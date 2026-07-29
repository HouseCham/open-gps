# Nginx reverse proxy + static file server.
# Config + self-signed cert live alongside this Dockerfile; the frontend
# static build is mounted at runtime by docker-compose (see volumes:
# in the nginx service).
FROM chamito/open-gps-frontend:dev AS frontend
FROM nginx:alpine

RUN rm -rf /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=frontend /app/dist /var/www/html

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]