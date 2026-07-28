import '@/styles/ui/empty-state.css';

import type { JSX, ReactNode } from 'react';

/**
 * Props for the EmptyState component.
 * @interface EmptyStateProps
 * @prop {ReactNode} icon - Icon shown centered above the title.
 * @prop {string} title - Title text.
 * @prop {string} message - Optional supporting copy.
 * @prop {ReactNode} action - Optional CTA element (typically a Button).
 */
export interface EmptyStateProps {
    icon?: ReactNode;
    title: string;
    message?: string;
    action?: ReactNode;
}

/**
 * EmptyState — dashed-border placeholder for empty collections.
 * @param {EmptyStateProps} props
 * @returns {JSX.Element}
 */
export function EmptyState({
    icon,
    title,
    message,
    action,
}: EmptyStateProps): JSX.Element {
    return (
        <div className="empty-state">
            {icon && <div className="empty-state-icon">{icon}</div>}
            <h4>{title}</h4>
            {message && <p>{message}</p>}
            {action}
        </div>
    );
}
