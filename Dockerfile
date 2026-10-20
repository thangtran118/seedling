# Seedling for a VPS (design doc, Distribution Plan: host in Vietnam, Docker app + Postgres).
# One full image keeps drizzle-kit and the admin CLI available inside the container:
#   docker compose --profile prod exec app pnpm admin bootstrap --area "..." --name "..." --phone 09...
FROM node:24-alpine
WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
# db/index.ts needs a URL at import time; postgres-js connects lazily, so nothing is contacted during build.
RUN DATABASE_URL=postgres://build:build@localhost:5432/build pnpm build

ENV NODE_ENV=production PORT=3000
EXPOSE 3000
CMD ["sh", "-c", "pnpm db:migrate && pnpm start"]
