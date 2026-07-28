/**
 * Represents the fields required to update a user's profile
 * @interface ProfileForm
 * @prop {string} name - The user's name
 * @prop {string} lastname - The user's last name
 */
export interface ProfileForm {
    name: string;
    lastname: string;
}

/**
 * Represents the errors that can occur when updating a user's profile
 * @interface ProfileFormErrors
 * @prop {string} name - The error message for the name field
 * @prop {string} lastname - The error message for the last name field
 */
export interface ProfileFormErrors {
    name?: string;
    lastname?: string;
}
