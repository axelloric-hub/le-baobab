"""Marketplace. Verite : PostgreSQL (argent => forte coherence).
 - Les PRIX d'une commande sont des COPIES figees (OrderItem) : changer un prix ne reecrit jamais l'historique.
 - Seller est fusionne dans Store (un vendeur = proprietaire d'une boutique). Discount et Coupon sont fusionnes (Coupon).
 - Les montants sont des ENTIERS en plus petite unite (XAF : 1 ; EUR : centimes) : jamais de flottants pour de l'argent."""
from __future__ import annotations

from django.conf import settings
from django.db import models
from django.db.models import Q
from django.db.models.functions import Upper
from django.utils import timezone

from apps.core.models import UUIDModel

U = settings.AUTH_USER_MODEL
CURRENCY = {"max_length": 3}


class Store(UUIDModel):
    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        SUSPENDED = "suspended", "Suspendue"

    owner = models.ForeignKey(U, on_delete=models.PROTECT, related_name="stores")
    slug = models.SlugField(max_length=80, unique=True)
    name = models.CharField(max_length=120)
    description = models.TextField(max_length=5000, blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.ACTIVE)
    company_ref = models.UUIDField(null=True, blank=True)  # futur domaine companies : reference par id
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    updated_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        db_table = "marketplace_store"


class ProductCategory(models.Model):
    id = models.BigAutoField(primary_key=True)
    slug = models.SlugField(max_length=80, unique=True)
    name = models.CharField(max_length=100)
    parent = models.ForeignKey("self", null=True, blank=True, on_delete=models.CASCADE, related_name="children")

    class Meta:
        db_table = "marketplace_category"
        verbose_name_plural = "product categories"


class Product(UUIDModel):
    class Kind(models.TextChoices):
        APPLICATION = "application", "Application"
        SOFTWARE = "software", "Logiciel"
        SERVICE = "service", "Service"
        TEMPLATE = "template", "Template"
        RESOURCE = "resource", "Ressource"
        COURSE = "course", "Formation"
        DIGITAL = "digital_content", "Contenu numerique"

    class Status(models.TextChoices):
        DRAFT = "draft", "Brouillon"
        PUBLISHED = "published", "Publie"
        SUSPENDED = "suspended", "Suspendu (moderation)"
        ARCHIVED = "archived", "Archive"

    class LicenseType(models.TextChoices):
        PERSONAL = "personal", "Personnelle"
        TEAM = "team", "Equipe"
        COMMERCIAL = "commercial", "Commerciale"
        NONE = "none", "Sans licence (service/formation)"

    store = models.ForeignKey(Store, on_delete=models.PROTECT, related_name="products")
    category = models.ForeignKey(ProductCategory, null=True, blank=True, on_delete=models.SET_NULL, related_name="products")
    kind = models.CharField(max_length=16, choices=Kind.choices)
    slug = models.SlugField(max_length=80)
    title = models.CharField(max_length=160)
    description = models.TextField(max_length=20000, blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.DRAFT)
    license_type = models.CharField(max_length=10, choices=LicenseType.choices, default=LicenseType.PERSONAL)
    documentation_url = models.URLField(blank=True)
    skills = models.ManyToManyField("profiles.Skill", blank=True, related_name="products", db_table="marketplace_product_skill")
    rating_count = models.PositiveIntegerField(default=0, editable=False)  # maintenus par trigger (avis)
    rating_sum = models.PositiveIntegerField(default=0, editable=False)
    published_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    updated_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        db_table = "marketplace_product"
        constraints = [models.UniqueConstraint(fields=["store", "slug"], name="uniq_product_slug"),
                       models.CheckConstraint(condition=~Q(status="published") | Q(published_at__isnull=False), name="chk_product_published_dated"),
                       models.CheckConstraint(condition=Q(rating_sum__lte=models.F("rating_count") * 5), name="chk_product_rating_bounds")]
        indexes = [models.Index(fields=["category", "-published_at"], name="product_browse_idx", condition=Q(status="published")),
                   models.Index(fields=["store", "status"], name="product_store_idx")]

    @property
    def rating_avg(self) -> float | None:
        return round(self.rating_sum / self.rating_count, 2) if self.rating_count else None


class ProductVariant(UUIDModel):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="variants")
    sku = models.CharField(max_length=60, unique=True)
    name = models.CharField(max_length=100)
    price_minor = models.PositiveIntegerField()  # 0 = gratuit
    currency = models.CharField(**CURRENCY)
    is_default = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    stock = models.IntegerField(null=True, blank=True)  # NULL = illimite (numerique)

    class Meta:
        db_table = "marketplace_variant"
        constraints = [models.CheckConstraint(condition=~Q(currency=""), name="chk_variant_currency"),
                       models.CheckConstraint(condition=Q(stock__isnull=True) | Q(stock__gte=0), name="chk_variant_stock_nonneg"),  # JAMAIS de surstock : garanti par la base
                       models.UniqueConstraint(fields=["product"], condition=Q(is_default=True), name="uniq_variant_default")]


class ProductMedia(UUIDModel):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="media")
    kind = models.CharField(max_length=10, default="image")
    storage_key = models.CharField(max_length=400)
    position = models.PositiveSmallIntegerField(default=0)

    class Meta:
        db_table = "marketplace_product_media"
        constraints = [models.UniqueConstraint(fields=["product", "position"], name="uniq_productmedia_position")]


class ProductEntitlementTarget(UUIDModel):
    """Ce qu'un achat DEBLOQUE dans un autre domaine (ex. cours/module/chapitre). Reference par id : marketplace ne connait pas education."""

    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="entitlement_targets")
    scope = models.CharField(max_length=10)  # classroom | course | module | chapter
    target_id = models.UUIDField()

    class Meta:
        db_table = "marketplace_entitlement_target"
        constraints = [models.UniqueConstraint(fields=["product", "scope", "target_id"], name="uniq_entitlement_target"),
                       models.CheckConstraint(condition=Q(scope__in=["classroom", "course", "module", "chapter"]), name="chk_target_scope")]


class ProductRelease(UUIDModel):
    """Version d'une application/logiciel : changelog, prerequis, instructions d'installation."""

    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="releases")
    version = models.CharField(max_length=40)
    platform = models.CharField(max_length=20, default="any")  # windows, macos, linux, android, ios, web, any
    changelog = models.TextField(blank=True)
    requirements = models.TextField(blank=True)
    installation_instructions = models.TextField(blank=True)
    is_latest = models.BooleanField(default=False)
    published_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "marketplace_release"
        constraints = [models.UniqueConstraint(fields=["product", "version", "platform"], name="uniq_release"),
                       models.UniqueConstraint(fields=["product", "platform"], condition=Q(is_latest=True), name="uniq_release_latest")]


class DigitalAsset(UUIDModel):
    release = models.ForeignKey(ProductRelease, on_delete=models.CASCADE, related_name="assets")
    filename = models.CharField(max_length=255)
    storage_key = models.CharField(max_length=400)
    size_bytes = models.BigIntegerField()
    checksum_sha256 = models.CharField(max_length=64)

    class Meta:
        db_table = "marketplace_digital_asset"
        constraints = [models.CheckConstraint(condition=Q(size_bytes__gte=0), name="chk_asset_size"),
                       models.CheckConstraint(condition=Q(checksum_sha256__regex=r"^[0-9a-f]{64}$"), name="chk_asset_checksum")]


class Cart(UUIDModel):
    user = models.OneToOneField(U, on_delete=models.CASCADE, related_name="cart")
    updated_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "marketplace_cart"


class CartItem(models.Model):
    id = models.BigAutoField(primary_key=True)
    cart = models.ForeignKey(Cart, on_delete=models.CASCADE, related_name="items")
    variant = models.ForeignKey(ProductVariant, on_delete=models.CASCADE, related_name="+")
    quantity = models.PositiveSmallIntegerField(default=1)

    class Meta:
        db_table = "marketplace_cart_item"
        constraints = [models.UniqueConstraint(fields=["cart", "variant"], name="uniq_cartitem"),
                       models.CheckConstraint(condition=Q(quantity__gte=1, quantity__lte=100), name="chk_cartitem_qty")]


class Coupon(UUIDModel):
    class Kind(models.TextChoices):
        PERCENT = "percent", "Pourcentage"
        FIXED = "fixed", "Montant fixe"

    code = models.CharField(max_length=40)
    kind = models.CharField(max_length=8, choices=Kind.choices)
    value = models.PositiveIntegerField()  # % (1..100) ou montant en plus petite unite
    currency = models.CharField(max_length=3, blank=True)  # requis pour 'fixed'
    store = models.ForeignKey(Store, null=True, blank=True, on_delete=models.CASCADE, related_name="coupons")  # NULL = toute la plateforme
    min_subtotal_minor = models.PositiveIntegerField(default=0)
    max_redemptions = models.PositiveIntegerField(null=True, blank=True)
    per_user_limit = models.PositiveSmallIntegerField(default=1)
    used_count = models.PositiveIntegerField(default=0, editable=False)
    starts_at = models.DateTimeField(default=timezone.now)
    ends_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "marketplace_coupon"
        constraints = [models.UniqueConstraint(Upper("code"), name="uniq_coupon_code_ci"),
                       models.CheckConstraint(condition=Q(kind="percent", value__gte=1, value__lte=100) | Q(kind="fixed", value__gt=0) & ~Q(currency=""), name="chk_coupon_value"),
                       models.CheckConstraint(condition=Q(ends_at__isnull=True) | Q(ends_at__gt=models.F("starts_at")), name="chk_coupon_period"),
                       models.CheckConstraint(condition=Q(max_redemptions__isnull=True) | Q(used_count__lte=models.F("max_redemptions")), name="chk_coupon_usage")]  # plafond garanti par la base


class Order(UUIDModel):
    class Status(models.TextChoices):
        PENDING = "pending", "En attente de paiement"
        PAID = "paid", "Payee"
        CANCELLED = "cancelled", "Annulee"
        PARTIALLY_REFUNDED = "partially_refunded", "Partiellement remboursee"
        REFUNDED = "refunded", "Remboursee"

    user = models.ForeignKey(U, on_delete=models.PROTECT, related_name="orders")
    number = models.CharField(max_length=24, unique=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    currency = models.CharField(**CURRENCY)
    subtotal_minor = models.PositiveBigIntegerField()
    discount_minor = models.PositiveBigIntegerField(default=0)
    total_minor = models.PositiveBigIntegerField()
    coupon = models.ForeignKey(Coupon, null=True, blank=True, on_delete=models.SET_NULL, related_name="orders")
    idempotency_key = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    updated_at = models.DateTimeField(default=timezone.now, editable=False)
    paid_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "marketplace_order"
        constraints = [
            models.CheckConstraint(condition=Q(total_minor=models.F("subtotal_minor") - models.F("discount_minor")) & Q(discount_minor__lte=models.F("subtotal_minor")), name="chk_order_totals"),
            models.CheckConstraint(condition=~Q(status="paid") | Q(paid_at__isnull=False), name="chk_order_paid_dated"),
            models.UniqueConstraint(fields=["user", "idempotency_key"], condition=~Q(idempotency_key=""), name="uniq_order_idempotency"),  # pas de double commande
        ]
        indexes = [models.Index(fields=["user", "-created_at"], name="order_user_idx"),
                   models.Index(fields=["created_at"], name="order_pending_idx", condition=Q(status="pending"))]


class OrderItem(UUIDModel):
    order = models.ForeignKey(Order, on_delete=models.PROTECT, related_name="items")
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name="order_items")
    variant = models.ForeignKey(ProductVariant, on_delete=models.PROTECT, related_name="order_items")
    store = models.ForeignKey(Store, on_delete=models.PROTECT, related_name="order_items")
    # COPIES figees au moment de la commande
    title = models.CharField(max_length=160)
    sku = models.CharField(max_length=60)
    unit_price_minor = models.PositiveIntegerField()
    quantity = models.PositiveSmallIntegerField()
    line_total_minor = models.PositiveBigIntegerField()
    discount_minor = models.PositiveBigIntegerField(default=0)
    platform_fee_minor = models.PositiveBigIntegerField(default=0)
    seller_net_minor = models.PositiveBigIntegerField(default=0)
    refunded_minor = models.PositiveBigIntegerField(default=0)

    class Meta:
        db_table = "marketplace_order_item"
        constraints = [
            models.CheckConstraint(condition=Q(line_total_minor=models.F("unit_price_minor") * models.F("quantity")), name="chk_item_line_total"),
            models.CheckConstraint(condition=Q(discount_minor__lte=models.F("line_total_minor")), name="chk_item_discount"),
            # frais + net vendeur = montant paye pour la ligne (apres remise) : rien ne se perd, rien ne se cree
            models.CheckConstraint(condition=Q(platform_fee_minor__lte=models.F("line_total_minor") - models.F("discount_minor")) & Q(seller_net_minor=models.F("line_total_minor") - models.F("discount_minor") - models.F("platform_fee_minor")), name="chk_item_split"),
            models.CheckConstraint(condition=Q(refunded_minor__lte=models.F("line_total_minor") - models.F("discount_minor")), name="chk_item_refund_cap"),  # jamais plus rembourse que paye
        ]
        indexes = [models.Index(fields=["store", "-order_id"], name="orderitem_store_idx"), models.Index(fields=["product"], name="orderitem_product_idx")]


class License(UUIDModel):
    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        REVOKED = "revoked", "Revoquee"

    user = models.ForeignKey(U, on_delete=models.PROTECT, related_name="licenses")
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name="licenses")
    order_item = models.OneToOneField(OrderItem, on_delete=models.PROTECT, related_name="license")
    key = models.CharField(max_length=40, unique=True)
    seats = models.PositiveSmallIntegerField(default=1)
    status = models.CharField(max_length=8, choices=Status.choices, default=Status.ACTIVE)
    issued_at = models.DateTimeField(default=timezone.now, editable=False)
    revoked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "marketplace_license"
        indexes = [models.Index(fields=["user", "product"], name="license_active_idx", condition=Q(status="active"))]


class Download(models.Model):
    id = models.BigAutoField(primary_key=True)
    license = models.ForeignKey(License, on_delete=models.CASCADE, related_name="downloads")
    asset = models.ForeignKey(DigitalAsset, on_delete=models.CASCADE, related_name="downloads")
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "marketplace_download"
        indexes = [models.Index(fields=["license", "-created_at"], name="download_license_idx")]


class CouponRedemption(models.Model):
    id = models.BigAutoField(primary_key=True)
    coupon = models.ForeignKey(Coupon, on_delete=models.CASCADE, related_name="redemptions")
    user = models.ForeignKey(U, on_delete=models.CASCADE, related_name="+")
    order = models.OneToOneField(Order, on_delete=models.CASCADE, related_name="redemption")
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "marketplace_coupon_redemption"
        indexes = [models.Index(fields=["coupon", "user"], name="redemption_user_idx")]


class Review(UUIDModel):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="reviews")
    user = models.ForeignKey(U, on_delete=models.CASCADE, related_name="reviews")
    order_item = models.ForeignKey(OrderItem, on_delete=models.PROTECT, related_name="+")  # preuve d'achat
    rating = models.PositiveSmallIntegerField()
    title = models.CharField(max_length=120, blank=True)
    body = models.TextField(max_length=5000, blank=True)
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        db_table = "marketplace_review"
        constraints = [models.UniqueConstraint(fields=["product", "user"], name="uniq_review"),
                       models.CheckConstraint(condition=Q(rating__gte=1, rating__lte=5), name="chk_review_rating")]
        indexes = [models.Index(fields=["product", "-created_at"], name="review_product_idx")]


class Wishlist(models.Model):
    id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(U, on_delete=models.CASCADE, related_name="wishlist")
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="+")
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "marketplace_wishlist"
        constraints = [models.UniqueConstraint(fields=["user", "product"], name="uniq_wishlist")]
