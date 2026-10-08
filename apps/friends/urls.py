from apps.core.api import route
from apps.friends import api

urlpatterns = [
    route("friends/", GET=api.friends),
    route("friends/requests/", GET=api.incoming_requests, POST=api.send_request),
    route("friends/requests/sent/", GET=api.sent_requests),
    route("friends/requests/<uuid:request_id>/respond/", POST=api.respond),
    route("friends/<str:username>/", DELETE=api.remove_friend),
    route("users/<str:username>/follow/", POST=api.follow, DELETE=api.unfollow),
    route("users/<str:username>/block/", POST=api.block, DELETE=api.unblock),
    route("users/<str:username>/close-friend/", POST=api.add_close, DELETE=api.remove_close),
    route("users/<str:username>/mute/", POST=api.mute),
    route("me/followers/", GET=api.followers),
    route("me/following/", GET=api.following),
    route("me/blocks/", GET=api.blocks),
]
