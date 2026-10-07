from apps.core.pagination import BaseCursorPagination


class NotificationCursorPagination(BaseCursorPagination):
    page_size = 30
    ordering = ("-created_at", "-id")
