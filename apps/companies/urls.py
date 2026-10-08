from apps.companies import api
from apps.core.api import route

urlpatterns = [
    route("companies/", POST=api.create),
    route("me/companies/", GET=api.mine),
    route("companies/<slug:slug>/", GET=api.detail, PATCH=api.update),
    route("companies/<slug:slug>/members/", GET=api.members, POST=api.add_member),
    route("companies/<slug:slug>/members/<str:username>/", PATCH=api.change_role, DELETE=api.remove_member),
    route("companies/<slug:slug>/verification/", POST=api.submit_verification),
    route("companies/<slug:slug>/links/", POST=api.add_link),
    route("companies/<slug:slug>/projects/", POST=api.add_project),
    route("companies/<slug:slug>/services/", POST=api.add_service),
    route("admin/company-verifications/", GET=api.verification_queue),
    route("admin/company-verifications/<uuid:verification_id>/review/", POST=api.review_verification),
]
