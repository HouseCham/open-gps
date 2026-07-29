import { Resend } from 'resend';
//-- Types
import type { Language, WelcomeEmailRequest } from '@/types';
//-- Constants
import {
    EMAIL_FROM,
    RESEND_API_KEY,
    WELCOME_EMAIL_TEMPLATE_EN,
    WELCOME_EMAIL_TEMPLATE_ES,
} from '@/constants';

/**
 * Email service
 * @type {EmailService}
 * @property {function} sendWelcomeEmail - Send a welcome email to the user
 */
interface EmailService {
    sendWelcomeEmail: (data: WelcomeEmailRequest, locale: Language) => Promise<void>;
}
/**
 * Email service
 * @returns {EmailService} The email service connected to Resend
 */
export function useEmail(): EmailService {
    const resend = new Resend(RESEND_API_KEY);
    /**
     * Send a welcome email to the user
     * @param {WelcomeEmailRequest} data - The data to send in the email
     * @param {Language} locale - The language of the email
     * @returns {Promise<void>}
     */
    async function sendWelcomeEmail(
        data: WelcomeEmailRequest,
        locale: Language
    ): Promise<void> {
        const { to, subject, first_name, temporary_password, email } = data;
        try {
            const templateId =
                locale === 'en'
                    ? WELCOME_EMAIL_TEMPLATE_EN
                    : WELCOME_EMAIL_TEMPLATE_ES;
            // verify that the template exists
            if (!templateId) {
                throw new Error('Template not found');
            }
            const { error } = await resend.emails.send({
                from: EMAIL_FROM,
                to: [to],
                subject,
                template: {
                    id: templateId,
                    variables: {
                        first_name,
                        temporary_password,
                        email,
                    },
                },
            });

            if (error) {
                console.log(error);
            }
        } catch (error) {
            console.log(error);
        }
    }

    return {
        sendWelcomeEmail,
    };
}
