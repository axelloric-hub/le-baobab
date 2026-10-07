#!/bin/sh
# SERVICE_ROLE=api (defaut) : API REST.  SERVICE_ROLE=ws : WebSocket (connexions longues, timeouts plus larges).
# Les migrations NE sont PAS lancees ici (N conteneurs en parallele) : elles tournent une fois, dans la CI, avant le deploiement.
set -eu
PORT="${PORT:-8080}"
case "${SERVICE_ROLE:-api}" in
  api)
    exec gunicorn config.asgi:application -k uvicorn_worker.UvicornWorker \
      --workers "${WEB_CONCURRENCY:-2}" --bind "0.0.0.0:${PORT}" \
      --timeout 60 --graceful-timeout 30 --keep-alive 5 --access-logfile - ;;
  ws)
    exec gunicorn config.asgi:application -k uvicorn_worker.UvicornWorker \
      --workers "${WEB_CONCURRENCY:-1}" --bind "0.0.0.0:${PORT}" \
      --timeout 120 --graceful-timeout 60 --keep-alive 75 --access-logfile - ;;
  *) echo "SERVICE_ROLE inconnu: ${SERVICE_ROLE}" >&2; exit 64 ;;
esac
