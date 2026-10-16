from apps.core.api import route
from apps.portfolio import api

urlpatterns = [
    route("me/portfolio/", GET=api.my_portfolio, PATCH=api.update_portfolio),
    route("users/<str:username>/portfolio/", GET=api.user_portfolio),
    route("me/portfolio/projects/", POST=api.add_project),
    route("me/portfolio/projects/<uuid:project_id>/", PATCH=api.update_project, DELETE=api.delete_project),
    route("me/portfolio/projects/<uuid:project_id>/links/", POST=api.add_link),
    route("me/portfolio/projects/<uuid:project_id>/links/<uuid:link_id>/", DELETE=api.remove_link),
    route("me/portfolio/projects/<uuid:project_id>/media/", POST=api.add_media),
    route("me/portfolio/projects/<uuid:project_id>/media/<uuid:media_id>/", DELETE=api.remove_media),
    route("showcase/projects/", GET=api.showcase_projects),
    route("showcase/projects/<uuid:project_id>/", GET=api.showcase_project),
    route("showcase/technologies/", GET=api.showcase_technologies),
    route("me/portfolio/repositories/", POST=api.add_repository),
    route("me/portfolio/repositories/from-url/", POST=api.add_repository_from_url),
    route("me/portfolio/experiences/", POST=api.add_experience),
    route("me/portfolio/educations/", POST=api.add_education),
    route("me/portfolio/achievements/", POST=api.add_achievement),
    route("me/portfolio/certificates/", POST=api.add_certificate),
    route("me/portfolio/<slug:kind>/<uuid:entry_id>/", DELETE=api.delete_entry),
]
