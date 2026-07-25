import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/client', () => ({
    authClient: vi.fn(),
    apiClient: vi.fn(),
}));

import * as clientMod from '@/lib/api/client';
import { $toasts } from '@/lib/stores/toast.store';
import type {
    CreatedUser,
    CreateUserDto,
    Envelope,
    User,
    UserWithDevices,
} from '@/types/api';
import { useUserService } from './userService';

const apiClient = vi.mocked(clientMod.apiClient);

function makeUser(overrides: Partial<User> = {}): User {
    return {
        id: 'u1',
        email: 'a@b.com',
        email_verified: true,
        image: null,
        name: 'Alpha',
        lastname: 'A',
        role: 'user',
        must_change_password: false,
        created_at: '2024-01-01T00:00:00Z',
        ...overrides,
    };
}

const u1 = makeUser({ id: 'u1', name: 'Alpha' });
const u2 = makeUser({ id: 'u2', name: 'Beta' });

beforeEach(() => {
    apiClient.mockReset();
    $toasts.set([]);
});

function listEnv(users: User[]): { data: Envelope<User[]> } {
    return { data: { status_code: 200, message: 'OK', data: users } };
}

describe('useUserService', () => {
    it('getAllUsers fetches the list and hydrates users', async () => {
        apiClient.mockResolvedValue(listEnv([u1, u2]));
        const { result } = renderHook(() => useUserService());

        await act(async () => {
            await result.current.getAllUsers();
        });

        expect(result.current.users).toEqual([u1, u2]);
        expect(result.current.isLoading).toBe(false);
        expect(apiClient).toHaveBeenCalledWith(
            '/users',
            expect.objectContaining({ method: 'GET' })
        );
    });

    it('getUserByID fetches the user and their paginated devices', async () => {
        const user: UserWithDevices = {
            ...u1,
            devices: [
                {
                    id: 'd1',
                    uuid_firmware: 'esp32-001',
                    name: 'Tracker',
                },
            ],
            pagination: {
                page: 2,
                page_size: 5,
                total: 6,
                total_pages: 2,
            },
        };
        apiClient.mockResolvedValue({
            data: { status_code: 200, message: 'OK', data: user },
        });
        const { result } = renderHook(() => useUserService());

        await act(async () => {
            await result.current.getUserByID('u1', 2, 5);
        });

        expect(result.current.user).toEqual(user);
        expect(result.current.isLoading).toBe(false);
        expect(apiClient).toHaveBeenCalledWith('/users/u1', {
            method: 'GET',
            query: { page: 2, page_size: 5 },
        });
    });

    it('createUser appends the returned user to the existing list', async () => {
        const seedEnv = listEnv([u1]);
        const created: CreatedUser = {
            ...makeUser({ id: 'u3', name: 'Gamma' }),
            temporary_password: '0123456789abcdef0123456789abcdef',
        };
        const createEnv: { data: Envelope<CreatedUser> } = {
            data: { status_code: 201, message: 'OK', data: created },
        };
        apiClient
            .mockResolvedValueOnce(seedEnv)
            .mockResolvedValueOnce(createEnv);

        const { result } = renderHook(() => useUserService());

        await act(async () => {
            await result.current.getAllUsers();
        });
        expect(result.current.users.map(u => u.id)).toEqual(['u1']);

        const dto: CreateUserDto = { email: created.email, name: created.name };
        let response: User | undefined;
        await act(async () => {
            response = await result.current.createUser(dto);
        });

        expect(response).toEqual(created);

        expect(result.current.users.map(u => u.id)).toEqual(['u1', 'u3']);
        expect(apiClient).toHaveBeenLastCalledWith(
            '/users',
            expect.objectContaining({ method: 'POST', body: dto })
        );
    });

    it('updateUser swaps the matching row in place', async () => {
        const renamed = makeUser({ id: 'u1', name: 'AlphaPrime' });
        apiClient
            .mockResolvedValueOnce(listEnv([u1, u2]))
            .mockResolvedValueOnce({
                data: { status_code: 200, message: 'OK', data: renamed },
            });

        const { result } = renderHook(() => useUserService());

        await act(async () => {
            await result.current.getAllUsers();
        });

        await act(async () => {
            await result.current.updateUser('u1', { name: 'AlphaPrime' });
        });

        expect(result.current.users[0]?.name).toBe('AlphaPrime');
        expect(result.current.users[1]?.name).toBe('Beta');
    });

    it('deleteUser removes the row by id', async () => {
        apiClient
            .mockResolvedValueOnce(listEnv([u1, u2]))
            .mockResolvedValueOnce({ data: null });

        const { result } = renderHook(() => useUserService());

        await act(async () => {
            await result.current.getAllUsers();
        });

        await act(async () => {
            await result.current.deleteUser('u1');
        });

        expect(result.current.users.map(u => u.id)).toEqual(['u2']);
    });

    it('getAllUsers re-throws a normalized error when the API rejects', async () => {
        apiClient.mockRejectedValue(new Error('boom'));
        const { result } = renderHook(() => useUserService());

        await act(async () => {
            await expect(result.current.getAllUsers()).rejects.toEqual({
                status: 0,
                message: 'boom',
            });
        });
        expect(result.current.isLoading).toBe(false);
    });
});
