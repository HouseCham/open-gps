import { StrictMode, type ReactNode, type JSX } from 'react';
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useHydrateOnce } from './useHydrateOnce';

function Strict({ children }: { children: ReactNode }): JSX.Element {
    return <StrictMode>{children}</StrictMode>;
}

describe('useHydrateOnce', () => {
    it('invokes refresh exactly once on first mount', () => {
        const refresh = vi.fn();
        renderHook(() => useHydrateOnce(refresh));
        expect(refresh).toHaveBeenCalledTimes(1);
    });

    it('does NOT re-invoke refresh on re-renders with the same identity', () => {
        const refresh = vi.fn();
        const { rerender } = renderHook(() => useHydrateOnce(refresh));
        rerender();
        rerender();
        expect(refresh).toHaveBeenCalledTimes(1);
    });

    it('does NOT re-invoke refresh when its identity changes (ref-gate, not the deps array)', () => {
        const first = vi.fn();
        const { rerender } = renderHook(({ fn }) => useHydrateOnce(fn), {
            initialProps: { fn: first as () => void },
        });
        const second = vi.fn();
        rerender({ fn: second });
        expect(first).toHaveBeenCalledTimes(1);
        expect(second).not.toHaveBeenCalled();
    });

    it('StrictMode double-mount still invokes refresh only once', () => {
        const refresh = vi.fn();
        renderHook(() => useHydrateOnce(refresh), { wrapper: Strict });
        expect(refresh).toHaveBeenCalledTimes(1);
    });
});
