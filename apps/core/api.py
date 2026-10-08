"""Mini-cadre d'API : un endpoint = une fonction decoree. Valide l'entree, applique l'authentification, appelle UN service, formate la sortie.
Le registre ROUTES alimente la documentation (liste des endpoints, collection Insomnia) : elle ne peut donc pas diverger du code."""
from __future__ import annotations

import functools
from typing import Callable

from django.conf import settings
from django.urls import path
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import NotAuthenticated, NotFound, PermissionDenied
from rest_framework.pagination import CursorPagination
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

ROUTES: list[dict] = []


def validate(fields: dict, data) -> dict:
    ser = type("Input", (serializers.Serializer,), dict(fields))(data=data)
    ser.is_valid(raise_exception=True)
    return ser.validated_data


def endpoint(summary: str, *, auth: str = "user", body: dict | None = None, query: dict | None = None, status: int = 200) -> Callable:
    """auth : 'public' (anonyme accepte) | 'optional' (utilisateur facultatif) | 'user' (connecte) | 'staff' (administrateur).
    Le handler recoit `request` ; `request.input` = corps valide, `request.q` = parametres de requete valides."""

    for spec in (body, query):
        if spec and len({id(f) for f in spec.values()}) != len(spec):
            # Garde de demarrage : une meme instance de champ liee a deux noms fait lire a CHAQUE champ la valeur du dernier (bug reel rencontre).
            raise RuntimeError(f"endpoint '{summary}' : une meme instance de champ est utilisee pour plusieurs champs")

    def deco(fn: Callable) -> Callable:
        @functools.wraps(fn)
        def wrapper(request, *args, **kwargs):
            if auth in ("user", "staff") and not request.user.is_authenticated:
                raise NotAuthenticated()
            if auth == "staff" and not request.user.is_staff:
                raise PermissionDenied()
            request.input = validate(body, request.data) if body is not None else None
            request.q = validate(query, request.query_params) if query is not None else {}
            out = fn(request, *args, **kwargs)
            return out if isinstance(out, Response) else Response(out, status=status)

        wrapper.api_meta = {"summary": summary, "auth": auth, "body": body, "query": query, "status": status}
        return wrapper

    return deco


def route(pattern: str, **handlers: Callable):
    """route('posts/', GET=list_posts, POST=create_post) -> path DRF ; enregistre chaque methode pour la documentation."""

    @api_view(list(handlers))
    @permission_classes([AllowAny])  # l'authentification/les droits sont appliques par @endpoint (un seul endroit, visible)
    def view(request, *args, **kwargs):
        return handlers[request.method](request, *args, **kwargs)

    view.__name__ = "api_" + pattern.strip("/").replace("/", "_").replace("<", "").replace(">", "").replace(":", "_") or "api_root"
    for method, handler in handlers.items():
        ROUTES.append({"path": pattern, "method": method, "handler": f"{handler.__module__}.{handler.__name__}", **handler.api_meta})
    return path(pattern, view)


def paginate(request, qs, ordering, render: Callable, page_size: int = 30) -> Response:
    cls = type("P", (CursorPagination,), {"ordering": ordering, "page_size": page_size, "page_size_query_param": "limit", "max_page_size": 100})
    p = cls()
    page = p.paginate_queryset(qs, request)
    return Response({"next": p.get_next_link(), "previous": p.get_previous_link(), "results": [render(o) for o in page]})


def get_or_404(qs):
    obj = qs.first()
    if obj is None:
        raise NotFound()  # 404 (et non 403) : on ne revele pas l'existence d'un objet qu'on n'a pas le droit de voir
    return obj


def client_ip(request) -> str | None:
    """IP du client : le routeur Cloudflare la transmet dans X-Client-IP (de confiance car l'origine refuse tout acces direct)."""
    if settings.EDGE_SHARED_SECRET and request.META.get("HTTP_X_CLIENT_IP"):
        return request.META["HTTP_X_CLIENT_IP"][:45]
    return request.META.get("REMOTE_ADDR")


def user_agent(request) -> str:
    return request.META.get("HTTP_USER_AGENT", "")[:400]
