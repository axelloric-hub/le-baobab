from .base import *  # noqa: F401,F403
from .base import DATABASES, env, env_bool

DEBUG = False
SECURE_SSL_REDIRECT = env_bool("SECURE_SSL_REDIRECT", True)
# Derriere un Worker Cloudflare : le conteneur recoit du HTTP simple et un Host interne ("container").
# Le Worker ECRASE toujours X-Forwarded-Proto/Host et le conteneur n'est joignable que par lui (jamais direct).
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
USE_X_FORWARDED_HOST = True
SECURE_REDIRECT_EXEMPT = [r"^health/$", r"^ready/$", r"^internal/jobs/"]  # sondes et cron : appels internes en HTTP
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_REFERRER_POLICY = "same-origin"
DATABASES["default"]["OPTIONS"] = {**DATABASES["default"].get("OPTIONS", {}), "sslmode": "require"}
if len(SECRET_KEY) < 50:  # noqa: F405
    raise RuntimeError("DJANGO_SECRET_KEY trop courte pour la production")
if not INTERNAL_JOB_SECRET or len(INTERNAL_JOB_SECRET) < 32:  # noqa: F405
    raise RuntimeError("INTERNAL_JOB_SECRET (>= 32 caracteres) requis en production")
