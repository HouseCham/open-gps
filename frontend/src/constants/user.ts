import type { Language } from '@/types';
import type { UserSortKey } from '@/types/api';

/**
 * The literal phrase a user must type to enable the destructive button.
 * Kept in sync with the matching template in `user.delete.prompt`.
 * @constant {Record<Language, string>}
 */
export const DELETE_USER_CONFIRM_PHRASE: Record<Language, string> = {
    en: 'confirm',
    es: 'confirmar',
};
/**
 * The sort keys supported by the users table.
 * @constant {readonly UserSortKey[]}
 */
export const USER_SORT_OPTIONS: readonly UserSortKey[] = [
    'created-desc',
    'created-asc',
    'name-asc',
] as const;
