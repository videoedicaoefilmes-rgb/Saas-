# syntax=docker/dockerfile:1
# Imagem única para web e worker (o comando define o papel). Inclui FFmpeg.
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml prisma.config.ts ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm prisma generate && pnpm build

FROM base AS runtime
ENV NODE_ENV=production
RUN useradd --system --uid 1001 app && mkdir -p /app/.data && chown app /app/.data
COPY --from=build --chown=app /app /app
USER app
EXPOSE 3000
# Web: padrão. Worker: `pnpm worker`. Migrações: `pnpm db:deploy`.
CMD ["pnpm", "start"]
