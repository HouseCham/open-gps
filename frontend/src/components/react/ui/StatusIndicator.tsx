import '@/styles/ui/status-indicator.css';
import type { JSX } from 'react/jsx-runtime';

/**
 * Props for the StatusIndicator component.
 * @interface StatusIndicatorProps
 * @prop {'online' | 'stale' | 'offline'} status - Connection status.
 * @prop {string} label - Text shown next to the dot.
 */
export interface StatusIndicatorProps {
    status: 'online' | 'stale' | 'offline';
    label: string;
}

/**
 * StatusIndicator — text label with a glowing status dot.
 * @param {StatusIndicatorProps} props
 * @returns {JSX.Element}
 */
export function StatusIndicator({
    status,
    label,
}: StatusIndicatorProps): JSX.Element {
    return (
        <span className={`status-indicator ${status}`}>
            <span className="dot" />
            {label}
        </span>
    );
}
