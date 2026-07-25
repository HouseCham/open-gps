import { useState } from 'react';
//-- Types
import type {
    CreateDeviceDto,
    Device,
    DeviceDetail,
    DeviceListResponse,
    DeviceWithAccess,
    Envelope,
    UpdateDeviceDto,
} from '@/types/api';
//-- Utils
import { handleApiError, withApiErrorToast } from '@/lib/api/api-utils';
import { toastBus } from '@/lib/stores/toast.store';
//-- Http Client
import { apiClient } from '@/lib/api/client';

/**
 * The interface for the device service.
 * @interface IDeviceService
 * @property {boolean} isLoading - Whether the service is currently loading data.
 * @property {DeviceWithAccess[]} devices - The list of devices the authenticated user has access to.
 * @property {DeviceDetail | null} device - The single device retrieved by ID (if any), including its user-access list.
 * @method getAllDevices - Retrieves a paginated list of devices for the authenticated user.
 * @method getDeviceById - Retrieves a single device by its ID along with the users that have access to it.
 * @method createDevice - Creates a new device.
 * @method updateDevice - Updates an existing device's name and/or vehicle type.
 * @method deleteDevice - Soft-deletes a device by its ID.
 * @method grantAccess - Grants a user `viewer` access to the device.
 * @method revokeAccess - Revokes a user's access to the device.
 */
interface IDeviceService {
    isLoading: boolean;
    devices: DeviceWithAccess[];
    device: DeviceDetail | null;
    getAllDevices: (page?: number, pageSize?: number) => Promise<void>;
    getDeviceById: (id: string) => Promise<void>;
    createDevice: (payload: CreateDeviceDto) => Promise<void>;
    updateDevice: (id: string, payload: UpdateDeviceDto) => Promise<void>;
    deleteDevice: (id: string) => Promise<void>;
    grantAccess: (deviceId: string, userId: string) => Promise<void>;
    revokeAccess: (deviceId: string, userId: string) => Promise<void>;
}

/**
 * The HTTP client used to interact with the devices API.
 */
export const useDeviceService = (): IDeviceService => {
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [devices, setDevices] = useState<DeviceWithAccess[]>([]);
    const [device, setDevice] = useState<DeviceDetail | null>(null);

    /**
     * Resets the state of the service to its initial values.
     * @returns {void}
     */
    function resetState(): void {
        setIsLoading(false);
    }

    /**
     * Retrieves a paginated list of devices for the authenticated user.
     * @param {number} [page=1] - The page number to retrieve.
     * @param {number} [pageSize=20] - The number of items per page.
     * @returns {Promise<void>} Resolves when the devices are fetched and state is updated.
     */
    async function getAllDevices(
        page: number = 1,
        pageSize: number = 20
    ): Promise<void> {
        resetState();
        setIsLoading(true);
        setDevices([]);
        try {
            const { data: response } = await withApiErrorToast(() =>
                apiClient<Envelope<DeviceListResponse> | null>('/devices', {
                    method: 'GET',
                    query: { page, page_size: pageSize },
                })
            );
            if (!response) {
                toastBus.push({
                    variant: 'error',
                    title: 'Error',
                    message: 'get all devices returned a null response',
                });
                handleApiError(
                    new Error('get all devices returned a null response')
                );
            }
            setDevices(response.data.items);
        } finally {
            setIsLoading(false);
        }
    }

    /**
     * Retrieves a single device by its ID, including the list of every user
     * that has access to it.
     * @param {string} id - The ID of the device to retrieve.
     * @returns {Promise<void>} Resolves when the device is fetched and state is updated.
     */
    async function getDeviceById(id: string): Promise<void> {
        resetState();
        setIsLoading(true);
        setDevice(null);
        try {
            const { data: response } = await withApiErrorToast(() =>
                apiClient<Envelope<DeviceDetail> | null>(`/devices/${id}`, {
                    method: 'GET',
                })
            );
            if (!response) {
                toastBus.push({
                    variant: 'error',
                    title: 'Error',
                    message: 'get device returned a null response',
                });
                handleApiError(
                    new Error('get device returned a null response')
                );
            }
            setDevice(response.data);
        } finally {
            setIsLoading(false);
        }
    }

    /**
     * Creates a new device and grants the authenticated user owner access to it.
     * @param {CreateDeviceDto} payload - The device data to create.
     * @returns {Promise<void>} Resolves when the device is created and state is updated.
     */
    async function createDevice(payload: CreateDeviceDto): Promise<void> {
        resetState();
        setIsLoading(true);
        try {
            const { data: response } = await withApiErrorToast(() =>
                apiClient<Envelope<Device> | null>('/devices', {
                    method: 'POST',
                    body: payload,
                })
            );
            if (!response || !response.data) {
                toastBus.push({
                    variant: 'error',
                    title: 'Error',
                    message: 'create device returned a null response',
                });
                handleApiError(
                    new Error('create device returned a null response')
                );
            }
            // Optimistically add the new device to the list as a DeviceWithAccess
            const newDeviceWithAccess: DeviceWithAccess = {
                ...response.data,
                access_role: 'owner',
            };
            setDevices([newDeviceWithAccess, ...devices]);
        } finally {
            setIsLoading(false);
        }
    }

    /**
     * Updates an existing device's name and/or vehicle type.
     * @param {string} id - The ID of the device to update.
     * @param {UpdateDeviceDto} payload - The fields to update.
     * @returns {Promise<void>} Resolves when the device is updated and state is updated.
     */
    async function updateDevice(
        id: string,
        payload: UpdateDeviceDto
    ): Promise<void> {
        resetState();
        setIsLoading(true);
        try {
            const { data: response } = await withApiErrorToast(() =>
                apiClient<Envelope<Device> | null>(`/devices/${id}`, {
                    method: 'PUT',
                    body: payload,
                })
            );
            if (!response || !response.data) {
                toastBus.push({
                    variant: 'error',
                    title: 'Error',
                    message: 'update device returned a null response',
                });
                handleApiError(
                    new Error('update device returned a null response')
                );
            }
            // Update the device in the list if it is present there
            setDevices(prev =>
                prev.map(d => (d.id === id ? { ...d, ...response.data } : d))
            );
            // Update the single-device state if it matches; preserve fields
            // the PUT response does not carry (users, access_role).
            if (device && device.id === id) {
                setDevice({ ...device, ...response.data });
            }
        } finally {
            setIsLoading(false);
        }
    }

    /**
     * Soft-deletes a device by its ID.
     * @param {string} id - The ID of the device to delete.
     * @returns {Promise<void>} Resolves when the device is deleted and state is updated.
     */
    async function deleteDevice(id: string): Promise<void> {
        resetState();
        setIsLoading(true);
        try {
            await withApiErrorToast(() =>
                apiClient<Envelope<null> | null>(`/devices/${id}`, {
                    method: 'DELETE',
                })
            );
            // Remove the deleted device from the list
            setDevices(prev => prev.filter(d => d.id !== id));
            // Clear single-device state if it matches
            if (device && device.id === id) {
                setDevice(null);
            }
        } finally {
            setIsLoading(false);
        }
    }

    /**
     * Grants a user `viewer` access to the device and refreshes the device
     * detail (which now includes the updated users list).
     * @param {string} deviceId - The ID of the device.
     * @param {string} userId - The ID of the user to grant access to.
     * @returns {Promise<void>} Resolves when the grant completes.
     */
    async function grantAccess(
        deviceId: string,
        userId: string
    ): Promise<void> {
        setIsLoading(true);
        try {
            await withApiErrorToast(() =>
                apiClient<Envelope<unknown> | null>(
                    `/devices/${deviceId}/access`,
                    {
                        method: 'POST',
                        body: { user_id: userId },
                    }
                )
            );
            // Refresh the device so `device.users` reflects the new grant.
            await getDeviceById(deviceId);
        } finally {
            setIsLoading(false);
        }
    }

    /**
     * Revokes a user's access to the device and refreshes the device detail
     * (which now reflects the missing user).
     * @param {string} deviceId - The ID of the device.
     * @param {string} userId - The ID of the user whose access to revoke.
     * @returns {Promise<void>} Resolves when the revocation completes.
     */
    async function revokeAccess(
        deviceId: string,
        userId: string
    ): Promise<void> {
        setIsLoading(true);
        try {
            await withApiErrorToast(() =>
                apiClient<Envelope<null> | null>(
                    `/devices/${deviceId}/access/${userId}`,
                    {
                        method: 'DELETE',
                    }
                )
            );
            // Refresh the device so `device.users` reflects the revocation.
            await getDeviceById(deviceId);
        } finally {
            setIsLoading(false);
        }
    }

    return {
        isLoading,
        devices,
        device,
        //-- actions
        getAllDevices,
        getDeviceById,
        createDevice,
        updateDevice,
        deleteDevice,
        grantAccess,
        revokeAccess,
    };
};
