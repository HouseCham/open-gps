/**
 * @interface LoginFormData
 * @property {string} email - The email address of the user.
 * @property {string} password - The password of the user.
 */
export interface LoginFormData {
    email: string;
    password: string;
}
/**
 * @interface LoginFormStrings
 * @property {string} email - The label for the email input.
 * @property {string} emailPlaceholder - The placeholder for the email input.
 * @property {string} password - The label for the password input.
 * @property {string} passwordPlaceholder - The placeholder for the password input.
 * @property {string} loggingIn - The text to display while the form is loading.
 * @property {string} login - The label for the login button.
 * @property {string} emailRequired - The error message to display if the email is required.
 * @property {string} emailInvalid - The error message to display if the email is invalid.
 * @property {string} passwordRequired - The error message to display if the password is required.
 * @property {string} loginTitle - The title for the login form.
 * @property {string} loginSubtitle - The subtitle for the login form.
 * @property {string} signInWithGoogle - The label for the Google sign-in button.
 * @property {string} orContinueWith - The label for the divider between OAuth and email/password.
 */
export interface LoginFormStrings {
    email: string;
    emailPlaceholder: string;
    password: string;
    passwordPlaceholder: string;
    loggingIn: string;
    login: string;
    emailRequired: string;
    emailInvalid: string;
    passwordRequired: string;
    loginTitle: string;
    loginSubtitle: string;
    signInWithGoogle: string;
    orContinueWith: string;
    rememberDevice: string;
    forgotPassword: string;
    noAccount: string;
    createOne: string;
    firstAdminBadge: string;
    loginFailed: string;
    showPassword: string;
    hidePassword: string;
    emailPasswordRequired: string;
    apiInspectorTitle: string;
    apiInspectorCookieNote: string;
}
/**
 * @interface SignupFormData
 * @property {string} email - The email address of the user.
 * @property {string} name - The name of the user.
 * @property {string} password - The password of the user.
 */
export interface SignupFormData {
    email: string;
    name: string;
    password: string;
}
/**
 * @interface SignupFormStrings
 * @property {string} email - The label for the email input.
 * @property {string} emailPlaceholder - The placeholder for the email input.
 * @property {string} password - The label for the password input.
 * @property {string} passwordPlaceholder - The placeholder for the password input.
 * @property {string} name - The label for the name input.
 * @property {string} namePlaceholder - The placeholder for the name input.
 * @property {string} signingUp - The label for the signing up button.
 * @property {string} signup - The label for the sign up button.
 * @property {string} haveAccount - The label for the have account text.
 * @property {string} loginLink - The label for the login link.
 * @property {string} emailRequired - The error message for the email input.
 * @property {string} emailInvalid - The error message for the email input.
 * @property {string} passwordRequired - The error message for the password input.
 * @property {string} passwordMin - The error message for the password input.
 * @property {string} nameRequired - The error message for the name input.
 * @property {string} signupTitle - The title for the sign up form.
 * @property {string} signupSubtitle - The subtitle for the sign up form.
 */
export interface SignupFormStrings {
    email: string;
    emailPlaceholder: string;
    password: string;
    passwordPlaceholder: string;
    name: string;
    namePlaceholder: string;
    signingUp: string;
    signup: string;
    haveAccount: string;
    loginLink: string;
    emailRequired: string;
    emailInvalid: string;
    passwordRequired: string;
    passwordMin: string;
    nameRequired: string;
    signupTitle: string;
    signupSubtitle: string;
    strengthLabel: string;
    strengthTooShort: string;
    strengthWeak: string;
    strengthFair: string;
    strengthGood: string;
    strengthStrong: string;
    nameHelp: string;
    passwordHelp: string;
    confirmPassword: string;
    passwordsDoNotMatch: string;
    termsAgree: string;
    termsLabel: string;
    privacyLabel: string;
    creatingAccount: string;
    orDivider: string;
    continueWithGoogle: string;
    firstAdminWelcome: string;
    createAccountBadge: string;
    emailPasswordRequired: string;
    acceptTerms: string;
    pickStrongerPassword: string;
    signupFailed: string;
    showPassword: string;
    hidePassword: string;
    apiInspectorTitle: string;
    apiInspectorCookieNote: string;
    autoSignInNote: string;
}
/**
 * @interface ChangePasswordStrings
 * @property {string} title - Modal heading.
 * @property {string} subtitle - Modal supporting copy.
 * @property {string} description - Body copy that explains the situation.
 * @property {string} currentPassword - Label for the current-password field.
 * @property {string} currentPlaceholder - Placeholder for the current-password field.
 * @property {string} newPassword - Label for the new-password field.
 * @property {string} newPlaceholder - Placeholder for the new-password field.
 * @property {string} confirmPassword - Label for the confirm-password field.
 * @property {string} confirmPlaceholder - Placeholder for the confirm-password field.
 * @property {string} submit - Label for the submit button at rest.
 * @property {string} submitting - Label for the submit button while in flight.
 * @property {string} errorWrongPassword - Inline error when the current password is wrong.
 * @property {string} errorWeakPassword - Inline error when the new password fails server validation.
 * @property {string} errorGeneric - Fallback inline error for any other failure.
 * @property {string} passwordsDoNotMatch - Inline error when the confirm field doesn't match.
 * @property {string} pickStrongerPassword - Inline error when the strength score is too low.
 * @property {string} passwordRequired - Inline error when any password field is empty.
 * @property {string} showPassword - Accessibility label for the show-password toggle.
 * @property {string} hidePassword - Accessibility label for the hide-password toggle.
 * @property {string} strengthLabel - Label for the strength-meter "Strength" header.
 * @property {string} strengthTooShort - First (level 0) strength-meter label.
 * @property {string} strengthWeak - Second (level 1) strength-meter label.
 * @property {string} strengthFair - Third (level 2) strength-meter label.
 * @property {string} strengthGood - Fourth (level 3) strength-meter label.
 * @property {string} strengthStrong - Fifth (level 4) strength-meter label.
 * @property {string} passwordHelp - Helper text under the new-password field.
 */
export interface ChangePasswordStrings {
    title: string;
    subtitle: string;
    description: string;
    currentPassword: string;
    currentPlaceholder: string;
    newPassword: string;
    newPlaceholder: string;
    confirmPassword: string;
    confirmPlaceholder: string;
    submit: string;
    submitting: string;
    errorWrongPassword: string;
    errorWeakPassword: string;
    errorGeneric: string;
    passwordsDoNotMatch: string;
    pickStrongerPassword: string;
    passwordRequired: string;
    showPassword: string;
    hidePassword: string;
    strengthLabel: string;
    strengthTooShort: string;
    strengthWeak: string;
    strengthFair: string;
    strengthGood: string;
    strengthStrong: string;
    passwordHelp: string;
}
