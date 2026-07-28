import { useEffect } from 'react';
/**
 * Handles click outside of an element
 * @function useClickOutside
 * @param {React.RefObject<HTMLElement | null>} ref - The ref to the element
 * @param {Function} onClose - The function to call when the element is clicked outside
 * @returns {void}
 */
export function useClickOutside(
    ref: React.RefObject<HTMLElement | null>,
    onClose: () => void
): void {
    useEffect(() => {
        const onDoc = (e: MouseEvent): void => {
            if (ref.current && !ref.current.contains(e.target as Node))
                onClose();
        };
        const onKey = (e: KeyboardEvent): void => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('mousedown', onDoc);
        document.addEventListener('keydown', onKey);
        return (): void => {
            document.removeEventListener('mousedown', onDoc);
            document.removeEventListener('keydown', onKey);
        };
    }, [ref, onClose]);
}
