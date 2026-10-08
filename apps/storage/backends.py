"""Backends de stockage. S3Backend : tout bucket compatible S3 (Cloudflare R2, Supabase Storage...). FakeBackend : tests et essais SANS bucket."""
from __future__ import annotations

from functools import lru_cache
from typing import Protocol

from django.conf import settings


class Backend(Protocol):
    def presign_put(self, key: str, content_type: str, size: int, ttl: int) -> tuple[str, dict]: ...
    def presign_get(self, key: str, ttl: int, filename: str | None = None) -> str: ...
    def head(self, key: str) -> dict | None: ...
    def delete(self, key: str) -> None: ...


class S3Backend:
    def __init__(self) -> None:
        import boto3
        from botocore.config import Config

        self.bucket = settings.STORAGE_BUCKET
        self.client = boto3.client(
            "s3", endpoint_url=settings.STORAGE_ENDPOINT_URL or None, aws_access_key_id=settings.STORAGE_ACCESS_KEY_ID, aws_secret_access_key=settings.STORAGE_SECRET_ACCESS_KEY,
            region_name=settings.STORAGE_REGION, config=Config(signature_version="s3v4", s3={"addressing_style": "path"}, connect_timeout=5, read_timeout=10, retries={"max_attempts": 2}))

    def presign_put(self, key: str, content_type: str, size: int, ttl: int) -> tuple[str, dict]:
        # Type ET taille sont SIGNES : le bucket refuse tout envoi qui differe de ce que l'API a autorise.
        url = self.client.generate_presigned_url("put_object", Params={"Bucket": self.bucket, "Key": key, "ContentType": content_type, "ContentLength": size}, ExpiresIn=ttl)
        return url, {"Content-Type": content_type}

    def presign_get(self, key: str, ttl: int, filename: str | None = None) -> str:
        params = {"Bucket": self.bucket, "Key": key}
        if filename:
            params["ResponseContentDisposition"] = f'attachment; filename="{filename}"'
        return self.client.generate_presigned_url("get_object", Params=params, ExpiresIn=ttl)

    def head(self, key: str) -> dict | None:
        from botocore.exceptions import ClientError

        try:
            r = self.client.head_object(Bucket=self.bucket, Key=key)
        except ClientError as exc:
            if exc.response.get("Error", {}).get("Code") in ("404", "NoSuchKey", "NotFound"):
                return None
            raise
        return {"size": int(r["ContentLength"]), "content_type": r.get("ContentType", "")}

    def delete(self, key: str) -> None:
        self.client.delete_object(Bucket=self.bucket, Key=key)


class FakeBackend:
    """En memoire. `simulate_upload` imite le client qui envoie le fichier ; STORAGE_FAKE_AUTO_COMPLETE accepte la fin d'envoi sans objet."""

    objects: dict[str, dict] = {}
    expected: dict[str, dict] = {}

    def presign_put(self, key, content_type, size, ttl):
        self.expected[key] = {"size": size, "content_type": content_type}
        return f"https://fake-bucket.invalid/put/{key}?expires={ttl}&sig=fake", {"Content-Type": content_type}

    def presign_get(self, key, ttl, filename=None):
        return f"https://fake-bucket.invalid/get/{key}?expires={ttl}&sig=fake"

    def head(self, key):
        if key in self.objects:
            return self.objects[key]
        if settings.STORAGE_FAKE_AUTO_COMPLETE and key in self.expected:
            return dict(self.expected[key])
        return None

    def delete(self, key):
        self.objects.pop(key, None)

    @classmethod
    def simulate_upload(cls, key: str, size: int, content_type: str) -> None:
        cls.objects[key] = {"size": size, "content_type": content_type}

    @classmethod
    def reset(cls) -> None:
        cls.objects, cls.expected = {}, {}


@lru_cache(maxsize=1)
def _s3() -> S3Backend:
    return S3Backend()


def get_backend() -> Backend:
    return FakeBackend() if settings.STORAGE_BACKEND == "fake" else _s3()
