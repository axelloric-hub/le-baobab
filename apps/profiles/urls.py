from apps.core.api import route
from apps.profiles import api

urlpatterns = [
    route("me/", GET=api.me),
    route("me/profile/", PATCH=api.update_profile),
    route("me/privacy/", PATCH=api.update_privacy),
    route("me/preferences/", PATCH=api.update_preferences),
    route("me/skills/", PUT=api.replace_skills),
    route("me/interests/", PUT=api.replace_interests),
    route("me/links/", POST=api.add_link),
    route("me/links/<uuid:link_id>/", DELETE=api.delete_link),
    route("me/delete/", POST=api.delete_account),
    route("users/", GET=api.search_users),
    route("users/<str:username>/", GET=api.user_profile),
    route("skills/", GET=api.list_skills),
    route("interests/", GET=api.list_interests),
    route("professions/", GET=api.list_professions),
    route("countries/", GET=api.list_countries),
]
