/**
 * Mask the local-part of an email for the confirmation card.
 * "alex@open-gps.local" → "al•••@open-gps.local".
 * @param {string} email - The email to mask.
 * @returns {string} The masked email.
 */
export function maskEmail(email: string): string {
    const at = email.indexOf('@');
    if (at <= 0) return email;
    const local = email.slice(0, at);
    const domain = email.slice(at);
    const visible = local.slice(0, 2);
    return `${visible}•••${domain}`;
}