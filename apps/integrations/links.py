"""Analyse STRICTE des liens (YouTube, LinkedIn, GitHub). Aucun acces reseau ici : on ne fait que reconnaitre l'URL, en extraire
l'identifiant et reconstruire NOUS-MEMES l'adresse canonique et l'adresse d'integration. Ainsi une URL saisie par un utilisateur
ne peut jamais devenir une adresse arbitraire affichee dans un <iframe> (liste blanche d'hotes, identifiants valides par expression reguliere).

Ce qui est lu dans l'application :
 - YouTube : lecteur officiel (youtube-nocookie.com/embed), sans quitter l'application ;
 - GitHub / LinkedIn : lien + metadonnees ; aucun lecteur integre n'existe pour eux."""
from __future__ import annotations

import re
from urllib.parse import parse_qs, urlsplit

from apps.core.exceptions import DomainError

_YT_ID = re.compile(r"^[A-Za-z0-9_-]{11}$")
_YT_LIST = re.compile(r"^[A-Za-z0-9_-]{10,60}$")
_YT_HOSTS = {"youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "www.youtube-nocookie.com", "youtube-nocookie.com"}
_LI_HANDLE = re.compile(r"^[A-Za-z0-9%_.-]{2,100}$")
_GH_USER = re.compile(r"^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$")
SUPPORTED = "YouTube, LinkedIn ou GitHub"


def _split(url: str):
    """Decoupe et refuse tout ce qui est louche : schema autre que http(s), identifiants dans l'URL, port non standard."""
    if not isinstance(url, str) or len(url) > 600:
        raise DomainError("Lien invalide.", code="invalid_link")
    parts = urlsplit(url.strip())
    if parts.scheme not in ("http", "https") or not parts.hostname or parts.username or parts.password:
        raise DomainError("Lien invalide : il doit commencer par https://", code="invalid_link")
    if parts.port not in (None, 80, 443):
        raise DomainError("Lien invalide.", code="invalid_link")
    return parts


def _start_seconds(raw: str | None) -> int:
    """'90', '90s', '1m30s', '1h2m3s' -> secondes (borne a 12 h)."""
    if not raw:
        return 0
    m = re.fullmatch(r"(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?", raw.strip().lower())
    if not m or not any(m.groups()):
        return 0
    h, mn, s = (int(x or 0) for x in m.groups())
    return min(h * 3600 + mn * 60 + s, 12 * 3600)


def parse_youtube(url: str) -> dict | None:
    parts = _split(url)
    host = parts.hostname.lower()
    if host not in _YT_HOSTS:
        return None
    qs = parse_qs(parts.query)
    segs = [p for p in parts.path.split("/") if p]
    video_id = None
    if host == "youtu.be":
        video_id = segs[0] if segs else None
    elif segs[:1] == ["watch"]:
        video_id = (qs.get("v") or [None])[0]
    elif len(segs) >= 2 and segs[0] in ("shorts", "embed", "live", "v"):
        video_id = segs[1]
    if video_id and _YT_ID.match(video_id):
        start = _start_seconds((qs.get("t") or qs.get("start") or [None])[0])
        embed = f"https://www.youtube-nocookie.com/embed/{video_id}?rel=0" + (f"&start={start}" if start else "")
        return {"provider": "youtube", "kind": "video", "video_id": video_id, "start_seconds": start,
                "canonical_url": f"https://www.youtube.com/watch?v={video_id}", "embed_url": embed,
                "thumbnail_url": f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg"}
    playlist = (qs.get("list") or [None])[0]
    if segs[:1] == ["playlist"] and playlist and _YT_LIST.match(playlist):
        return {"provider": "youtube", "kind": "playlist", "playlist_id": playlist, "canonical_url": f"https://www.youtube.com/playlist?list={playlist}",
                "embed_url": f"https://www.youtube-nocookie.com/embed/videoseries?list={playlist}", "thumbnail_url": None}
    raise DomainError("Lien YouTube non reconnu : collez l'adresse d'une video (youtube.com/watch?v=..., youtu.be/..., /shorts/...).", code="invalid_youtube_link")


def parse_linkedin(url: str) -> dict | None:
    parts = _split(url)
    host = parts.hostname.lower()
    if host != "linkedin.com" and not host.endswith(".linkedin.com"):
        return None
    segs = [p for p in parts.path.split("/") if p]
    kinds = {"in": "profile", "company": "company", "school": "school"}
    if len(segs) >= 2 and segs[0] in kinds and _LI_HANDLE.match(segs[1]):
        return {"provider": "linkedin", "kind": kinds[segs[0]], "handle": segs[1], "canonical_url": f"https://www.linkedin.com/{segs[0]}/{segs[1]}/", "embed_url": None}
    raise DomainError("Lien LinkedIn non reconnu : collez l'adresse de votre profil (linkedin.com/in/votre-nom).", code="invalid_linkedin_link")


def parse_github(url: str) -> dict | None:
    from apps.integrations import github

    parts = _split(url)
    if parts.hostname.lower() not in ("github.com", "www.github.com"):
        return None
    segs = [p for p in parts.path.split("/") if p]
    # accepte aussi github.com/proprietaire/depot/tree/main/... : on ne garde que proprietaire/depot
    repo = github.parse_repo_url(f"https://github.com/{segs[0]}/{segs[1]}") if len(segs) >= 2 else None
    if repo:
        return {"provider": "github", "kind": "repository", "owner": repo[0], "repo": repo[1], "canonical_url": f"https://github.com/{repo[0]}/{repo[1]}", "embed_url": None}
    if len(segs) == 1 and _GH_USER.match(segs[0]):
        return {"provider": "github", "kind": "profile", "handle": segs[0], "canonical_url": f"https://github.com/{segs[0]}", "embed_url": None}
    raise DomainError("Lien GitHub non reconnu : collez l'adresse d'un depot (github.com/proprietaire/depot).", code="invalid_github_link")


def resolve(url: str) -> dict:
    """Reconnait le fournisseur d'un lien ou refuse."""
    for parser in (parse_youtube, parse_linkedin, parse_github):
        out = parser(url)
        if out is not None:
            return out
    raise DomainError(f"Lien non pris en charge : seuls les liens {SUPPORTED} sont acceptes ici.", code="unsupported_link")


def resolve_for(provider: str, url: str) -> dict:
    """Comme resolve(), mais exige un fournisseur precis (ex: un lien « LinkedIn » doit etre un vrai lien LinkedIn)."""
    parser = {"youtube": parse_youtube, "linkedin": parse_linkedin, "github": parse_github}[provider]
    out = parser(url)
    if out is None:
        raise DomainError(f"Ce lien n'est pas un lien {provider.capitalize() if provider != 'linkedin' else 'LinkedIn'}.", code="link_provider_mismatch")
    return out
