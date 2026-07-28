import type { API_KEY_SORT_OPTIONS } from '@/constants';
import type { Translation } from '@/i18n';

/**
 * Translation bundle shape consumed by the access page island.
 */
export type AccessTranslation = Translation['apiKeys'];

/**
 * Modal state — either the device-picker form or the one-time reveal.
 */
export type AccessModalMode = 'form' | 'reveal';

/**
 * Payload for the API key reveal modal.
 * @interface ApiKeyRevealPayload
 * @prop {string} deviceName - Name of the device the key was issued for.
 * @prop {string} plainKey - The generated API key.
 */
export interface ApiKeyRevealPayload {
    deviceName: string;
    plainKey: string;
}

/**
 * Type of sort option for the access key feature
 */
export type ApiKeySortKey = (typeof API_KEY_SORT_OPTIONS)[number];
