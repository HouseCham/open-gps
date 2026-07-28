import '@/styles/ui/checkbox.css';

import { useEffect, useRef, type JSX, type ReactNode } from 'react';

/**
 * Props for the Checkbox component.
 * @interface CheckboxProps
 * @prop {boolean} checked - Whether the checkbox is checked.
 * @prop {(checked: boolean) => void} onChange - Called when state changes.
 * @prop {boolean} indeterminate - Renders a horizontal dash (mixed state).
 * @prop {ReactNode} label - Visible label.
 * @prop {string} id - id used to associate the label.
 */
export interface CheckboxProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
    indeterminate?: boolean;
    label?: ReactNode;
    id?: string;
}

/**
 * Checkbox — tri-state (checked/unchecked/indeterminate) checkbox with label.
 * @param {CheckboxProps} props
 * @returns {JSX.Element}
 */
export function Checkbox({
    checked,
    onChange,
    disabled,
    indeterminate,
    label,
    id,
}: CheckboxProps): JSX.Element {
    const ref = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (ref.current) ref.current.indeterminate = !!indeterminate;
    }, [indeterminate]);

    return (
        <label className="check-row" htmlFor={id}>
            <input
                id={id}
                ref={ref}
                type="checkbox"
                className="check"
                checked={checked}
                onChange={e => onChange(e.target.checked)}
                disabled={disabled}
            />
            {label}
        </label>
    );
}
