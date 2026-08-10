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
    resetPassword: string;
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
/**
 * @interface PasswordForgottenFormStrings
 * @property {string} emailPlaceholder - Placeholder for the email field.
 * @property {string} badge - Heading chip on the request form.
 * @property {string} title - Heading on the request form.
 * @property {string} sentTitle - Heading on the confirmation card.
 * @property {string} subtitle - Body copy on the request form.
 * @property {string} sentSubtitle - Body copy on the confirmation card.
 * @property {string} emailLabel - Label for the email field.
 * @property {string} emailHelp - Helper text under the email field.
 * @property {string} submit - Label for the submit button at rest.
 * @property {string} submitting - Label for the submit button while in flight.
 * @property {string} backToLogin - Anchor copy under the request form.
 * @property {string} sentTitlePrefix - Sentence prefix above the masked email chip on the sent card.
 * @property {string} copyEmail - "Copy" link button label on the sent card.
 * @property {string} copiedEmail - "Copied" link button label after a copy.
 * @property {string} useDifferentEmail - Link that returns the user to the request form.
 * @property {string} expiresIn - Prefix on the countdown row of the sent card.
 * @property {string} singleUseToken - Suffix on the countdown row of the sent card.
 * @property {string} resendPrompt - Body copy on the resend row.
 * @property {string} resendCta - Resend button label when the cooldown elapsed.
 * @property {string} resendResent - Resend button label right after a successful resend.
 * @property {string} resendCooldown - Prefix on the countdown timer in the resend row.
 * @property {string} mailHelper - Label preceding the mail-app shortcut buttons.
 * @property {string} mailApple - Apple Mail shortcut label.
 * @property {string} mailGmail - Gmail shortcut label.
 * @property {string} mailOutlook - Outlook shortcut label.
 * @property {string} identityFrom - Key label for the "From" row.
 * @property {string} identityFromValue - Value of the "From" row.
 * @property {string} identityFromBadge - Pill badge next to the "From" value.
 * @property {string} identitySubject - Key label for the "Subject" row.
 * @property {string} identitySubjectValue - Value of the "Subject" row.
 * @property {string} identityReplyTo - Key label for the "Reply-to" row.
 * @property {string} identityReplyToValue - Value of the "Reply-to" row.
 * @property {string} emailRequired - Inline error when the email is empty.
 * @property {string} emailInvalid - Inline error when the email is malformed.
 * @property {string} requestFailed - Fallback error message when the API call fails.
 * @property {{ email: string; redirectPath: string }} apiInspectorBody - Fake values shown in the dev `ApiInspector` body preview.
 * @property {string} rateLimitNote - Note rendered under the inspector explaining the rate-limit bucket.
 */
export interface PasswordForgottenFormStrings {
    emailPlaceholder: string;
    badge: string;
    title: string;
    sentTitle: string;
    subtitle: string;
    sentSubtitle: string;
    emailLabel: string;
    emailHelp: string;
    submit: string;
    submitting: string;
    backToLogin: string;
    sentTitlePrefix: string;
    copyEmail: string;
    copiedEmail: string;
    useDifferentEmail: string;
    expiresIn: string;
    singleUseToken: string;
    resendPrompt: string;
    resendCta: string;
    resendResent: string;
    resendCooldown: string;
    mailHelper: string;
    mailApple: string;
    mailGmail: string;
    mailOutlook: string;
    identityFrom: string;
    identityFromValue: string;
    identityFromBadge: string;
    identitySubject: string;
    identitySubjectValue: string;
    identityReplyTo: string;
    identityReplyToValue: string;
    emailRequired: string;
    emailInvalid: string;
    requestFailed: string;
    apiInspectorBody: { email: string; redirectPath: string };
    rateLimitNote: string;
}
/**
 * @typedef PasswordRecoveryPhase
 * @type {('request' | 'sent')}
 */
export type PasswordRecoveryPhase = 'request' | 'sent';
