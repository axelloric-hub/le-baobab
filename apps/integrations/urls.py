from apps.core.api import route
from apps.integrations import api

urlpatterns = [
    route("integrations/providers/", GET=api.providers),
    route("me/integrations/", GET=api.my_accounts),
    route("me/integrations/<uuid:account_id>/", DELETE=api.disconnect),
    route("me/integrations/github/connect/", POST=api.github_connect),
    route("auth/github/start/", GET=api.github_start),
    route("auth/github/callback/", GET=api.github_callback),
    route("auth/github/exchange/", POST=api.github_exchange),
    route("media/resolve/", POST=api.resolve_link),
]
