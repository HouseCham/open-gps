import type { ChangeEvent, JSX } from "react";
/**
 * @interface SettingsChoiceProps
 * @prop {string} name - The name of the setting.
 * @prop {string} value - The value of the setting.
 * @prop {string} label - The label for the setting.
 * @prop {boolean} checked - Whether the setting is selected.
 * @prop {(event: ChangeEvent<HTMLInputElement>) => void} onChange - The change handler for the setting.
 */
interface SettingsChoiceProps {
    name: string;
    value: string;
    label: string;
    checked: boolean;
    onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}
/**
 * Renders a radio button for a settings option
 * @param {SettingsChoiceProps} props - The props for the component.
 * @returns {JSX.Element} The rendered component.
 */
export function SettingsChoice({
    name,
    value,
    label,
    checked,
    onChange,
}: SettingsChoiceProps): JSX.Element {
    const id = `${name}-${value}`;
    return (
        <span className="settings-choice">
            <input
                id={id}
                type="radio"
                name={name}
                value={value}
                checked={checked}
                onChange={onChange}
            />
            <label htmlFor={id}>{label}</label>
        </span>
    );
}