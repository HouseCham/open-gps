FROM frontend AS frontend

FROM nginx:alpine
RUN rm -rf /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=frontend /app/dist /var/www/html

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]
