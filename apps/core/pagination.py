"""Strategies de pagination.
- DefaultPagePagination : referentiels/admin (faible volume, besoin du total).
- BaseCursorPagination : feed, messages, notifications (gros volumes, pas de COUNT, pas de drift)."""
from rest_framework.pagination import CursorPagination, PageNumberPagination


class DefaultPagePagination(PageNumberPagination):
    page_size = 25
    page_size_query_param = "page_size"
    max_page_size = 100


class BaseCursorPagination(CursorPagination):
    """ordering doit etre un champ UNIQUE-ish et indexe ; (created_at, id) via ordering=("-created_at","-id")."""

    page_size = 30
    page_size_query_param = "limit"
    max_page_size = 100
    ordering = ("-created_at", "-id")
