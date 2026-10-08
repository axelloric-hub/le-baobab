"""Integrations externes : lecture seule pour l'instant. Les connexions OAuth (GitHub, TikTok...) ne sont pas implementees."""
from __future__ import annotations

from rest_framework.response import Response

from apps.core.api import endpoint, get_or_404
from apps.integrations.models import ExternalAccount, ExternalProvider


@endpoint("Fournisseurs externes pris en charge (la connexion n'est pas encore disponible).", auth="public")
def providers(request):
    return [{"code": p.pk} for p in ExternalProvider.objects.all()]


@endpoint("Mes comptes externes connectes (jamais les jetons).")
def my_accounts(request):
    return [{"id": str(a.pk), "provider": a.provider_id} for a in ExternalAccount.objects.filter(user=request.user)]


@endpoint("Deconnecter un de mes comptes externes.", status=204)
def disconnect(request, account_id):
    get_or_404(ExternalAccount.objects.filter(pk=account_id, user=request.user)).delete()
    return Response(status=204)
