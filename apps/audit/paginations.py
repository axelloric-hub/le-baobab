from apps.core.pagination import BaseCursorPagination


class AuditCursorPagination(BaseCursorPagination):
    page_size = 50
    ordering = ("-created_at", "-id")
