import type { JSX } from 'react';

/**
 * Horizontal "or" separator used between primary and OAuth actions.
 * @param {{ label: string }} props
 * @returns {JSX.Element}
 */
export function OrDivider({ label }: { label: string }): JSX.Element {
    return (
        <div className="or-divider" role="separator">
            <span>{label}</span>
        </div>
    );
}
