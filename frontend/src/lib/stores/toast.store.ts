import type { ToastItem } from '@/types/components/ui';
import { atom } from 'nanostores';

/**
 * Maximum number of toasts shown at once. The oldest is dropped when a
 * new push would exceed the cap. Matches the previous per-hook cap.
 * @constant {number}
 */
export const TOAST_STACK_MAX = 5;

/**
 * Global toast queue. Components subscribe with `useStore($toasts)` and
 * the `<ToastProvider />` island reads from it; any service or form
 * pushes via {@link toastBus.push}.
 * @type {import('nanostores').Atom<ToastItem[]>}
 */
export const $toasts = atom<ToastItem[]>([]);

/**
 * Generates a stable, monotonically-increasing id for a pushed toast.
 * Pairs a millisecond clock with a counter to stay unique within the
 * same millisecond.
 */
let counter = 0;
function nextId(): string {
    counter += 1;
    return `t-${Date.now()}-${counter}`;
}

/**
 * The toast bus. Push to show a toast, dismiss to hide one by id,
 * clear to empty the stack. Imported wherever a notification is needed
 * — the bus is the only mutation entry point so the UI re-renders
 * deterministically.
 * @namespace toastBus
 */
export const toastBus = {
    /**
     * Add a toast to the stack. If the stack would exceed
     * {@link TOAST_STACK_MAX}, the oldest toast is dropped.
     * @param {Omit<ToastItem, 'id'>} item - Toast payload (id is generated).
     * @returns {string} The id assigned to the pushed toast.
     */
    push(item: Omit<ToastItem, 'id'>): string {
        const id = nextId();
        const next: ToastItem = { ...item, id };
        const stack = $toasts.get();
        const trimmed =
            stack.length >= TOAST_STACK_MAX
                ? stack.slice(stack.length - TOAST_STACK_MAX + 1)
                : stack;
        $toasts.set([...trimmed, next]);
        return id;
    },

    /**
     * Remove a toast by id. No-op if the id is not present.
     * @param {string} id - Toast id returned by `push`.
     * @returns {void}
     */
    dismiss(id: string): void {
        $toasts.set($toasts.get().filter(t => t.id !== id));
    },

    /**
     * Remove every toast. Use sparingly — typically only on route change.
     * @returns {void}
     */
    clear(): void {
        $toasts.set([]);
    },
};
