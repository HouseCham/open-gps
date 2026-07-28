import '@/styles/ui/breadcrumbs.css';

import { ChevronRight } from 'lucide-react';
import type { JSX } from 'react/jsx-runtime';

/**
 * One breadcrumb segment.
 * @interface BreadcrumbItem
 * @prop {string} label - Visible text.
 * @prop {string} href - Optional href; last item is rendered as text regardless.
 */
export interface BreadcrumbItem {
    label: string;
    href?: string;
}

/**
 * Props for the Breadcrumbs component.
 * @interface BreadcrumbsProps
 * @prop {BreadcrumbItem[]} items - Ordered segments.
 */
export interface BreadcrumbsProps {
    items: readonly BreadcrumbItem[];
}

/**
 * Breadcrumbs — path-style navigation with chevron separators.
 * @param {BreadcrumbsProps} props
 * @returns {JSX.Element}
 */
export function Breadcrumbs({ items }: BreadcrumbsProps): JSX.Element {
    return (
        <nav className="breadcrumbs" aria-label="Breadcrumb">
            {items.map((it, i) => {
                const isLast = i === items.length - 1;
                return (
                    <span
                        key={`${it.label}-${i}`}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 8,
                        }}
                    >
                        {i > 0 && (
                            <span className="sep">
                                <ChevronRight size={11} aria-hidden="true" />
                            </span>
                        )}
                        {isLast || !it.href ? (
                            <span className="current">{it.label}</span>
                        ) : (
                            <a href={it.href}>{it.label}</a>
                        )}
                    </span>
                );
            })}
        </nav>
    );
}
