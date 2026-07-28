import { createFetch } from '@better-fetch/fetch';

/**
 * The HTTP client used to talk to the Authula authentication API.
 * @type {typeof import('@better-fetch/fetch').createFetch}
 */
export const authClient = createFetch({
    baseURL: `${import.meta.env.PUBLIC_API_URL}/api/auth` || '/api/auth',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
});
/**
 * The HTTP client used to talk to the Authula API.
 * @type {typeof import('@better-fetch/fetch').createFetch}
 */
export const apiClient = createFetch({
    baseURL: `${import.meta.env.PUBLIC_API_URL}/api/v1` || '/api/v1',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
});
