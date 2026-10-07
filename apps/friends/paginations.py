from apps.core.pagination import BaseCursorPagination


class FriendRequestCursorPagination(BaseCursorPagination):
    page_size = 30
    ordering = ("-created_at", "-id")


class FollowCursorPagination(BaseCursorPagination):
    """Un utilisateur populaire peut avoir des millions d'abonnes : curseur obligatoire (pas d'OFFSET)."""

    page_size = 50
    ordering = ("-created_at", "-id")
