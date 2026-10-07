"""Enregistre les hooks de moderation du domaine social (posts, commentaires)."""
from apps.moderation import registry
from apps.moderation.registry import ModerationHooks
from apps.social.models import Comment, Post


def _set_post_status(pk, status):
    Post.objects.filter(pk=pk).update(status=status)


def _owner(model):
    def inner(pk):
        return model.objects.filter(pk=pk).values_list("author_id", flat=True).first()
    return inner


def register_hooks() -> None:
    registry.register("post", ModerationHooks(
        hide=lambda pk: _set_post_status(pk, Post.Status.HIDDEN),
        remove=lambda pk: _set_post_status(pk, Post.Status.REMOVED),
        restore=lambda pk: _set_post_status(pk, Post.Status.PUBLISHED),
        owner_of=_owner(Post)))
    from django.utils import timezone

    registry.register("comment", ModerationHooks(
        hide=lambda pk: Comment.objects.filter(pk=pk).update(deleted_at=timezone.now(), deletion_reason="hidden by moderation"),
        remove=lambda pk: Comment.objects.filter(pk=pk).update(deleted_at=timezone.now(), deletion_reason="removed by moderation"),
        restore=lambda pk: Comment.objects.filter(pk=pk).update(deleted_at=None, deletion_reason=""),
        owner_of=_owner(Comment)))
