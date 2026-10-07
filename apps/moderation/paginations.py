from apps.core.pagination import BaseCursorPagination


class CaseQueuePagination(BaseCursorPagination):
    page_size = 25
    ordering = ("-priority", "opened_at", "id")
