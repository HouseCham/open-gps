# Go Code Review Skill

=====================================================

Applies to `.go` files. Skip vendor/ directories, `_test.go` fixtures marked as golden files, and any file with a `// Code generated ... DO NOT EDIT.` header.
Extends (does not replace) the base **ALL FILES** and **Go** rules in `CODE_REVIEW.md`.

---

## Error Handling

REJECT if:

- An error is discarded with `_` outside of a narrowly justified, commented case (e.g. a best-effort `Close()` in a defer where the error truly cannot be handled)
- An error is wrapped by rebuilding the message (`fmt.Errorf("failed: " + err.Error())` or `errors.New(err.Error())`) instead of `%w`, breaking the error chain for `errors.Is`/`errors.As`
- A sentinel error is compared with `==` or a type is checked with a raw type assertion (`err.(*MyError)`) instead of `errors.Is` / `errors.As`
- The same error is both logged **and** returned up the stack, causing it to be logged multiple times by different layers
- `panic` is used for an expected, recoverable failure (bad user input, a failed network call) rather than reserved for truly unrecoverable states or program initialization
- `catch (e: any)`-style blanket handling — i.e. a `recover()` that swallows every panic without re-raising or logging what was recovered

PREFER:

- `fmt.Errorf("doing X: %w", err)` to add context while preserving the chain
- `errors.New("...")` for static, exported sentinel errors (`var ErrNotFound = errors.New("not found")`) so callers can match with `errors.Is`
- Custom error types implementing `error` (and `Unwrap() error`) for errors that carry structured data
- `errors.Is` / `errors.As` at the call site instead of equality checks or unchecked type assertions
- Handling an error exactly once: either handle it (log, retry, fall back) or wrap-and-return it — never both

```go
// REJECT
func loadUser(id string) (*User, error) {
    row, err := db.QueryRow(id)
    if err != nil {
        log.Printf("query failed: %v", err)
        return nil, errors.New("query failed: " + err.Error())
    }
    ...
}

// PREFER
var ErrUserNotFound = errors.New("user not found")

func loadUser(id string) (*User, error) {
    row, err := db.QueryRow(id)
    if err != nil {
        return nil, fmt.Errorf("querying user %q: %w", id, err)
    }
    if row == nil {
        return nil, ErrUserNotFound
    }
    ...
}

// at the call site
if _, err := loadUser(id); errors.Is(err, ErrUserNotFound) {
    ...
}
```

---

## Types & Interfaces

REJECT if:

- `interface{}` / `any` is used as a parameter or return type where a concrete type or a generic type parameter would work
- A closed set of values is represented as raw `int`/`string` constants instead of a named type with `iota` (Go's alternative to `enum`)
- An interface is declared in the producer package "just in case" instead of at the point of consumption in the package that actually needs it
- An interface has grown to 5+ methods where callers only ever use a subset → split into smaller, composable interfaces
- A type assertion (`x.(T)`) is used without the two-value `, ok` form in a context where a failed assertion is a plausible outcome, not a genuine bug

PREFER:

- Accepting interfaces, returning concrete (exported) types
- Small, single-purpose interfaces defined where they're consumed, named for behavior (`Reader`, `Validator`)
- `iota`-based typed constants with a `String() string` method (satisfying `fmt.Stringer`) for closed sets of values
- Generics (type parameters with a constraint) over `any` + type assertions when a function only needs to operate over a bounded set of types
- The `, ok` idiom for type assertions and map lookups: `v, ok := x.(T)`

```go
// REJECT
type Status int

const (
    StatusPending = 0
    StatusActive  = 1
    StatusDone    = 2
)

func Sum(nums []interface{}) interface{} { ... }

// PREFER
type Status int

const (
    StatusPending Status = iota
    StatusActive
    StatusDone
)

func (s Status) String() string {
    switch s {
    case StatusPending:
        return "pending"
    case StatusActive:
        return "active"
    case StatusDone:
        return "done"
    default:
        return "unknown"
    }
}

func Sum[T int | float64](nums []T) T {
    var total T
    for _, n := range nums {
        total += n
    }
    return total
}
```

---

## Functions & API Design

REJECT if:

- `context.Context` is not the first parameter of a function that does I/O, blocks, or calls another `ctx`-taking function, or is stored on a struct field instead of passed explicitly
- An exported function takes more than ~3 positional parameters — especially several of the same type (`bool, bool, string`) — instead of an options struct or functional options
- Optional configuration is simulated with a family of overloaded constructors (`NewClient`, `NewClientWithTimeout`, `NewClientWithTimeoutAndRetries`, ...) instead of functional options
- An exported function panics on invalid external input instead of returning an `error` (panic is for programmer errors, not bad input)
- Named return values are used as a substitute for clear code in long functions, rather than to document a short function's return or enable a `defer`-based error wrap

PREFER:

- `ctx context.Context` as the first parameter, named `ctx`, never embedded in a struct
- The functional options pattern for optional configuration
- Guard clauses / early returns over deeply nested `if/else`
- Returning `error` as the last return value, always checked immediately after the call

```go
// REJECT
func NewClient(host string, timeout time.Duration, retries int, useTLS bool) *Client { ... }

// PREFER
type Option func(*Client)

func WithTimeout(d time.Duration) Option {
    return func(c *Client) { c.timeout = d }
}

func WithRetries(n int) Option {
    return func(c *Client) { c.retries = n }
}

func NewClient(host string, opts ...Option) *Client {
    c := &Client{host: host, timeout: 30 * time.Second}
    for _, opt := range opts {
        opt(c)
    }
    return c
}
```

---

## Concurrency

REJECT if:

- A goroutine is started with no defined way for it to stop (no `context.Context`, no done channel, no bounded work) — a goroutine leak
- Shared state (a map, slice, or struct field) is read and written from multiple goroutines without a `sync.Mutex`/`sync.RWMutex` or a channel guarding it
- A channel is closed from the receiving side, or closed more than once — only the sender should close a channel
- `sync.WaitGroup.Add` is called inside the goroutine it's tracking (race with `Wait`) instead of before `go func()`
- A loop variable is captured by reference inside a closure passed to a goroutine in a module whose `go.mod` targets Go < 1.22 (pre-1.22, loop variables are reused across iterations; Go 1.22+ creates a fresh variable per iteration, so this is only a bug on older language versions — flag it if the `go` directive is below `1.22`)

PREFER:

- `context.Context` for cancellation and timeouts, checked via `ctx.Done()` or passed to blocking calls
- `sync.Mutex`/`sync.RWMutex` with a comment on the field it guards (`mu sync.Mutex // guards cache`), or channels when ownership transfer is a cleaner model
- `golang.org/x/sync/errgroup` for goroutine groups that need aggregated error handling and cancellation
- Closing channels only from the sender, and only once

```go
// REJECT
func startWorker(jobs []Job) {
    for _, j := range jobs {
        go func() {
            process(j) // pre-1.22: all goroutines may see the last j
        }()
    }
}

// PREFER
func startWorker(ctx context.Context, jobs []Job) error {
    g, ctx := errgroup.WithContext(ctx)
    for _, j := range jobs {
        j := j // explicit copy keeps this safe on any Go version
        g.Go(func() error {
            select {
            case <-ctx.Done():
                return ctx.Err()
            default:
                return process(j)
            }
        })
    }
    return g.Wait()
}
```

---

## Mutability & Data Handling

REJECT if:

- An exported accessor returns a struct's internal slice or map directly, letting callers mutate private state
- A function `append`s to a slice parameter and returns it without copying, while the caller still holds and relies on the original backing array (aliasing bug)
- A large struct is repeatedly passed and returned by value through several layers where a pointer receiver would avoid the copy, and the struct is not meant to be immutable

PREFER:

- Returning a copy, or a read-only view, of internal slices/maps from exported accessors
- Allocating a fresh slice (`make` with a known capacity, or an explicit copy) before appending when the caller's independence from the result matters
- Pointer receivers for structs that are mutated or expensive to copy; value receivers for small structs treated as immutable

```go
// REJECT
type Cache struct {
    items map[string]string
}

func (c *Cache) Items() map[string]string {
    return c.items // caller can mutate internal state
}

// PREFER
func (c *Cache) Items() map[string]string {
    out := make(map[string]string, len(c.items))
    for k, v := range c.items {
        out[k] = v
    }
    return out
}
```

---

## Naming & Package Design

REJECT if:

- A package is named `util`, `common`, `helpers`, `base`, or `misc` — a grab-bag name with no cohesive purpose
- A name stutters with its package (`http.HTTPServer`, `user.UserService`) when the package name already provides that context
- An exported accessor is named `GetX()` for a simple field read — Go convention omits `Get` (`X()`); reserve verb-prefixed names for methods that actually do work (e.g. a network fetch)
- Receiver names are inconsistent across methods of the same type (`func (c *Client) ...` in one method, `func (cl *Client) ...` in another), or named `this`/`self`
- A single-method interface isn't named for the behavior it represents (e.g. `-er` suffix such as `Reader`, `Validator`) where that convention fits

PREFER:

- A short, consistent receiver name reused on every method of a type
- Short, lowercase, underscore-free package names that describe what the package *provides*
- `MixedCaps` (never `snake_case`) for all identifiers, per `gofmt`/`go vet`

---

## Documentation (Godoc)

REQUIRE a doc comment on every exported `type`, `func`, `const`, and `var`, and a package doc comment for any package intended for use outside its own module. Follow godoc convention exactly: the comment is a `//`-prefixed line comment immediately above the declaration, and its first sentence starts with the name being declared and ends with a period.

```go
// Client manages a persistent connection to the invoicing service.
type Client struct {
    // ...
}

// NewClient creates a Client configured with opts, connecting to host.
// It returns an error if the initial handshake fails.
func NewClient(host string, opts ...Option) (*Client, error) {
    // ...
}

// Package invoice provides types and helpers for generating and
// validating customer invoices.
package invoice
```

REJECT if:

- An exported identifier is missing a doc comment
- A doc comment's first sentence doesn't start with the declared name (breaks `go doc` grep-ability and fails `staticcheck`'s `ST1000`/`revive`'s `exported` check)
- A doc comment describes parameters or behavior the function no longer has (stale documentation)
- A deprecated exported identifier lacks a `// Deprecated: ...` line explaining the replacement

NOT required for: unexported helpers with self-evident names, generated code, and test files (except exported test helpers shared across packages, e.g. `testutil` packages).

---

## Skill Index (parent reference)

This file is loaded for `*.go` per `CODE_REVIEW.md`'s Skill Index.

=====================================================