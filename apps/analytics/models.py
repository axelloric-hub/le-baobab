"""Separation OLTP / analytique :
 - Evenements bruts (volumineux, semi-structures)  -> MongoDB `events` (TTL) via analytics.events.track()
 - Agregats quotidiens (petits, requetables en SQL) -> PostgreSQL DailyMetric (+ vues materialisees)
 - Catalogue des types d'evenements (contrat de schema) -> PostgreSQL EventType."""
from __future__ import annotations

from django.db import models
from django.db.models import Q
from django.utils import timezone


class EventType(models.Model):
    code = models.CharField(max_length=60, primary_key=True)  # post_created, lesson_completed, ad_click ...
    domain = models.CharField(max_length=30)
    description = models.CharField(max_length=200, blank=True)
    actor_required = models.BooleanField(default=True)
    contains_pii = models.BooleanField(default=False)
    retention_days = models.PositiveIntegerField(default=400)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "analytics_event_type"

    def __str__(self) -> str:
        return self.code


class DailyMetric(models.Model):
    id = models.BigAutoField(primary_key=True)
    day = models.DateField()
    metric = models.CharField(max_length=60)  # dau, new_users, posts, messages, revenue_minor_units ...
    dimension = models.CharField(max_length=80, blank=True, default="")  # ex: country=CM
    value = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    computed_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "analytics_daily_metric"
        constraints = [models.UniqueConstraint(fields=["day", "metric", "dimension"], name="uniq_dailymetric"),
                       models.CheckConstraint(condition=Q(value__gte=0), name="chk_dailymetric_nonneg")]
        indexes = [models.Index(fields=["metric", "-day"], name="dailymetric_metric_idx")]
