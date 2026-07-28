FROM postgres:16

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        postgresql-16-cron \
        postgresql-16-partman \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* /var/cache/apt/archives/* \
    && echo "shared_preload_libraries = 'pg_cron'" >> /usr/share/postgresql/postgresql.conf.sample \
    && echo "cron.database_name = 'opengps'" >> /usr/share/postgresql/postgresql.conf.sample

EXPOSE 5432