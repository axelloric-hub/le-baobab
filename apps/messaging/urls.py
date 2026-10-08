from apps.core.api import route
from apps.messaging import api

urlpatterns = [
    route("conversations/", GET=api.inbox),
    route("conversations/direct/", POST=api.open_direct),
    route("conversations/group/", POST=api.create_group_conversation),
    route("conversations/<uuid:conversation_id>/messages/", GET=api.history, POST=api.send),
    route("conversations/<uuid:conversation_id>/messages/<uuid:message_id>/thread/", GET=api.thread),
    route("conversations/<uuid:conversation_id>/read/", POST=api.mark_read),
    route("messages/<uuid:message_id>/", PATCH=api.edit, DELETE=api.delete),
    route("messages/<uuid:message_id>/reactions/", POST=api.react),
]
