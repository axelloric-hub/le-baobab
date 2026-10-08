from apps.core.api import route
from apps.progress import api

urlpatterns = [
    route("chapters/<uuid:chapter_id>/progress/", POST=api.record_progress),
    route("me/certificates/", GET=api.my_certificates),
    route("public/certificates/<str:code>/", GET=api.verify_certificate),
]
