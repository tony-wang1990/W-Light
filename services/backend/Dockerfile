FROM node:20-bookworm-slim AS base
WORKDIR /app
ENV PNPM_HOME=/root/.local/share/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY services/backend/package.json services/backend/package.json
COPY apps/LightOps/package.json apps/LightOps/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/toolbox-core/package.json packages/toolbox-core/package.json
RUN pnpm install --filter backend... --frozen-lockfile

FROM deps AS build
COPY services/backend services/backend
WORKDIR /app/services/backend
RUN pnpm run build

FROM base AS production
ENV NODE_ENV=production
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY services/backend/package.json services/backend/package.json
COPY apps/LightOps/package.json apps/LightOps/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/toolbox-core/package.json packages/toolbox-core/package.json
RUN pnpm install --filter backend... --prod --frozen-lockfile
COPY --from=build /app/services/backend/dist services/backend/dist
WORKDIR /app/services/backend
EXPOSE 3000
CMD ["pnpm", "run", "start"]
