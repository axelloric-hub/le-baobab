from apps.core.api import route
from apps.social import api

urlpatterns = [
    route("posts/", POST=api.create_post),
    route("posts/<uuid:post_id>/", GET=api.get_post, PATCH=api.edit_post, DELETE=api.delete_post),
    route("users/<str:username>/posts/", GET=api.user_posts),
    route("feed/", GET=api.feed),
    route("posts/<uuid:post_id>/reactions/", POST=api.react_post),
    route("posts/<uuid:post_id>/comments/", GET=api.comments, POST=api.add_comment),
    route("comments/<uuid:comment_id>/replies/", GET=api.replies),
    route("comments/<uuid:comment_id>/", DELETE=api.delete_comment),
    route("comments/<uuid:comment_id>/reactions/", POST=api.react_comment),
    route("posts/<uuid:post_id>/share/", POST=api.share),
    route("posts/<uuid:post_id>/save/", POST=api.save, DELETE=api.unsave),
    route("me/saved/", GET=api.saved),
    route("posts/<uuid:post_id>/view/", POST=api.view_post),
    route("posts/<uuid:post_id>/poll/vote/", POST=api.vote),
    route("statuses/", GET=api.statuses, POST=api.create_status),
    route("statuses/<uuid:status_id>/view/", POST=api.view_status),
    route("statuses/<uuid:status_id>/react/", POST=api.react_status),
    route("hashtags/trending/", GET=api.trending),
    route("hashtags/<str:tag>/posts/", GET=api.hashtag_posts),
]
