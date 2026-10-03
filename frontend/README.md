# Open GPS — Frontend

A self-hosted, open-source web application for real-time GPS tracking of IoT devices. Built for hobbyists, small businesses, and developers who want full control over their tracking data.

The frontend communicates with a Go + Fiber backend and PostgreSQL database to provide a responsive dashboard for managing GPS devices, visualizing their location history, and administering user access.

---

## Tech Stack

| Layer           | Technology                                                                                |
| --------------- | ----------------------------------------------------------------------------------------- |
| Framework       | [Astro 6](https://astro.build) (Islands Architecture) + [React 19](https://react.dev)     |
| Language        | [TypeScript 6](https://www.typescriptlang.org) (strict mode)                              |
| Styling         | Pure CSS — custom properties, dark/light themes, BEM methodology                          |
| Maps            | [MapLibre GL](https://maplibre.org) (`maplibre-gl` + `react-map-gl`)                      |
| State           | [Nano Stores](https://nanostores.dev)                                                     |
| Icons           | [Lucide](https://lucide.dev) (`@lucide/astro` + `lucide-react`)                           |
| HTTP            | [`@better-fetch/fetch`](https://github.com/better-fetch/fetch)                            |
| Auth            | [`Authula`](https://github.com/Authula/authula) (HTTP-only session cookie) + Google OAuth |
| Fonts           | [`@fontsource`](https://fontsource.org) (Inter, JetBrains Mono)                           |
| Testing         | [Vitest](https://vitest.dev) + Testing Library (happy-dom)                                |
| Package manager | [pnpm](https://pnpm.io)                                                                   |
| Engine          | Node >= 22.12.0                                                                           |

---

## Features

- **Home** — locale detection entry point; dashboard view is a placeholder pending implementation
- **Device Management** — View, search, create, edit, and delete GPS devices with role-based access control (grant/revoke viewer access)
- **Device Detail** — Live location map (MapLibre), GPS telemetry, device/access management, and a lazy-loaded history view with route inspection and CSV export
- **Guest Device Sharing** — Owner-issued read-only location links with 1/2/4/8-hour expiry, early revocation, and live SSE updates
- **Live Tracking** — Real-time position and presence (`online_moving`, `online_stationary`, `offline`, `never_seen`) via one SSE stream with REST snapshot bootstrap and controlled reconnect/fallback
- **Access / API Keys** — Per-device API key management (create, copy, revoke)
- **Reports** — Overview, health, quality, and routes sections with filters and CSV/GPX export
- **User Administration** — Manage users, roles, and temporary-password handoff (super admin)
- **Profile** — View/edit profile, device count, change password
- **Settings** — Theme, language, and password preferences
- **Authentication** — Email/password login (remember me), Google OAuth, first-admin signup, forgot/reset password flows, and route guards (protected, public-only, admin-only, forced password change)
- **No Access Notice** — Guidance screen for authenticated users without permissions
- **Internationalization** — English and Spanish locale support
- **Dark/Light Theme** — Full design system with CSS custom properties
- **Interactive UI** — Modal dialogs, toast notifications, dropdown menus (React islands)
- **Auth Illustrations** — Decorative SVG visuals (`MapSVG`, `RecoveryPipelineSVG`) on auth screens (the tracking map itself is MapLibre GL)

---

## Architecture

### Static-First with Islands of Interactivity

This project follows the **Astro Islands Architecture**:

- **Static content** lives in `.astro` files — zero JavaScript shipped to the browser
- **Interactive islands** are React `.tsx` components hydrated with explicit directives (`client:load`, `client:visible`, `client:idle`)
- Each hydration directive is intentional and justified — no unnecessary client-side JS

### Project Structure

```
src/
├── components/
│   ├── astro/layout/            # AppShell, AuthLayout, MainLayout
│   └── react/
│       ├── access/              # AccessPage — device API-key management
│       ├── auth/                # AuthProvider, route gates (Protected, PublicOnly,
│       │                        #   OnlyAdmin, ChangePassword, FirstRun), RouteFallback
│       ├── features/
│       │   ├── devices/         # DevicesPage, DevicesTable, DeviceFilterBar
│       │   │   ├── access/      #   DeviceAccessTable (per-device user access)
│       │   │   ├── detail/      #   DeviceDetailPage, telemetry, KPIs, status
│       │   │   ├── guest/       #   GuestDevicePage (public read-only view)
│       │   │   ├── history/     #   DeviceHistoryView (lazy, route player, CSV)
│       │   │   └── location/    #   MapCard (MapLibre), TelemetryCard
│       │   ├── no-access/       # NoAccessNotice
│       │   ├── profile/         # ProfilePage
│       │   ├── reports/         # ReportsPage, sections, filters, CSV/GPX export
│       │   ├── settings/        # SettingsPage (theme, language, password)
│       │   └── users/           # UsersPage, UsersTable, UserFilterBar (admin)
│       ├── form/                # LoginForm, SignupForm, ResetPasswordForm,
│       │                        #   ChangePasswordForm, PasswordForgottenForm/
│       │                        #   (+ ui/ field primitives, shared/ helpers)
│       ├── layout/              # Sidebar, Topbar (menus, dropdowns)
│       ├── modal/               # Add/Edit device, user, access key, share,
│       │                        #   profile, temp password + deleteModal/
│       ├── skeleton/            # Loading skeletons
│       ├── ui/                  # Button, Badge, Modal, Toast, KpiCard, Pagination,
│       │                        #   EmptyState, indicators, SearchInput, ...
│       ├── MapSVG.tsx           # Auth-screen illustration (not the tracking map)
│       ├── RecoveryPipelineSVG.tsx
│       └── RolePill.tsx
├── constants/                   # Domain + component constants (api, auth, device,
│                                #   map, reports, settings, regex, ...)
├── hooks/
│   └── useDeviceLocationStream.ts  # SSE live location + presence hook
├── i18n/                        # English (en.ts) and Spanish (es.ts) + getTranslation()
├── lib/
│   ├── api/
│   │   ├── client.ts            # authClient (/api/auth) + apiClient (/api/v1)
│   │   ├── api-utils.ts         # isApiError/isEnvelope guards, error helpers
│   │   ├── helpers/             # handleApiError, withApiErrorToast
│   │   └── services/            # authService, deviceService, userService,
│   │                            #   apiKeyService, locationService, profileService,
│   │                            #   reportsService, shareLinkService, emailService,
│   │                            #   bootstrap.service
│   ├── features/                # vehicle-utils
│   ├── hooks/                   # useAuth, useTheme, useHydrateOnce
│   ├── stores/                  # Nano Stores: auth, theme, toast, layout
│   └── *.ts                     # device, map, user, date, location, reports,
│                                #   settings, router, files, email, role utils...
├── pages/                       # File-based routing (see Routing)
├── scripts/
│   └── theme-init.js            # Pre-paint theme apply (prevents FOUC)
├── styles/
│   ├── global.css               # Design tokens only (~269 lines, sole raw-hex file)
│   ├── components/              # Co-located CSS for auth forms, modals, ...
│   ├── layout/                  # main-layout, sidebar, topbar
│   ├── map/                     # device-map, marker, popover, route-player
│   ├── ui/                      # Per-component CSS (button, modal, toast, ...)
│   └── *.css                    # Page-level styles (devices, reports, access, ...)
└── types/
    ├── api/                     # API request/response types (devices, users, auth,
    │                            #   locations, reports, share-links, api-keys, system)
    ├── components/              # Component prop types, organized by domain (+ ui/)
    ├── layout/                  # Layout prop types
    └── *.ts                     # Domain types (access, profile, settings, reports...)
```

### Routing

- `/` — Language detection, redirects to `/[lan]/` (runs the first-run bootstrap gate)
- `/[lan]/` — Home; **placeholder pending the dashboard view**
- `/[lan]/login` — Authentication (email/password + Google OAuth)
- `/[lan]/signup` — First admin registration
- `/[lan]/forgot-password` — Password recovery request
- `/[lan]/reset-password?token=...` — Password reset
- `/[lan]/devices` — Full device list with management actions
- `/[lan]/devices/detail?id=:id` — Device overview and live location
- `/[lan]/devices/detail?id=:id&view=history` — Lazy-loaded location history and route inspection
- `/[lan]/devices/guest#token=:token` — Public, temporary read-only live location view
- `/[lan]/access` — Device API-key management
- `/[lan]/admin` — User administration (admin only)
- `/[lan]/reports` — Reports with filters and export
- `/[lan]/profile` — User profile
- `/[lan]/settings` — Theme, language, and password settings
- `/[lan]/no-access` — Notice for users without permissions

Every `[lan]` route is statically generated for `en` and `es` via `getStaticPaths`.

---

## Getting Started

### Prerequisites

- Node.js >= 22.12.0
- pnpm (install with `corepack enable`)

### Install

```bash
pnpm install
```

### Development

```bash
pnpm dev
```

Starts the Astro dev server at `http://localhost:4321`.

### Build

```bash
pnpm build
```

Produces a static build in `dist/`.

### Preview

```bash
pnpm preview
```

Serves the production build locally.

### Test

```bash
pnpm test        # Vitest — run all tests once
pnpm test:watch  # Vitest — watch mode
```

### Lint, Format & Check

```bash
pnpm lint          # ESLint — checks .ts, .tsx, .astro files
pnpm format        # Prettier — formats all files
pnpm astro check   # TypeScript diagnostics (also: make check)
```

---

## Environment Variables

| Variable               | Default      | Description                                                                                     |
| ---------------------- | ------------ | ----------------------------------------------------------------------------------------------- |
| `PUBLIC_ENV`           | `production` | Build environment; enables development-only UI when set to `development`                        |
| `PUBLIC_API_URL`       | empty        | Optional API origin; leave empty when nginx serves frontend and API on one origin               |
| `PUBLIC_APP_ORIGIN`    | empty        | Public frontend origin used to build absolute password-reset links                              |
| `PUBLIC_MAP_STYLE_URL` | empty        | Optional MapLibre basemap style URL; defaults to `https://tiles.openfreemap.org/styles/liberty` |

These values are compile-time variables for the static Astro build. Passing
them as runtime container environment variables does not change an already
built image. For the local Docker stack, set them in the repository root
`.env` file or use the defaults in `docker-compose.local.yml`.

---

## Design System

The project uses a **pure CSS design system**: `src/styles/global.css` (~269
lines) is the only file allowed to declare raw hex values; everything else
consumes tokens via `var(--token-name)`. Component and page styles live in
separate files under `src/styles/`.

### Key Principles

- **No Tailwind, no CSS-in-JS** — every style is authored in `.css` files
- **Design tokens** (colors, spacing, typography, radii, shadows) are CSS custom properties
- **BEM naming** for component classes (`.btn`, `.btn--primary`, `.card__title`)
- **Theme** via `[data-theme="dark"]`/`[data-theme="light"]` on `<html>` — resolved pre-paint by `scripts/theme-init.js` with priority: `localStorage` (`open-gps:theme`) → system preference → light
- **Mobile-first** responsive design with fluid typography via `clamp()`

### Color Palette — "Grafíto Nórdico" (light) / "Carbono Nórdico" (dark)

- **Accent:** Steel blue (`#5e81ac` light, `#7fa9d1` dark) for primary actions and active states
- **Semantic:** Green (success), amber (warning), red (danger) — each with tint and text variants
- **Surface:** Light-first `:root` values with a full dark twin under `[data-theme="dark"]`
- **Text:** Three-tier scale (primary, secondary, muted) plus a neutral ramp (`--n-50` … `--n-900`)

### Typography

- **Primary font:** Inter (via `@fontsource/inter` imports in `global.css`)
- **Monospace:** JetBrains Mono for UUIDs and coordinates
- **Scale:** tokens from 4px to 80px spacing, radii from `6px` controls to pills

---

## API Layer

API services use `@better-fetch/fetch` through two clients in `lib/api/client.ts`:

- **`authClient`** — Authula auth endpoints (`/api/auth`), cookie-based sessions
- **`apiClient`** — Application API (`/api/v1`)

Services are exposed as React hooks with their own loading/error state (e.g.
`useDeviceService`, `useAuthService`, `useUserService`, `useApiKeyService`);
`BootstrapService` is the only plain class (first-run detection).

| Service             | Responsibility                                                   |
| ------------------- | ---------------------------------------------------------------- |
| `authService`       | Sign in/up/out, me, change password, password recovery, OAuth    |
| `deviceService`     | Device CRUD + access control (grant, list, revoke)               |
| `userService`       | User CRUD with pagination                                        |
| `apiKeyService`     | Per-device API keys (create, list, revoke)                       |
| `locationService`   | Latest location, history, and route queries                      |
| `profileService`    | Profile data and device counts                                   |
| `reportsService`    | Report queries and CSV/GPX export URLs                           |
| `shareLinkService`  | Guest share links (create, list, revoke, consume, live snapshot) |
| `emailService`      | Welcome email dispatch                                           |
| `bootstrap.service` | First-run/bootstrap detection                                    |

All API calls return responses wrapped in a generic `Envelope<T>` type with status code, message, and data payload. Errors are normalized through `handleApiError` into a structured `ApiError`, narrowed with `isApiError`, and surfaced to the UI via `withApiErrorToast`.

Live device data uses `useDeviceLocationStream`. SSE is same-origin, with REST
live snapshots as bootstrap and recovery; stream health is separate from
device presence.

---

## TypeScript Conventions

- **Strict mode** — extends `astro/tsconfigs/strict`
- **No `any`** — use `unknown` with narrowing
- **Explicit types** for all component props and function signatures
- **Runtime validation via type guards** for external data (`isApiError`, `isEnvelope`, `isGuestLiveSnapshot`)
- Type imports use `import type` syntax

---

## Testing

- **Vitest** with `happy-dom` and `@testing-library/react`
- Tests are colocated as `*.test.ts` / `*.test.tsx` next to the code they cover
- Run with `pnpm test` (single run) or `pnpm test:watch`

---

## License

MIT — see [LICENSE](../LICENSE).
