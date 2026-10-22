#!/usr/bin/env bash
# Opens an SSH tunnel to the production database, which only listens on the server's 127.0.0.1:5433.
# While it runs, connect any SQL client to localhost:15432 (user seedling, db seedling, POSTGRES_PASSWORD from .env).
#   deploy/db-tunnel.sh ubuntu@<ip>
set -euo pipefail

HOST="${1:-${SEEDLING_HOST:-}}"
LOCAL_PORT="${LOCAL_PORT:-15432}"
if [ -z "$HOST" ]; then
  echo "Cách dùng: deploy/db-tunnel.sh ubuntu@<ip>" >&2
  exit 1
fi
echo "Tunnel mở: postgres://seedling:<POSTGRES_PASSWORD>@localhost:$LOCAL_PORT/seedling  (Ctrl+C để đóng)"
exec ssh -N -L "$LOCAL_PORT:127.0.0.1:5433" "$HOST"
