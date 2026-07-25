import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/client', () => ({
    authClient: vi.fn(),
    apiClient: vi.fn(),
}));

import * as clientMod from '@/lib/api/client';
import type {
    DeviceCountResponse,
    Envelope,
    ProfileResponse,
    User,
} from '@/types/api';
import { useProfileService } from './profileService';

const apiClient = vi.mocked(clientMod.apiClient);

const user: User = {
    id: 'u1',
    email: 'a@b.com',
    email_verified: true,
    image: null,
    name: 'Alpha',
    lastname: 'A',
    role: 'user',
    must_change_password: false,
    created_at: '2024-01-01T00:00:00Z',
};

beforeEach(() => {
    apiClient.mockReset();
});

describe('useProfileService.refresh', () => {
    it('hydrates profile + deviceCount on a successful fetch and clears isLoading', async () => {
        const meEnv: { data: Envelope<ProfileResponse['user']> } = {
            data: { status_code: 200, message: 'OK', data: user },
        };
        const countEnv: { data: Envelope<DeviceCountResponse> } = {
            data: { status_code: 200, message: 'OK', data: { total: 3 } },
        };
        apiClient.mockResolvedValueOnce(meEnv).mockResolvedValueOnce(countEnv);

        const { result } = renderHook(() => useProfileService());

        await act(async () => {
            await result.current.refresh();
        });

        expect(result.current.profile).toEqual(user);
        expect(result.current.deviceCount).toBe(3);
        expect(result.current.error).toBeNull();
        expect(result.current.isLoading).toBe(false);
    });

    it('captures errors into state instead of re-throwing', async () => {
        apiClient.mockRejectedValue(new Error('boom'));

        const { result } = renderHook(() => useProfileService());

        await act(async () => {
            await result.current.refresh();
        });

        expect(result.current.error).toEqual({
            status: 0,
            message: 'boom',
        });
        expect(result.current.isLoading).toBe(false);
    });

    it('leaves profile + deviceCount untouched on a null response (no data wipe)', async () => {
        // First: seed both.
        apiClient
            .mockResolvedValueOnce({
                data: { status_code: 200, message: 'OK', data: user },
            })
            .mockResolvedValueOnce({
                data: { status_code: 200, message: 'OK', data: { total: 3 } },
            });

        const { result } = renderHook(() => useProfileService());

        await act(async () => {
            await result.current.refresh();
        });

        expect(result.current.profile).toEqual(user);
        expect(result.current.deviceCount).toBe(3);

        // Then: simulate a 401-style null response on both calls. The
        // service must leave the seed values intact — that's the contract
        // callers depend on for an inline retry that does not blank the UI.
        apiClient
            .mockResolvedValueOnce({ data: null })
            .mockResolvedValueOnce({ data: null });

        await act(async () => {
            await result.current.refresh();
        });

        expect(result.current.profile).toEqual(user);
        expect(result.current.deviceCount).toBe(3);
        expect(result.current.error).toBeNull();
    });
});
