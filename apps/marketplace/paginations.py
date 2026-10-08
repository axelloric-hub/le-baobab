from apps.core.pagination import BaseCursorPagination


class ProductCursorPagination(BaseCursorPagination):
    page_size = 24
    ordering = ("-published_at", "-id")  # couvert par product_browse_idx


class OrderCursorPagination(BaseCursorPagination):
    page_size = 20
    ordering = ("-created_at", "-id")  # couvert par order_user_idx
