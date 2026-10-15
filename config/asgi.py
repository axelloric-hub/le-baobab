import os

from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")
django_asgi_app = get_asgi_application()

from channels.routing import ProtocolTypeRouter, URLRouter  # noqa: E402
from channels.security.websocket import OriginValidator  # noqa: E402

from apps.core.ws_auth import EdgeSecretASGIMiddleware, JWTAuthMiddleware  # noqa: E402
from django.conf import settings  # noqa: E402

from config.routing import websocket_urlpatterns  # noqa: E402

application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        "websocket": EdgeSecretASGIMiddleware(OriginValidator(JWTAuthMiddleware(URLRouter(websocket_urlpatterns)), settings.WS_ALLOWED_ORIGINS)),
    }
)
