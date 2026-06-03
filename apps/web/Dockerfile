FROM node:20-bookworm-slim AS build
WORKDIR /app
ARG PNPM_VERSION=9.15.9
ENV PNPM_HOME=/root/.local/share/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/toolbox-core/package.json packages/toolbox-core/package.json
RUN pnpm install --filter web... --frozen-lockfile

COPY apps/web apps/web
COPY packages packages
WORKDIR /app/apps/web
RUN pnpm run build

FROM nginx:1.27-alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
