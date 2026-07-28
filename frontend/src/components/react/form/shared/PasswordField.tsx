import { useState } from 'react';
//-- Types
import type { JSX } from 'react';
//-- Components
import { Input } from '@/components/react/form/ui';
//-- Icons
import { Eye, EyeOff } from 'lucide-react';

/**
 * Props for the PasswordField component.
 * @interface PasswordFieldProps
 * @prop {string} id - Input id.
 * @prop {string} value - Input value.
 * @prop {(value: string) => void} onChange - Input change handler.
 * @prop {boolean} invalid - Whether the input is invalid.
 * @prop {string} autoComplete - Input autoComplete attribute.
 * @prop {string} placeholder - Input placeholder.
 * @prop {boolean} required - Whether the input is required.
 * @prop {string} showLabel - Label for the show password button.
 * @prop {string} hideLabel - Label for the hide password button.
 */
interface PasswordFieldProps {
    id: string;
    value: string;
    onChange: (value: string) => void;
    invalid?: boolean;
    autoComplete?: string;
    placeholder?: string;
    required?: boolean;
    showLabel: string;
    hideLabel: string;
}

/**
 * Password input with a visibility toggle suffix button.
 * @param {PasswordFieldProps} props
 * @returns {JSX.Element}
 */
export function PasswordField({
    id,
    value,
    onChange,
    invalid,
    autoComplete,
    placeholder,
    required,
    showLabel,
    hideLabel,
}: PasswordFieldProps): JSX.Element {
    const [show, setShow] = useState(false);
    return (
        <div className="input-with-suffix">
            <Input
                id={id}
                type={show ? 'text' : 'password'}
                placeholder={placeholder}
                value={value}
                onChange={e => onChange(e.target.value)}
                invalid={invalid}
                autoComplete={autoComplete}
                required={required}
            />
            <button
                type="button"
                className="suffix"
                onClick={() => setShow(s => !s)}
                aria-label={show ? hideLabel : showLabel}
                aria-pressed={show}
            >
                {show ? (
                    <EyeOff className="icon-16" />
                ) : (
                    <Eye className="icon-16" />
                )}
            </button>
        </div>
    );
}
