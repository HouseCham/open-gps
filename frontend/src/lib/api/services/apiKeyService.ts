import { useState } from 'react';
//-- Types
import type {
    ApiError,
    ApiKey,
    ApiKeyListResponse,
    ApiKeyWithDevice,
    CreateApiKeyResponse,
    Envelope,
} from '@/types/api';
//-- Utils
import {
    handleApiError,
    isApiError,
    withApiErrorToast,
} from '@/lib/api/api-utils';
import { toastBus } from '@/lib/stores/toast.store';
//-- Http Client
import { apiClient } from '@/lib/api/client';

/**
 * One row in the global `/api-keys` admin table. Returned by the
 * `GET /api/v1/api-keys` endpoint, which joins device_api_keys with
 * devices so the table can render the Device column and drive the
 * per-row revoke flow without a second round-trip per row.
 *
 * `plain_key` is intentionally absent; once the user closes the
 * reveal modal the value is dropped and the row is forever
 * metadata-only.
 * @typedef {Object} ApiKeyRow
 * @property {string} id - UUID of the key row.
 * @property {string} name - Display name of the owning device (the
 *   "Device" column).
 * @property {string} device_name - Display name of the owning device
 *   (explicit form of `name`; both fields carry the same value).
 * @property {string} device_id - UUID of the owning device. Required
 *   to call the per-device revoke endpoint.
 * @property {string} created_at - ISO 8601 timestamp when the key was issued.
 */
export interface ApiKeyRow {
    id: string;
    name: string;
    device_name: string;
    device_id: string;
    created_at: string;
}

/**
 * The HTTP client used to interact with the device API keys endpoint.
 *
 * Four routes back the service:
 *   GET    /api/v1/api-keys                       -- global list, joined with devices
 *   GET    /api/v1/devices/:id/api-keys           -- per-device list (legacy)
 *   POST   /api/v1/devices/:id/api-keys           -- issue a key (returns plain_key once)
 *   DELETE /api/v1/devices/:id/api-keys/:keyId    -- revoke (idempotent)
 *
 * Issue and revoke are session-authenticated and require `owner` access
 * on the target device. The global list is also session-authenticated
 * but relaxed on per-device role: the SQL join filters by `user_id`
 * and the response carries metadata only (no token, no hash).
 *
 * The IoT-side counterpart (`X-Device-API-Key`) lives on the device
 * firmware, not in this service.
 */
export const useApiKeyService = (): {
    isLoading: boolean;
    error: ApiError | null;
    apiKeys: ApiKey[];
    rows: ApiKeyRow[];
    getApiKeys: (deviceId: string) => Promise<void>;
    getAllApiKeys: () => Promise<void>;
    issueApiKey: (deviceId: string) => Promise<CreateApiKeyResponse | null>;
    revokeApiKey: (deviceId: string, keyId: string) => Promise<void>;
} => {
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<ApiError | null>(null);
    const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
    const [rows, setRows] = useState<ApiKeyRow[]>([]);

    /**
     * Clears the error before a new operation. Does not touch the
     * loading flag (callers flip it on/off themselves) or the cached
     * lists -- both `apiKeys` and `rows` survive across mutations.
     * @returns {void}
     */
    function clearError(): void {
        setError(null);
    }

    /**
     * Lists every active API key for a single device. Returns metadata
     * only -- no token, no hash. Refreshes the per-device `apiKeys`
     * state. Kept for callers that need a single-device view; the
     * global admin page uses `getAllApiKeys()` instead.
     * @param {string} deviceId - The ID of the device whose keys to list.
     * @returns {Promise<void>} Resolves when the keys are fetched and
     *   state is updated.
     */
    async function getApiKeys(deviceId: string): Promise<void> {
        clearError();
        setIsLoading(true);
        setApiKeys([]);
        try {
            const { data: response } = await withApiErrorToast(() =>
                apiClient<Envelope<ApiKeyListResponse> | null>(
                    `/devices/${deviceId}/api-keys`,
                    { method: 'GET' }
                )
            );
            if (!response) {
                toastBus.push({
                    variant: 'error',
                    title: 'Error',
                    message: 'list api keys returned a null response',
                });
                handleApiError(
                    new Error('list api keys returned a null response')
                );
                return;
            }
            setApiKeys(response.data);
        } finally {
            setIsLoading(false);
        }
    }

    /**
     * Lists every active api key across every device the caller has
     * access to, enriched with the owning device's id and display
     * name. Hits the global `GET /api/v1/api-keys` endpoint -- no
     * fanout, no device list required. Drives the `/api-keys` admin
     * page.
     * @returns {Promise<void>} Resolves when the list is fetched and
     *   `rows` is populated.
     */
    async function getAllApiKeys(): Promise<void> {
        clearError();
        setIsLoading(true);
        setRows([]);
        try {
            const { data: response } = await withApiErrorToast(() =>
                apiClient<Envelope<ApiKeyWithDevice[]>>('/api-keys', {
                    method: 'GET',
                })
            );
            if (!response || !response.data) {
                toastBus.push({
                    variant: 'error',
                    title: 'Error',
                    message: 'list api keys returned a null response',
                });
                handleApiError(
                    new Error('list api keys returned a null response')
                );
                return;
            }
            setRows(response.data);
        } finally {
            setIsLoading(false);
        }
    }

    /**
     * Issues a fresh API key for a device. The backend enforces
     * "at most one active key per device" at the DB level; a second
     * issue for a device that already has one returns 409 Conflict.
     * On that path we push a dedicated toast and return `null`.
     *
     * The returned `plain_key` is the token to flash onto the device
     * firmware. It is returned **exactly once** by the backend; this
     * service surfaces a one-time warning toast and hands the value back
     * to the caller for immediate display. It is intentionally never
     * stored in component state -- callers must display it and discard it.
     * @param {string} deviceId - The ID of the device to issue a key for.
     * @returns {Promise<CreateApiKeyResponse | null>} The newly issued key
     *   (with `plain_key`), or `null` if the request failed.
     */
    async function issueApiKey(
        deviceId: string
    ): Promise<CreateApiKeyResponse | null> {
        setIsLoading(true);
        setError(null);
        try {
            const { data: response } = await withApiErrorToast(() =>
                apiClient<Envelope<CreateApiKeyResponse> | null>(
                    `/devices/${deviceId}/api-keys`,
                    { method: 'POST' }
                )
            );
            if (!response || !response.data) {
                toastBus.push({
                    variant: 'error',
                    title: 'Error',
                    message: 'issue api key returned a null response',
                });
                handleApiError(
                    new Error('issue api key returned a null response')
                );
                return null;
            }
            const created: CreateApiKeyResponse = response.data;
            // Optimistically prepend the new key to the per-device list so
            // the per-device UI reflects issue immediately, without a
            // round-trip. The aggregated global view is left for the
            // caller to refresh via `getAllApiKeys()`.
            const metadata: ApiKey = {
                id: created.id,
                created_at: created.created_at,
                last_used_at: null,
                expires_at: null,
            };
            setApiKeys(prev => [metadata, ...prev]);
            toastBus.push({
                variant: 'warning',
                title: 'Save this key now',
                message:
                    'The API key is shown only once. Copy it and flash it onto the device firmware -- it cannot be retrieved later.',
            });
            return created;
        } catch (err) {
            // 409 Conflict: the device already has an active key. The
            // generic error toast from withApiErrorToast has already fired;
            // we add a more specific one and swallow the error so callers
            // can branch on `null` instead of catching.
            if (isApiError(err) && err.status === 409) {
                toastBus.push({
                    variant: 'error',
                    title: 'Device already has a key',
                    message:
                        'This device already has an active API key. Revoke the existing one before issuing a new key.',
                });
                return null;
            }
            throw err;
        } finally {
            setIsLoading(false);
        }
    }

    /**
     * Revokes a single API key by its ID. Idempotent -- revoking an
     * already-revoked or unknown key returns `204` on the backend.
     * @param {string} deviceId - The ID of the device the key belongs to.
     * @param {string} keyId - The UUID of the key to revoke.
     * @returns {Promise<void>} Resolves when the revocation completes.
     */
    async function revokeApiKey(
        deviceId: string,
        keyId: string
    ): Promise<void> {
        setIsLoading(true);
        setError(null);
        try {
            await withApiErrorToast(() =>
                apiClient<Envelope<null> | null>(
                    `/devices/${deviceId}/api-keys/${keyId}`,
                    { method: 'DELETE' }
                )
            );
            // Drop the revoked key from both cached lists. The backend
            // returns 204 with no body, so the only signal is success.
            setApiKeys(prev => prev.filter(k => k.id !== keyId));
            setRows(prev => prev.filter(r => r.id !== keyId));
        } finally {
            setIsLoading(false);
        }
    }

    return {
        isLoading,
        error,
        apiKeys,
        rows,
        //-- actions
        getApiKeys,
        getAllApiKeys,
        issueApiKey,
        revokeApiKey,
    };
};
