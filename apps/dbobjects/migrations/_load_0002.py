"""Chargement idempotent des donnees de reference (partage par 0002 et 0003)."""
from django.utils.text import slugify

from apps.dbobjects import reference_data as R


def load(apps, schema_editor):
    Country = apps.get_model("profiles", "Country")
    for region, items in R.AFRICAN_COUNTRIES.items():
        for code, name in items.items():
            Country.objects.update_or_create(code=code, defaults={"name": name, "region": region, "is_african": True})
    for code, name in R.OTHER_COUNTRIES.items():
        Country.objects.update_or_create(code=code, defaults={"name": name, "region": "Hors Afrique", "is_african": False})
    NT = apps.get_model("notifications", "NotificationType")
    for code, cat, channels, critical in R.NOTIFICATION_TYPES:
        NT.objects.update_or_create(code=code, defaults={"category": cat, "default_channels": channels, "is_critical": critical})
    ET = apps.get_model("analytics", "EventType")
    for code, domain, actor, pii, days in R.EVENT_TYPES:
        ET.objects.update_or_create(code=code, defaults={"domain": domain, "actor_required": actor, "contains_pii": pii, "retention_days": days})
    RR = apps.get_model("moderation", "ReportReason")
    for code, label, sev in R.REPORT_REASONS:
        RR.objects.update_or_create(code=code, defaults={"label": label, "severity": sev})
    P = apps.get_model("integrations", "ExternalProvider")
    for code, name, oauth, embed, hours in R.PROVIDERS:
        P.objects.update_or_create(code=code, defaults={"name": name, "supports_oauth": oauth, "supports_embed": embed, "max_cache_hours": hours})
    Skill, Interest, Profession = (apps.get_model("profiles", m) for m in ("Skill", "Interest", "Profession"))
    for slug, name, kind in R.SKILLS:
        Skill.objects.update_or_create(slug=slug, defaults={"name": name, "kind": kind})
    for name in R.INTERESTS:
        Interest.objects.update_or_create(slug=slugify(name), defaults={"name": name})
    for name in R.PROFESSIONS:
        Profession.objects.update_or_create(slug=slugify(name), defaults={"name": name})
