from apps.core.pagination import BaseCursorPagination


class MessageCursorPagination(BaseCursorPagination):
    """Historique : curseur sur `seq` (unique par conversation, monotone, indexe) -> O(log n), sans OFFSET."""

    page_size = 40
    max_page_size = 100
    ordering = "-seq"


class InboxCursorPagination(BaseCursorPagination):
    page_size = 30
    ordering = ("-conversation_id",)
