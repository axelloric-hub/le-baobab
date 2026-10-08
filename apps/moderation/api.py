from __future__ import annotations

from rest_framework import serializers as s

from apps.core.api import endpoint, get_or_404, paginate
from apps.moderation import services as MV
from apps.moderation.models import ModerationCase, ReportReason


@endpoint("Motifs de signalement.", auth="public")
def reasons(request):
    return [{"code": r.code, "label": r.label} for r in ReportReason.objects.filter(is_active=True)]


@endpoint("Signaler un contenu ou un utilisateur (un meme signalement n'est pas compte deux fois).", status=201,
          body={"target_type": s.CharField(max_length=40), "target_id": s.UUIDField(), "reason": s.CharField(max_length=40), "details": s.CharField(max_length=1000, required=False, allow_blank=True, default="")})
def report(request):
    d = request.input
    r = MV.report_content(reporter=request.user, target_type=d["target_type"], target_id=d["target_id"], reason_code=d["reason"], details=d["details"])
    return {"id": str(r.pk), "status": "received"}


@endpoint("[Moderation] File des dossiers.", auth="staff", query={"status": s.ChoiceField(choices=["open", "in_review", "resolved"], default="open")})
def cases(request):
    qs = ModerationCase.objects.filter(status=request.q["status"]).select_related("subject_user")
    return paginate(request, qs, ("-priority", "-opened_at", "-id"), lambda c: {"id": str(c.pk), "subject_type": c.subject_type, "subject_id": str(c.subject_id), "priority": c.priority,
                                                                              "subject_user": c.subject_user.username if c.subject_user_id else None, "opened_at": c.opened_at}, 30)


@endpoint("[Moderation] Appliquer une decision (masquer, retirer, avertir, suspendre, bannir...).", auth="staff",
          body={"action": s.CharField(max_length=30), "reason": s.CharField(max_length=500), "expires_at": s.DateTimeField(required=False), "policy_code": s.CharField(max_length=40, required=False, default=""),
                "points": s.IntegerField(min_value=0, max_value=10, required=False, default=0)})
def decide(request, case_id):
    d = request.input
    case = get_or_404(ModerationCase.objects.filter(pk=case_id))
    a = MV.apply_action(moderator=request.user, case=case, action=d["action"], reason=d["reason"], expires_at=d.get("expires_at"), policy_code=d["policy_code"], points=d["points"])
    return {"action_id": str(a.pk), "case_status": ModerationCase.objects.get(pk=case.pk).status}
