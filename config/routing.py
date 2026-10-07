"""Routes WebSocket : chaque app expose son routing.py, agrege ici."""
from apps.messaging.routing import websocket_urlpatterns as messaging_ws
from apps.notifications.routing import websocket_urlpatterns as notifications_ws

websocket_urlpatterns = [*messaging_ws, *notifications_ws]
