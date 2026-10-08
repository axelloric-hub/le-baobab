from __future__ import annotations

from django.db import connection
from rest_framework import serializers as s

from apps.core.api import endpoint


@endpoint("[Administration] Indicateurs quotidiens de la plateforme (vue materialisee).", auth="staff", query={"days": s.IntegerField(min_value=1, max_value=366, default=30)})
def platform_daily(request):
    with connection.cursor() as cur:
        cur.execute("SELECT * FROM mv_platform_daily ORDER BY 1 DESC LIMIT %s", [request.q["days"]])
        cols = [c[0] for c in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]
