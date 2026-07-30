import type { Language } from "./i18n";

/**
 * Data to send in the welcome email
 * @type {WelcomeEmailRequest}
 * @property {string} subject - The subject of the email
 * @property {string} first_name - The first name of the user
 * @property {string} temporary_password - The temporary password of the user
 * @property {string} email - The email of the user
 */
export interface WelcomeEmailRequest {
    subject: string;
    first_name: string;
    temporary_password: string;
    email: string;
    locale: Language;
}

/**
 * Response payload returned by the welcome email endpoint.
 * @interface WelcomeEmailResponse
 * @property {string} message_id - Resend's email id, useful for support correlation.
 */
export interface WelcomeEmailResponse {
    message_id: string;
}
