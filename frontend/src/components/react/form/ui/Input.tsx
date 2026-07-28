import '@/styles/ui/input.css';

import type { InputHTMLAttributes, JSX } from 'react';

/**
 * Props for the Input component.
 * @interface InputProps
 * @prop {boolean} invalid - Marks the input as invalid (red ring).
 */
export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    invalid?: boolean;
}

/**
 * Input — single-line text field.
 * @param {InputProps} props
 * @returns {JSX.Element}
 */
export function Input({
    invalid,
    className = '',
    ...rest
}: InputProps): JSX.Element {
    return (
        <input
            className={`input ${className}`}
            aria-invalid={invalid || undefined}
            {...rest}
        />
    );
}
