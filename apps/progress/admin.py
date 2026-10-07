from django.contrib import admin

from apps.core.admin_utils import register_readable
from apps.progress.models import Certificate, CertificateTemplate, CertificateVerification, ChapterProgress


@admin.register(Certificate)
class CertificateAdmin(admin.ModelAdmin):
    """Certificats : lecture seule (emission automatique, revocation tracee via le service)."""

    list_display = ("verification_code", "user", "course", "score_percent", "issued_at", "revoked_at")
    search_fields = ("verification_code", "user__username", "course__title")
    raw_id_fields = ("user", "course", "template")
    ordering = ("-issued_at",)

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


register_readable(ChapterProgress, search=("user__username",), filters=("status",))
register_readable(CertificateTemplate, search=("name",))
register_readable(CertificateVerification, filters=(), allow_add=False)
