"""Un achat (marketplace) debloque du contenu : reaction a l'EVENEMENT OrderPaid, sans import des modeles de commerce. Idempotent (grant_key)."""
import logging

from apps.accounts.models import User
from apps.core.outbox import subscribe
from apps.education import services as E
from apps.education.models import Chapter, Classroom, Course, Module

log = logging.getLogger(__name__)
_MODELS = {"classroom": Classroom, "course": Course, "module": Module, "chapter": Chapter}


@subscribe("OrderPaid")
def grant_purchased_access(ev):
    buyer = User.objects.get(pk=ev.payload["buyer"])
    for item in ev.payload["items"]:
        for ent in item["entitlements"]:
            target = _MODELS[ent["scope"]].objects.filter(pk=ent["target_id"]).first()
            if target is None:
                log.warning("entitlement target missing: %s", ent)
                continue
            E.grant_entitlement(buyer, ent["scope"], target, source="purchase", source_ref=ev.aggregate_id,
                                grant_key=f"order:{item['item_id']}:{ent['scope']}:{ent['target_id']}")


@subscribe("OrderRefunded")
def revoke_refunded_access(ev):
    if ev.payload["fully_refunded_item"]:
        E.revoke_entitlements_by_prefix(f"order:{ev.payload['item_id']}:")
