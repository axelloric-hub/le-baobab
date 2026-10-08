from apps.core.api import route
from apps.integrations import api

urlpatterns = [
    route("integrations/providers/", GET=api.providers),
    route("me/integrations/", GET=api.my_accounts),
    route("me/integrations/<uuid:account_id>/", DELETE=api.disconnect),
]
