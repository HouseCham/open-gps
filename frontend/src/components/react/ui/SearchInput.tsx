import '@/styles/ui/search-input.css';

import { useEffect, useRef, type JSX } from 'react';
import { Search } from 'lucide-react';

/**
 * Props for the SearchInput component.
 * @interface SearchInputProps
 * @prop {string} value - Current search value.
 * @prop {(v: string) => void} onChange - Called on each keystroke.
 * @prop {string} placeholder - Placeholder text.
 * @prop {string} kbd - Keyboard hint shown on the right. Default: '⌘K'.
 */
export interface SearchInputProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    kbd?: string;
}

/**
 * SearchInput — input with magnifier icon and ⌘K shortcut.
 * @param {SearchInputProps} props
 * @returns {JSX.Element}
 */
export function SearchInput({
    value,
    onChange,
    placeholder = 'Search devices…',
    kbd = '⌘K',
}: SearchInputProps): JSX.Element {
    const ref = useRef<HTMLInputElement>(null);
    /**
     * Handle ⌘K shortcuts.
     * @param {KeyboardEvent} e - The keydown event.
     * @returns {void}
     */
    const onKey = (e: KeyboardEvent): void => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            ref.current?.focus();
        }
    };
    useEffect(() => {
        window.addEventListener('keydown', onKey);
        return (): void => window.removeEventListener('keydown', onKey);
    }, []);

    return (
        <div className="input-search" style={{ display: 'block' }}>
            <Search size={14} aria-hidden="true" />
            <input
                ref={ref}
                type="text"
                className="input"
                placeholder={placeholder}
                value={value}
                onChange={e => onChange(e.target.value)}
                aria-label="Search"
            />
            <div className="input-search-append">
                <kbd>{kbd}</kbd>
            </div>
        </div>
    );
}
