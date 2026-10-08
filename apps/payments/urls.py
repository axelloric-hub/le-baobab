from apps.core.api import route
from apps.payments import api

urlpatterns = [
    route("payments/start/", POST=api.start),
    route("payments/<uuid:payment_id>/simulate/", POST=api.simulate),
    route("payments/webhooks/<slug:provider>/", POST=api.webhook),
    route("orders/<uuid:order_id>/pay-free/", POST=api.pay_free),
    route("refunds/", POST=api.request_refund),
    route("me/refunds/", GET=api.my_refunds),
    route("admin/refunds/", GET=api.admin_refunds),
    route("admin/refunds/<uuid:refund_id>/decision/", POST=api.decide_refund),
    route("admin/ledger/orders/<uuid:order_id>/", GET=api.ledger),
]
