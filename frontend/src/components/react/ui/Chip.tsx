import type { JSX } from 'react/jsx-runtime';

/**
 * Props for the Chip component
 * @interface ChipProps
 * @prop {string} label - The label text.
 * @prop {number | null} count - Optional count badge.
 * @prop {boolean} active - Whether the chip is active.
 * @prop {() => void} onClick - Click handler.
 */
interface ChipProps {
    label: string;
    count: number | null;
    active: boolean;
    onClick: () => void;
}

/**
 * Chip — clickable label with optional count badge.
 * @param {ChipProps} props
 * @returns {JSX.Element}
 */
export function Chip({
    label,
    count,
    active,
    onClick,
}: ChipProps): JSX.Element {
    return (
        <button
            type="button"
            className={`users-chip${active ? ' is-active' : ''}`}
            onClick={onClick}
            aria-pressed={active}
        >
            {label}
            {count !== null && (
                <span className="users-chip-count">{count}</span>
            )}
        </button>
    );
}
