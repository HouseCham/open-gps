# TypeScript Code Review Skill

=====================================================

Applies to `.ts` files. For `.tsx` files, combine with `docs/skills/react.md`.
Extends (does not replace) the base **ALL FILES** and **TypeScript** rules in `CODE_REVIEW.md`.

---

## Type Safety

REJECT if:

- `any` used without a `// @ts-expect-error` directive **and** an explanatory comment directly above it
- Type assertions (`as X`) used without an inline comment explaining why the assertion is safe
- `enum` used → use an `as const` object + derived union type instead
- Non-null assertion (`!`) used outside tests or a narrowly justified, commented case
- Parameters typed as `object`, `Function`, or other overly-broad built-ins instead of a specific shape
- `@ts-ignore` used anywhere → use `@ts-expect-error` (fails loudly once the underlying error is fixed, unlike `@ts-ignore`)

PREFER:

- `unknown` over `any` at trust boundaries (API responses, `JSON.parse`, external input, `catch` variables), narrowed via type guards or runtime schema validation (Zod, Valibot)
- `satisfies` over type assertions when you need both literal-type inference and shape checking
- Discriminated unions over boolean flags + optional fields
- `as const` for literal object/array values instead of `enum`

**`enum` vs `as const`:**

```ts
// REJECT
enum Role {
    Admin,
    Editor,
    Viewer,
}

// PREFER
const ROLE = {
    Admin: 'admin',
    Editor: 'editor',
    Viewer: 'viewer',
} as const;

type Role = (typeof ROLE)[keyof typeof ROLE];
```

**`satisfies` vs assertion:**

```ts
// REJECT
const config = {
    retries: 3,
    timeoutMs: 5000,
} as Config;

// PREFER
const config = {
    retries: 3,
    timeoutMs: 5000,
} satisfies Config;
```

**Discriminated unions vs type guards:**

```ts
// REJECT
interface ApiResponse<T> {
    data?: T;
    error?: string;
    loading: boolean;
}

// PREFER
type ApiResponse<T> =
    | { status: 'loading' }
    | { status: 'success'; data: T }
    | { status: 'error'; error: string };
```

---

## Functions

REJECT if:

- Exported function is missing an explicit return type
- Function takes more than ~3 positional parameters → use a single options object instead
- Overloaded signatures are used where a union parameter type would be simpler and equally safe
- Optional parameters are declared before required parameters

PREFER:

- Named exports over default exports (safer refactors, reliable IDE auto-import)
- `function` declarations for top-level/exported utilities (hoisting, cleaner stack traces); arrow functions for callbacks and inline handlers
- Early returns / guard clauses over deeply nested `if/else`

---

## Null & Undefined

REJECT if:

- Loose equality (`== null`) is mixed inconsistently with strict checks across the codebase
- Optional chaining (`?.`) or nullish coalescing (`??`) is available but manual null checks are used instead
- `||` is used for default values where the left-hand side could legitimately be `0`, `''`, or `false` → use `??`

---

## Error Handling

REJECT if:

- `catch` block is empty or comment-only (base rule — called out again here since it's especially common in async/await code)
- An error is caught and re-thrown as a generic `Error` without preserving the original via `cause`
- `catch (e: any)` is used — since TS 4.4, catch bindings default to `unknown`; narrow before use

PREFER:

- Custom error classes extending `Error` (with a `name` override) for domain-specific failures
- Result-style return types (`{ ok: true; value: T } | { ok: false; error: E }`) for expected/recoverable failure paths; reserve `throw` for truly exceptional cases

```ts
// PREFER
class InvalidInvoiceError extends Error {
    name = 'InvalidInvoiceError';
    constructor(message: string, options?: { cause?: unknown }) {
        super(message, options);
    }
}

try {
    parseInvoice(raw);
} catch (err) {
    throw new InvalidInvoiceError('Failed to parse invoice', { cause: err });
}
```

---

## Immutability

REQUIRE:

- `readonly` on interface/type properties that shouldn't be reassigned after construction
- `readonly T[]` / `ReadonlyArray<T>` for array parameters the callee shouldn't mutate
- Immutable update patterns (spread, `structuredClone`) over direct mutation of objects/arrays passed by reference

---

## Documentation (JSDoc)

REQUIRE a JSDoc block on every exported `interface`, shape-representing `type` alias, and exported `function`. Match this format exactly — same tag set, same ordering, same closing `*/` style (no leading `*` on the closing line):

**Interfaces:**

```ts
/**
 * Interface representing the navigation labels for the Navbar component.
 * @interface NavLabels
 * @property {string} blog - The label for the blog link.
 * @property {string} projects - The label for the projects link.
 * @property {string} about - The label for the about link.
 * @property {string} certifications - The label for the certifications link.
 * @property {string} experience - The label for the experience link.
 * @property {string} resume - The label for the resume link.
 */
export interface NavLabels {
    blog: string;
    projects: string;
    about: string;
    certifications: string;
    experience: string;
    resume: string;
}
```

**Functions:**

```ts
/**
 * Get the navigation labels for the Navbar component.
 * @param {Partial<NavLabels>} nav - The partial navigation labels.
 * @returns {NavLabels} The complete navigation labels.
 */
export function getNavLabels(nav: Partial<NavLabels>): NavLabels {
    return {
        blog: nav.blog ?? 'Blog',
        projects: nav.projects ?? 'Projects',
        about: nav.about ?? 'About',
        certifications: nav.certifications ?? 'Certifications',
        experience: nav.experience ?? 'Experience',
        resume: nav.resume ?? 'Resume ↗',
    };
}
```

REJECT if:

- Exported interface/type is missing a `/** ... */` block, or the block is missing `@interface`/`@property` for every field
- Exported function is missing a `/** ... */` block, or is missing a `@param` for every parameter and a `@returns`
- The doc's description doesn't match what the code actually does (stale documentation)
- A `@param`/`@property` type annotation in the comment doesn't match the real TS type

NOT required for: unexported/internal helper functions, trivial one-line arrow functions used inline, test files.

---

## Skill Index (parent reference)

This file is loaded for `*.ts` (and `*.tsx`, alongside `react.md`) per `CODE_REVIEW.md`'s Skill Index.

=====================================================