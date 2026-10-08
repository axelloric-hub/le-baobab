from django.contrib import admin

from apps.core.admin_utils import register_readable
from apps.payments.models import LedgerEntry, Payment, Refund, WebhookEvent

for _model, _search, _filters in ((Payment, ("provider_ref", "order__number"), ("provider", "status")), (Refund, ("order_item__order__number",), ("status",)),
                                  (LedgerEntry, ("order__number",), ("account", "kind")), (WebhookEvent, ("event_id",), ("provider",))):
    # Tout le domaine financier est en LECTURE SEULE dans l'admin : grand livre, paiements et webhooks ne se modifient jamais a la main.
    register_readable(_model, search=_search, filters=_filters, readonly=[f.name for f in _model._meta.fields], allow_add=False, allow_delete=False)
