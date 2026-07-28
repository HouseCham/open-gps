/**
 * Path the user lands on after a successful sign-in or sign-up. The
 * frontend's index page resolves the active locale and forwards to
 * `/[lan]/index.astro`.
 * @constant {string}
 */
export const REDIRECT_AFTER_AUTH = '/';

/**
 * Path the user lands on after a successful sign-out.
 * @constant {string}
 */
export const REDIRECT_AFTER_SIGNOUT = '/login';

/**
 * Path to the sign-in page. Used by route protection to redirect
 * unauthenticated users. The locale is resolved by `index.astro`.
 * @constant {string}
 */
export const LOGIN_PATH = '/login';

/**
 * Path to the sign-up page. Used by route protection to redirect
 * unauthenticated users. The locale is resolved by `index.astro`.
 * @constant {string}
 */
export const SIGNUP_PATH = '/signup';

/**
 * Path to the authenticated dashboard. Used by `<PublicOnlyRoute />`
 * to redirect users who are already signed in away from the sign-in
 * and sign-up pages. The locale is resolved by `index.astro`.
 * @constant {string}
 */
export const DASHBOARD_PATH = '/';

/**
 * `sessionStorage` key used as a one-shot handoff between the admin
 * gate and the `no-access.astro` page. The gate writes a route slug
 * here before issuing its redirect; the destination page reads it on
 * mount, surfaces a transient toast, then clears it. One-shot by
 * design — the next sign-in clears it.
 * @constant {string}
 */
export const DENIED_ROUTE_STORAGE_KEY = 'ogps:denied-route';
