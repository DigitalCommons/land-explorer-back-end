# syntax=docker/dockerfile:1

# Multi-stage build for the Land Explorer back-end (Hapi, TypeScript compiled
# to lib/ with tsc). Modelled on mykomap-monolith/apps/back-end/Dockerfile.
# See docs/coolify.md for how to build and run this.
#
# Note: unlike the Mykomap back-end (which is bundled by Vite), this app is
# compiled with plain tsc and is NOT bundled, so it needs its production
# node_modules present at runtime.

# Node version must be supplied (e.g. 24). No sane default - fail loudly if unset.
ARG NODE_VERSION=nonesuch

# ---- build stage ----
FROM node:${NODE_VERSION}-alpine AS build
WORKDIR /app

# git: lets the build read tag/commit info for version metadata.
# python3/make/g++: needed to compile the native `bcrypt` dependency on musl.
RUN apk add --no-cache git python3 make g++

# Install deps first (cache-friendly), then bring in source and compile.
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY . .
RUN npm run build
# NB: dev dependencies are kept in this stage so the compose `migrate` service
# (which targets this stage) has sequelize-cli available. The runtime stage
# prunes them.

# ---- runtime stage ----
FROM node:${NODE_VERSION}-alpine
WORKDIR /app

# Default to production. The dev compose overrides this to `development` so the
# back-end's CORS allows the local front-end origin (see src/server.ts).
ENV NODE_ENV=production

# Compiled app + node_modules + the Sequelize config, then strip dev deps
# (keeping compiled native modules like bcrypt intact).
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/lib ./lib
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/config ./config
RUN npm prune --omit=dev

USER node
EXPOSE 4000

# Docker is the process supervisor; we run node directly rather than via pm2.
CMD ["node", "lib/main.js"]
