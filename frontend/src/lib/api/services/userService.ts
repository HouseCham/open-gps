import { useState } from 'react';
//-- Types
import type {
    ApiError,
    CreateUserDto,
    CreatedUser,
    Envelope,
    UpdateUserDto,
    User,
    UserWithDevices,
} from '@/types/api';

//-- Utils
import {
    handleApiError,
    isApiError,
    toApiError,
    withApiErrorToast,
} from '@/lib/api/api-utils';
import { toastBus } from '@/lib/stores/toast.store';
//-- Http Client
import { apiClient } from '@/lib/api/client';
/**
 * The interface for the user service.
 * @interface IUserService
 * @property {boolean} isLoading - Whether the service is currently loading data.
 * @property {ApiError | null} error - The error that occurred, if any.
 * @property {User[]} users - The list of users.
 * @property {UserWithDevices | null} user - The user retrieved by ID.
 * @method getAllUsers - Retrieves a list of all users.
 * @method getUserByID - Retrieves a user and their paginated devices.
 * @method createUser - Creates a new user.
 * @method updateUser - Updates an existing user's `name` / `lastname`.
 * @method deleteUser - Soft-deletes a user (`204 No Content`).
 */
interface IUserService {
    isLoading: boolean;
    error: ApiError | null;
    users: User[];
    user: UserWithDevices | null;
    getAllUsers: () => Promise<void>;
    getUserByID: (
        id: string,
        page?: number,
        pageSize?: number
    ) => Promise<void>;
    createUser: (payload: CreateUserDto) => Promise<CreatedUser>;
    updateUser: (id: string, payload: UpdateUserDto) => Promise<void>;
    deleteUser: (id: string) => Promise<void>;
}
/**
 * The HTTP client used to interact with the users API.
 */
export const useUserService = (): IUserService => {
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<ApiError | null>(null);
    const [users, setUsers] = useState<User[]>([]);
    const [user, setUser] = useState<UserWithDevices | null>(null);
    /**
     * Resets the state of the service to its initial values.
     * @returns {void}
     */
    function resetState(): void {
        setIsLoading(false);
        setError(null);
    }
    /**
     * Retrieves a list of all users.
     * @returns {Promise<void>} Resolves when the users are fetched and state is updated.
     */
    async function getAllUsers(): Promise<void> {
        resetState();
        setIsLoading(true);
        setUsers([]);
        try {
            const { data: response } = await withApiErrorToast(() =>
                apiClient<Envelope<User[]> | null>('/users', {
                    method: 'GET',
                })
            );
            if (!response) {
                toastBus.push({
                    variant: 'error',
                    title: 'Error',
                    message: 'get all users returned a null response',
                });
                handleApiError(
                    new Error('get all users returned a null response')
                );
            }
            setUsers(response.data);
        } finally {
            setIsLoading(false);
        }
    }

    /**
     * Retrieves a user by their ID, including their associated devices.
     * @param {string} id - The ID of the user to retrieve.
     * @param {number} [page=1] - The device page number.
     * @param {number} [pageSize=10] - The number of devices per page.
     * @returns {Promise<void>} Resolves when the user is fetched and state is updated.
     * @throws {ApiError} An error object containing the error status, message, and code.
     */
    async function getUserByID(
        id: string,
        page: number = 1,
        pageSize: number = 10
    ): Promise<void> {
        setError(null);
        setIsLoading(true);
        setUser(null);
        try {
            const { data: response } = await withApiErrorToast(() =>
                apiClient<Envelope<UserWithDevices> | null>(`/users/${id}`, {
                    method: 'GET',
                    query: { page, page_size: pageSize },
                })
            );
            if (!response) {
                toastBus.push({
                    variant: 'error',
                    title: 'Error',
                    message: 'get user returned a null response',
                });
                handleApiError(new Error('get user returned a null response'));
            }
            setUser(response.data);
        } catch (caught: unknown) {
            const apiError = isApiError(caught) ? caught : toApiError(caught);
            setError(apiError);
            throw apiError;
        } finally {
            setIsLoading(false);
        }
    }

    /**
     * Creates a new user.
     * @param {CreateUserDto} payload - The user data to create.
     * @returns {Promise<CreatedUser>} The created user and temporary password.
     * @throws {ApiError} An error object containing the error status, message, and code.
     */
    async function createUser(payload: CreateUserDto): Promise<CreatedUser> {
        resetState();
        setIsLoading(true);
        try {
            const { data: response } = await withApiErrorToast(() =>
                apiClient<Envelope<CreatedUser> | null>('/users', {
                    method: 'POST',
                    body: payload,
                })
            );
            if (!response || response.status_code !== 201 || !response.data) {
                toastBus.push({
                    variant: 'error',
                    title: 'Error',
                    message: 'create user returned an invalid response',
                });
                handleApiError(
                    new Error('create user returned an invalid response')
                );
            }
            setUsers(prev => [...prev, response.data]);
            return response.data;
        } finally {
            setIsLoading(false);
        }
    }

    /**
     * Updates an existing user's `name` and/or `lastname`.
     * @param {string} id - The id of the user to update.
     * @param {UpdateUserDto} payload - The user fields to change.
     * @returns {Promise<void>} Resolves when the user is updated.
     * @throws {ApiError} An error object containing the error status, message, and code.
     */
    async function updateUser(
        id: string,
        payload: UpdateUserDto
    ): Promise<void> {
        resetState();
        setIsLoading(true);
        try {
            const { data: response } = await withApiErrorToast(() =>
                apiClient<Envelope<User> | null>(`/users/${id}`, {
                    method: 'PUT',
                    body: payload,
                })
            );
            if (!response || !response.data) {
                toastBus.push({
                    variant: 'error',
                    title: 'Error',
                    message: 'update user returned a null response',
                });
                handleApiError(
                    new Error('update user returned a null response')
                );
            }
            const updated = response.data;
            setUsers(prev => prev.map(u => (u.id === id ? updated : u)));
            setUser(prev => (prev?.id === id ? { ...prev, ...updated } : prev));
        } finally {
            setIsLoading(false);
        }
    }

    /**
     * Soft-deletes a user. Backend returns `204 No Content`, so the
     * local state is updated by id without parsing a body.
     * @param {string} id - The id of the user to delete.
     * @returns {Promise<void>} Resolves when the user is deleted.
     * @throws {ApiError} An error object containing the error status, message, and code.
     */
    async function deleteUser(id: string): Promise<void> {
        resetState();
        setIsLoading(true);
        try {
            await withApiErrorToast(() =>
                apiClient(`/users/${id}`, {
                    method: 'DELETE',
                })
            );
            setUsers(prev => prev.filter(u => u.id !== id));
        } finally {
            setIsLoading(false);
        }
    }

    return {
        isLoading,
        error,
        users,
        user,
        //-- actions
        getAllUsers,
        getUserByID,
        createUser,
        updateUser,
        deleteUser,
    };
};
