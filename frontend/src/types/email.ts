/**
 * Data to send in the welcome email
 * @type {WelcomeEmailRequest}
 * @property {string} to - The email to send the email to
 * @property {string} subject - The subject of the email
 * @property {string} first_name - The first name of the user
 * @property {string} temporary_password - The temporary password of the user
 * @property {string} email - The email of the user
 */
export interface WelcomeEmailRequest {
    to: string;
    subject: string;
    first_name: string;
    temporary_password: string;
    email: string;
}
