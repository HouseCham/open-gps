import type { JSX } from 'react';

/**
 * Inline multicolor Google "G" used inside the OAuth sign-in button.
 * @returns {JSX.Element}
 */
export function GoogleLogo(): JSX.Element {
    return (
        <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
            <path
                fill="#FFC107"
                d="M43.6 20.5H42V20H24v8h11.3C33.7 32.5 29.3 35.5 24 35.5c-6.4 0-11.5-5.1-11.5-11.5S17.6 12.5 24 12.5c2.9 0 5.6 1.1 7.7 2.9l5.7-5.7C33.6 6.5 29 4.5 24 4.5 13 4.5 4.5 13 4.5 24S13 43.5 24 43.5c11 0 19.5-8.5 19.5-19.5 0-1.2-.1-2.3-.4-3.5z"
            />
            <path
                fill="#FF3D00"
                d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12.5 24 12.5c2.9 0 5.6 1.1 7.7 2.9l5.7-5.7C33.6 6.5 29 4.5 24 4.5 16.3 4.5 9.7 9.1 6.3 14.7z"
            />
            <path
                fill="#4CAF50"
                d="M24 43.5c5 0 9.5-1.9 12.8-5l-5.9-5c-2 1.4-4.5 2.2-6.9 2.2-5.3 0-9.7-3.5-11.3-8.4l-6.5 5C9.5 38.9 16.2 43.5 24 43.5z"
            />
            <path
                fill="#1976D2"
                d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.5l5.9 5c-.4.4 6.4-4.7 6.4-14.5 0-1.2-.1-2.3-.4-3.5z"
            />
        </svg>
    );
}
