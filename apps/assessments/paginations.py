from apps.core.pagination import BaseCursorPagination


class SubmissionCursorPagination(BaseCursorPagination):
    page_size = 30
    ordering = ("-submitted_at", "-id")  # couvert par submission_assignment_idx
