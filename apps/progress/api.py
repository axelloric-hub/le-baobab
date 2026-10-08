from __future__ import annotations

from rest_framework import serializers as s

from apps.core.api import client_ip, endpoint, get_or_404
from apps.education.models import Chapter
from apps.progress import services as P
from apps.progress.models import Certificate


@endpoint("Enregistrer ma progression dans un chapitre (le pourcentage ne recule jamais ; 100 = chapitre termine ; le temps est plafonne a 1 h par appel).",
          body={"percent": s.IntegerField(min_value=0, max_value=100), "seconds": s.IntegerField(min_value=0, max_value=3600, default=0)})
def record_progress(request, chapter_id):
    cp = P.record_progress(request.user, chapter_id, percent=request.input["percent"], seconds=request.input["seconds"])
    ch = Chapter.objects.select_related("module__course").get(pk=chapter_id)
    return {"status": cp.status, "percent": cp.percent, "time_spent_seconds": cp.time_spent_seconds, "course": P.course_progress(request.user, ch.module.course)}


@endpoint("Mes certificats.")
def my_certificates(request):
    qs = Certificate.objects.filter(user=request.user, revoked_at__isnull=True).select_related("course")
    return [{"id": str(c.pk), "course": c.course.title, "verification_code": c.verification_code, "score_percent": float(c.score_percent) if c.score_percent is not None else None, "issued_at": c.issued_at} for c in qs]


@endpoint("Verifier PUBLIQUEMENT un certificat par son code (limite par adresse IP). Ne renvoie aucune donnee privee.", auth="public")
def verify_certificate(request, code):
    return P.verify_certificate(code, ip=client_ip(request))
