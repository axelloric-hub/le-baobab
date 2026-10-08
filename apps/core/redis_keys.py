"""Convention de cles Redis : baobab:<domaine>:<id>[:<facette>]. UNIQUE point de construction
des cles -> impossible de collisionner ou d'oublier le prefixe. TTL centralises ici."""
from __future__ import annotations

from typing import Final

PREFIX: Final = "baobab"

# TTL en secondes
TTL_PROFILE_CACHE: Final = 600
TTL_PERMISSIONS_CACHE: Final = 120
TTL_FEED_CACHE: Final = 60 * 15
TTL_PRESENCE: Final = 90          # heartbeat client toutes les ~30 s
TTL_TYPING: Final = 6
TTL_OTP: Final = 600
TTL_IDEMPOTENCY: Final = 60 * 60 * 24
TTL_LOCK_DEFAULT: Final = 30
TTL_UNREAD: Final = 60 * 60 * 24 * 7
TTL_DEDUP: Final = 60 * 60


def _k(*parts: object) -> str:
    return ":".join([PREFIX, *(str(p) for p in parts)])


def user(uid) -> str: return _k("user", uid)
def user_profile(uid) -> str: return _k("user", uid, "profile")
def user_presence(uid) -> str: return _k("user", uid, "presence")
def user_permissions(uid) -> str: return _k("user", uid, "perms")
def user_notifications_unread(uid) -> str: return _k("user", uid, "notif", "unread")
def conversation_typing(cid) -> str: return _k("conversation", cid, "typing")
def conversation_unread(cid) -> str: return _k("conversation", cid, "unread")  # hash user_id -> n
def feed(uid) -> str: return _k("feed", uid)                       # sorted set post_id/score
def feed_cache(uid, page) -> str: return _k("feed", uid, "page", page)
def rate_limit(scope: str, ident) -> str: return _k("rate_limit", scope, ident)
def lock(resource: str, ident) -> str: return _k("lock", resource, ident)
def idempotency(scope: str, key: str) -> str: return _k("idem", scope, key)
def otp(purpose: str, ident) -> str: return _k("otp", purpose, ident)
def counter(kind: str, ident) -> str: return _k("cnt", kind, ident)   # compteurs chauds -> flush PG
def ad_freq(ad_id, uid, window: str) -> str: return _k("ad", "freq", ad_id, uid, window)
def dedup(scope: str, ident) -> str: return _k("dedup", scope, ident)
def pubsub_channel(name: str) -> str: return _k("pubsub", name)
def celebrity_authors() -> str: return _k("feed", "celebrities")  # set d'auteurs 'pull' (audience > seuil de fan-out)
def sched(job: str) -> str: return _k("sched", job)  # barriere "deja execute pour cet intervalle" du planificateur interne
def ad_gate_day(campaign, day) -> str: return _k("ad", "gate", campaign, day)          # depense du jour (micro) : plafond de budget temps reel
def ad_gate_total(campaign) -> str: return _k("ad", "gate_total", campaign)            # depense cumulee (micro), initialisee depuis PostgreSQL
def ad_acc(ad, day) -> str: return _k("ad", "acc", ad, day)                            # accumulateur a regler (hash impressions/clics/conversions/depense)
def ad_settling(batch, ad, day) -> str: return _k("ad", "settling", batch, ad, day)    # lot en cours de reglement (rejouable)
def ad_dedupe(kind, ident) -> str: return _k("ad", "dedupe", kind, ident)
