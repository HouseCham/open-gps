import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/client', () => ({
    authClient: vi.fn(),
    apiClient: vi.fn(),
}));

import * as clientMod from '@/lib/api/client';
import { $toasts } from '@/lib/stores/toast.store';
import type {
    Device,
    DeviceDetail,
    DeviceListResponse,
    DeviceWithAccess,
    Envelope,
} from '@/types/api';
import { useDeviceService } from './deviceService';

const apiClient = vi.mocked(clientMod.apiClient);

function device(id: string): Device {
    return {
        id,
        uuid_firmware: `fw-${id}`,
        name: `Device ${id}`,
        vehicle_type: 'car',
        created_at: '2024-01-01T00:00:00Z',
        last_seen_at: null,
    };
}

function withAccess(id: string): DeviceWithAccess {
    return { ...device(id), access_role: 'owner' };
}

function listEnv(items: DeviceWithAccess[]): {
    data: Envelope<DeviceListResponse>;
} {
    return {
        data: {
            status_code: 200,
            message: 'OK',
            data: {
                items,
                pagination: {
                    page: 1,
                    page_size: 20,
                    total: items.length,
                    total_pages: 1,
                },
            },
        },
    };
}

function detailEnv(detail: DeviceDetail): { data: Envelope<DeviceDetail> } {
    return { data: { status_code: 200, message: 'OK', data: detail } };
}

beforeEach(() => {
    apiClient.mockReset();
    $toasts.set([]);
});

describe('useDeviceService', () => {
    describe('getAllDevices', () => {
        it('hydrates devices from the paged response with default paging', async () => {
            const items = [withAccess('d1'), withAccess('d2')];
            apiClient.mockResolvedValue(listEnv(items));

            const { result } = renderHook(() => useDeviceService());

            await act(async () => {
                await result.current.getAllDevices();
            });

            expect(result.current.devices).toEqual(items);
            expect(apiClient).toHaveBeenCalledWith(
                '/devices',
                expect.objectContaining({
                    method: 'GET',
                    query: { page: 1, page_size: 20 },
                })
            );
        });

        it('forwards custom page + page_size in the query string', async () => {
            apiClient.mockResolvedValue(listEnv([]));

            const { result } = renderHook(() => useDeviceService());

            await act(async () => {
                await result.current.getAllDevices(2, 5);
            });

            expect(apiClient).toHaveBeenCalledWith(
                '/devices',
                expect.objectContaining({ query: { page: 2, page_size: 5 } })
            );
        });
    });

    describe('createDevice', () => {
        it('optimistically prepends the created device with access_role=owner', async () => {
            const created = device('d-new');
            apiClient.mockResolvedValue({
                data: { status_code: 201, message: 'OK', data: created },
            });

            const { result } = renderHook(() => useDeviceService());

            await act(async () => {
                await result.current.createDevice({
                    uuid_firmware: 'fw-new',
                    name: 'New',
                    vehicle_type: 'car',
                });
            });

            expect(result.current.devices[0]?.id).toBe('d-new');
            expect(result.current.devices[0]?.access_role).toBe('owner');
        });
    });

    describe('updateDevice', () => {
        it('patches the matching row in the devices list', async () => {
            const renamed = { ...device('d1'), name: 'Renamed' };
            apiClient
                .mockResolvedValueOnce(listEnv([withAccess('d1')]))
                .mockResolvedValueOnce({
                    data: { status_code: 200, message: 'OK', data: renamed },
                });

            const { result } = renderHook(() => useDeviceService());

            await act(async () => {
                await result.current.getAllDevices();
            });

            await act(async () => {
                await result.current.updateDevice('d1', { name: 'Renamed' });
            });

            expect(result.current.devices[0]?.name).toBe('Renamed');
        });
    });

    describe('deleteDevice', () => {
        it('removes the device from the list', async () => {
            apiClient
                .mockResolvedValueOnce(
                    listEnv([withAccess('d1'), withAccess('d2')])
                )
                .mockResolvedValueOnce({ data: null });

            const { result } = renderHook(() => useDeviceService());

            await act(async () => {
                await result.current.getAllDevices();
            });

            await act(async () => {
                await result.current.deleteDevice('d1');
            });

            expect(result.current.devices.map(d => d.id)).toEqual(['d2']);
        });
    });

    describe('access grants', () => {
        it('grantAccess POSTs and then re-fetches the device detail', async () => {
            const refreshed: DeviceDetail = {
                ...withAccess('d1'),
                users: [
                    {
                        user_id: 'u-x',
                        name: 'X',
                        email: 'x@y.com',
                        role: 'viewer',
                        access_granted_at: '2024-01-01T00:00:00Z',
                    },
                ],
            };

            apiClient
                .mockResolvedValueOnce({
                    data: { status_code: 201, message: 'OK', data: null },
                })
                .mockResolvedValueOnce(detailEnv(refreshed));

            const { result } = renderHook(() => useDeviceService());

            await act(async () => {
                await result.current.grantAccess('d1', 'u-x');
            });

            expect(apiClient).toHaveBeenNthCalledWith(
                1,
                '/devices/d1/access',
                expect.objectContaining({
                    method: 'POST',
                    body: { user_id: 'u-x' },
                })
            );
            expect(apiClient).toHaveBeenNthCalledWith(
                2,
                '/devices/d1',
                expect.objectContaining({ method: 'GET' })
            );
            expect(result.current.device?.users).toEqual(refreshed.users);
        });

        it('revokeAccess DELETEs and then re-fetches the device detail', async () => {
            const refreshed: DeviceDetail = { ...withAccess('d1'), users: [] };

            apiClient
                .mockResolvedValueOnce({
                    data: { status_code: 204, message: 'OK', data: null },
                })
                .mockResolvedValueOnce(detailEnv(refreshed));

            const { result } = renderHook(() => useDeviceService());

            await act(async () => {
                await result.current.revokeAccess('d1', 'u-x');
            });

            expect(apiClient).toHaveBeenNthCalledWith(
                1,
                '/devices/d1/access/u-x',
                expect.objectContaining({ method: 'DELETE' })
            );
            expect(apiClient).toHaveBeenNthCalledWith(
                2,
                '/devices/d1',
                expect.objectContaining({ method: 'GET' })
            );
            expect(result.current.device?.users).toEqual([]);
        });
    });
});
