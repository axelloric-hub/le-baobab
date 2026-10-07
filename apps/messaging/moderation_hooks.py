from django.utils import timezone

from apps.moderation import registry
from apps.moderation.registry import ModerationHooks
from apps.messaging.models import Message


def register_hooks() -> None:
    registry.register("message", ModerationHooks(
        hide=lambda pk: Message.objects.filter(pk=pk).update(deleted_at=timezone.now(), deletion_reason="hidden by moderation"),
        remove=lambda pk: Message.objects.filter(pk=pk).update(deleted_at=timezone.now(), deletion_reason="removed by moderation"),
        restore=lambda pk: Message.objects.filter(pk=pk).update(deleted_at=None, deletion_reason=""),
        owner_of=lambda pk: Message.objects.filter(pk=pk).values_list("sender_id", flat=True).first()))
