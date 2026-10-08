from django.utils import timezone

from apps.moderation import registry
from apps.moderation.registry import ModerationHooks
from apps.marketplace.models import Product


def register_hooks() -> None:
    def hide(pk): Product.objects.filter(pk=pk).update(status="suspended")
    def remove(pk): Product.objects.filter(pk=pk).update(status="archived")
    def restore(pk): Product.objects.filter(pk=pk).update(status="published", published_at=timezone.now())
    registry.register("product", ModerationHooks(hide=hide, remove=remove, restore=restore,
                                                 owner_of=lambda pk: Product.objects.filter(pk=pk).values_list("store__owner_id", flat=True).first()))
