//-- Types
import type { BetterFetchOption } from '@better-fetch/fetch';
import type { BootstrapResponseEnvelope, BootstrapStatus } from '@/types/api';
import { apiClient } from '@/lib/api/client';
//-- Utils
import { handleApiError } from '@/lib/api/helpers/handle-api-error';

/**
 * The HTTP client used to interact with the system bootstrap endpoint.
 * @class BootstrapService
 */
export class BootstrapService {
    constructor(private http: typeof apiClient) {}

    /**
     * Asks the backend whether the app needs its first user.
     *
     * The endpoint is intentionally unauthenticated: it has to be
     * reachable before the visitor has signed in. Any error here
     * is treated as a hard failure and re-thrown — the frontend
     * gate cannot make a safe decision without the answer.
     * @returns {Promise<BootstrapStatus>} The bootstrap status.
     * @throws {ApiError} When the backend is unreachable or returns a non-2xx response.
     */
    async getStatus(): Promise<BootstrapStatus> {
        try {
            const { data } = await this.http<BootstrapResponseEnvelope>(
                '/system/bootstrap',
                {
                    method: 'GET',
                } as BetterFetchOption
            );
            // better-fetch's generic doesn't narrow `data` to the
            // BootstrapResponseEnvelope shape, so we re-assert it here.
            // Trusted: this endpoint is gated by the same backend envelope
            // contract as every other route in the API.
            const envelope = data as unknown as BootstrapResponseEnvelope;
            return {
                needsSetup: envelope.data,
            };
        } catch (error) {
            handleApiError(error);
        }
    }
}

export const bootstrapService = new BootstrapService(apiClient);
