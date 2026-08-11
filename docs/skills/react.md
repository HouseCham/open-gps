# React Code Review Skill

=====================================================

Applies to `.tsx`/`.jsx` files. Combine with `docs/skills/typescript.md` for typing rules.
Extends (does not replace) the base **React** rules in `CODE_REVIEW.md`. Assumes React 19+.

---

## Components

REJECT if:

- `import React from 'react'` is used → use named imports (`import { useState, type ReactNode } from 'react'`); the JSX runtime doesn't require the default import
- Component is typed as `React.FC<Props>` → prefer a plain typed function (`React.FC` forces an implicit `children`, and has weaker generics support)
- A single file exports multiple unrelated top-level components (small, purely-internal sub-components colocated in the same file are fine)
- New code uses class components (function components + hooks only, except error boundaries, which still require a class)

PREFER:

- Composition (`children`, render props, slots) over inheritance or deeply configurable "god components"
- Semantic HTML (`<nav>`, `<section>`, `<article>`, `<button>`) over generic `<div onClick>`
- Colocated files: `Button/Button.tsx`, `Button/Button.test.tsx`, `Button/Button.module.css` in the same directory

---

## Hooks

REJECT if:

- `useMemo`/`useCallback` is added without a comment justifying it. React 19's Compiler auto-memoizes most cases — manual memoization should be reserved for genuinely expensive computations or referential-stability requirements external libraries depend on
- A hook is called conditionally or after an early `return` (Rules of Hooks)
- A custom hook doesn't start with `use`
- `useEffect` is used to derive a value from existing props/state that could be computed directly during render
- `useEffect` has a missing or incorrect dependency array
- Data fetching happens directly inside `useEffect` where a framework loader pattern (React Router loaders, RSC, TanStack Query) is available

PREFER:

- Deriving values during render over storing them in state and syncing with `useEffect`
- Extracting a custom hook once stateful logic is duplicated across 2+ components

```tsx
// REJECT — derived state stored + synced
const [fullName, setFullName] = useState('');
useEffect(() => {
    setFullName(`${firstName} ${lastName}`);
}, [firstName, lastName]);

// PREFER — derive during render
const fullName = `${firstName} ${lastName}`;
```

---

## Props

REJECT if:

- Props are drilled more than 2 levels deep → use Context, composition, or component slots instead
- A boolean prop has unclear polarity (e.g. chains of `disabled={!enabled}`) → name booleans for what `true` means
- A props `interface` extends the wrong native element type (e.g. a `<button>` wrapper not extending `ButtonHTMLAttributes<HTMLButtonElement>`)

PREFER:

- An explicit `interface` (not an inline object type) for every props shape
- Destructuring props in the function signature, with explicit defaults
- `Omit<NativeProps, 'conflictingProp'>` when overriding a native attribute's type

---

## Rendering & Performance

REJECT if:

- List-rendered elements are missing a stable `key`, or use array index as `key` on a list that can reorder/filter
- Inline anonymous functions/objects are passed as props inside large, performance-sensitive lists without a memoization justification
- Code mutates the DOM directly (`ref.current.style.x = ...`, `document.querySelector`) instead of driving it through state
- `.map()` is called on data that can contain `null`/`undefined` without a preceding `.filter()`/guard

---

## Accessibility

REJECT if:

- Interactive elements are built from `<div>`/`<span>` + `onClick` instead of `<button>`/`<a>`
- `<img>` is missing `alt` text (or `alt=""` for purely decorative images)
- Form inputs are missing an associated `<label>` (via `htmlFor`/`id`, or wrapping)
- Custom interactive components are missing keyboard handlers (Enter/Space via `onKeyDown`) when not built on a native element

---

## Documentation (JSDoc)

REQUIRE a JSDoc block on every exported component's `Props` interface, and on the component function itself. Match this format exactly:

```tsx
/**
 * Props for the Button component.
 * @interface ButtonProps
 * @prop {ReactNode} children - Button label/content.
 * @prop {'primary' | 'secondary' | 'ghost' | 'destructive'} variant - Visual style. Default: 'primary'.
 * @prop {'sm' | 'md' | 'lg'} size - Button size. Default: 'md'.
 * @prop {ReactNode} icon - Icon shown before the label.
 * @prop {ReactNode} iconRight - Icon shown after the label.
 * @prop {boolean} iconOnly - Render as square icon-only button (hides label).
 * @prop {boolean} loading - Show spinner and disable interaction.
 * @prop {boolean} disabled - Disabled state.
 */
export interface ButtonProps extends Omit<
    ButtonHTMLAttributes<HTMLButtonElement>,
    'children'
> {
    children?: ReactNode;
    variant?: 'primary' | 'secondary' | 'ghost' | 'destructive';
    size?: 'sm' | 'md' | 'lg';
    icon?: ReactNode;
    iconRight?: ReactNode;
    iconOnly?: boolean;
    loading?: boolean;
}

/**
 * Button — primary action trigger. Supports variants, sizes, icons, and loading.
 * @param {ButtonProps} props
 * @returns {JSX.Element}
 */
export function Button({
    variant = 'primary',
    size = 'md',
    icon,
    iconRight,
    iconOnly,
    loading,
    disabled,
    children,
    className,
    type = 'button',
    ...rest
}: ButtonProps): JSX.Element {
    const cls = [
        'btn',
        `btn-${variant}`,
        `btn-${size}`,
        iconOnly && 'btn-icon-only',
        className,
    ]
        .filter(Boolean)
        .join(' ');

    const content = loading ? (
        <>
            <span className="btn-spinner" aria-hidden="true" />
            <span>{children}</span>
        </>
    ) : iconOnly ? (
        <>{icon}</>
    ) : (
        <>
            {icon}
            {children}
            {iconRight}
        </>
    );

    return (
        <button
            type={type}
            className={cls}
            disabled={disabled || loading}
            aria-busy={loading || undefined}
            {...rest}
        >
            {content}
        </button>
    );
}
```

REJECT if:

- The exported `Props` interface is missing `@interface` and one `@prop` per property (including a short default-value note where relevant)
- The exported component function is missing `@param {XProps} props` and `@returns {JSX.Element}`
- The component's doc first line isn't a one-sentence summary of its purpose (mirrors `Button — primary action trigger...`)

NOT required for: internal-only sub-components not exported from the file/module, trivial wrapper components.

---

## Skill Index (parent reference)

This file is loaded for `*.tsx`/`*.jsx` per `CODE_REVIEW.md`'s Skill Index, alongside `typescript.md`.

=====================================================