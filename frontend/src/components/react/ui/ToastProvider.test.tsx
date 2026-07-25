import { act, render } from '@testing-library/react';
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';
import {
    TOAST_DEFAULT_DURATION_MS,
    TOAST_ERROR_DURATION_MS,
} from '@/constants/components/ui/toast.constants';
import { $toasts, toastBus } from '@/lib/stores/toast.store';
import { ToastProvider } from '@/components/react/ui/ToastProvider';

beforeEach(() => {
    $toasts.set([]);
    vi.useFakeTimers();
});

afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
});

describe('<ToastProvider />', () => {
    it('renders no rows when the queue is empty', () => {
        const { container } = render(<ToastProvider />);
        expect(container.querySelector('.gp-toast-stack')?.children).toHaveLength(0);
    });

    it('renders a row for each toast in the queue', () => {
        toastBus.push({ variant: 'success', title: 'A' });
        toastBus.push({ variant: 'error', title: 'B' });
        const { container } = render(<ToastProvider />);
        const rows = container.querySelectorAll('.gp-toast');
        expect(rows).toHaveLength(2);
        expect(rows[0]?.classList.contains('gp-toast--success')).toBe(true);
        expect(rows[1]?.classList.contains('gp-toast--error')).toBe(true);
    });

    it('dismisses toasts after their explicit duration', () => {
        toastBus.push({ variant: 'success', title: 'A', duration: 100 });
        render(<ToastProvider />);
        expect($toasts.get()).toHaveLength(1);
        act(() => {
            vi.advanceTimersByTime(150);
        });
        expect($toasts.get()).toHaveLength(0);
    });

    it(`uses TOAST_ERROR_DURATION_MS for errors without an explicit duration`, () => {
        toastBus.push({ variant: 'error', title: 'A' });
        render(<ToastProvider />);
        act(() => {
            vi.advanceTimersByTime(TOAST_DEFAULT_DURATION_MS);
        });
        expect($toasts.get()).toHaveLength(1);
        act(() => {
            vi.advanceTimersByTime(
                TOAST_ERROR_DURATION_MS - TOAST_DEFAULT_DURATION_MS,
            );
        });
        expect($toasts.get()).toHaveLength(0);
    });

    it('keeps toasts sticky when duration is 0', () => {
        toastBus.push({ variant: 'info', title: 'A', duration: 0 });
        render(<ToastProvider />);
        act(() => {
            vi.advanceTimersByTime(60_000);
        });
        expect($toasts.get()).toHaveLength(1);
    });
});