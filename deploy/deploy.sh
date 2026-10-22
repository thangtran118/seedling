#!/usr/bin/env bash
# Copy the code to the server and (re)build + restart the app. Migrations run when the app container starts.
#   deploy/deploy.sh ubuntu@<ip>        (or: SEEDLING_HOST=ubuntu@<ip> deploy/deploy.sh)
set -euo pipefail

HOST="${1:-${SEEDLING_HOST:-}}"
APP_DIR="${SEEDLING_DIR:-/opt/seedling}"
if [ -z "$HOST" ]; then
  echo "Cách dùng: deploy/deploy.sh ubuntu@<ip>" >&2
  exit 1
fi

cd "$(dirname "$0")/.."

if [ -n "$(git status --porcelain)" ]; then
  echo "Cảnh báo: có thay đổi chưa commit, chúng cũng sẽ được deploy." >&2
fi
echo "Deploy $(git rev-parse --short HEAD) lên $HOST:$APP_DIR"

# The server keeps its own .env and backups/; --delete never touches excluded paths.
rsync -az --delete \
  --include=.env.production.example \
  --exclude=.git --exclude=node_modules --exclude=.next \
  --exclude=.env --exclude='.env.*' \
  --exclude=backups --exclude=.gstack --exclude=.idea --exclude=.claude \
  ./ "$HOST:$APP_DIR/"

ssh "$HOST" bash -s -- "$APP_DIR" <<'REMOTE'
set -euo pipefail
cd "$1"
if ! grep -qE '^POSTGRES_PASSWORD=.{16,}' .env 2>/dev/null || ! grep -qE '^SITE_DOMAIN=.+' .env; then
  echo "Thiếu $1/.env (POSTGRES_PASSWORD ít nhất 16 ký tự, SITE_DOMAIN). Xem DEPLOY.md." >&2
  exit 1
fi
docker compose --profile prod up -d --build --remove-orphans
docker image prune -f >/dev/null
docker compose --profile prod ps
REMOTE

echo "Xong. Xem log: ssh $HOST 'cd $APP_DIR && docker compose --profile prod logs -f app'"
