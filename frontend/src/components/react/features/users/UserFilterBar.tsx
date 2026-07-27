//-- Types
import type { ChangeEvent, JSX } from 'react';
import type { Translation } from '@/i18n';
import type {
    UserEmailFilter,
    UserFilterCounts,
    UserRoleFilter,
    UserSortKey,
} from '@/types/api';
//-- Constants
import { USER_SORT_OPTIONS } from '@/constants';
//-- Icons
import { RefreshCw, Search as SearchIcon } from 'lucide-react';
//-- Components
import { Button } from '@/components/react/ui/button';
import { Select } from '@/components/react/form/ui';
import { Chip } from '@/components/react/ui/';

/**
 * Props for the UserFilterBar component.
 * @interface UserFilterBarProps
 * @prop {Translation['user']['filters']} t - Translation strings for the filter bar.
 * @prop {string} query - Current search query.
 * @prop {(q: string) => void} onQuery - Search query setter.
 * @prop {UserRoleFilter} roleFilter - Current role filter.
 * @prop {(v: UserRoleFilter) => void} onRoleFilter - Role filter setter.
 * @prop {UserEmailFilter} emailFilter - Current email-verification filter.
 * @prop {(v: UserEmailFilter) => void} onEmailFilter - Email filter setter.
 * @prop {UserSortKey} sortBy - Current sort key.
 * @prop {(v: UserSortKey) => void} onSortBy - Sort key setter.
 * @prop {UserFilterCounts} counts - Counts driving each chip badge.
 * @prop {() => void} onRefresh - Refresh callback.
 */
interface UserFilterBarProps {
    t: Translation['user']['filters'];
    query: string;
    onQuery: (v: string) => void;
    roleFilter: UserRoleFilter;
    onRoleFilter: (v: UserRoleFilter) => void;
    emailFilter: UserEmailFilter;
    onEmailFilter: (v: UserEmailFilter) => void;
    sortBy: UserSortKey;
    onSortBy: (v: UserSortKey) => void;
    counts: UserFilterCounts;
    onRefresh: () => void;
}

/**
 * UserFilterBar — search box, sort dropdown, and role/email chip rows.
 * @param {UserFilterBarProps} props
 * @returns {JSX.Element}
 */
export function UserFilterBar({
    t,
    query,
    onQuery,
    roleFilter,
    onRoleFilter,
    emailFilter,
    onEmailFilter,
    sortBy,
    onSortBy,
    counts,
    onRefresh,
}: UserFilterBarProps): JSX.Element {
    const sortOptions = USER_SORT_OPTIONS.map(k => ({
        value: k,
        label: t.sort[k],
    }));

    return (
        <div className="users-filters">
            <div className="users-filters-row">
                <label className="users-search">
                    <SearchIcon
                        size={14}
                        strokeWidth={1.6}
                        aria-hidden="true"
                    />
                    <input
                        type="text"
                        placeholder={t.searchPlaceholder}
                        value={query}
                        onChange={e => onQuery(e.target.value)}
                        aria-label={t.searchPlaceholder}
                    />
                </label>
                <div className="users-sort">
                    <span>{t.sortLabel}</span>
                    <Select
                        options={sortOptions}
                        value={sortBy}
                        onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                            const next = e.target.value;
                            if (
                                next !== 'created-desc' &&
                                next !== 'created-asc' &&
                                next !== 'name-asc'
                            )
                                return;
                            onSortBy(next);
                        }}
                        aria-label={t.sortLabel}
                    />
                </div>
                <Button
                    type="button"
                    variant="ghost"
                    iconOnly
                    aria-label={t.sortLabel}
                    title={t.sortLabel}
                    onClick={onRefresh}
                >
                    <RefreshCw size={14} strokeWidth={1.6} />
                </Button>
            </div>
            <div className="users-chip-row">
                <span className="users-chip-row-label">{t.roleLabel}</span>
                <Chip
                    label={t.roleAll}
                    count={counts.all}
                    active={roleFilter === 'all'}
                    onClick={() => onRoleFilter('all')}
                />
                <Chip
                    label={t.roleSuperAdmin}
                    count={counts.admin}
                    active={roleFilter === 'super_admin'}
                    onClick={() => onRoleFilter('super_admin')}
                />
                <Chip
                    label={t.roleUser}
                    count={counts.user}
                    active={roleFilter === 'user'}
                    onClick={() => onRoleFilter('user')}
                />
            </div>
            <div className="users-chip-row">
                <span className="users-chip-row-label">{t.emailLabel}</span>
                <Chip
                    label={t.emailAll}
                    count={null}
                    active={emailFilter === 'all'}
                    onClick={() => onEmailFilter('all')}
                />
                <Chip
                    label={t.emailVerified}
                    count={counts.verified}
                    active={emailFilter === 'verified'}
                    onClick={() => onEmailFilter('verified')}
                />
                <Chip
                    label={t.emailUnverified}
                    count={counts.unverified}
                    active={emailFilter === 'unverified'}
                    onClick={() => onEmailFilter('unverified')}
                />
            </div>
        </div>
    );
}
