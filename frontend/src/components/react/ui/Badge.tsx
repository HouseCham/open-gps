import '@/styles/ui/badge.css';

import type { JSX, ReactNode } from 'react';

/**
 * Props for the Badge component.
 * @interface BadgeProps
 * @prop {'neutral' | 'accent' | 'success' | 'warning' | 'danger'} tone - Color tone. Default: 'neutral'.
 * @prop {'pill' | 'square'} shape - Border-radius shape.
 * @prop {boolean} dot - Show a leading status dot.
 * @prop {ReactNode} children - Badge label.
 */
export interface BadgeProps {
    tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger';
    shape?: 'pill' | 'square';
    dot?: boolean;
    children: ReactNode;
}

/**
 * Badge — compact label with optional dot indicator.
 * @param {BadgeProps} props
 * @returns {JSX.Element}
 */
export function Badge({
    tone = 'neutral',
    shape,
    dot,
    children,
}: BadgeProps): JSX.Element {
    const cls = [
        'badge',
        `badge-${tone}`,
        shape === 'pill' && 'badge-pill',
        shape === 'square' && 'badge-square',
    ]
        .filter(Boolean)
        .join(' ');
    return (
        <span className={cls}>
            {dot && <span className="badge-dot" />}
            {children}
        </span>
    );
}
