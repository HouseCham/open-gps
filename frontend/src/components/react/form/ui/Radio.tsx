import '@/styles/ui/radio.css';
import type { JSX } from 'react/jsx-runtime';

/**
 * Props for the Radio component.
 * @interface RadioProps
 * @prop {string} name - Group name (shared across mutually exclusive radios).
 * @prop {string} value - The value this option represents.
 * @prop {string} checked - The currently selected value (controlled).
 * @prop {(value: string) => void} onChange - Called when this radio is selected.
 * @prop {string} label - Visible label.
 * @prop {string} id - id used to associate the label.
 */
export interface RadioProps {
    name: string;
    value: string;
    checked: string;
    onChange: (value: string) => void;
    label?: string;
    id?: string;
    disabled?: boolean;
}

/**
 * Radio — single radio option within a group.
 * @param {RadioProps} props
 * @returns {JSX.Element}
 */
export function Radio({
    name,
    value,
    checked,
    onChange,
    label,
    id,
    disabled,
}: RadioProps): JSX.Element {
    return (
        <label className="check-row" htmlFor={id}>
            <input
                id={id}
                type="radio"
                name={name}
                value={value}
                checked={checked === value}
                className="radio"
                onChange={() => onChange(value)}
                disabled={disabled}
            />
            {label}
        </label>
    );
}
