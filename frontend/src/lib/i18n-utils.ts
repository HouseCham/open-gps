import type { LoginFormStrings, SignupFormStrings } from "@/types/components";
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
export function parseSignUpStrings(auth: Translation['auth']): SignupFormStrings {
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
    }
}