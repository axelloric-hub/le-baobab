"""Audit inalterable. AuditLog est APPEND-ONLY : un trigger SQL interdit UPDATE/DELETE (voir dbobjects).
Deux sources alimentent la meme table :
  1. triggers de ligne (`baobab_audit_row`) -> capture TOUTE modification, meme hors ORM ;
  2. services applicatifs (`audit.services.record`) -> actions metier avec contexte (IP, user-agent).
Les logs de requetes API (fort volume) vivent dans MongoDB (`api_request_logs`, TTL) et non ici."""
from __future__ import annotations

from django.conf import settings
from django.db import models
from django.utils import timezone

U = settings.AUTH_USER_MODEL


class AuditLog(models.Model):
    id = models.BigAutoField(primary_key=True)
    actor = models.ForeignKey(U, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    actor_label = models.CharField(max_length=150, blank=True)  # survit a l'anonymisation / suppression
    action = models.CharField(max_length=60)  # ex: user.update, order.refund
    object_type = models.CharField(max_length=80)  # nom de table ou type metier
    object_id = models.CharField(max_length=64)
    old_values = models.JSONField(null=True, blank=True)
    new_values = models.JSONField(null=True, blank=True)
    source = models.CharField(max_length=10, default="app")  # app | trigger
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=400, blank=True)
    correlation_id = models.CharField(max_length=64, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "audit_log"
        indexes = [
            models.Index(fields=["object_type", "object_id", "-created_at"], name="audit_object_idx"),
            models.Index(fields=["actor", "-created_at"], name="audit_actor_idx"),
            models.Index(fields=["correlation_id"], name="audit_corr_idx", condition=~models.Q(correlation_id="")),
            # BRIN (cree dans database/postgres/indexes) sur created_at : table append-only, correlation physique ~1.
        ]


class AdminAction(models.Model):
    id = models.BigAutoField(primary_key=True)
    admin = models.ForeignKey(U, null=True, on_delete=models.SET_NULL, related_name="admin_actions")
    action = models.CharField(max_length=60)
    target_type = models.CharField(max_length=80)
    target_id = models.CharField(max_length=64)
    reason = models.CharField(max_length=500)
    payload = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "audit_admin_action"
        indexes = [models.Index(fields=["admin", "-created_at"], name="adminaction_admin_idx"),
                   models.Index(fields=["target_type", "target_id"], name="adminaction_target_idx")]


class SecurityEvent(models.Model):
    class Severity(models.TextChoices):
        INFO = "info", "Info"
        WARNING = "warning", "Alerte"
        CRITICAL = "critical", "Critique"

    id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(U, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    event_type = models.CharField(max_length=60)  # password_changed, two_factor_disabled, suspicious_login, token_reuse...
    severity = models.CharField(max_length=10, choices=Severity.choices, default=Severity.INFO)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    data = models.JSONField(default=dict, blank=True)
    correlation_id = models.CharField(max_length=64, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "audit_security_event"
        indexes = [models.Index(fields=["user", "-created_at"], name="secevent_user_idx"),
                   models.Index(fields=["severity", "-created_at"], name="secevent_sev_idx", condition=~models.Q(severity="info"))]


class SystemEvent(models.Model):
    class Level(models.TextChoices):
        INFO = "info", "Info"
        WARNING = "warning", "Alerte"
        ERROR = "error", "Erreur"

    id = models.BigAutoField(primary_key=True)
    level = models.CharField(max_length=8, choices=Level.choices, default=Level.INFO)
    component = models.CharField(max_length=60)  # outbox, feed, cron.flush_counters...
    message = models.CharField(max_length=500)
    data = models.JSONField(default=dict, blank=True)
    correlation_id = models.CharField(max_length=64, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "audit_system_event"
        indexes = [models.Index(fields=["component", "-created_at"], name="sysevent_component_idx")]
