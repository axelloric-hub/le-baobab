from apps.advertising import api
from apps.core.api import route

urlpatterns = [
    route("ads/accounts/", POST=api.create_account),
    route("me/ads/accounts/", GET=api.my_accounts),
    route("admin/ads/accounts/<uuid:account_id>/topup/", POST=api.admin_topup),
    route("ads/campaigns/", GET=api.my_campaigns, POST=api.create_campaign),
    route("ads/campaigns/<uuid:campaign_id>/ad-sets/", POST=api.create_ad_set),
    route("ads/campaigns/<uuid:campaign_id>/activate/", POST=api.activate),
    route("ads/campaigns/<uuid:campaign_id>/pause/", POST=api.pause),
    route("ads/campaigns/<uuid:campaign_id>/stats/", GET=api.stats),
    route("ads/creatives/", POST=api.create_creative),
    route("ads/ad-sets/<uuid:ad_set_id>/ads/", POST=api.create_ad),
    route("ads/ads/<uuid:ad_id>/submit/", POST=api.submit_ad),
    route("admin/ads/review-queue/", GET=api.review_queue),
    route("admin/ads/<uuid:ad_id>/review/", POST=api.review_ad),
    route("ads/audiences/", POST=api.create_audience),
    route("ads/audiences/<uuid:audience_id>/members/", POST=api.audience_members),
    route("ads/serve/", GET=api.serve),
    route("ads/impressions/", POST=api.impression),
    route("ads/clicks/", POST=api.click),
    route("ads/conversions/", POST=api.conversion),
    route("me/ad-preferences/", GET=api.get_preferences, PUT=api.set_preferences),
]
