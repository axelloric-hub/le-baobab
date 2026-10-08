from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from apps.core.internal import InternalJobView
from apps.core.views import HealthView, ReadinessView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("health/", HealthView.as_view(), name="health"),
    path("ready/", ReadinessView.as_view(), name="ready"),
    path("internal/jobs/<slug:name>/", InternalJobView.as_view(), name="internal-job"),
    path("api/v1/", include("apps.accounts.urls")),
    path("api/v1/", include("apps.core.admin_api")),
    path("api/v1/", include("apps.storage.urls")),
    path("api/v1/", include("apps.profiles.urls")),
    path("api/v1/", include("apps.friends.urls")),
    path("api/v1/", include("apps.community.urls")),
    path("api/v1/", include("apps.messaging.urls")),
    path("api/v1/", include("apps.social.urls")),
    path("api/v1/", include("apps.notifications.urls")),
    path("api/v1/", include("apps.moderation.urls")),
    path("api/v1/", include("apps.education.urls")),
    path("api/v1/", include("apps.assessments.urls")),
    path("api/v1/", include("apps.progress.urls")),
    path("api/v1/", include("apps.marketplace.urls")),
    path("api/v1/", include("apps.payments.urls")),
    path("api/v1/", include("apps.companies.urls")),
    path("api/v1/", include("apps.portfolio.urls")),
    path("api/v1/", include("apps.jobs.urls")),
    path("api/v1/", include("apps.advertising.urls")),
    path("api/v1/", include("apps.analytics.urls")),
    path("api/v1/", include("apps.integrations.urls")),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="docs"),
]
