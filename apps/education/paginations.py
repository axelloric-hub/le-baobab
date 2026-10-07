from apps.core.pagination import BaseCursorPagination


class CourseCursorPagination(BaseCursorPagination):
    page_size = 20
    ordering = ("-published_at", "-id")  # couvert par course_published_idx
