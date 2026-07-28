import '@/styles/ui/status-badge.css';
import type { JSX } from 'react/jsx-runtime';

const LABELS = {
    online: 'Online',
    stale: 'Stale',
    offline: 'Offline',
} as const;

/**
 * Props for the StatusBadge component.
 * @interface StatusBadgeProps
 * @prop {'online' | 'stale' | 'offline'} status - Connection status.
 */
export interface StatusBadgeProps {
    status: 'online' | 'stale' | 'offline';
}

/**
 * StatusBadge — pill with status dot and label (Online / Stale / Offline).
 * @param {StatusBadgeProps} props
 * @returns {JSX.Element}
 */
export function StatusBadge({ status }: StatusBadgeProps): JSX.Element {
    return (
        <span className={`status-badge status-${status}`}>
            <span className="status-dot" />
            {LABELS[status]}
        </span>
    );
}
