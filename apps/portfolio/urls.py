from apps.core.api import route
from apps.portfolio import api

urlpatterns = [
    route("me/portfolio/", GET=api.my_portfolio, PATCH=api.update_portfolio),
    route("users/<str:username>/portfolio/", GET=api.user_portfolio),
    route("me/portfolio/projects/", POST=api.add_project),
    route("me/portfolio/projects/<uuid:project_id>/links/", POST=api.add_link),
    route("me/portfolio/projects/<uuid:project_id>/media/", POST=api.add_media),
    route("me/portfolio/repositories/", POST=api.add_repository),
    route("me/portfolio/experiences/", POST=api.add_experience),
    route("me/portfolio/educations/", POST=api.add_education),
    route("me/portfolio/achievements/", POST=api.add_achievement),
    route("me/portfolio/certificates/", POST=api.add_certificate),
    route("me/portfolio/<slug:kind>/<uuid:entry_id>/", DELETE=api.delete_entry),
]
