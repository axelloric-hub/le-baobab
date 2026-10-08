from apps.core.api import route
from apps.jobs import api

urlpatterns = [
    route("jobs/", GET=api.list_jobs, POST=api.create_job),
    route("jobs/<uuid:job_id>/", GET=api.get_job),
    route("jobs/<uuid:job_id>/publish/", POST=api.publish_job),
    route("jobs/<uuid:job_id>/close/", POST=api.close_job),
    route("jobs/<uuid:job_id>/apply/", POST=api.apply),
    route("jobs/<uuid:job_id>/applications/", GET=api.job_applications),
    route("jobs/<uuid:job_id>/slots/", GET=api.list_slots, POST=api.create_slot),
    route("jobs/<uuid:job_id>/proposals/", GET=api.job_proposals, POST=api.submit_proposal),
    route("me/applications/", GET=api.my_applications),
    route("applications/<uuid:application_id>/", GET=api.get_application),
    route("applications/<uuid:application_id>/transition/", POST=api.transition),
    route("applications/<uuid:application_id>/book/", POST=api.book),
    route("applications/<uuid:application_id>/offer/", POST=api.make_offer),
    route("me/offers/", GET=api.my_offers),
    route("offers/<uuid:offer_id>/respond/", POST=api.respond_offer),
    route("me/freelancer-profile/", GET=api.my_freelancer, PUT=api.put_freelancer),
    route("me/proposals/", GET=api.my_proposals),
    route("proposals/<uuid:proposal_id>/accept/", POST=api.accept_proposal),
    route("me/contracts/", GET=api.my_contracts),
    route("contracts/<uuid:contract_id>/", GET=api.get_contract),
    route("contracts/<uuid:contract_id>/terminate/", POST=api.terminate),
    route("milestones/<uuid:milestone_id>/advance/", POST=api.advance_milestone),
]
