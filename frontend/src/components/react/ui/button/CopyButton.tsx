import { useState } from 'react';
//-- Types
import type { JSX } from 'react/jsx-runtime';
//-- Utils
import { copyToClipboard } from '@/lib';
//-- Components
import { Button } from './Button';
//-- Icons
import { Check, Copy } from 'lucide-react';

/**
 * Props for the CopyButton component.
 * @interface CopyButtonProps
 * @prop {string} value - The value to copy.
 * @prop {string} label - Button label.
 * @prop {string} copiedLabel - Button label when copied.
 */
interface CopyButtonProps {
    value: string;
    label: string;
    copiedLabel: string;
}
/**
 * A button that copies a value to the clipboard.
 * @param {CopyButtonProps} props - Props for the component.
 * @returns {JSX.Element} The rendered component.
 */
export function CopyButton({
    value,
    label,
    copiedLabel,
}: CopyButtonProps): JSX.Element {
    const [copied, setCopied] = useState(false);
    /**
     * Copies the value to the clipboard.
     * @returns {Promise<void>} A promise that resolves when the value is copied.
     */
    const handleCopy = async (): Promise<void> => {
        if (await copyToClipboard(value)) {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
        }
    };

    return (
        <Button
            type="button"
            variant="ghost"
            size="sm"
            iconOnly
            className={`dd-copy-button${copied ? ' is-copied' : ''}`}
            onClick={() => void handleCopy()}
            aria-label={copied ? copiedLabel : label}
            title={copied ? copiedLabel : label}
            icon={copied ? <Check size={12} /> : <Copy size={12} />}
        />
    );
}
