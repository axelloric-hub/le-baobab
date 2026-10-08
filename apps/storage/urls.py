from apps.core.api import route
from apps.storage import api

urlpatterns = [
    route("files/purposes/", GET=api.purposes),
    route("files/uploads/", POST=api.request_upload),
    route("files/", GET=api.my_files),
    route("files/<uuid:file_id>/complete/", POST=api.complete_upload),
    route("files/<uuid:file_id>/url/", GET=api.file_url),
    route("files/<uuid:file_id>/", DELETE=api.delete_file),
]
