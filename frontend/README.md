# Open GPS — Frontend

A self-hosted, open-source web application for real-time GPS tracking of IoT devices. Built for hobbyists, small businesses, and developers who want full control over their tracking data.

The frontend communicates with a Go + Fiber backend and PostgreSQL database to provide a responsive dashboard for managing GPS devices, visualizing their location history, and administering user access.

---

## Tech Stack

| Layer           | Technology                                                                            |
| --------------- | ------------------------------------------------------------------------------------- |
| Framework       | [Astro 6](https://astro.build) (Islands Architecture) + [React 19](https://react.dev) |
| Language        | [TypeScript 5.9](https://www.typescriptlang.org) (strict mode)                        |
| Styling         | Pure CSS — custom properties, dark/light themes, BEM methodology                      |
| Icons           | [Lucide](https://lucide.dev) (`@lucide/astro` + `lucide-react`)                       |
| HTTP            | [`@better-fetch/fetch`](https://github.com/better-fetch/fetch)                        |
| Auth            | [`Authula`](https://github.com/Authula/authula) (HTTP-only session cookie)            |
| Package manager | [pnpm](https://pnpm.io)                                                               |
| Engine          | Node >= 22.12.0                                                                       |

---

## Features

- **Dashboard** — KPI overview, activity feed, device table with search and sort
- **Device Management** — View, create, edit, and delete GPS devices with role-based access control
- **Device Detail** — Location map, battery/signal indicators, route playback, location history, access management
- **User Administration** — Manage users, roles, and invitations (super admin)
- **Profile & Settings** — Edit profile, change password, theme and language preferences
- **Authentication** — Login and first-admin signup flows
- **Internationalization** — English and Spanish locale support
- **Dark/Light Theme** — Full design system with CSS custom properties
- **Interactive UI** — Modal dialogs, toast notifications, dropdown menus (React islands)
- **SVG-Based Map** — Custom map rendering without third-party map SDKs (CSS grid + SVG pins)

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
│   ├── astro/                 # Server-rendered .astro components
│   │   ├── admin/             # AdminStats, UserTable
│   │   ├── device/            # DeviceCard, DeviceTable
│   │   ├── layout/            # MainLayout, Sidebar, TabBar, Toolbar, AuthLayout
│   │   ├── sections/          # Dashboard, KpiBar, ActivityFeed, DeviceDetail
│   │   └── ui/                # Badge, Button, Input, KpiCard, StatusIndicator,
│   │                          # SignalIndicator, BatteryIndicator, EmptyState, DataTable
│   └── react/                 # Interactive React islands
│       ├── auth/              # LoginForm, SignupForm
│       ├── device/            # DeviceForm
│       ├── map/               # DeviceMap, MapMarker, MapPopover, RoutePlayer
│       └── ui/                # Modal, Toast, Dropdown, ThemeToggle, GalleryIslands
├── constants/
│   ├── components/            # Demo/gallery data per component (admin, device, map, etc.)
│   │   └── ui/                # UI component constants (modal defaults)
│   └── regex.ts               # Validation regex patterns
├── hooks/                     # Custom hooks (useToast)
├── i18n/                      # English (en.ts) and Spanish (es.ts) translation bundles
├── lib/                       # Utilities, API services, auth client
│   ├── api/                   # HTTP client, device/user services
│   │   └── helpers/           # handleApiError utility
│   ├── auth/                  # Authula HTTP-only session-cookie client
│   ├── map-utils.ts           # Map calculation utilities
│   └── user-utils.ts          # User helper utilities
├── pages/                     # File-based routing
│   ├── [lan]/                 # Locale-driven routes (en/es)
│   │   ├── devices/           # Device list + detail pages
│   │   ├── admin.astro        # Admin overview
│   │   ├── profile.astro      # User profile
│   │   └── index.astro        # Dashboard
│   ├── login.astro            # Login page
│   ├── signup.astro           # Signup page
│   └── *-gallery.astro        # Component galleries (dev verification)
├── styles/
│   ├── global.css             # Design system: tokens, reset, typography, all component styles
│   ├── components/            # Co-located CSS for React forms (login, signup, device)
│   ├── layout/                # MainLayout, Sidebar, TabBar CSS
│   ├── map/                   # DeviceMap, marker, popover, route-player CSS
│   └── ui/                    # Modal, toast, dropdown CSS
└── types/
    ├── api/                   # API request/response types (devices, users)
    ├── components/             # Component prop types, organized by domain
    │   └── ui/                # UI component prop types (button, input, modal, etc.)
    ├── layout/                # Layout prop types (sidebar, etc.)
    ├── i18n.ts                 # i18n type definitions
    └── index.ts               # Type exports
```

### Routing

- `/` — Language detection, redirects to `/[lan]/`
- `/[lan]/` — Dashboard (KPIs, map, activity feed, device table)
- `/[lan]/devices` — Full device list with management actions
- `/[lan]/devices/[id]` — Device detail with map and stats
- `/[lan]/admin` — Super admin overview
- `/[lan]/profile` — User profile and settings
- `/login` — Authentication
- `/signup` — First admin registration

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

### Lint & Format

```bash
pnpm lint       # ESLint — checks .ts, .tsx, .astro files
pnpm format     # Prettier — formats all files
```

---

## Environment Variables

| Variable         | Default                        | Description          |
| ---------------- | ------------------------------ | -------------------- |
| `PUBLIC_API_URL` | `http://localhost:8080/api/v1` | Backend API base URL |

---

## Design System

The project uses a **pure CSS design system** defined entirely through CSS custom properties in `src/styles/global.css` (~2900 lines).

### Key Principles

- **No Tailwind, no CSS-in-JS** — every style is authored in `.css` files
- **Design tokens** (colors, spacing, typography, radii, shadows) are CSS custom properties consumed via `var(--)`
- **BEM naming** for component classes (`.btn`, `.btn--primary`, `.card__title`)
- **Dark theme** via `[data-theme="dark"]` attribute on `<html>` — default state
- **Mobile-first** responsive design with fluid typography via `clamp()`

### Color Palette

- **Accent:** Electric blue (`#3b82f6`) for primary actions and active states
- **Semantic:** Green (success), amber (warning), red (danger) — each with muted variants
- **Surface:** Dark-first with light theme overrides via `[data-theme="light"]`
- **Text:** Three-tier scale for primary, secondary, and placeholder text

### Typography

- **Primary font:** Inter (via Astro Fonts API)
- **Monospace:** JetBrains Mono / Fira Code for UUIDs and coordinates
- **Scale:** 11px through 32px (7 steps) with controlled line heights

---

## API Layer

API services use `@better-fetch/fetch` and are structured as classes with dependency injection:

- **`DevicesService`** — CRUD operations + access control (grant, list, revoke)
- **`UsersService`** — CRUD operations with pagination support
- **`authClient`** — Authula HTTP client configured with cookie-based sessions

All API calls return responses wrapped in a generic `Envelope<T>` type with status code, message, and data payload. Errors are normalized through `handleApiError` into a structured `ApiError` type.

---

## TypeScript Conventions

- **Strict mode** — extends `astro/tsconfigs/strict`
- **No `any`** — use `unknown` with narrowing
- **Explicit types** for all component props and function signatures
- **Zod** for runtime validation of external data (API responses, form inputs)
- Type imports use `import type` syntax

---

## License

MIT
