from apps.analytics import api
from apps.core.api import route

urlpatterns = [route("admin/metrics/platform-daily/", GET=api.platform_daily)]
