import '@/styles/ui/tag-input.css';

import { useState, type JSX } from 'react';
import { X } from 'lucide-react';

/**
 * Props for the TagInput component.
 * @interface TagInputProps
 * @prop {string[]} value - Current tags.
 * @prop {(tags: string[]) => void} onChange - Called with the new tags array.
 * @prop {string} placeholder - Input placeholder. Default: 'Add tag…'.
 */
export interface TagInputProps {
    value: string[];
    onChange?: (tags: string[]) => void;
    placeholder?: string;
}

/**
 * TagInput — comma/enter to add, backspace to remove last.
 * @param {TagInputProps} props
 * @returns {JSX.Element}
 */
export function TagInput({
    value,
    onChange,
    placeholder = 'Add tag…',
}: TagInputProps): JSX.Element {
    const [draft, setDraft] = useState('');
    /**
     * Add a new tag.
     * @param {string} raw - Raw input value.
     * @returns {void}
     */
    const commit = (raw: string): void => {
        const t = raw.trim();
        if (!t) return;
        onChange?.([...value, t]);
        setDraft('');
    };
    /**
     * Remove a tag.
     * @param {number} i - Index of the tag to remove.
     * @returns {void}
     */
    const remove = (i: number): void => {
        onChange?.(value.filter((_, idx) => idx !== i));
    };

    return (
        <div
            className="tag-input"
            onClick={e => {
                const target = e.target as HTMLElement;
                target.querySelector('input')?.focus();
            }}
        >
            {value.map((t, i) => (
                <span className="tag-chip" key={`${t}-${i}`}>
                    {t}
                    <span
                        className="x"
                        role="button"
                        tabIndex={0}
                        onClick={e => {
                            e.stopPropagation();
                            remove(i);
                        }}
                        onKeyDown={e => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                remove(i);
                            }
                        }}
                        aria-label={`Remove ${t}`}
                    >
                        <X size={10} aria-hidden="true" />
                    </span>
                </span>
            ))}
            <input
                value={draft}
                placeholder={placeholder}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault();
                        commit(draft);
                    }
                    if (e.key === 'Backspace' && !draft && value.length) {
                        remove(value.length - 1);
                    }
                }}
            />
        </div>
    );
}
