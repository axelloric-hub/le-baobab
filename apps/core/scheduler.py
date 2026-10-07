"""Planificateur INTERNE : remplace un service de cron payant. Il tourne dans un thread du processus web.
Principe : les evenements outbox ne sont ecrits QUE pendant une requete, donc quand le processus est eveille ; le thread les relaie
quelques secondes plus tard. Si l'hebergeur met le service en veille (offre gratuite), plus rien n'est ecrit ni relaye, et les
evenements restants sont traites au reveil. Les jobs "periodiques" (vues, purge...) ne tournent donc que pendant l'activite.
Plusieurs workers : chaque job singleton est protege par un SET NX EX dans Redis (un seul worker l'execute par intervalle) ;
le relais de l'outbox n'a pas besoin de barriere (SELECT ... FOR UPDATE SKIP LOCKED)."""
from __future__ import annotations

import logging
import threading
import time
from dataclasses import dataclass
from typing import Callable

log = logging.getLogger("baobab.scheduler")
_started = threading.Event()


@dataclass(frozen=True)
class Job:
    name: str
    every: int  # secondes
    run: Callable[[], object]
    singleton: bool = True


def _command(name: str, *args: str, **kwargs) -> Callable[[], object]:
    def run() -> object:
        from django.core.management import call_command

        return call_command(name, *args, verbosity=0, **kwargs)

    return run


def default_jobs() -> list[Job]:
    from apps.core.outbox import relay_batch

    return [
        Job("relay-outbox", 3, lambda: relay_batch(500), singleton=False),
        Job("flush-counters", 300, _command("flush_counters")),  # 5 min : economise le quota de commandes d'un Redis gratuit
        Job("refresh-trending", 600, _command("refresh_materialized_views", "mv_trending_hashtags")),
        Job("refresh-platform", 3600, _command("refresh_materialized_views", "mv_platform_daily")),
        Job("refresh-metrics", 3600, _command("refresh_metrics", days=2)),
        Job("housekeeping", 3600, _command("housekeeping")),
    ]


def redis_claim(job: Job) -> bool:
    """Vrai si CE worker doit executer le job pour l'intervalle courant."""
    if not job.singleton:
        return True
    from apps.core import redis_keys as K
    from apps.core.redis import get_redis

    return bool(get_redis().set(K.sched(job.name), 1, nx=True, ex=max(job.every - 1, 1)))


def run_due(jobs: list[Job], last_run: dict[str, float], now: float, claim: Callable[[Job], bool] = redis_claim) -> list[str]:
    """Execute les jobs echus. Fonction pure vis-a-vis du temps (testable). Une erreur n'arrete jamais les autres jobs."""
    executed: list[str] = []
    for job in jobs:
        if now - last_run.get(job.name, float("-inf")) < job.every:
            continue
        last_run[job.name] = now
        try:
            if not claim(job):
                continue
            job.run()
            executed.append(job.name)
        except Exception:  # noqa: BLE001
            log.exception("scheduler job failed: %s", job.name)
    return executed


def _loop() -> None:
    from django.db import connections

    time.sleep(10)  # laisse l'application finir de demarrer
    jobs, last_run = default_jobs(), {}
    while True:
        try:
            run_due(jobs, last_run, time.monotonic())
        except Exception:  # noqa: BLE001
            log.exception("scheduler tick failed")
        finally:
            connections.close_all()  # ne jamais garder une connexion inactive (pooler gratuit : connexions comptees)
        time.sleep(1)


def start_in_background() -> bool:
    if _started.is_set():
        return False
    _started.set()
    threading.Thread(target=_loop, name="baobab-scheduler", daemon=True).start()
    log.info("in-process scheduler started")
    return True
