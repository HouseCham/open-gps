# nginx — Reverse Proxy

Single entry point for the full GPS Tracker stack. Sits between the browser
and the three internal services (Astro SPA, Go API, Authula), terminating
TLS and routing requests to the right upstream.

## Why a reverse proxy?

The app uses http-only session cookies for authentication
(`authula.session_token` set by Authula). Browsers only send such cookies
back to the **same origin** that set them. With the frontend and backend
on different ports, the cookie never reaches the API.

Putting every service behind nginx on a single origin (`https://localhost`)
fixes this — the cookie is set, sent, and read within one host, no CORS
or `credentials: 'include'` acrobatics required.

## Routes

| Path prefix     | Upstream               | Purpose                                  |
|-----------------|------------------------|------------------------------------------|
| `/`             | frontend `/var/www/html` | Astro static build (SPA fallback)        |
| `/api/auth/*`   | `http://api:8080`      | Authula routes + custom /me handler (Fiber) |
| `/api/v1/*`     | `http://api:8080`      | App routes (devices, users, access)      |
| `/health`       | `http://api:8080/health` | Health check                            |

The `/api/v1/devices/:id/locations/stream` SSE route is proxied with
`proxy_buffering off`, `proxy_cache off`, `gzip off`, and a long
`proxy_read_timeout` (75s) so real-time events stream through without
buffering. Its `location` block is declared *before* the generic `/api/v1/`
prefix so it takes precedence.

Plain HTTP (`:80`) is redirected to HTTPS (`:443`) — see the first `server`
block in `nginx.conf`.

## Layout

```
nginx/
├── Dockerfile         # nginx:alpine + the config
├── nginx.conf         # The reverse proxy config (routes + TLS)
├── certs/             # Local TLS cert (gitignored, generated)
│   ├── localhost.crt
│   └── localhost.key
└── README.md          # This file
```

## How the static files reach nginx

The `frontend` service is a tiny Alpine image that exists only to hold a
named Docker volume (`frontend_dist`) containing the Astro `dist/`. Nginx
mounts the same volume read-only at `/var/www/html` and serves it
directly — no second nginx bundled inside the frontend image.

## TLS / local certificates

For local development the repo expects a self-signed cert at
`nginx/certs/localhost.crt` and matching key at `nginx/certs/localhost.key`.

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
docker compose restart nginx
```
`https://localhost` will show a green padlock with no warning.

For production, replace `localhost.crt` and `localhost.key` with a
real cert (Let's Encrypt, your CA, etc.). The nginx config references
both files by path, so swapping them is enough.

## Common errors

| Symptom | Check | Fix |
|---------|-------|-----|
| `404` on all `/api/v1/*` routes | `docker compose ps api` shows api up | Add `API_PORT: ${API_PORT}` to the api service in `docker-compose.yml` |
| `404` on all `/api/*` routes | `docker logs gps-tracker-api` | Go binary defaults to port 3000; `API_PORT` env var must be set to `8080` |
| `host not found in upstream "api"` | `docker compose ps api` | nginx started before the api container — `docker compose restart nginx` |
| `502 Bad Gateway` on `/api/*` | `docker compose logs api` | api container is down or crashing — check logs |
| Cookie not set on sign-in | DevTools → Network → check `Set-Cookie` header | `AUTHULA_BASE_URL` must match the public origin nginx exposes (`https://localhost` in dev) |
| OAuth redirect 404 at `/api/auth/oauth2/callback/google` | Same as above | Authula's redirect URL in Google Cloud Console must match `AUTHULA_BASE_URL` + `/api/auth/oauth2/callback/google` |

## Common operations

```bash
# Validate the config without reloading
docker exec gps-tracker-nginx nginx -t

# Reload after editing nginx.conf (no downtime)
docker exec gps-tracker-nginx nginx -s reload

# Tail logs
docker logs -f gps-tracker-nginx

# Tail access + error logs (the second one is more useful in dev)
docker exec gps-tracker-nginx tail -f /var/log/nginx/error.log
```

## Troubleshooting

| Symptom                                 | Likely cause                                         |
|-----------------------------------------|------------------------------------------------------|
| `host not found in upstream "api"`      | nginx started before the `api` container was healthy |
| 502 Bad Gateway on `/api/*`             | api container is down — `docker compose ps api`      |
| Cookie not set on sign-in               | `AUTHULA_BASE_URL` doesn't match the public origin   |
| OAuth callback returns 404              | Same: Authula's redirect URL must match `https://localhost` |
| Self-signed warning in Chrome/Firefox   | See *Option B* above                                 |

## Production notes (intentionally out of scope for this README)

- Replace self-signed cert with a real one, set `secure = true` on the
  Authula session cookie (`backend/config.toml`).
- HSTS, rate-limiting, and security headers — add as separate `server`
  block.
- CORS: leave `CORS_ALLOWED_ORIGINS` empty for same-origin deployments;
  set it when the API and SPA are hosted on different domains.