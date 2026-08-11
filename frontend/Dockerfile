#== Build stage
# Pure Astro build artifact. No runtime web server bundled in this image —
# nginx (in the reverse-proxy service) serves /app/dist as static files.
# The container stays alive in compose only to hold the named volume that
# nginx mounts. In production, ship the contents of /app/dist to a CDN /
# object store and skip the runtime stage entirely.
FROM node:22-alpine AS builder

WORKDIR /app

ARG PUBLIC_ENV=production
ARG PUBLIC_API_URL=
ARG PUBLIC_APP_ORIGIN=
ENV PUBLIC_ENV=${PUBLIC_ENV} \
    PUBLIC_API_URL=${PUBLIC_API_URL} \
    PUBLIC_APP_ORIGIN=${PUBLIC_APP_ORIGIN}

COPY package.json pnpm-lock.yaml .npmrc pnpm-workspace.yaml ./
RUN corepack enable pnpm && pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

#== Runtime stage
FROM alpine:3.20 AS runtime
WORKDIR /app
# Copy the static build so the named volume can mount it.
COPY --from=builder /app/dist /app/dist
# Keep the container alive so the named volume stays mounted.
CMD ["tail", "-f", "/dev/null"]
