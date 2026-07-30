import { useState } from "react";
//-- Types
import type { WelcomeEmailRequest, WelcomeEmailResponse } from "@/types";
import type { ApiError, Envelope } from "@/types/api";
//-- Utils
import { handleApiError, withApiErrorToast } from '@/lib/api/api-utils';
import { toastBus } from '@/lib/stores/toast.store';
//-- Http Client
import { apiClient } from '@/lib/api/client';

/**
 * The interface for the email service.
 * @interface IEmailService
 * @property {boolean} isLoading - Whether the service is currently dispatching an email.
 * @property {ApiError | null} error - The last error returned by the API, if any.
 * @property {string | null} messageId - Resend's email id from the most recent successful dispatch.
 * @method sendWelcomeEmail - Dispatches the welcome email through Resend using the locale-specific template.
 */
interface IEmailService {
    isLoading: boolean;
    error: ApiError | null;
    messageId: string | null;
    sendWelcomeEmail: (request: WelcomeEmailRequest) => Promise<void>;
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
    }

    /**
     * Dispatches the welcome email through Resend using the locale-specific
     * template. The 202 status reflects that the API accepted the dispatch;
     * delivery itself is asynchronous on Resend's side.
     * @param {WelcomeEmailRequest} request - The payload for the welcome email.
     * @returns {Promise<void>} Resolves when the email is dispatched and state is updated.
     */
    async function sendWelcomeEmail(
        request: WelcomeEmailRequest
    ): Promise<void> {
        resetState();
        setIsLoading(true);
        setMessageId(null);
        try {
            const { data: response } = await withApiErrorToast(() =>
                apiClient<Envelope<WelcomeEmailResponse> | null>('/email/welcome', {
                    method: 'POST',
                    body: request,
                })
            );
            if (!response || !response.data) {
                toastBus.push({
                    variant: 'error',
                    title: 'Error',
                    message: 'send welcome email returned a null response',
                });
                handleApiError(
                    new Error('send welcome email returned a null response')
                );
            }
            setMessageId(response.data.message_id);
        } finally {
            setIsLoading(false);
        }
    }

    return {
        isLoading,
        error,
        messageId,
        //-- actions
        sendWelcomeEmail,
    };
};