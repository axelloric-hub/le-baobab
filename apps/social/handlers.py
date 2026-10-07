"""Abonnements aux evenements de domaine (outbox) : projections Mongo + fan-out Redis. Idempotents (rejouables)."""
from apps.core.outbox import subscribe
from apps.social import feed


@subscribe("PostCreated")
def on_post_created(ev):
    feed.project_post_card(ev.aggregate_id)
    feed.fanout_post(ev.aggregate_id)


@subscribe("PostEdited")
def on_post_edited(ev):
    feed.project_post_card(ev.aggregate_id)


@subscribe("PostDeleted")
def on_post_deleted(ev):
    feed.delete_post_card(ev.aggregate_id)


@subscribe("PostLiked")
@subscribe("PostShared")
def on_counters_changed(ev):
    feed.update_card_counters(ev.aggregate_id)


@subscribe("CommentCreated")
def on_comment_created(ev):
    feed.update_card_counters(ev.payload["post"])
