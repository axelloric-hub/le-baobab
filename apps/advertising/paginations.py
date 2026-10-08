from apps.core.pagination import BaseCursorPagination


class CampaignCursorPagination(BaseCursorPagination):
    page_size = 20
    ordering = ("-created_at", "-id")
