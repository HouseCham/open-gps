export * from './regex';
export * from './date';
export * from './device';
export * from './layout';
export * from './user';
export * from './access';
export * from './map';
export * from './api';
export * from './live-location';
export * from './reports';
export * from './settings';

/**
 * @constant REPOSITORY_URL
 * @description GitHub repository URL for the project
 */
export const REPOSITORY_URL = 'https://github.com/HouseCham/open-gps';
/**
 * @constant OWNER_GITHUB_URL
 * @description GitHub URL for the project owner - Ramsés Ramírez Vallejo
 */
export const OWNER_GITHUB_URL = 'https://github.com/HouseCham';
/**
 * @constant OWNER_NAME
 * @description Name of the project owner - Ramsés Ramírez Vallejo
 */
export const OWNER_NAME = 'Ramsés Ramírez Vallejo';
/**
 * @constant REPO_ENVIRONMENT
 * @description The environment in which the repository is running (e.g., development, production).
 * This value is derived from the `PUBLIC_ENV` environment variable.
 */
export const REPO_ENVIRONMENT = import.meta.env.PUBLIC_ENV;
/**
 * @constant APP_ORIGIN
 * @description The origin URL of the application, derived from the `PUBLIC_APP_ORIGIN` environment variable.
 * This is used for constructing absolute URLs in the application.
 */
export const APP_ORIGIN = import.meta.env.PUBLIC_APP_ORIGIN;
