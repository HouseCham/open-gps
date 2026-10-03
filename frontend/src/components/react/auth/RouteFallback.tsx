import type { ReactElement } from 'react';
import { MapSVG } from '@/components/react/MapSVG';
/**
 * Props for the RouteFallback component
 * @interface RouteFallbackProps
 * @param {string} message - The message to display
 */
interface RouteFallbackProps {
    message: string;
}

/**
 * Default loading UI shown by the auth-route gates
 * (`<ProtectedRoute />`, `<PublicOnlyRoute />`) while the session
 * hydrates. Centering matches the auth screens so there is no layout
 * shift when the gate resolves.
 * @returns {JSX.Element} The loading map.
 */
export function RouteFallback({ message }: RouteFallbackProps): ReactElement {
    return (
        <div role="status" aria-live="polite" className="auth-gate__fallback">
            <MapSVG status={message} />
        </div>
    );
}
