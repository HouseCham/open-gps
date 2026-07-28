import '@/styles/ui/select.css';

import type { JSX, SelectHTMLAttributes } from 'react';

/**
 * A single option in the Select dropdown.
 * @interface SelectOption
 * @prop {string} value - The underlying value.
 * @prop {string} label - The human-readable label.
 */
export interface SelectOption {
    value: string;
    label: string;
}

/**
 * Props for the Select component.
 * @interface SelectProps
 * @prop {SelectOption[]} options - Available choices.
 */
export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
    options: readonly SelectOption[];
    invalid?: boolean;
}

/**
 * Select — native dropdown with custom chevron.
 * @param {SelectProps} props
 * @returns {JSX.Element}
 */
export function Select({
    options,
    invalid,
    className = '',
    ...rest
}: SelectProps): JSX.Element {
    return (
        <select
            className={`select-native ${className}`}
            aria-invalid={invalid || undefined}
            {...rest}
        >
            {options.map(o => (
                <option key={o.value} value={o.value}>
                    {o.label}
                </option>
            ))}
        </select>
    );
}
