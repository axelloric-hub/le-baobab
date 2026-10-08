from apps.core.api import route
from apps.notifications import api

urlpatterns = [
    route("notifications/", GET=api.list_notifications),
    route("notifications/unread-count/", GET=api.unread_count),
    route("notifications/read/", POST=api.mark_read),
    route("notifications/preferences/", GET=api.preferences, PUT=api.set_preference),
]
