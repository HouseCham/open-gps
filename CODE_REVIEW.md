# Code Review Rules

=====================================================

## References

- Frontend Repo details: `frontend/AGENTS.md`
- Backend Repo details: `backend/AGENTS.md`
- IoT Repo details: `iot/AGENTS.md`

---

## OpenGPS reports conventions

The reports feature follows `docs/engineering/code-quality.md` and the Hermes `open-gps-code-conventions` skill.

---

## ALL FILES

REJECT if:

- Hardcoded secrets/credentials
- `any` type (TypeScript)
- Code duplication (violates DRY)
- Silent error handling (empty catch blocks)
- `console.log` left in production code (TypeScript)
- `fmt.Println` / `log.Print` left in production code → use structured logger (Golang)

---

## TypeScript

REJECT if:

- `any` type without `// @ts-expect-error` justification
- Missing return types on exported functions
- Type assertions (`as X`) without explanatory comment
- `enum` used → use `as const` objects instead
- Bare `try/catch` with empty or comment-only body

PREFER:

- Discriminated unions over type guards
- `satisfies` over type assertions
- Named exports over default exports
- Explicit `interface` for object shapes passed as props

---

## React

REJECT if:

- `import React from 'react'` → use named imports `import { useState } from 'react'`
- `useMemo`/`useCallback` without justification (React 19 Compiler handles this)
- Props drilling more than 2 levels deep → use Context or composition
- Inline anonymous functions as event handlers in performance-sensitive lists
- Missing `key` prop on list-rendered elements
- Direct DOM mutation instead of state

PREFER:

- Composition over inheritance
- Semantic HTML (`<section>`, `<article>`, `<nav>`) over generic `<div>`
- Colocated files (component + test + styles in same directory)
- `cn()` for conditional class merging

---

## AstroJS

REJECT if:

- Client-side logic in `.astro` files without `client:*` directive
- `client:load` used where `client:idle` or `client:visible` would suffice
- Fetching data inside a component when it belongs in `getStaticPaths` or top-level frontmatter
- Secrets or env vars exposed without `import.meta.env.PUBLIC_` prefix convention
- Missing `---` frontmatter fences in `.astro` files

REQUIRE:

- Image optimization via `<Image />` from `astro:assets` instead of raw `<img>`
- Content collections schema defined with Zod for typed frontmatter
- `export const prerender` flag set explicitly when mixed rendering is used

PREFER:

- Static rendering by default; opt into SSR only when necessary
- Layouts via `<slot />` composition over prop drilling layouts
- Page-level data fetching in frontmatter, not inside child components

---

## CSS

REJECT if:

- Raw hex colors or magic number values outside of design tokens/CSS variables
- `!important` without an explanatory comment
- Inline `style=` attributes for anything other than truly dynamic values
- `z-index` values above 100 without a stacking context comment
- Non-scoped global class names that risk collisions (e.g. `.button`, `.text`)

REQUIRE:

- CSS custom properties (`--color-primary`) for all design tokens
- Scoped styles in `.astro` files using `<style>` (scoped by default) or CSS Modules

PREFER:

- Logical properties (`margin-inline`, `padding-block`) over directional shorthands
- `rem`/`em` units over `px` for typography and spacing
- `clamp()` for fluid typography instead of media-query breakpoints
- Animations wrapped in `@media (prefers-reduced-motion: no-preference)`

---

## Skill Index

| Trigger (file pattern)        | Skill        | Location                        |
|-------------------------------|--------------|---------------------------------|
| `*.ts`, `*.tsx`               | TypeScript   | `docs/skills/typescript.md`     |
| `*.tsx`, `*.jsx`              | React        | `docs/skills/react.md`          |
| `*.astro`                     | AstroJS      | `docs/skills/astro.md`          |
| `*.css`, `*.module.css`       | CSS          | `docs/skills/css.md`            |
| `astro.config.*`              | AstroJS      | `docs/skills/astro.md`          |
| `*.go`                        | Golang       | `docs/skills/golang.md`         |

---

## Go — Errors

REJECT if:

- Error ignored with `_` without explanatory comment
- `errors.New` used for sentinel errors that need wrapping context → use `fmt.Errorf("...: %w", err)`
- Panic used for recoverable errors → reserve `panic` for truly unrecoverable states
- Error strings start with a capital letter or end with punctuation (violates Go conventions)

REQUIRE:

- All exported functions return an `error` as the last return value when they can fail
- Errors wrapped with context at each layer: `fmt.Errorf("service.CreateUser: %w", err)`

PREFER:

- Custom error types (`type NotFoundError struct{}`) for errors requiring distinct handling
- `errors.Is` / `errors.As` over string comparison for error checking

---

## Go — Types & Interfaces

REJECT if:

- Interface defined with more than 3–4 methods without justification → split it (ISP)
- Returning concrete struct where an interface would decouple the caller
- Exported struct fields used for internal-only state → use unexported fields

REQUIRE:

- Interfaces defined in the package that *consumes* them, not where they are implemented
- Struct fields tagged with `json:"-"` for fields that must never be serialized

PREFER:

- Small, composable interfaces (`io.Reader`, `io.Writer` style)
- Embedding interfaces over re-declaring methods

---

## Go — Concurrency

REJECT if:

- Goroutine launched without a clear ownership/lifetime strategy (risk of leak)
- Shared state mutated without a mutex or channel
- `time.Sleep` used for synchronization → use channels or `sync.WaitGroup`
- `context.Background()` used inside a handler or request-scoped function → propagate the incoming `ctx`

REQUIRE:

- `context.Context` as the first parameter on any function that does I/O or can be cancelled
- Goroutines paired with a `recover()` in long-running workers to prevent silent crashes

PREFER:

- Channels for ownership transfer, mutexes for shared state guarding
- `errgroup` for fan-out goroutine coordination with error collection

---

## Go — Packages & Structure

REJECT if:

- Circular imports between packages
- Business logic placed in `main` package beyond wiring/bootstrapping
- Exported identifier names that stutter: `user.UserService` → `user.Service`
- `init()` functions used for logic beyond simple registration

REQUIRE:

- Package names are lowercase, single words, no underscores
- `internal/` used for packages not intended for external consumption

PREFER:

- Flat package structure over deep nesting
- Dependency injection over global variables for services and clients
- `//go:generate` directives committed alongside the files they generate

---

## Go — Testing

REJECT if:

- Tests depend on external services without mocks or test containers
- `t.Fatal` / `t.Error` called inside goroutines spawned within tests → use `t.Helper()` wrappers
- Test helpers that are not marked with `t.Helper()`
- Magic values in test assertions without named constants or comments

REQUIRE:

- Table-driven tests for functions with multiple input/output cases
- `testify/assert` or stdlib `cmp` for readable assertions — no raw `if got != want`

PREFER:

- Test file colocated with the package it tests (`foo_test.go`)
- `_test` package suffix for black-box tests (`package foo_test`)
- Subtests via `t.Run("case name", ...)` for grouped scenarios

---

## Go — Performance & Style

REJECT if:

- Returning large structs by value in hot paths → use pointers
- Unbounded slice growth inside loops without pre-allocated capacity (`make([]T, 0, n)`)
- String concatenation in loops → use `strings.Builder`

PREFER:

- `defer` for cleanup (closing files, unlocking mutexes) immediately after resource acquisition
- Named return values only when they meaningfully document the function signature
- `gofmt` / `goimports` enforced via CI — no manual style debates in review

---

## Skill Index

| Trigger (file pattern)        | Skill        | Location                      |
|-------------------------------|--------------|---------------------------------|
| `*.go`                        | Go           | `docs/skills/go.md`           |
| `*_test.go`                   | Testing      | `docs/skills/testing.md`      |
| `Dockerfile`, `*.yml`         | Infra        | `docs/skills/infra.md`        |
| `go.mod`, `go.sum`            | Dependencies | `docs/skills/deps.md`         |

---

## C++ — Memory Management (Arduino / IoT)

REJECT if:

- Arduino `String` class used for concatenation/manipulation in loops, ISRs, or on every iteration of `loop()` → use fixed-size `char[]` buffers instead (heap fragmentation risk on constrained MCUs)
- `new`/`delete` or `malloc`/`free` used outside a one-time `setup()`/init path
- Recursive functions without a fixed, documented depth bound
- Large arrays/buffers declared on the stack inside frequently-called functions → risk of stack overflow
- `sprintf` / `strcpy` / `strcat` used without bounds checking → use `snprintf` / `strlcpy` / `strlcat`

REQUIRE:

- String literals used only for output/logging (`Serial.print`, etc.) wrapped in the `F()` macro or declared `PROGMEM` to keep them out of RAM
- Fixed-width integer types (`uint8_t`, `uint16_t`, `int32_t`, from `<stdint.h>`) for register values, buffer sizes, and protocol/wire-format fields
- Buffer sizes and array bounds defined as named `constexpr` constants, never magic numbers

PREFER:

- Static/global allocation with compile-time-bounded containers over dynamic allocation
- `constexpr` over `#define` for typed constants
- Passing large objects/buffers by reference or pointer, not by value

---

## C++ — Interrupts & Timing

REJECT if:

- Blocking calls (`delay()`, `Serial.print()`, dynamic allocation, long loops) inside an ISR
- Variables shared between an ISR and the main loop not declared `volatile`
- `delay()` used in `loop()` where a non-blocking `millis()`-based state machine is required for concurrent timing
- Interrupts disabled (`noInterrupts()`) for longer than the minimum critical section, or without a matching `interrupts()` restore

REQUIRE:

- ISRs kept minimal — set a flag or copy data, defer heavier processing to `loop()`
- `millis()`/`micros()` overflow handled via subtraction (`if (millis() - lastRun >= interval)`), never direct comparison
- Time- or state-based debounce logic on any digital input read from a switch/button

PREFER:

- Non-blocking state machines over sequential `delay()` chains
- Hardware timers/RTOS tasks over busy-wait loops for periodic work

---

## C++ — Hardware & I/O

REJECT if:

- Pin numbers hardcoded as bare integers in logic → use named `constexpr`/`const uint8_t` pin constants
- Return values of hardware calls ignored (`Wire.endTransmission()`, `sensor.begin()`, `SD.begin()`, etc.) with no fallback/retry/error path
- Floating-point arithmetic used in tight loops on FPU-less MCUs (e.g. AVR) where fixed-point/integer math would suffice
- Global mutable state shared across files without a clear owning module/class

REQUIRE:

- Every sensor/peripheral `begin()`/`init()` call checked for a success return value before proceeding
- Watchdog timer (or platform equivalent) enabled and fed for any long-running or network-dependent loop
- Network/connection code (WiFi, MQTT, HTTP) checks connection state before publish/read and implements a reconnect-with-backoff strategy

PREFER:

- Hardware abstraction behind small interfaces/classes so peripherals can be mocked/stubbed in tests
- Scoped enums or `as const`-style constants over loose `#define` flags for modes/states

---

## C++ — Style & Structure

REJECT if:

- `using namespace std;` (or similar) at global/header scope
- Header files missing include guards or `#pragma once`
- Function/class definitions duplicated across multiple `.cpp` translation units instead of shared via a header
- Empty or comment-only error branches on hardware/communication failures (same as ALL FILES rule, called out explicitly here since silent sensor/network failures are a common IoT bug source)

REQUIRE:

- `camelCase` for functions/variables, `PascalCase` for classes, `UPPER_SNAKE_CASE` for true constants
- Secrets (WiFi SSID/password, API keys, device certs) loaded from a git-ignored config header or secure storage partition, never committed hardcoded

PREFER:

- Composition of small single-responsibility classes (e.g. `SensorReader`, `MqttPublisher`) over one large monolithic sketch file
- `const`/`constexpr` correctness on methods and parameters that don't mutate state

---

## Skill Index

| Trigger (file pattern)         | Skill               | Location                      |
|---------------------------------|---------------------|-------------------------------|
| `*.cpp`, `*.h`, `*.hpp`         | C++ (Arduino/IoT)   | `docs/skills/cpp-arduino.md`  |
| `*.ino`                          | Arduino Sketch      | `docs/skills/cpp-arduino.md`  |
| `platformio.ini`                | IoT Build Config    | `docs/skills/iot-build.md`    |

---

## Response Format

FIRST LINE must be exactly:

STATUS: PASSED

or

STATUS: FAILED

If FAILED, list: `file:line - rule violated - issue`

=====================================================