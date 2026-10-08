from apps.community import api
from apps.core.api import route

urlpatterns = [
    route("groups/", GET=api.list_groups, POST=api.create_group),
    route("me/groups/", GET=api.my_groups),
    route("me/group-invitations/", GET=api.my_invitations),
    route("group-invitations/<uuid:invitation_id>/respond/", POST=api.respond_invitation),
    route("group-join-requests/<uuid:request_id>/review/", POST=api.review_request),
    route("groups/<slug:slug>/", GET=api.group_detail),
    route("groups/<slug:slug>/join/", POST=api.join),
    route("groups/<slug:slug>/leave/", POST=api.leave),
    route("groups/<slug:slug>/members/", GET=api.members),
    route("groups/<slug:slug>/invite/", POST=api.invite),
    route("groups/<slug:slug>/join-requests/", GET=api.join_requests),
    route("groups/<slug:slug>/ban/", POST=api.ban),
    route("groups/<slug:slug>/mute/", POST=api.mute_member),
    route("groups/<slug:slug>/channels/", GET=api.channels, POST=api.create_channel),
    route("communities/", GET=api.communities, POST=api.create_community),
]
