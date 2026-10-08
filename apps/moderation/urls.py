from apps.core.api import route
from apps.moderation import api

urlpatterns = [
    route("reports/reasons/", GET=api.reasons),
    route("reports/", POST=api.report),
    route("admin/moderation/cases/", GET=api.cases),
    route("admin/moderation/cases/<uuid:case_id>/actions/", POST=api.decide),
]
