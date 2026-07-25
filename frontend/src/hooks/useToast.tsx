import { useStore } from '@nanostores/react';
import { $toasts, toastBus } from '@/lib/stores/toast.store';
import type { ToastHandle } from '@/types/components/ui';

/**
 * Read the current toast stack and expose the bus actions. Components
 * that only need to `push` (and re-render on push) should prefer this
 * hook over the lower-level store import.
 *
 * The `<Container />` from the previous implementation is gone — the
 * `<ToastProvider />` island owns the single global container. The
 * `dismiss` and `clear` handles are kept for API parity.
 *
 * @returns {ToastHandle} Snapshot of the toast stack + push/dismiss/clear.
 */
export function useToast(): ToastHandle {
    const toasts = useStore($toasts);

    return {
        toasts,
        push: toastBus.push,
        dismiss: toastBus.dismiss,
        clear: toastBus.clear,
    };
}
