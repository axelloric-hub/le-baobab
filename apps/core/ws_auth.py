"""Auth WebSocket par JWT (query ?token= ou sous-protocole). Le frontend n'est jamais cru sur parole."""
from __future__ import annotations

from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.contrib.auth.models import AnonymousUser


@database_sync_to_async
def _user_from_token(raw: str):
    from rest_framework_simplejwt.authentication import JWTAuthentication
    from rest_framework_simplejwt.exceptions import TokenError, InvalidToken

    auth = JWTAuthentication()
    try:
        return auth.get_user(auth.get_validated_token(raw))
    except (TokenError, InvalidToken, Exception):  # noqa: BLE001
        return AnonymousUser()


class JWTAuthMiddleware(BaseMiddleware):
    async def __call__(self, scope, receive, send):
        token = parse_qs(scope.get("query_string", b"").decode()).get("token", [None])[0]
        scope["user"] = await _user_from_token(token) if token else AnonymousUser()
        return await super().__call__(scope, receive, send)


class EdgeSecretASGIMiddleware:
    """Pendant WebSocket de EdgeSecretMiddleware : refuse les connexions qui ne passent pas par le Worker."""

    def __init__(self, inner):
        self.inner = inner

    async def __call__(self, scope, receive, send):
        from django.conf import settings
        import hmac

        secret = settings.EDGE_SHARED_SECRET.encode()
        if secret and scope["type"] == "websocket":
            headers = dict(scope.get("headers", []))
            if not hmac.compare_digest(headers.get(b"x-edge-secret", b""), secret):
                await receive()  # consomme 'websocket.connect' puis refuse
                await send({"type": "websocket.close", "code": 4403})
                return
        return await self.inner(scope, receive, send)
