"""Marketplace : catalogue public, boutiques, panier, commande, licences, telechargements (URL signee), avis. Les secrets commerciaux (commission, stock exact) ne sortent jamais."""
from __future__ import annotations

from django.db import connection
from rest_framework import serializers as s
from rest_framework.response import Response

from apps.core.api import client_ip, endpoint, get_or_404, paginate
from apps.core.exceptions import PermissionDeniedError
from apps.marketplace import services as M
from apps.marketplace.models import Cart, DigitalAsset, License, Order, Product, ProductVariant, Review, Store, Wishlist
from apps.marketplace.serializers import OrderSerializer
from apps.profiles.render import user_brief
from apps.storage.services import resolve_owned, signed_url

PRICE_BODY = lambda: {"sku": s.CharField(max_length=60), "name": s.CharField(max_length=100), "price_minor": s.IntegerField(min_value=0), "currency": s.CharField(min_length=3, max_length=3), "stock": s.IntegerField(min_value=0, required=False, allow_null=True)}  # noqa: E731


def _store(request, slug, *, owner=False) -> Store:
    st = get_or_404(Store.objects.filter(slug=slug))
    if owner and not (request.user.is_staff or st.owner_id == request.user.pk):
        get_or_404(Store.objects.none())
    return st


def _product(request, product_id, *, owner=False) -> Product:
    p = get_or_404(Product.objects.filter(pk=product_id).select_related("store"))
    mine = request.user.is_authenticated and (request.user.is_staff or p.store.owner_id == request.user.pk)
    if owner and not mine:
        get_or_404(Product.objects.none())
    if not mine and (p.status != "published" or p.store.status != "active"):
        get_or_404(Product.objects.none())
    return p


def _variant(v: ProductVariant) -> dict:
    return {"id": str(v.pk), "sku": v.sku, "name": v.name, "price_minor": v.price_minor, "currency": v.currency, "in_stock": v.stock is None or v.stock > 0}


def _product_json(p: Product, *, detail: bool = False) -> dict:
    out = {"id": str(p.pk), "store": {"slug": p.store.slug, "name": p.store.name}, "kind": p.kind, "slug": p.slug, "title": p.title, "license_type": p.license_type, "status": p.status,
           "rating": p.rating_avg, "rating_count": p.rating_count, "published_at": p.published_at, "variants": [_variant(v) for v in p.variants.filter(is_active=True)],
           "media": [{"kind": m.kind, "url": signed_url(m.storage_key)} for m in p.media.all()]}
    if detail:
        rel = p.releases.filter(is_latest=True).order_by("-published_at").first()
        out.update(description=p.description, documentation_url=p.documentation_url,
                   latest_release={"version": rel.version, "platform": rel.platform, "changelog": rel.changelog, "requirements": rel.requirements, "installation_instructions": rel.installation_instructions,
                                   "files": [{"id": str(a.pk), "filename": a.filename, "size_bytes": a.size_bytes, "checksum_sha256": a.checksum_sha256} for a in rel.assets.all()]} if rel else None)
    return out


@endpoint("Creer ma boutique.", status=201, body={"name": s.CharField(max_length=120), "slug": s.SlugField(max_length=80), "description": s.CharField(max_length=5000, required=False, allow_blank=True, default="")})
def create_store(request):
    st = M.create_store(request.user, **request.input)
    return {"slug": st.slug, "name": st.name}


@endpoint("Mes boutiques.")
def my_stores(request):
    return [{"slug": x.slug, "name": x.name, "status": x.status} for x in Store.objects.filter(owner=request.user)]


@endpoint("Page publique d'une boutique.", auth="public")
def store_detail(request, slug):
    st = _store(request, slug)
    return {"slug": st.slug, "name": st.name, "description": st.description, "products": [_product_json(p) for p in st.products.filter(status="published").select_related("store")[:50]]}


@endpoint("Catalogue des produits publies.", auth="public", query={"q": s.CharField(required=False, max_length=60), "kind": s.CharField(required=False), "store": s.SlugField(required=False)})
def list_products(request):
    qs = Product.objects.filter(status="published", store__status="active").select_related("store")
    q = request.q
    if q.get("q"):
        qs = qs.filter(title__icontains=q["q"])
    if q.get("kind"):
        qs = qs.filter(kind=q["kind"])
    if q.get("store"):
        qs = qs.filter(store__slug=q["store"])
    return paginate(request, qs, ("-published_at", "-id"), _product_json, 24)


@endpoint("Fiche produit (version, changelog, prerequis, instructions, fichiers sans lien de telechargement).", auth="optional")
def product_detail(request, product_id):
    return _product_json(_product(request, product_id), detail=True)


@endpoint("[Vendeur] Creer un produit (brouillon).", status=201, body={"kind": s.ChoiceField(choices=[c[0] for c in Product.Kind.choices]), "slug": s.SlugField(max_length=80), "title": s.CharField(max_length=160),
                                                                      "license_type": s.ChoiceField(choices=[c[0] for c in Product.LicenseType.choices], default="personal"), "description": s.CharField(max_length=20000, required=False, allow_blank=True, default="")})
def create_product(request, slug):
    p = M.create_product(_store(request, slug, owner=True), request.user, **request.input)
    return {"id": str(p.pk), "status": p.status}


@endpoint("[Vendeur] Ajouter une variante (prix en plus petite unite ; stock vide = illimite).", status=201, body=PRICE_BODY())
def add_variant(request, product_id):
    d = request.input
    v = M.add_variant(_product(request, product_id, owner=True), request.user, sku=d["sku"], name=d["name"], price_minor=d["price_minor"], currency=d["currency"], stock=d.get("stock"))
    return _variant(v)


@endpoint("[Vendeur] Ajouter une image/video au produit (fichier envoye, usage 'product_media').", status=201, body={"file": s.UUIDField()})
def add_media(request, product_id):
    f = resolve_owned(request.user, request.input["file"], ("product_media",))
    M.add_media(_product(request, product_id, owner=True), request.user, storage_key=f.key, kind=f.content_type.split("/")[0])
    return {"added": True}


class _AssetIn(s.Serializer):
    file = s.UUIDField()
    checksum_sha256 = s.RegexField(r"^[0-9a-f]{64}$", error_messages={"invalid": "Empreinte SHA-256 attendue (64 caracteres hexadecimaux minuscules)."})


@endpoint("[Vendeur] Publier une version avec ses fichiers (envoyes, usage 'product_asset'). L'empreinte SHA-256 est fournie par le vendeur.", status=201,
          body={"version": s.CharField(max_length=40), "platform": s.ChoiceField(choices=["any", "windows", "macos", "linux", "android", "ios", "web"], default="any"), "changelog": s.CharField(max_length=20000, required=False, allow_blank=True, default=""),
                "requirements": s.CharField(max_length=5000, required=False, allow_blank=True, default=""), "installation_instructions": s.CharField(max_length=10000, required=False, allow_blank=True, default=""),
                "assets": s.ListField(child=_AssetIn(), min_length=1, max_length=20)})
def add_release(request, product_id):
    d = request.input
    assets = []
    for a in d["assets"]:
        f = resolve_owned(request.user, a["file"], ("product_asset",))
        assets.append({"filename": f.filename, "storage_key": f.key, "size_bytes": f.size_bytes, "checksum_sha256": a["checksum_sha256"]})
    rel = M.add_release(_product(request, product_id, owner=True), request.user, version=d["version"], platform=d["platform"], assets=assets, changelog=d["changelog"], requirements=d["requirements"],
                        installation_instructions=d["installation_instructions"])
    return {"id": str(rel.pk), "version": rel.version}


@endpoint("[Vendeur] Ce que l'achat debloque (cours, module, chapitre, classroom) : verifie que vous en etes enseignant.", status=201, body={"scope": s.ChoiceField(choices=["classroom", "course", "module", "chapter"]), "target_id": s.UUIDField()})
def add_target(request, product_id):
    M.add_entitlement_target(_product(request, product_id, owner=True), request.user, scope=request.input["scope"], target_id=request.input["target_id"])
    return {"added": True}


@endpoint("[Vendeur] Publier le produit (verifie qu'il est vendable).")
def publish_product(request, product_id):
    p = M.publish_product(_product(request, product_id, owner=True), request.user)
    return {"id": str(p.pk), "status": p.status}


@endpoint("[Vendeur] Creer un coupon pour ma boutique.", status=201,
          body={"code": s.CharField(max_length=40), "kind": s.ChoiceField(choices=["percent", "fixed"]), "value": s.IntegerField(min_value=1), "currency": s.CharField(max_length=3, required=False, allow_blank=True, default=""),
                "max_redemptions": s.IntegerField(min_value=1, required=False), "per_user_limit": s.IntegerField(min_value=1, max_value=100, default=1), "min_subtotal_minor": s.IntegerField(min_value=0, default=0), "ends_at": s.DateTimeField(required=False)})
def create_coupon(request, slug):
    c = M.create_coupon(request.user, store=_store(request, slug, owner=True), **request.input)
    return {"id": str(c.pk), "code": c.code}


@endpoint("[Vendeur] Mes revenus calcules depuis le grand livre (brut, rembourse, net apres commission).")
def revenue(request, slug):
    st = _store(request, slug, owner=True)
    with connection.cursor() as cur:
        cur.execute("SELECT seller_gross, seller_refunds, seller_net FROM baobab_store_revenue(%s)", [st.pk])
        g, r, n = cur.fetchone()
    return {"gross_minor": g, "refunded_minor": r, "net_minor": n}


@endpoint("Avis d'un produit.", auth="public")
def reviews(request, product_id):
    p = _product(request, product_id)
    return paginate(request, Review.objects.filter(product=p).select_related("user__profile"), ("-created_at", "-id"),
                    lambda r: {"id": str(r.pk), "user": user_brief(r.user), "rating": r.rating, "title": r.title, "body": r.body, "created_at": r.created_at}, 20)


@endpoint("Noter un produit (reserve aux acheteurs, un avis par produit).", status=201, body={"rating": s.IntegerField(min_value=1, max_value=5), "title": s.CharField(max_length=120, required=False, allow_blank=True, default=""), "body": s.CharField(max_length=5000, required=False, allow_blank=True, default="")})
def review(request, product_id):
    r = M.create_review(request.user, _product(request, product_id).pk, **request.input)
    return {"id": str(r.pk)}


@endpoint("Ajouter/retirer un produit de ma liste de souhaits.")
def wishlist_toggle(request, product_id):
    return {"in_wishlist": M.toggle_wishlist(request.user, _product(request, product_id).pk)}


@endpoint("Ma liste de souhaits.")
def wishlist(request):
    return [_product_json(w.product) for w in Wishlist.objects.filter(user=request.user, product__status="published").select_related("product__store")[:100]]


# ------------------------------------------------------------------ panier, commande
def _cart(user) -> dict:
    cart = Cart.objects.filter(user=user).first()
    items = list(cart.items.select_related("variant__product__store")) if cart else []
    lines = [{"variant": str(i.variant_id), "product": i.variant.product.title, "variant_name": i.variant.name, "unit_price_minor": i.variant.price_minor, "currency": i.variant.currency,
              "quantity": i.quantity, "line_total_minor": i.variant.price_minor * i.quantity, "available": i.variant.is_active and i.variant.product.status == "published"} for i in items]
    return {"items": lines, "subtotal_minor": sum(l["line_total_minor"] for l in lines), "currency": lines[0]["currency"] if lines else None}


@endpoint("Mon panier.")
def get_cart(request):
    return _cart(request.user)


@endpoint("Ajouter au panier (une seule devise par panier ; stock verifie).", status=201, body={"variant": s.UUIDField(), "quantity": s.IntegerField(min_value=1, max_value=100, default=1)})
def cart_add(request):
    M.add_to_cart(request.user, request.input["variant"], request.input["quantity"])
    return _cart(request.user)


@endpoint("Changer la quantite (0 retire la ligne).", body={"quantity": s.IntegerField(min_value=0, max_value=100)})
def cart_set(request, variant_id):
    M.set_cart_quantity(request.user, variant_id, request.input["quantity"])
    return _cart(request.user)


@endpoint("Retirer une ligne du panier.")
def cart_remove(request, variant_id):
    M.set_cart_quantity(request.user, variant_id, 0)
    return _cart(request.user)


@endpoint("Passer commande depuis le panier. idempotency_key est OBLIGATOIRE (une cle = une commande, meme si le client clique deux fois). Prix figes ; stock reserve.", status=201,
          body={"idempotency_key": s.CharField(max_length=100), "coupon_code": s.CharField(max_length=40, required=False, allow_blank=True, default="")})
def checkout(request):
    o = M.checkout(request.user, **request.input)
    return OrderSerializer(Order.objects.prefetch_related("items").get(pk=o.pk)).data


@endpoint("Mes commandes.")
def orders(request):
    return paginate(request, Order.objects.filter(user=request.user).prefetch_related("items"), ("-created_at", "-id"), lambda o: OrderSerializer(o).data, 20)


@endpoint("Detail d'une de mes commandes.")
def order_detail(request, order_id):
    return OrderSerializer(get_or_404(Order.objects.filter(pk=order_id, user=request.user).prefetch_related("items"))).data


@endpoint("Annuler une commande non payee (le stock et le coupon sont rendus).")
def cancel_order(request, order_id):
    get_or_404(Order.objects.filter(pk=order_id, user=request.user))
    return OrderSerializer(Order.objects.prefetch_related("items").get(pk=M.cancel_order(order_id, by=request.user).pk)).data


@endpoint("Mes licences.")
def licenses(request):
    return [{"id": str(l.pk), "product": {"id": str(l.product_id), "title": l.product.title}, "key": l.key, "seats": l.seats, "status": l.status, "issued_at": l.issued_at,
             "files": [{"id": str(a.pk), "filename": a.filename} for r in l.product.releases.filter(is_latest=True) for a in r.assets.all()] if l.status == "active" else []}
            for l in License.objects.filter(user=request.user).select_related("product")]


@endpoint("Obtenir une URL signee de telechargement (licence active requise ; 20 par minute).")
def download(request, asset_id):
    get_or_404(DigitalAsset.objects.filter(pk=asset_id))
    key = M.authorize_download(request.user, asset_id, ip=client_ip(request))
    return {"url": signed_url(key), "expires_in": 300}
