/**
 * @constant RESEND_API_KEY
 * @description The API key for the Resend service
 */
export const RESEND_API_KEY = process.env.RESEND_API_KEY;
/**
 * @constant WELCOME_EMAIL_TEMPLATE_EN
 * @description The ID of the welcome email template in Resend for English
 */
export const WELCOME_EMAIL_TEMPLATE_EN = process.env.WELCOME_EMAIL_TEMPLATE_EN;
/**
 * @constant WELCOME_EMAIL_TEMPLATE_ES
 * @description The ID of the welcome email template in Resend for Spanish
 */
export const WELCOME_EMAIL_TEMPLATE_ES = process.env.WELCOME_EMAIL_TEMPLATE_ES;
/**
 * @constant EMAIL_FROM
 * @description The email address from which the emails are sent
 */
export const EMAIL_FROM = process.env.EMAIL_FROM;
/**
 * @constant RESEND_IS_ENABLED
 * @description Whether the Resend service is enabled (the templates key is set)
 */
export const RESEND_IS_ENABLED = !!RESEND_API_KEY;