"""Relais evenements de domaine -> analytics (idempotent via event_id)."""
from apps.analytics.events import track
from apps.core.outbox import subscribe

_MAP = {
    "UserRegistered": ("user_registered", "user"),
    "PostCreated": ("post_created", "post"),
    "PostLiked": ("post_liked", "post"),
    "MessageSent": ("message_sent", "message"),
    "FriendshipCreated": ("friendship_created", "friendship"),
    "CourseEnrolled": ("course_started", "enrollment"),
    "ChapterCompleted": ("lesson_completed", "chapter"),
    "OrderPaid": ("purchase_completed", "order"),
    "JobApplied": ("job_applied", "application"),
}


def _make(event_name, code, target_type):
    @subscribe(event_name)
    def handler(ev):
        actor = ev.payload.get("author") or ev.payload.get("user") or ev.payload.get("sender") or ev.payload.get("buyer") or (ev.aggregate_id if target_type == "user" else None)
        track(code, actor_id=actor, target_type=target_type, target_id=ev.aggregate_id, metadata={"correlation_id": ev.correlation_id, **({"users": ev.payload["users"]} if "users" in ev.payload else {})}, event_id=str(ev.event_id))
    return handler


for _name, (_code, _tt) in _MAP.items():
    _make(_name, _code, _tt)
