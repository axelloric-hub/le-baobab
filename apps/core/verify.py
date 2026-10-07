"""Verification de bout en bout de la couche data (utilisee par `manage.py check_databases` et scripts/check_databases.py)."""
from __future__ import annotations

from django.conf import settings
from django.db import connection

from apps.core import redis as R
from apps.core.mongo import get_db, load_collection_specs

EXPECTED_FUNCTIONS = [
    "baobab_set_updated_at", "baobab_forbid_mutation", "baobab_attach_updated_at_triggers", "baobab_message_assign_seq",
    "baobab_audit_row", "baobab_are_friends", "baobab_group_has_permission", "baobab_feed_score", "baobab_unread_count",
    "baobab_user_stats", "baobab_recount_post_counters", "baobab_refresh_daily_metrics", "baobab_housekeeping",
]
EXPECTED_TRIGGERS = ["trg_post_reaction_count", "trg_comment_count", "trg_group_member_count", "trg_message_assign_seq",
                     "trg_audit_log_immutable", "trg_moderation_action_immutable", "trg_audit_user", "trg_set_updated_at"]
EXPECTED_VIEWS = ["v_user_statistics", "v_group_statistics", "v_moderation_queue", "mv_platform_daily", "mv_trending_hashtags"]
EXPECTED_INDEXES = ["post_fts_idx", "audit_log_created_brin", "outbox_pending_idx", "post_author_pub_idx", "friend_low_acc_idx"]
Result = tuple[str, bool, str]


def _pg() -> list[Result]:
    out: list[Result] = []
    with connection.cursor() as cur:
        cur.execute("SELECT version()")
        out.append(("postgres.connexion", True, cur.fetchone()[0].split(",")[0]))
        cur.execute("SELECT count(*) FROM information_schema.tables WHERE table_schema = current_schema() AND table_type = 'BASE TABLE'")
        n = cur.fetchone()[0]
        out.append(("postgres.tables", n >= 90, f"{n} tables"))
        cur.execute("SELECT extname FROM pg_extension")
        ext = {r[0] for r in cur.fetchall()}
        out.append(("postgres.extensions", {"pg_trgm", "btree_gist"} <= ext, ", ".join(sorted(ext))))
        for label, sql, expected in [
            ("fonctions", "SELECT proname FROM pg_proc WHERE proname LIKE 'baobab\\_%'", EXPECTED_FUNCTIONS),
            ("triggers", "SELECT DISTINCT tgname FROM pg_trigger WHERE NOT tgisinternal", EXPECTED_TRIGGERS),
            ("vues", "SELECT viewname FROM pg_views WHERE schemaname = current_schema() UNION SELECT matviewname FROM pg_matviews", EXPECTED_VIEWS),
            ("index", "SELECT indexname FROM pg_indexes WHERE schemaname = current_schema()", EXPECTED_INDEXES),
        ]:
            cur.execute(sql)
            present = {r[0] for r in cur.fetchall()}
            missing = [e for e in expected if e not in present]
            out.append((f"postgres.{label}", not missing, f"{len(present)} presents" + (f", MANQUANTS: {missing}" if missing else "")))
        cur.execute("SELECT count(*) FROM pg_constraint WHERE contype = 'x'")
        out.append(("postgres.exclusion", cur.fetchone()[0] >= 1, "contrainte d'exclusion des sanctions"))
        cur.execute("SELECT count(*) FROM django_migrations WHERE app = 'dbobjects'")
        out.append(("postgres.migrations", cur.fetchone()[0] >= 2, "dbobjects appliquees"))
    return out


def _mongo() -> list[Result]:
    out: list[Result] = []
    try:
        db = get_db()
        db.command("ping")
        out.append(("mongodb.connexion", True, settings.MONGODB_DATABASE))
        existing = set(db.list_collection_names())
        for spec in load_collection_specs():
            name = spec["name"]
            if name not in existing:
                out.append((f"mongodb.{name}", False, "collection absente (lancer manage.py mongo_setup)"))
                continue
            have = {i["name"] for i in db[name].list_indexes()}
            missing = [i["name"] for i in spec.get("indexes", []) if i["name"] not in have]
            out.append((f"mongodb.{name}", not missing, f"{len(have)} index" + (f", MANQUANTS: {missing}" if missing else "")))
    except Exception as exc:  # noqa: BLE001
        out.append(("mongodb.connexion", False, repr(exc)))
    return out


def _redis() -> list[Result]:
    out: list[Result] = []
    try:
        r = R.get_redis()
        out.append(("redis.connexion", bool(r.ping()), settings.REDIS_URL.rsplit("@", 1)[-1]))
        for script in ("rate_limit", "lock_release", "capped_incr", "idempotency_acquire"):
            R._script(script)
        out.append(("redis.scripts", True, "4 scripts Lua enregistres"))
        allowed, remaining, _ = R.rate_limit("selfcheck", "x", 1, 1)
        out.append(("redis.rate_limit", allowed and remaining == 0, "script Lua operationnel"))
        try:
            policy = r.config_get("maxmemory-policy").get("maxmemory-policy", "?")
            ok = policy in {"volatile-lru", "volatile-lfu", "noeviction", "volatile-ttl"}
            out.append(("redis.eviction", ok, f"maxmemory-policy={policy}" + ("" if ok else " (allkeys-* peut evincer des verrous/idempotence)")))
        except Exception:  # noqa: BLE001 - CONFIG interdit sur certains services manages
            out.append(("redis.eviction", True, "CONFIG indisponible (service manage) : verifier maxmemory-policy cote fournisseur"))
    except Exception as exc:  # noqa: BLE001
        out.append(("redis.connexion", False, repr(exc)))
    return out


def verify_all() -> list[Result]:
    return _pg() + _mongo() + _redis()
