import type { ReactElement } from 'react';

/**
 * Default loading UI shown by the auth-route gates
 * (`<ProtectedRoute />`, `<PublicOnlyRoute />`) while the session
 * hydrates. Centering matches the auth screens so there is no layout
 * shift when the gate resolves.
 * @returns {JSX.Element} A simple spinner.
 */
export function RouteFallback(): ReactElement {
    return (
        <div role="status" aria-live="polite" className="auth-gate__fallback">
            <span>Loading…</span>
        </div>
    );
}
