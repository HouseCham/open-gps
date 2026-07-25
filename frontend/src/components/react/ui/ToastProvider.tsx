import '@/styles/ui/toast.css';

import { useStore } from '@nanostores/react';
import { useEffect, type JSX } from 'react';
import {
    TOAST_DEFAULT_DURATION_MS,
    TOAST_ERROR_DURATION_MS,
} from '@/constants/components/ui/toast.constants';
import { $toasts, toastBus } from '@/lib/stores/toast.store';
import { ToastStack } from '@/components/react/ui/toast/ToastStack';
import type { ToastItem } from '@/types/components/ui';

/**
 * Resolves the auto-dismiss delay for a toast. Caller-supplied
 * `duration` wins; errors default to a longer window than the rest
 * so users can read the cause.
 * @param {ToastItem} toast - The toast to time.
 * @returns {number} Delay in ms. `0` means sticky (never auto-dismiss).
 */
function resolveDuration(toast: ToastItem): number {
    if (typeof toast.duration === 'number') return toast.duration;
    return toast.variant === 'error'
        ? TOAST_ERROR_DURATION_MS
        : TOAST_DEFAULT_DURATION_MS;
}

/**
 * ToastProvider — single global container island. Subscribes to the
 * toast nanostore, renders the stack, and owns the auto-dismiss
 * timers so individual rows stay presentational.
 *
 * Mount once per page tree (typically inside the layout). Pair with
 * `client:load` so the subscription is live before the first user
 * interaction — toast pushes that fire before hydration would be
 * dropped silently otherwise.
 * @returns {JSX.Element}
 */
export function ToastProvider(): JSX.Element {
    const toasts = useStore($toasts);

    useEffect(() => {
        const timers = new Map<string, ReturnType<typeof setTimeout>>();
        for (const t of toasts) {
            const delay = resolveDuration(t);
            if (delay <= 0) continue;
            timers.set(
                t.id,
                setTimeout(() => {
                    toastBus.dismiss(t.id);
                }, delay),
            );
        }
        return (): void => {
            for (const handle of timers.values()) clearTimeout(handle);
            timers.clear();
        };
    }, [toasts]);

    return <ToastStack toasts={toasts} onDismiss={toastBus.dismiss} />;
}