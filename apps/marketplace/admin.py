from django.contrib import admin

from apps.core.admin_utils import register_readable
from apps.marketplace.models import (
    Cart, Coupon, DigitalAsset, Download, License, Order, OrderItem, Product, ProductCategory, ProductEntitlementTarget, ProductRelease, ProductVariant, Review, Store, Wishlist,
)


class VariantInline(admin.TabularInline):
    model = ProductVariant
    extra = 0


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ("title", "store", "kind", "status", "rating_count", "published_at")
    list_filter = ("kind", "status")
    search_fields = ("title", "slug", "store__name")
    raw_id_fields = ("store", "category")
    readonly_fields = ("rating_count", "rating_sum")
    inlines = [VariantInline]
    ordering = ("-created_at",)


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    can_delete = False
    readonly_fields = [f.name for f in OrderItem._meta.fields]


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    """Commandes : LECTURE SEULE (l'argent ne se corrige pas depuis l'admin ; remboursements via le service tracable)."""

    list_display = ("number", "user", "status", "total_minor", "currency", "created_at", "paid_at")
    list_filter = ("status", "currency")
    search_fields = ("number", "user__username", "user__email")
    raw_id_fields = ("user", "coupon")
    inlines = [OrderItemInline]
    ordering = ("-created_at",)
    readonly_fields = [f.name for f in Order._meta.fields]

    def has_add_permission(self, request): return False
    def has_change_permission(self, request, obj=None): return False
    def has_delete_permission(self, request, obj=None): return False


register_readable(Store, search=("name", "slug"), filters=("status",))
register_readable(ProductCategory, search=("name",))
register_readable(ProductVariant, search=("sku", "name"), filters=("is_active",))
register_readable(ProductRelease, search=("version",), filters=("platform", "is_latest"))
register_readable(DigitalAsset, search=("filename",))
register_readable(ProductEntitlementTarget, filters=("scope",))
register_readable(Cart)
register_readable(Coupon, search=("code",), filters=("kind", "is_active"), readonly=("used_count",))
register_readable(License, search=("key", "user__username"), filters=("status",), allow_delete=False)
register_readable(Download, allow_add=False)
register_readable(Review, search=("title", "user__username"), filters=("rating",))
register_readable(Wishlist)
