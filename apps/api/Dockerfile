# Fastify API + worker. Builds natively on ARM64 (Oracle Ampere) and x86.
# Build from the repo root: docker build -f apps/api/Dockerfile -t dairy-api .
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages ./packages
COPY apps/api ./apps/api
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --filter @dairy/api... --filter @dairy/db...
RUN pnpm --filter @dairy/api build
# Production node_modules for the API only (workspace packages are bundled by tsup).
RUN pnpm deploy --legacy --filter @dairy/api --prod /out && cp -r apps/api/dist /out/dist

# Migration image: runs SQL migrations with the migrator role, then exits.
FROM build AS migrate
WORKDIR /repo/packages/db
CMD ["pnpm", "migrate"]

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /out ./
USER node
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s CMD node -e "fetch('http://127.0.0.1:4000/v1/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/server.js"]
