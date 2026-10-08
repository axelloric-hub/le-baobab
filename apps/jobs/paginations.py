from apps.core.pagination import BaseCursorPagination


class JobCursorPagination(BaseCursorPagination):
    page_size = 20
    ordering = ("-published_at", "-id")  # couvert par job_open_idx


class ApplicationCursorPagination(BaseCursorPagination):
    page_size = 30
    ordering = ("-created_at", "-id")
