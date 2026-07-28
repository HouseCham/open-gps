import type {
    UserEmailFilter,
    UserSortKey,
    UserFilterCounts,
} from '@/types/api';
import type { Translation } from '@/i18n';
import type { User } from '@/types/api';
import type { DataTableColumn } from '@/types/components/ui';

/**
 * Two-letter initials from a display name for the avatar fallback.
 * @param {string} name - Full display name.
 * @returns {string} Uppercase initials (1–2 chars).
 */
export function getInitials(name: string): string {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2 && parts[0] && parts[parts.length - 1]) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return (parts[0] ?? '').slice(0, 2).toUpperCase();
}

/**
 * Returns the user's first name followed by the initial of the second name
 * (if it exists), with a trailing period.
 * @param {string} name - The full name of the user.
 * @returns {string} The first name and the initial of the second name.
 */
export function getFirstNameWithInitial(name: string): string {
    const nameParts = name.trim().split(/\s+/).filter(Boolean);
    const firstName = nameParts[0] ?? '';
    const secondName = nameParts[1];
    if (!secondName) return firstName;
    return `${firstName} ${secondName.charAt(0).toUpperCase()}.`;
}

/**
 * Returns the columns for the user table.
 * @param {Translation['admin']['userTable']} t - The translation object.
 * @returns {DataTableColumn[]} The columns for the user table.
 */
export function getUserTableColumns(
    t: Translation['admin']['userTable']
): DataTableColumn[] {
    return [
        { key: 'name', label: t.name, sortable: true },
        { key: 'email', label: t.email },
        { key: 'role', label: t.role },
        { key: 'status', label: t.status },
        { key: 'created', label: t.created, align: 'center' },
        { key: 'devices', label: t.devices, align: 'center' },
        { key: 'actions', label: t.actions, align: 'center' },
    ];
}

/**
 * Apply the role / email / search filters and sort the result.
 * @param {User[]} users - The list of users.
 * @param {string} query - The search query.
 * @param {UserEmailFilter} emailFilter - The email filter.
 * @param {UserSortKey} sortBy - The sort key.
 * @returns {User[]} The filtered and sorted list of users.
 */
export function filterAndSortUsers(
    users: User[],
    query: string,
    emailFilter: UserEmailFilter,
    sortBy: UserSortKey
): User[] {
    const q = query.trim().toLowerCase();
    let list = users.filter(u => {
        if (
            q &&
            !`${u.name} ${u.lastname} ${u.email}`.toLowerCase().includes(q)
        ) {
            return false;
        }
        if (emailFilter === 'verified' && !u.email_verified) return false;
        if (emailFilter === 'unverified' && u.email_verified) return false;
        return true;
    });
    list = [...list].sort((a, b) => {
        switch (sortBy) {
            case 'created-desc':
                return (
                    new Date(b.created_at).getTime() -
                    new Date(a.created_at).getTime()
                );
            case 'created-asc':
                return (
                    new Date(a.created_at).getTime() -
                    new Date(b.created_at).getTime()
                );
            case 'name-asc':
                return `${a.name} ${a.lastname}`.localeCompare(
                    `${b.name} ${b.lastname}`
                );
            default:
                return 0;
        }
    });
    return list;
}

/**
 * Counts driving the chip badges in the filter bar.
 * @param {User[]} users - The list of users.
 * @returns {UserFilterCounts} The counts.
 */
export function computeFilterCounts(users: User[]): UserFilterCounts {
    let verified = 0;
    let admin = 0;
    for (const u of users) {
        if (u.email_verified) verified += 1;
        if (u.role === 'super_admin') admin += 1;
    }
    return {
        all: users.length,
        admin,
        user: users.length - admin,
        verified,
        unverified: users.length - verified,
    };
}
