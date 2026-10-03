import { useState } from 'react';
//-- Types
import type { WelcomeEmailRequest, WelcomeEmailResponse } from '@/types';
import type { ApiError, Envelope } from '@/types/api';
//-- Utils
import { withApiErrorToast } from '@/lib/api/api-utils';
//-- Http Client
import { apiClient } from '@/lib/api/client';

/**
 * The interface for the email service.
 * @interface IEmailService
 * @property {boolean} isLoading - Whether the service is currently dispatching an email.
 * @property {ApiError | null} error - The last error returned by the API, if any.
 * @property {string | null} messageId - Resend's email id from the most recent successful dispatch.
 * @method sendWelcomeEmail - Dispatches the welcome email through Resend. Resolves `true` when the API accepted the dispatch (202), `false` otherwise.
 */
interface IEmailService {
    isLoading: boolean;
    error: ApiError | null;
    messageId: string | null;
    sendWelcomeEmail: (request: WelcomeEmailRequest) => Promise<boolean>;
}

/**
 * The HTTP client used to interact with the email API.
 */
export const useEmailService = (): IEmailService => {
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<ApiError | null>(null);
    const [messageId, setMessageId] = useState<string | null>(null);

    /**
     * Resets the state of the service to its initial values.
     * @returns {void}
     */
    function resetState(): void {
        setIsLoading(false);
        setError(null);
        setMessageId(null);
    }

    /**
     * Dispatches the welcome email through Resend using the locale-specific
     * template. The 202 status reflects that the API accepted the dispatch;
     * delivery itself is asynchronous on Resend's side. Network / 4xx / 5xx
     * errors are surfaced through `withApiErrorToast`; this function does not
     * throw on those paths.
     * @param {WelcomeEmailRequest} request - The payload for the welcome email.
     * @returns {Promise<boolean>} `true` when the API returned 202, `false` otherwise.
     */
    async function sendWelcomeEmail(
        request: WelcomeEmailRequest
    ): Promise<boolean> {
        resetState();
        setIsLoading(true);
        try {
            const result = await withApiErrorToast(() =>
                apiClient<Envelope<WelcomeEmailResponse> | null>(
                    '/email/welcome',
                    {
                        method: 'POST',
                        body: request,
                    }
                )
            );
            const response = result?.data;
            const ok = response?.status_code === 202;
            if (ok && response?.data) {
                setMessageId(response.data.message_id);
            }
            return ok;
        } finally {
            setIsLoading(false);
        }
    }

    return {
        //-- state
        isLoading,
        error,
        messageId,
        //-- actions
        sendWelcomeEmail,
    };
};
