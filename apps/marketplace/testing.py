"""Fabriques de test du commerce."""
from __future__ import annotations

import hashlib
import itertools
from types import SimpleNamespace

from apps.core.testing import make_user
from apps.marketplace import services as M

_n = itertools.count(1)


def make_shop(*, stock: int | None = None, price: int = 10_000, kind: str = "application"):
    seller = make_user()
    store = M.create_store(seller, name="Boutique", slug=f"shop-{next(_n)}")
    product = M.create_product(store, seller, kind=kind, slug="app", title="Mon app")
    variant = M.add_variant(product, seller, sku=f"SKU-{next(_n)}", name="Standard", price_minor=price, currency="XAF", stock=stock)
    if kind in ("application", "software"):
        M.add_release(product, seller, version="1.0.0", platform="windows", assets=[{"filename": "app.zip", "storage_key": "files/app.zip", "size_bytes": 1024,
                                                                                    "checksum_sha256": hashlib.sha256(b"app").hexdigest()}])
    M.publish_product(product, seller)
    return SimpleNamespace(seller=seller, store=store, product=product, variant=variant)


def second_product(shop, *, price: int, sku: str, stock: int | None = None, kind: str = "template"):
    p = M.create_product(shop.store, shop.seller, kind=kind, slug=sku.lower(), title=f"Produit {sku}")
    v = M.add_variant(p, shop.seller, sku=sku, name="Std", price_minor=price, currency="XAF", stock=stock)
    M.publish_product(p, shop.seller)
    return p, v
