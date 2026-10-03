# nginx — Reverse Proxy

Single entry point for the full GPS Tracker stack. Sits between the
browser and the two internal upstreams — the Astro static build and the
Go API (which embeds Authula) — routing requests to the right target.
TLS is handled per environment: self-signed certs in local dev,
Traefik in production (see *Local vs production*).

## Why a reverse proxy?

The app uses http-only session cookies for authentication
(`authula.session_token` set by Authula). Browsers only send such cookies
back to the **same origin** that set them. With the frontend and backend
on different ports, the cookie never reaches the API.

Putting every service behind nginx on a single origin (`https://localhost`)
fixes this — the cookie is set, sent, and read within one host, no CORS
or `credentials: 'include'` acrobatics required.

## Routes

Both configs (`nginx.conf` and `nginx.local.conf`) share the same route
table:

| Path prefix     | Upstream               | Purpose                                  |
|-----------------|------------------------|------------------------------------------|
| `/`             | static `/var/www/html` | Astro static build (SPA fallback)        |
| `/api/auth/*`   | `http://api:8080`      | Authula routes + custom /me handler (Fiber) |
| `/api/v1/*`     | `http://api:8080`      | App routes (devices, users, access)      |
| `/health`       | `http://api:8080/health` | Health check                            |

The two SSE routes get special treatment: `proxy_buffering off`,
`proxy_cache off`, `gzip off`, and a long `proxy_read_timeout` (75s) so
real-time events stream through without buffering:

- `/api/v1/devices/:id/locations/stream` — regex location
  (`~ ^/api/v1/devices/[^/]+/locations/stream$`)
- `/api/v1/guest/device/stream` — exact match (`= ...`)

nginx gives exact (`=`) and regex locations precedence over the generic
`/api/v1/` prefix regardless of declaration order, so no ordering trick
is needed.

## Local vs production

| | Local (`docker-compose.local.yml`) | Production (`docker-compose.yml`) |
|---|---|---|
| Config file | `nginx.local.conf` (mounted over `/etc/nginx/conf.d/default.conf`) | `nginx.conf` (baked into the image) |
| TLS | Self-signed cert, terminates in this nginx (`:443`); `:80` redirects to HTTPS | Plain HTTP/`80` only — Traefik terminates TLS upstream and injects `X-Forwarded-Proto` |
| Static files | Named volume `frontend_dist` mounted read-only at `/var/www/html` | Astro `dist/` baked into the image at build time |
| Image | Built from `./nginx` with `additional_contexts: frontend=service:frontend` | Prebuilt `chamito/open-gps-nginx:dev` (CI builds it with `--build-context frontend=docker-image://…`) |

Local stack:

```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml up
# or: make run
```

## Layout

```
nginx/
├── Dockerfile         # Multi-stage: nginx:alpine + config + baked frontend dist
├── nginx.conf         # Production config (routes, SPA fallback; TLS is Traefik's job)
├── nginx.local.conf   # Local dev config (TLS with self-signed cert, HTTP→HTTPS redirect)
├── certs/             # Local TLS certs (gitignored, generated)
│   ├── localhost.crt
│   └── localhost.key
└── README.md          # This file
```

## How the static files reach nginx

**Local:** the `frontend` service is an Alpine runtime image whose only
job is to hold the named Docker volume (`frontend_dist`) containing the
Astro `dist/` (the container just runs `tail -f /dev/null`). Nginx
mounts the same volume read-only at `/var/www/html` and serves it
directly — no second nginx bundled inside the frontend image.

**Production:** there is no `frontend` service at runtime. The nginx
image bakes the static build in via a multi-stage copy
(`COPY --from=frontend /app/dist /var/www/html`); CI feeds the frontend
image in as a build context. Ship the contents of `dist/` to a CDN /
object store instead if you want to skip nginx's static role entirely.

## TLS / local certificates

TLS applies to **local development only** — the production config
(`nginx.conf`) has no cert files at all; Traefik terminates TLS before
traffic reaches this container.

For local dev the repo expects a self-signed cert at
`nginx/certs/localhost.crt` and matching key at
`nginx/certs/localhost.key`, mounted read-only at `/etc/nginx/certs/`
and referenced by `nginx.local.conf`.

Two ways to get them:

**Option A — openssl (default, no browser trust)**
```bash
./scripts/generate-certs.sh          # uses openssl
# or force-regenerate:
./scripts/generate-certs.sh --force
```
Browsers will warn on every visit. Click *Advanced → Proceed* to accept.

**Option B — mkcert (recommended, browser-trusted)**
```bash
sudo pacman -S mkcert nss            # CachyOS / Arch
sudo mkcert -install                 # one-time, installs local CA

cd nginx/certs
sudo mkcert -key-file localhost.key \
            -cert-file localhost.crt \
            localhost 127.0.0.1
docker compose -f docker-compose.yml -f docker-compose.local.yml restart nginx
```
`https://localhost` will show a green padlock with no warning.

## Troubleshooting

| Symptom | Check | Fix |
|---------|-------|-----|
| `404` on all `/api/v1/*` routes | `docker compose ps api` shows api up | Ensure `API_PORT=8080` (`.env`); compose passes it as `API_PORT: ${API_PORT}` |
| `404` on all `/api/*` routes | `docker logs open-gps-api` | Go binary defaults to port 3000; `API_PORT` env var must be set to `8080` |
| `host not found in upstream "api"` | `docker compose ps api` | nginx started before the api container — restart it: `docker compose … restart nginx` |
| `502 Bad Gateway` on `/api/*` | `docker compose logs api` | api container is down or crashing — check logs |
| Cookie not set on sign-in | DevTools → Network → check `Set-Cookie` header | `AUTHULA_BASE_URL` must match the public origin nginx exposes (`https://localhost` in dev) |
| OAuth redirect 404 at `/api/auth/oauth2/callback/google` | Same as above | Authula's redirect URL in Google Cloud Console must match `AUTHULA_BASE_URL` + `/api/auth/oauth2/callback/google` |
| Self-signed warning in Chrome/Firefox | — | See *Option B* above (mkcert) |

## Common operations

Container names below are the explicit ones from
`docker-compose.local.yml` (production containers are
project-prefixed, e.g. `<project>-nginx-1` — adjust accordingly):

```bash
# Validate the config without reloading
docker exec open-gps-nginx nginx -t

# Reload after editing nginx.conf (no downtime)
docker exec open-gps-nginx nginx -s reload

# Tail logs
docker logs -f open-gps-nginx

# Tail access + error logs (the second one is more useful in dev)
docker exec open-gps-nginx tail -f /var/log/nginx/error.log
```

## Production notes (intentionally out of scope for this README)

- TLS and the `secure` flag on the Authula session cookie are handled at
  the Traefik layer upstream of this container.
- HSTS, rate-limiting, and security headers — add as separate `server`
  block if you terminate TLS in this nginx instead.
- CORS: leave `CORS_ALLOWED_ORIGINS` empty for same-origin deployments;
  set it when the API and SPA are hosted on different domains.
