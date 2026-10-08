from rest_framework import serializers

from apps.marketplace.models import CartItem, Order, OrderItem, Product, ProductVariant, Review


class VariantPublicSerializer(serializers.ModelSerializer):
    in_stock = serializers.SerializerMethodField()

    class Meta:
        model = ProductVariant
        fields = ("id", "sku", "name", "price_minor", "currency", "in_stock")  # jamais le stock exact (donnee commerciale)
        read_only_fields = fields

    def get_in_stock(self, obj) -> bool:
        return obj.stock is None or obj.stock > 0


class ProductPublicSerializer(serializers.ModelSerializer):
    variants = serializers.SerializerMethodField()
    rating = serializers.FloatField(source="rating_avg", read_only=True)

    class Meta:
        model = Product
        fields = ("id", "kind", "slug", "title", "description", "license_type", "documentation_url", "rating", "rating_count", "variants", "published_at")
        read_only_fields = fields

    def get_variants(self, obj):
        return VariantPublicSerializer(obj.variants.filter(is_active=True), many=True).data


class CartAddSerializer(serializers.Serializer):
    variant = serializers.UUIDField()
    quantity = serializers.IntegerField(min_value=1, max_value=100, default=1)


class CheckoutSerializer(serializers.Serializer):
    idempotency_key = serializers.CharField(max_length=100)
    coupon_code = serializers.CharField(max_length=40, required=False, allow_blank=True, default="")


class OrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderItem
        fields = ("id", "title", "sku", "unit_price_minor", "quantity", "line_total_minor", "discount_minor", "refunded_minor")
        read_only_fields = fields


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)

    class Meta:
        model = Order
        fields = ("id", "number", "status", "currency", "subtotal_minor", "discount_minor", "total_minor", "created_at", "paid_at", "items")
        read_only_fields = fields  # frais plateforme / net vendeur : jamais exposes a l'acheteur


class ReviewInputSerializer(serializers.Serializer):
    rating = serializers.IntegerField(min_value=1, max_value=5)
    title = serializers.CharField(max_length=120, required=False, allow_blank=True, default="")
    body = serializers.CharField(max_length=5000, required=False, allow_blank=True, default="")


class ReviewSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)

    class Meta:
        model = Review
        fields = ("id", "username", "rating", "title", "body", "created_at")
        read_only_fields = fields
