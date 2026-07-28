import '@/styles/ui/switch.css';
import type { JSX } from 'react/jsx-runtime';

/**
 * Props for the Switch component.
 * @interface SwitchProps
 * @prop {boolean} checked - Whether the switch is on.
 * @prop {(checked: boolean) => void} onChange - Called when toggled.
 * @prop {string} label - Visible label.
 * @prop {string} id - id used to associate the label.
 */
export interface SwitchProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
    label?: string;
    id?: string;
}

/**
 * Switch — toggle with sliding thumb.
 * @param {SwitchProps} props
 * @returns {JSX.Element}
 */
export function Switch({
    checked,
    onChange,
    disabled,
    label,
    id,
}: SwitchProps): JSX.Element {
    return (
        <label className="switch-row" htmlFor={id}>
            <input
                id={id}
                type="checkbox"
                className="switch"
                checked={checked}
                onChange={e => onChange(e.target.checked)}
                disabled={disabled}
            />
            {label}
        </label>
    );
}
