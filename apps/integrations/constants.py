"""Liste blanche d'hotes d'embed OFFICIELS. Aucun contournement d'API/DRM/auth : on n'affiche que les contenus
exposes par les mecanismes officiels (oEmbed, iframe player, API avec OAuth consenti)."""
ALLOWED_EMBED_HOSTS: dict[str, tuple[str, ...]] = {
    "tiktok": ("www.tiktok.com",),
    "youtube": ("www.youtube.com", "www.youtube-nocookie.com"),
    "github": (),   # pas d'embed : lien + metadonnees via API REST
    "gitlab": (),
    "linkedin": ("www.linkedin.com",),
}
