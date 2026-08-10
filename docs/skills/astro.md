# AstroJS Code Review Skill

=====================================================

Applies to `.astro` files and `astro.config.*`.
Extends (does not replace) the base **AstroJS** rules in `CODE_REVIEW.md`. Assumes Astro 4/5.

---

## Rendering Strategy

REJECT if:

- `export const prerender` is omitted in a project that mixes static and server-rendered routes (must be explicit per-route in mixed setups)
- A route uses server rendering (`prerender = false`) for content that's fully known at build time
- `output: 'server'` is set globally in `astro.config.*` when only a handful of routes need it → prefer `output: 'static'` with per-route opt-in via `prerender = false`

PREFER:

- Static rendering by default; opt into server rendering only for routes that genuinely need request-time data (auth, personalization, search, live pricing)
- Scoping on-demand rendering to the smallest possible route surface

---

## Client Directives (Islands)

REJECT if:

- An interactive component ships with no `client:*` directive, so it never hydrates
- `client:load` is used for a component that isn't above-the-fold or isn't needed immediately → prefer `client:idle` or `client:visible`
- `client:only` is used without naming the framework (`client:only="react"`), or is used where plain server rendering would work
- A component is turned into an island for content that never changes on the client → keep it a plain `.astro` component

PREFER:

- `client:visible` for below-the-fold interactive widgets (carousels, comment sections, "load more" lists)
- `client:idle` for non-critical interactivity that isn't immediately visible
- `client:load` reserved for critical, above-the-fold interactivity only (e.g. a mobile nav toggle)

---

## Data & Content

REJECT if:

- Data fetching happens inside a child component's script instead of `getStaticPaths` or the page's top-level frontmatter
- A content collection under `src/content/` has no Zod schema defined in `content.config.ts` / `content/config.ts`
- Frontmatter fields are read without using the schema-inferred type (`CollectionEntry<'name'>`)

REQUIRE:

- `defineCollection({ schema: z.object({...}) })` for every content collection
- Page-level data fetching (API calls, `getCollection`, `getEntry`) in frontmatter — not inside nested components

---

## Assets & Images

REJECT if:

- Raw `<img>` is used for local/build-time-known images instead of `<Image />` from `astro:assets`
- An image is missing explicit `width`/`height` (or relies on `<Image />`'s automatic inference) — causes layout shift otherwise
- `<Picture />` isn't used where responsive or art-directed images are actually needed

---

## Environment & Secrets

REJECT if:

- A server-only secret is referenced in a way that could leak into the client bundle (not routed through `astro:env` or a properly scoped server-only import)
- A client-accessible env var doesn't use the `PUBLIC_` prefix convention
- `.env` values are read via `process.env` inside a component/script that also ships to the client

REQUIRE:

- `import.meta.env.PUBLIC_*` for anything intentionally exposed to the browser
- Server-only secrets kept out of any frontmatter/script path that gets inlined into client-shipped code

---

## Structure & Composition

REJECT if:

- Component logic requires frontmatter but the `---` fences are missing
- A layout hard-codes page-specific markup instead of exposing `<slot />` (or named slots) for composition
- Client-side DOM logic is written in a bare `<script>` tag where a framework island (`client:*`) would be the more appropriate, testable choice

PREFER:

- Named slots (`<slot name="header" />`) for multi-region layouts over prop-drilled layout components
- `Astro.props` typed via an exported `Props` interface at the top of the frontmatter

```astro
---
interface Props {
  title: string;
  description?: string;
}

const { title, description } = Astro.props;
---

<html lang="en">
  <head>
    <title>{title}</title>
    {description && <meta name="description" content={description} />}
  </head>
  <body>
    <slot />
  </body>
</html>
```

---

## Performance & SEO

REQUIRE:

- `<meta name="viewport">` and an accurate `lang` attribute set in the base layout
- View Transitions (`<ClientRouter />` / `transition:*`) used deliberately on specific elements, not applied blanket across the app
- Minimal critical CSS; avoid shipping component-scoped styles for content that's server-rendered and never hydrated

---

## Skill Index (parent reference)

This file is loaded for `*.astro` and `astro.config.*` per `CODE_REVIEW.md`'s Skill Index.

=====================================================