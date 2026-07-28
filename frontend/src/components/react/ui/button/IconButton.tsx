import '@/styles/components/icon-button.css';
//-- Types
import type { JSX } from 'react/jsx-runtime';
import type { MouseEvent } from 'react';
//-- Icons
import { Pencil, Trash2 } from 'lucide-react';

/**
 * Props for the IconButton component
 * @interface IconButtonProps
 * @prop {string} dataID - The data-id attribute.
 * @prop {boolean} danger - Whether the button should be red.
 * @prop {string} ariaLabel - The aria-label attribute.
 * @prop {string} title - The title attribute.
 * @prop {(e: MouseEvent<HTMLButtonElement>) => void} handleAction - The onClick handler.
 */
interface IconButtonProps {
    dataID: string;
    danger?: boolean;
    ariaLabel?: string;
    title?: string;
    handleAction: (e: MouseEvent<HTMLButtonElement>) => void;
}
/**
 * Renders an icon button for editing or deleting an item.
 * @param {IconButtonProps} props - The props for the component.
 * @returns {JSX.Element} The rendered component.
 */
export function IconButton({
    dataID,
    danger = false,
    ariaLabel,
    title,
    handleAction,
}: IconButtonProps): JSX.Element {
    const buttonClass = `icon-action-btn ${danger ? 'is-danger' : ''}`;
    return (
        <button
            type="button"
            className={buttonClass}
            data-id={dataID}
            data-action={danger ? 'delete' : 'edit'}
            onClick={handleAction}
            aria-label={ariaLabel}
            title={title}
        >
            {danger ? (
                <Trash2 size={14} strokeWidth={1.6} />
            ) : (
                <Pencil size={14} strokeWidth={1.6} />
            )}
        </button>
    );
}
