from __future__ import annotations

import secrets
from datetime import timedelta

from django.conf import settings
from django.db import IntegrityError, transaction
from django.db import models
from django.db.models import F, Q
from django.db.models.functions import Upper
from django.utils import timezone

from apps.core import redis as R
from apps.core.exceptions import ConflictError, DomainError, PermissionDeniedError, RateLimitedError
from apps.core.outbox import publish_event
from apps.core.registries import entitlement_target_allowed
from apps.marketplace.models import (
    Cart, CartItem, Coupon, CouponRedemption, DigitalAsset, Download, License, Order, OrderItem, Product, ProductEntitlementTarget,
    ProductRelease, ProductVariant, Review, Store, Wishlist,
)
from apps.marketplace.money import allocate, percent_of, platform_fee

LICENSED_KINDS = ("application", "software", "template", "resource", "digital_content")


def _owner_or_staff(user, store: Store) -> None:
    if not (user.is_staff or store.owner_id == user.pk):
        raise PermissionDeniedError("Reserve au proprietaire de la boutique.")


# ------------------------------------------------------------------ catalogue
@transaction.atomic
def create_store(owner, *, name: str, slug: str, description: str = "") -> Store:
    try:
        with transaction.atomic():
            return Store.objects.create(owner=owner, name=name, slug=slug, description=description)
    except IntegrityError as exc:
        raise ConflictError("Ce nom de boutique est deja pris.", code="slug_taken") from exc


@transaction.atomic
def create_product(store: Store, actor, *, kind: str, slug: str, title: str, license_type: str = "personal", description: str = "", category=None) -> Product:
    _owner_or_staff(actor, store)
    if store.status != "active":
        raise DomainError("Boutique suspendue.", code="store_suspended")
    if kind in ("service", "course"):
        license_type = "none"
    try:
        with transaction.atomic():
            return Product.objects.create(store=store, kind=kind, slug=slug, title=title, license_type=license_type, description=description, category=category)
    except IntegrityError as exc:
        raise ConflictError("Ce slug existe deja dans la boutique.", code="slug_taken") from exc


@transaction.atomic
def add_variant(product: Product, actor, *, sku: str, name: str, price_minor: int, currency: str, stock: int | None = None) -> ProductVariant:
    _owner_or_staff(actor, product.store)
    try:
        with transaction.atomic():
            return ProductVariant.objects.create(product=product, sku=sku, name=name, price_minor=price_minor, currency=currency.upper(), stock=stock,
                                                 is_default=not product.variants.exists())
    except IntegrityError as exc:
        raise DomainError("SKU deja utilise, devise vide ou stock negatif.", code="invalid_variant") from exc


@transaction.atomic
def add_entitlement_target(product: Product, actor, *, scope: str, target_id) -> ProductEntitlementTarget:
    """Ce que l'achat debloque. Le domaine proprietaire de la cible (education) confirme qu'elle existe et que l'acteur peut la vendre."""
    _owner_or_staff(actor, product.store)
    if not entitlement_target_allowed(scope, target_id, actor):
        raise PermissionDeniedError("Cible introuvable ou non vendable par cet utilisateur.", code="invalid_target")
    try:
        with transaction.atomic():
            return ProductEntitlementTarget.objects.create(product=product, scope=scope, target_id=target_id)
    except IntegrityError as exc:
        raise ConflictError("Cible deja associee.", code="duplicate_target") from exc


@transaction.atomic
def add_release(product: Product, actor, *, version: str, platform: str = "any", assets: list[dict], changelog: str = "", requirements: str = "",
                installation_instructions: str = "") -> ProductRelease:
    _owner_or_staff(actor, product.store)
    if not assets:
        raise DomainError("Une version doit contenir au moins un fichier.", code="no_assets")
    ProductRelease.objects.filter(product=product, platform=platform, is_latest=True).update(is_latest=False)
    try:
        with transaction.atomic():
            rel = ProductRelease.objects.create(product=product, version=version, platform=platform, changelog=changelog, requirements=requirements,
                                                installation_instructions=installation_instructions, is_latest=True)
            DigitalAsset.objects.bulk_create([DigitalAsset(release=rel, **a) for a in assets])
    except IntegrityError as exc:
        raise DomainError("Version deja publiee pour cette plateforme, ou fichier invalide (taille, empreinte SHA-256).", code="invalid_release") from exc
    return rel


@transaction.atomic
def publish_product(product: Product, actor) -> Product:
    _owner_or_staff(actor, product.store)
    if product.store.status != "active":
        raise DomainError("Boutique suspendue.", code="store_suspended")
    if not product.variants.filter(is_active=True).exists():
        raise DomainError("Au moins une variante active est requise.", code="no_variant")
    if product.kind in ("application", "software") and not product.releases.filter(is_latest=True, assets__isnull=False).exists():
        raise DomainError("Une application doit avoir une version avec fichier.", code="no_release")
    if product.kind == "course" and not product.entitlement_targets.exists():
        raise DomainError("Une formation doit debloquer au moins un cours, module ou chapitre.", code="no_target")
    product.status, product.published_at = "published", timezone.now()
    product.save(update_fields=["status", "published_at", "updated_at"])
    publish_event("ProductPublished", "product", product.pk, {"store": str(product.store_id)})
    return product


@transaction.atomic
def create_coupon(actor, *, code: str, kind: str, value: int, currency: str = "", store: Store | None = None, max_redemptions: int | None = None,
                  per_user_limit: int = 1, min_subtotal_minor: int = 0, ends_at=None) -> Coupon:
    if store is not None:
        _owner_or_staff(actor, store)
    elif not actor.is_staff:
        raise PermissionDeniedError("Un coupon plateforme est reserve a l'administration.")
    try:
        with transaction.atomic():
            return Coupon.objects.create(code=code.strip().upper(), kind=kind, value=value, currency=currency.upper(), store=store, max_redemptions=max_redemptions,
                                         per_user_limit=per_user_limit, min_subtotal_minor=min_subtotal_minor, ends_at=ends_at)
    except IntegrityError as exc:
        raise DomainError("Code deja utilise ou valeur invalide.", code="invalid_coupon") from exc


# ------------------------------------------------------------------ panier
def _buyable(variant: ProductVariant) -> None:
    if not (variant.is_active and variant.product.status == "published" and variant.product.store.status == "active"):
        raise DomainError("Produit indisponible.", code="unavailable")


@transaction.atomic
def add_to_cart(user, variant_id, quantity: int = 1) -> CartItem:
    variant = ProductVariant.objects.select_related("product__store").get(pk=variant_id)
    _buyable(variant)
    cart, _ = Cart.objects.get_or_create(user=user)
    others = cart.items.exclude(variant=variant).select_related("variant")
    if any(i.variant.currency != variant.currency for i in others):
        raise DomainError("Un panier ne peut contenir qu'une seule devise.", code="mixed_currency")
    item = cart.items.filter(variant=variant).first()
    new_qty = (item.quantity if item else 0) + quantity
    if not 1 <= new_qty <= 100:
        raise DomainError("Quantite invalide (1 a 100).", code="invalid_quantity")
    if variant.stock is not None and new_qty > variant.stock:
        raise DomainError("Stock insuffisant.", code="out_of_stock")
    if item is None:
        return CartItem.objects.create(cart=cart, variant=variant, quantity=new_qty)
    item.quantity = new_qty
    item.save(update_fields=["quantity"])
    return item


@transaction.atomic
def set_cart_quantity(user, variant_id, quantity: int) -> None:
    cart = Cart.objects.filter(user=user).first()
    if cart is None:
        return
    if quantity <= 0:
        cart.items.filter(variant_id=variant_id).delete()
        return
    item = cart.items.select_related("variant").get(variant_id=variant_id)
    if quantity > 100 or (item.variant.stock is not None and quantity > item.variant.stock):
        raise DomainError("Quantite indisponible.", code="out_of_stock")
    item.quantity = quantity
    item.save(update_fields=["quantity"])


# ------------------------------------------------------------------ commande
def _order_number() -> str:
    return f"BAO-{timezone.now():%Y%m%d}-{''.join(secrets.choice('ABCDEFGHJKLMNPQRSTUVWXYZ23456789') for _ in range(6))}"


def _validate_coupon(coupon: Coupon, user, lines: list[dict], currency: str) -> list[int]:
    """Retourne les indices des lignes eligibles ; leve DomainError sinon."""
    now = timezone.now()
    if not coupon.is_active or coupon.starts_at > now or (coupon.ends_at and coupon.ends_at < now):
        raise DomainError("Coupon invalide ou expire.", code="coupon_invalid")
    if coupon.max_redemptions is not None and coupon.used_count >= coupon.max_redemptions:
        raise DomainError("Coupon epuise.", code="coupon_exhausted")
    if coupon.kind == "fixed" and coupon.currency != currency:
        raise DomainError("Ce coupon n'est pas valable dans cette devise.", code="coupon_currency")
    used = CouponRedemption.objects.filter(coupon=coupon, user=user).exclude(order__status="cancelled").count()
    if used >= coupon.per_user_limit:
        raise DomainError("Coupon deja utilise.", code="coupon_already_used")
    eligible = [i for i, l in enumerate(lines) if coupon.store_id is None or l["variant"].product.store_id == coupon.store_id]
    if not eligible:
        raise DomainError("Ce coupon ne s'applique a aucun article du panier.", code="coupon_not_applicable")
    if sum(lines[i]["total"] for i in eligible) < coupon.min_subtotal_minor:
        raise DomainError("Montant minimal non atteint pour ce coupon.", code="coupon_min_subtotal")
    return eligible


@transaction.atomic
def checkout(user, *, idempotency_key: str, coupon_code: str = "") -> Order:
    """Panier -> commande. IDEMPOTENT par cle ; prix figes ; stock decremente sous verrou (jamais de surstock) ; remise repartie au centime."""
    if not idempotency_key.strip():
        raise DomainError("Une cle d'idempotence est obligatoire.", code="idempotency_key_required")
    existing = Order.objects.filter(user=user, idempotency_key=idempotency_key).first()
    if existing:
        return existing
    cart = Cart.objects.filter(user=user).first()
    items = list(cart.items.all()) if cart else []
    if not items:
        raise DomainError("Panier vide.", code="empty_cart")
    # Verrous dans un ORDRE FIXE (pk croissant) : deux commandes concurrentes ne peuvent pas s'interbloquer.
    locked = {v.pk: v for v in ProductVariant.objects.select_for_update(of=("self",)).select_related("product__store").filter(pk__in=[i.variant_id for i in items]).order_by("pk")}
    lines, currencies = [], set()
    for it in items:
        v = locked.get(it.variant_id)
        if v is None:
            raise DomainError("Article retire du catalogue.", code="unavailable")
        _buyable(v)
        if v.stock is not None and v.stock < it.quantity:
            raise DomainError(f"Stock insuffisant pour « {v.product.title} ».", code="out_of_stock")
        currencies.add(v.currency)
        lines.append({"variant": v, "qty": it.quantity, "total": v.price_minor * it.quantity})
    if len(currencies) != 1:
        raise DomainError("Un panier ne peut contenir qu'une seule devise.", code="mixed_currency")
    currency = currencies.pop()
    subtotal = sum(l["total"] for l in lines)
    discounts, coupon = [0] * len(lines), None
    if coupon_code.strip():
        coupon = Coupon.objects.select_for_update(of=("self",)).annotate(u=Upper("code")).filter(u=coupon_code.strip().upper()).first()
        if coupon is None:
            raise DomainError("Coupon inconnu.", code="coupon_invalid")
        eligible = _validate_coupon(coupon, user, lines, currency)
        base = sum(lines[i]["total"] for i in eligible)
        amount = percent_of(base, coupon.value) if coupon.kind == "percent" else min(coupon.value, base)
        for i, share in zip(eligible, allocate(amount, [lines[i]["total"] for i in eligible])):
            discounts[i] = share
    discount = sum(discounts)
    try:
        with transaction.atomic():
            order = Order.objects.create(user=user, number=_order_number(), currency=currency, subtotal_minor=subtotal, discount_minor=discount,
                                         total_minor=subtotal - discount, coupon=coupon, idempotency_key=idempotency_key)
    except IntegrityError:  # commande simultanee avec la meme cle : la gagnante fait foi
        return Order.objects.get(user=user, idempotency_key=idempotency_key)
    for l, d in zip(lines, discounts):
        v, net_paid = l["variant"], l["total"] - d
        fee = platform_fee(net_paid, settings.PLATFORM_FEE_BPS)
        OrderItem.objects.create(order=order, product=v.product, variant=v, store=v.product.store, title=v.product.title, sku=v.sku, unit_price_minor=v.price_minor,
                                 quantity=l["qty"], line_total_minor=l["total"], discount_minor=d, platform_fee_minor=fee, seller_net_minor=net_paid - fee)
        if v.stock is not None:
            ProductVariant.objects.filter(pk=v.pk).update(stock=F("stock") - l["qty"])
    if coupon:
        CouponRedemption.objects.create(coupon=coupon, user=user, order=order)
        Coupon.objects.filter(pk=coupon.pk).update(used_count=F("used_count") + 1)
    cart.items.all().delete()
    publish_event("OrderCreated", "order", order.pk, {"user": str(user.pk), "total": order.total_minor, "currency": currency})
    return order


@transaction.atomic
def cancel_order(order_id, *, by=None, reason: str = "") -> Order:
    """Annule une commande NON PAYEE : restitue le stock et le coupon. (Un paiement qui arriverait ensuite est traite par payments.)"""
    order = Order.objects.select_for_update(of=("self",)).get(pk=order_id)
    if by is not None and not (by.is_staff or by.pk == order.user_id):
        raise PermissionDeniedError("Commande d'un autre utilisateur.")
    if order.status != "pending":
        raise ConflictError("Seule une commande en attente peut etre annulee.", code="not_pending")
    for item in order.items.select_related("variant").order_by("variant_id"):
        if item.variant.stock is not None:
            ProductVariant.objects.filter(pk=item.variant_id).update(stock=F("stock") + item.quantity)
    red = CouponRedemption.objects.filter(order=order).first()
    if red:
        Coupon.objects.filter(pk=red.coupon_id).update(used_count=F("used_count") - 1)
        red.delete()
    order.status, order.cancelled_at = "cancelled", timezone.now()
    order.save(update_fields=["status", "cancelled_at", "updated_at"])
    publish_event("OrderCancelled", "order", order.pk, {"user": str(order.user_id), "reason": reason})
    return order


def expire_pending_orders(batch: int = 200) -> int:
    """Job : annule les commandes impayees depuis plus de PENDING_ORDER_TTL_HOURS (rend le stock et les coupons)."""
    cutoff = timezone.now() - timedelta(hours=settings.PENDING_ORDER_TTL_HOURS)
    n = 0
    for pk in Order.objects.filter(status="pending", created_at__lt=cutoff).values_list("pk", flat=True)[:batch]:
        try:
            cancel_order(pk, reason="expired")
            n += 1
        except ConflictError:
            pass  # payee entre-temps
    return n


# ------------------------------------------------------------------ licences & telechargements
def issue_license(item: OrderItem) -> License | None:
    if item.product.kind not in LICENSED_KINDS or item.product.license_type == "none":
        return None
    for _ in range(5):
        try:
            with transaction.atomic():
                return License.objects.create(user=item.order.user, product=item.product, order_item=item, seats=item.quantity,
                                              key="BAO-" + "-".join("".join(secrets.choice("ABCDEFGHJKLMNPQRSTUVWXYZ23456789") for _ in range(5)) for _ in range(4)))
        except IntegrityError:
            existing = License.objects.filter(order_item=item).first()
            if existing:
                return existing
    raise DomainError("Impossible de generer une cle de licence.", code="license_key_failed")


@transaction.atomic
def authorize_download(user, asset_id, *, ip: str | None = None) -> str:
    """Retourne la cle de stockage SI l'utilisateur detient une licence ACTIVE du produit. Journalise ; limite le debit (anti-aspiration)."""
    asset = DigitalAsset.objects.select_related("release__product").get(pk=asset_id)
    lic = License.objects.filter(user=user, product=asset.release.product, status="active").first()
    if lic is None:
        raise PermissionDeniedError("Licence active requise.", code="license_required")
    allowed, _, _ = R.rate_limit("download", user.pk, 20, 60)
    if not allowed:
        raise RateLimitedError("Trop de telechargements, reessayez dans une minute.")
    Download.objects.create(license=lic, asset=asset, ip_address=ip)
    return asset.storage_key


# ------------------------------------------------------------------ avis & liste de souhaits
@transaction.atomic
def create_review(user, product_id, *, rating: int, title: str = "", body: str = "") -> Review:
    """Avis reserve aux ACHETEURS (achat paye, non integralement rembourse). Un avis par utilisateur et par produit."""
    item = (OrderItem.objects.filter(product_id=product_id, order__user=user, order__status__in=["paid", "partially_refunded"])
            .filter(refunded_minor__lt=F("line_total_minor") - F("discount_minor")).first())
    if item is None:
        raise PermissionDeniedError("Seuls les acheteurs peuvent noter ce produit.", code="purchase_required")
    if not 1 <= rating <= 5:
        raise DomainError("Note entre 1 et 5.", code="invalid_rating")
    try:
        with transaction.atomic():
            return Review.objects.create(product_id=product_id, user=user, order_item=item, rating=rating, title=title, body=body)
    except IntegrityError as exc:
        raise ConflictError("Vous avez deja note ce produit.", code="already_reviewed") from exc


@transaction.atomic
def toggle_wishlist(user, product_id) -> bool:
    deleted, _ = Wishlist.objects.filter(user=user, product_id=product_id).delete()
    if deleted:
        return False
    Wishlist.objects.get_or_create(user=user, product_id=product_id)
    return True


@transaction.atomic
def add_media(product: Product, actor, *, storage_key: str, kind: str = "image"):
    from apps.marketplace.models import ProductMedia

    _owner_or_staff(actor, product.store)
    pos = (ProductMedia.objects.filter(product=product).aggregate(m=models.Max("position"))["m"] or -1) + 1
    return ProductMedia.objects.create(product=product, kind=kind, storage_key=storage_key, position=pos)
