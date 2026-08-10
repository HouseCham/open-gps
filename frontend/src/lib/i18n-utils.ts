import type {
    ChangePasswordStrings,
    LoginFormStrings,
    PasswordForgottenFormStrings,
    SignupFormStrings,
} from '@/types/components';
import type { Translation } from '@/i18n';

/**
 * Parse the login strings from the translation object.
 * @param {Translation['auth']} auth - The translation object.
 * @returns {LoginFormStrings} The parsed login strings.
 */
export function parseLoginStrings(auth: Translation['auth']): LoginFormStrings {
    return {
        email: auth.email,
        emailPlaceholder: auth.emailPlaceholder,
        password: auth.password,
        passwordPlaceholder: auth.passwordPlaceholder,
        loggingIn: auth.loggingIn,
        login: auth.login,
        emailRequired: auth.emailRequired,
        emailInvalid: auth.emailInvalid,
        passwordRequired: auth.passwordRequired,
        loginTitle: auth.loginTitle,
        loginSubtitle: auth.loginSubtitle,
        signInWithGoogle: auth.signInWithGoogle,
        orContinueWith: auth.orContinueWith,
        rememberDevice: auth.rememberDevice,
        forgotPassword: auth.forgotPassword,
        resetPassword: auth.resetPassword,
        noAccount: auth.noAccount,
        createOne: auth.createOne,
        firstAdminBadge: auth.firstAdminBadge,
        loginFailed: auth.loginFailed,
        showPassword: auth.showPassword,
        hidePassword: auth.hidePassword,
        emailPasswordRequired: auth.emailPasswordRequired,
        apiInspectorTitle: auth.apiInspectorTitle,
        apiInspectorCookieNote: auth.apiInspectorCookieNote,
    };
}
/**
 * Parse the signup strings from the translation object.
 * @param {Translation['auth']} auth - The translation object.
 * @returns {SignupFormStrings} The parsed signup strings.
 */
export function parseSignUpStrings(
    auth: Translation['auth']
): SignupFormStrings {
    return {
        email: auth.email,
        emailPlaceholder: auth.emailPlaceholder,
        password: auth.password,
        passwordPlaceholder: auth.passwordPlaceholder,
        name: auth.name,
        namePlaceholder: auth.namePlaceholder,
        signingUp: auth.signingUp,
        signup: auth.signup,
        haveAccount: auth.haveAccount,
        loginLink: auth.login,
        emailRequired: auth.emailRequired,
        emailInvalid: auth.emailInvalid,
        passwordRequired: auth.passwordRequired,
        passwordMin: auth.passwordMin,
        nameRequired: auth.nameRequired,
        signupTitle: auth.signupTitle,
        signupSubtitle: auth.signupSubtitle,
        strengthLabel: auth.strengthLabel,
        strengthTooShort: auth.strengthTooShort,
        strengthWeak: auth.strengthWeak,
        strengthFair: auth.strengthFair,
        strengthGood: auth.strengthGood,
        strengthStrong: auth.strengthStrong,
        nameHelp: auth.nameHelp,
        passwordHelp: auth.passwordHelp,
        confirmPassword: auth.confirmPassword,
        passwordsDoNotMatch: auth.passwordsDoNotMatch,
        termsAgree: auth.termsAgree,
        termsLabel: auth.termsLabel,
        privacyLabel: auth.privacyLabel,
        creatingAccount: auth.creatingAccount,
        orDivider: auth.orDivider,
        continueWithGoogle: auth.continueWithGoogle,
        firstAdminWelcome: auth.firstAdminWelcome,
        createAccountBadge: auth.createAccountBadge,
        emailPasswordRequired: auth.emailPasswordRequired,
        acceptTerms: auth.acceptTerms,
        pickStrongerPassword: auth.pickStrongerPassword,
        signupFailed: auth.signupFailed,
        showPassword: auth.showPassword,
        hidePassword: auth.hidePassword,
        apiInspectorTitle: auth.apiInspectorTitle,
        apiInspectorCookieNote: auth.apiInspectorCookieNote,
        autoSignInNote: auth.autoSignInNote,
    };
}
/**
 * Parse the change-password strings from the translation object.
 * @param {Translation['auth']} auth - The translation object.
 * @returns {ChangePasswordStrings} The parsed change-password strings.
 */
export function parseChangePasswordStrings(
    auth: Translation['auth']
): ChangePasswordStrings {
    return {
        title: auth.changePassword.title,
        subtitle: auth.changePassword.subtitle,
        description: auth.changePassword.description,
        currentPassword: auth.changePassword.currentPassword,
        currentPlaceholder: auth.changePassword.currentPlaceholder,
        newPassword: auth.password,
        newPlaceholder: auth.changePassword.newPlaceholder,
        confirmPassword: auth.confirmPassword,
        confirmPlaceholder: auth.changePassword.confirmPlaceholder,
        submit: auth.changePassword.submit,
        submitting: auth.changePassword.submitting,
        errorWrongPassword: auth.changePassword.errorWrongPassword,
        errorWeakPassword: auth.changePassword.errorWeakPassword,
        errorGeneric: auth.changePassword.errorGeneric,
        passwordsDoNotMatch: auth.passwordsDoNotMatch,
        pickStrongerPassword: auth.pickStrongerPassword,
        passwordRequired: auth.passwordRequired,
        showPassword: auth.showPassword,
        hidePassword: auth.hidePassword,
        strengthLabel: auth.strengthLabel,
        strengthTooShort: auth.strengthTooShort,
        strengthWeak: auth.strengthWeak,
        strengthFair: auth.strengthFair,
        strengthGood: auth.strengthGood,
        strengthStrong: auth.strengthStrong,
        passwordHelp: auth.passwordHelp,
    };
}
/**
 * Parse the password-recovery strings from the translation object.
 * @param {Translation['auth']} auth - The translation object.
 * @returns {PasswordForgottenFormStrings} The parsed password-recovery strings.
 */
export function parsePasswordForgottenStrings(
    auth: Translation['auth']
): PasswordForgottenFormStrings {
    const r = auth.passwordRecovery;
    return {
        emailPlaceholder: auth.emailPlaceholder,
        badge: r.badge,
        title: r.title,
        sentTitle: r.sentTitle,
        subtitle: r.subtitle,
        sentSubtitle: r.sentSubtitle,
        emailLabel: r.emailLabel,
        emailHelp: r.emailHelp,
        submit: r.submit,
        submitting: r.submitting,
        backToLogin: r.backToLogin,
        sentTitlePrefix: r.sentTitlePrefix,
        copyEmail: r.copyEmail,
        copiedEmail: r.copiedEmail,
        useDifferentEmail: r.useDifferentEmail,
        expiresIn: r.expiresIn,
        singleUseToken: r.singleUseToken,
        resendPrompt: r.resendPrompt,
        resendCta: r.resendCta,
        resendResent: r.resendResent,
        resendCooldown: r.resendCooldown,
        mailHelper: r.mailHelper,
        mailApple: r.mailApple,
        mailGmail: r.mailGmail,
        mailOutlook: r.mailOutlook,
        identityFrom: r.identityFrom,
        identityFromValue: r.identityFromValue,
        identityFromBadge: r.identityFromBadge,
        identitySubject: r.identitySubject,
        identitySubjectValue: r.identitySubjectValue,
        identityReplyTo: r.identityReplyTo,
        identityReplyToValue: r.identityReplyToValue,
        emailRequired: r.emailRequired,
        emailInvalid: r.emailInvalid,
        requestFailed: r.requestFailed,
        apiInspectorBody: r.apiInspectorBody,
        rateLimitNote: r.rateLimitNote,
    };
}
