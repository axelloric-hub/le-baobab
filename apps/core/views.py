from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.health import check_all


class HealthView(APIView):
    """Liveness : le process repond (aucune dependance)."""

    permission_classes = [AllowAny]
    authentication_classes: list = []
    throttle_classes: list = []

    def get(self, request):
        return Response({"status": "ok"})


class ReadinessView(APIView):
    """Readiness : PostgreSQL + MongoDB + Redis joignables."""

    permission_classes = [AllowAny]
    authentication_classes: list = []
    throttle_classes: list = []

    def get(self, request):
        report = check_all()
        ok = all(item["ok"] for item in report.values())
        return Response({"status": "ready" if ok else "degraded", "checks": report}, status=200 if ok else 503)
