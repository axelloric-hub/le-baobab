"""WebSocket de chat. Autorisation verifiee en base a la connexion ; present/typing dans Redis ; la
persistance des messages passe TOUJOURS par l'API/service (le socket ne fait que diffuser et signaler)."""
from __future__ import annotations

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer

from apps.core import redis as R
from apps.messaging import selectors


class ChatConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        user = self.scope["user"]
        self.conversation_id = self.scope["url_route"]["kwargs"]["conversation_id"]
        if not user.is_authenticated or not await database_sync_to_async(selectors.is_member)(user.pk, self.conversation_id):
            await self.close(code=4403)
            return
        self.group = f"conv.{self.conversation_id}"
        await self.channel_layer.group_add(self.group, self.channel_name)
        await self.accept()
        await database_sync_to_async(R.heartbeat)(user.pk)

    async def disconnect(self, code):
        if hasattr(self, "group"):
            await self.channel_layer.group_discard(self.group, self.channel_name)

    async def receive_json(self, content, **kwargs):
        user = self.scope["user"]
        kind = content.get("type")
        if kind == "heartbeat":
            await database_sync_to_async(R.heartbeat)(user.pk)
        elif kind == "typing":
            allowed, _, _ = await database_sync_to_async(R.rate_limit)("ws.typing", user.pk, 10, 5)
            if allowed:
                await database_sync_to_async(R.set_typing)(self.conversation_id, user.pk)
                await self.channel_layer.group_send(self.group, {"type": "chat.typing", "user": str(user.pk)})

    async def chat_message(self, event):
        await self.send_json({"type": "message", "message_id": event["message_id"], "seq": event["seq"], "sender": event["sender"]})

    async def chat_typing(self, event):
        if event["user"] != str(self.scope["user"].pk):
            await self.send_json({"type": "typing", "user": event["user"]})
