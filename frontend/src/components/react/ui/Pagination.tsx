import '@/styles/ui/pagination.css';
import type { JSX } from 'react/jsx-runtime';

/**
 * Props for the Pagination component.
 * @interface PaginationProps
 * @prop {number} current - Current page (1-indexed).
 * @prop {number} total - Total page count.
 * @prop {(page: number) => void} onChange - Called with the new page.
 */
export interface PaginationProps {
    current: number;
    total: number;
    onChange?: (page: number) => void;
}

/**
 * Pagination — first/last/prev/next + numbered pages.
 * @param {PaginationProps} props
 * @returns {JSX.Element}
 */
export function Pagination({
    current,
    total,
    onChange,
}: PaginationProps): JSX.Element {
    const pages = Array.from({ length: total }, (_, i) => i + 1);
    /**
     * Go to a page.
     * @param {number} p - Page number (1-indexed).
     * @returns {void}
     */
    const go = (p: number): void => {
        if (p < 1 || p > total) return;
        onChange?.(p);
    };
    return (
        <div className="pagination" role="navigation" aria-label="Pagination">
            <button
                type="button"
                className="pg-btn"
                disabled={current === 1}
                onClick={() => go(current - 1)}
                aria-label="Previous"
            >
                <span className="arr">‹</span>
            </button>
            {pages.map(p => (
                <button
                    key={p}
                    type="button"
                    className={`pg-btn ${current === p ? 'is-active' : ''}`}
                    onClick={() => go(p)}
                >
                    {p}
                </button>
            ))}
            <button
                type="button"
                className="pg-btn"
                disabled={current === total}
                onClick={() => go(current + 1)}
                aria-label="Next"
            >
                <span className="arr">›</span>
            </button>
        </div>
    );
}
