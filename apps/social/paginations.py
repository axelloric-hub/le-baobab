from apps.core.pagination import BaseCursorPagination


class PostCursorPagination(BaseCursorPagination):
    """Profil / groupe / hashtag : (published_at, id) indexe par post_author_pub_idx & co. (feed principal : feed.get_feed)."""

    page_size = 20
    ordering = ("-published_at", "-id")


class CommentCursorPagination(BaseCursorPagination):
    page_size = 20
    ordering = ("created_at", "id")  # ordre de lecture chronologique, couvert par comment_post_root_idx
