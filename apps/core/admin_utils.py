"""Admin lisible par defaut : colonnes utiles, cles etrangeres en saisie par identifiant (pas de liste deroulante de 100 000 lignes)."""
from __future__ import annotations

from django.contrib import admin


def register_readable(model, *, search=(), filters=(), ordering=None, readonly=(), allow_delete=True, allow_add=True):
    fields = model._meta.concrete_fields
    attrs = {
        "list_display": [f.name for f in fields if f.get_internal_type() not in ("TextField", "JSONField")][:6],
        "raw_id_fields": [f.name for f in fields if f.is_relation],
        "search_fields": search, "list_filter": filters, "ordering": ordering, "readonly_fields": readonly,
    }
    if not allow_delete:
        attrs["has_delete_permission"] = lambda self, request, obj=None: False
    if not allow_add:
        attrs["has_add_permission"] = lambda self, request: False
    return admin.site.register(model, type(f"{model.__name__}Admin", (admin.ModelAdmin,), attrs))
