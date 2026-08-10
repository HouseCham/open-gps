# CSS Code Review Skill

=====================================================

Applies to `.css` files. For `.scss`/`.less` source files, apply the same rules and additionally flag preprocessor-only smells noted below. Skip compiled/output CSS (`*.min.css`, build artifacts).
Extends (does not replace) the base **ALL FILES** and **CSS** rules in `CODE_REVIEW.md`.

---

## Selectors & Specificity

REJECT if:

- An ID selector (`#header { ... }`) is used for styling — IDs create specificity that's hard to override and aren't reusable
- A selector is overqualified with a tag (`div.card`, `ul.nav-list`) when the class alone is sufficient — this couples the style to a specific element
- `!important` is used to win a specificity fight instead of restructuring selectors or using cascade layers (an exception is a deliberately documented, isolated utility/override layer)
- Selectors are nested 4+ levels deep (native CSS nesting or a preprocessor), creating high specificity and coupling styles to a specific DOM shape
- The universal selector (`*`) is used for anything beyond a single, clearly documented reset/normalize block

PREFER:

- Flat, single-class selectors with consistent specificity across the codebase
- `@layer` to make precedence an explicit, intentional decision instead of a specificity workaround
- A consistent naming convention (BEM-style `.card`, `.card__title`, `.card--featured`, CSS Modules, or scoped component styles) matching what the rest of the codebase already uses

```css
/* REJECT */
#sidebar .widget ul li a {
    color: blue !important;
}

/* PREFER */
@layer components;

@layer components {
    .widget__link {
        color: var(--color-link);
    }
}
```

---

## Layout

REJECT if:

- `float: left`/`float: right` is used for multi-column or page layout instead of Flexbox or Grid (floats remain fine for their original purpose: wrapping text around an inline element)
- Ad hoc pixel values for spacing/sizing are sprinkled through the file where a design-token custom property already exists for that value
- A container with dynamic or user-controlled text content has a fixed `height` (causes overflow/clipping) instead of `min-height` or intrinsic sizing
- Manual margin hacks (`margin-right: 16px` on all-but-last-child selectors) are used for gutters inside a flex/grid container instead of `gap`

PREFER:

- Flexbox for one-dimensional layout, Grid (with `subgrid` for nested alignment) for two-dimensional layout
- `gap` for spacing between flex/grid children
- Logical properties (`margin-inline`, `padding-block`, `inset-inline-start`) over physical ones (`margin-left`, `top`) so layouts adapt to writing direction

```css
/* REJECT */
.list > li {
    float: left;
    margin-right: 16px;
}
.list > li:last-child {
    margin-right: 0;
}

/* PREFER */
.list {
    display: flex;
    gap: 1rem;
}
```

---

## Responsive Design

REJECT if:

- A reusable component that can render in containers of different widths (sidebar vs. main content) is only made responsive with viewport-width `@media` queries instead of `@container`
- Pixel breakpoints are hard-coded and duplicated across multiple files instead of coming from one shared source of truth
- A breakpoint override needs `!important` to take effect — a sign the base specificity was already wrong

PREFER:

- `@container` queries for component-level responsiveness
- `clamp()`, `min()`, and `max()` for fluid type and spacing instead of a series of stepped breakpoint overrides
- Breakpoint values defined once (custom properties or a shared config) and referenced everywhere

```css
/* REJECT */
.card-title {
    font-size: 16px;
}
@media (min-width: 768px) {
    .card-title {
        font-size: 20px;
    }
}
@media (min-width: 1200px) {
    .card-title {
        font-size: 24px;
    }
}

/* PREFER */
.card-title {
    font-size: clamp(1rem, 0.85rem + 1vw, 1.5rem);
}

.card {
    container-type: inline-size;
}
@container (min-width: 30rem) {
    .card-title {
        font-size: 1.25rem;
    }
}
```

---

## Custom Properties & Theming

REJECT if:

- A color, spacing, or font value is hard-coded and repeated across the file instead of referencing an existing custom property/design token
- A preprocessor variable (`$sass-var`) is used for a value that needs to change at runtime (dark mode, per-component theming, user preference) — preprocessor variables are compiled away and can't respond to the cascade or JS
- A component-library custom property is consumed with `var(--x)` and no fallback, so the component breaks if the property is ever unset by a consumer

PREFER:

- `--custom-properties` for any themeable or runtime-changeable value; preprocessor variables reserved for build-time constants only (loop indices, file paths)
- `color-mix()` or relative color syntax to derive color variants instead of hand-picked hex shades
- A fallback in `var()` for any custom property a component doesn't fully own: `var(--gap, 1rem)`

```css
/* REJECT */
.button {
    background: #2563eb;
}
.button:hover {
    background: #1d4ed8;
}

/* PREFER */
.button {
    background: var(--color-primary);
}
.button:hover {
    background: color-mix(in srgb, var(--color-primary) 85%, black);
}
```

---

## Accessibility & Motion

REJECT if:

- `outline: none` or `outline: 0` is applied to `:focus` without a replacement focus style — this removes keyboard-navigation visibility entirely
- An animation or transition runs unconditionally with no `prefers-reduced-motion` guard
- Font sizes are set in `px` for body/reading text, overriding the user's browser font-size preference, instead of `rem`/`em`
- A hover-only interactive state has no `:focus-visible` equivalent, making it unreachable by keyboard

PREFER:

- `:focus-visible` with a clearly visible custom focus style whenever the default outline is removed
- Wrapping non-essential motion in `@media (prefers-reduced-motion: no-preference)`
- `rem`/`em` for typography and spacing that should scale with user preferences

```css
/* REJECT */
.button:focus {
    outline: none;
}
.modal {
    transition: transform 0.3s ease;
}

/* PREFER */
.button:focus-visible {
    outline: 2px solid var(--color-focus);
    outline-offset: 2px;
}
@media (prefers-reduced-motion: no-preference) {
    .modal {
        transition: transform 0.3s ease;
    }
}
```

---

## Documentation

REQUIRE a header comment at the top of every component/block stylesheet (or major section within a shared file) describing what it styles and any non-obvious dependency, such as a custom property the parent is expected to provide.

```css
/**
 * Card component.
 * Expects the parent to set --card-width via a container query context.
 */
.card {
    width: var(--card-width, 100%);
}
```

REJECT if:

- A new component stylesheet has no header comment
- A comment describes behavior the rule no longer implements (stale documentation)
- A non-obvious magic value (`z-index: 9999`, an odd `calc()` offset) has no comment explaining why that specific value was chosen

NOT required for: single-purpose utility classes with self-evident names, and generated/vendor CSS.

---

## Skill Index (parent reference)

This file is loaded for `*.css` (and `*.scss`/`*.less`, per the note above) per `CODE_REVIEW.md`'s Skill Index.

=====================================================