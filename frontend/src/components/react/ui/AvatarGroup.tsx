import '@/styles/ui/avatar-group.css';
import type { JSX } from 'react/jsx-runtime';

/**
 * A single avatar in an AvatarGroup.
 * @interface AvatarPerson
 * @prop {string} initials - Up to 2 chars shown on the chip.
 * @prop {string} title - Tooltip / aria-label.
 */
export interface AvatarPerson {
    initials: string;
    title?: string;
}

/**
 * Props for the AvatarGroup component.
 * @interface AvatarGroupProps
 * @prop {AvatarPerson[]} people - Avatars to render.
 * @prop {number} max - Maximum visible avatars; the rest collapse into "+N". Default: 3.
 */
export interface AvatarGroupProps {
    people: readonly AvatarPerson[];
    max?: number;
}

const PALETTE = [
    'var(--accent)',
    'var(--success)',
    'var(--warning)',
    'var(--danger)',
    'var(--text-secondary)',
] as const;

/**
 * AvatarGroup — overlapping circular initials with overflow count.
 * @param {AvatarGroupProps} props
 * @returns {JSX.Element}
 */
export function AvatarGroup({
    people,
    max = 3,
}: AvatarGroupProps): JSX.Element {
    const shown = people.slice(0, max);
    const overflow = people.length - shown.length;
    return (
        <div className="avatar-group">
            {shown.map((p, i) => (
                <div
                    key={`${p.initials}-${i}`}
                    className="ag"
                    style={{ background: PALETTE[i % PALETTE.length] }}
                    title={p.title}
                    aria-label={p.title}
                >
                    {p.initials}
                </div>
            ))}
            {overflow > 0 && <div className="ag ag-more">+{overflow}</div>}
        </div>
    );
}
