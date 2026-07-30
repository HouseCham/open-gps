# Nginx reverse proxy + static file server.
# Builds the frontend inside this image via `additional_contexts` (see
# docker-compose.local.yml) so nginx is self-contained — no dependency
# on an external pre-built image and no race during parallel builds.
FROM node:22-alpine AS frontend-builder
WORKDIR /app
COPY --from=frontend package.json pnpm-lock.yaml .npmrc pnpm-workspace.yaml ./
RUN corepack enable pnpm && pnpm install --frozen-lockfile
COPY --from=frontend . .
ARG PUBLIC_API_URL
ENV PUBLIC_API_URL=${PUBLIC_API_URL}
ARG RESEND_API_KEY
ENV RESEND_API_KEY=${RESEND_API_KEY}
ARG WELCOME_EMAIL_TEMPLATE_EN
ENV WELCOME_EMAIL_TEMPLATE_EN=${WELCOME_EMAIL_TEMPLATE_EN}
ARG WELCOME_EMAIL_TEMPLATE_ES
ENV WELCOME_EMAIL_TEMPLATE_ES=${WELCOME_EMAIL_TEMPLATE_ES}
ARG EMAIL_FROM
ENV EMAIL_FROM=${EMAIL_FROM}
RUN pnpm build

FROM nginx:alpine
RUN rm -rf /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=frontend-builder /app/dist /var/www/html

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]
