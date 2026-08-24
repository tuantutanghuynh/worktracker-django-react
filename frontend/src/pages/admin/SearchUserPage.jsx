import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Search, Lock, Unlock } from 'lucide-react';
import BaseModal from '../../components/common/modal/BaseModal';
import InputField from '../../components/common/forms/InputField';
import SelectDropdown from '../../components/common/forms/SelectDropdown';
import SortableHeader from '../../components/common/table/SortableHeader';
import PaginationBar from '../../components/common/table/PaginationBar';
import RoleBadge from '../../components/common/badges/RoleBadge';
import { useDebounce } from '../../hooks/useDebounce';
import { useOrdering } from '../../hooks/useOrdering';
import {
  useAdminUsers,
  useAdminUserDeepLink,
  useAdminRoles,
  useUpdateUser,
  useLockUser,
  useUnlockUser,
  useAssignUserDepartment,
  useResetUserPassword,
} from '../../hooks/queries/admin/useAdminUsers';
import { useAdminDepartments } from '../../hooks/queries/admin/useAdminDepartments';

const PAGE_SIZE = 15;

const editUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.string().min(1, 'Role is required'),
});

const resetPasswordSchema = z.object({
  new_password: z.string()
    .min(8, 'At least 8 characters')
    .regex(/[a-z]/, 'Must contain a lowercase letter')
    .regex(/[A-Z]/, 'Must contain an uppercase letter')
    .regex(/[0-9]/, 'Must contain a number')
    .regex(/[^A-Za-z0-9]/, 'Must contain a special symbol'),
});

// Admin page to find a user by email and modify their email/role/status/
// password/department. Data logic lives in
// hooks/queries/admin/useAdminUsers.js — this file is JSX only.
export function SearchUserPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [viewMode, setViewMode] = useState('search'); // 'search' | 'all'
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const [selectedUser, setSelectedUser] = useState(null);
  const [ordering, toggleSort] = useOrdering();
  const [page, setPage] = useState(1);

  // Reset to page 1 whenever the active tab, search term, or sort changes —
  // otherwise switching context could leave the user stranded on a page
  // number that doesn't exist in the new result set. Adjusting state during
  // render (React's own pattern for this) instead of a useEffect.
  const filterKey = `${viewMode}|${debouncedSearch}|${ordering}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setPage(1);
  }

  const { data: searchData, isLoading: isSearching } = useAdminUsers(
    { email: debouncedSearch, ordering: ordering || undefined, page },
    { enabled: viewMode === 'search' && debouncedSearch.length > 0 }
  );

  // "Account List" tab — only enabled while that tab is active so switching
  // to Search doesn't trigger a needless fetch.
  const { data: allData, isLoading: isLoadingAll } = useAdminUsers(
    { ordering: ordering || undefined, page },
    { enabled: viewMode === 'all' }
  );

  const activeData = viewMode === 'all' ? allData : searchData;
  const rows = activeData?.results || [];
  const totalCount = activeData?.count || 0;
  const isLoading = viewMode === 'all' ? isLoadingAll : isSearching;

  const { data: roles = [] } = useAdminRoles();
  const roleOptions = roles.map((r) => ({ value: String(r.id), label: r.name }));

  // page_size=500 opts this dropdown/lookup out of the default 15/page —
  // needs every department, not just the first page of them.
  const { data: departmentsPage } = useAdminDepartments({ page_size: 500 });
  const departments = departmentsPage?.results || [];
  const departmentNameById = Object.fromEntries(departments.map((d) => [d.id, d.name]));
  const departmentOptions = [
    { value: '', label: 'No Department' },
    ...departments.map((d) => ({ value: String(d.id), label: d.name })),
  ];

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm({ resolver: zodResolver(editUserSchema) });

  const {
    register: registerPassword,
    handleSubmit: handlePasswordSubmit,
    reset: resetPasswordForm,
    formState: { errors: passwordErrors },
  } = useForm({ resolver: zodResolver(resetPasswordSchema) });

  // Deep-link support for notifications (bell dropdown / data-quality
  // alerts) that point at ?edit=<id> — fetches that one user directly
  // instead of relying on it being present on whatever search/page is
  // currently loaded, then opens the modal and clears the param so
  // navigating away and back doesn't reopen it.
  const editId = searchParams.get('edit');
  const { data: deepLinkedUser } = useAdminUserDeepLink(editId);
  useEffect(() => {
    if (deepLinkedUser) {
      openUser(deepLinkedUser);
      setSearchParams((prev) => {
        prev.delete('edit');
        return prev;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkedUser]);

  function openUser(user) {
    setSelectedUser(user);
    reset({ email: user.email, role: user.role_detail ? String(user.role_detail.id) : '' });
    resetPasswordForm({ new_password: '' });
  }

  const updateMutation = useUpdateUser();
  const lockMutation = useLockUser();
  const unlockMutation = useUnlockUser();
  const departmentMutation = useAssignUserDepartment();
  const resetPasswordMutation = useResetUserPassword();

  function onSubmitEdit(data) {
    updateMutation.mutate(
      { id: selectedUser.id, payload: { email: data.email, role: Number(data.role) } },
      { onSuccess: (updated) => setSelectedUser((prev) => ({ ...prev, ...updated })) }
    );
  }

  // Deliberately calls the dedicated lock/unlock actions instead of a plain
  // PATCH is_active — those also revoke the Redis-cached session, a plain
  // PATCH would leave an already-issued JWT usable until it expires.
  function toggleLock() {
    const mutation = selectedUser.is_active ? lockMutation : unlockMutation;
    mutation.mutate(selectedUser.id, {
      onSuccess: () => setSelectedUser((prev) => ({ ...prev, is_active: !prev.is_active })),
    });
  }

  function onChangeDepartment(val) {
    const departmentId = val ? Number(val) : null;
    departmentMutation.mutate(
      { id: selectedUser.id, departmentId },
      {
        onSuccess: () =>
          setSelectedUser((prev) => ({ ...prev, profile: { ...prev.profile, department: departmentId } })),
      }
    );
  }

  function onSubmitPassword(data) {
    resetPasswordMutation.mutate(
      { id: selectedUser.id, newPassword: data.new_password },
      { onSuccess: () => resetPasswordForm({ new_password: '' }) }
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-900">Search Users</h1>
        <div className="flex rounded-lg border border-slate-200 bg-slate-100 p-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setViewMode('search')}
            className={`rounded-md px-3 py-1.5 transition-colors ${
              viewMode === 'search' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
            }`}
          >
            Search
          </button>
          <button
            type="button"
            onClick={() => setViewMode('all')}
            className={`rounded-md px-3 py-1.5 transition-colors ${
              viewMode === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
            }`}
          >
            Account List
          </button>
        </div>
      </div>

      {viewMode === 'search' && (
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by email..."
            className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50">
            <tr>
              <SortableHeader label="Email" sortKey="email" ordering={ordering} onSort={toggleSort} />
              <SortableHeader label="Role" sortKey="role__code" ordering={ordering} onSort={toggleSort} />
              <SortableHeader
                label="Department"
                sortKey="profile__department__name"
                ordering={ordering}
                onSort={toggleSort}
              />
              <SortableHeader label="Status" sortKey="is_active" ordering={ordering} onSort={toggleSort} />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {viewMode === 'search' && !debouncedSearch && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                  Type an email to search.
                </td>
              </tr>
            )}
            {(viewMode === 'all' || debouncedSearch) && isLoading && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                  Loading...
                </td>
              </tr>
            )}
            {(viewMode === 'all' || debouncedSearch) && !isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                  No users found.
                </td>
              </tr>
            )}
            {rows.map((u) => (
              <tr key={u.id} onClick={() => openUser(u)} className="cursor-pointer hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-900">{u.email}</td>
                <td className="px-4 py-3">{u.role_detail && <RoleBadge role={u.role_detail.code} />}</td>
                <td className="px-4 py-3 text-slate-500">
                  {u.profile?.department ? departmentNameById[u.profile.department] || `#${u.profile.department}` : '—'}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={
                      u.is_active
                        ? 'text-xs font-semibold text-emerald-600'
                        : 'text-xs font-semibold text-rose-500'
                    }
                  >
                    {u.is_active ? 'Active' : 'Locked'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {(viewMode === 'all' || debouncedSearch) && (
          <PaginationBar
            page={page}
            totalPages={Math.max(1, Math.ceil(totalCount / PAGE_SIZE))}
            onPageChange={setPage}
            totalItems={totalCount}
            pageSize={PAGE_SIZE}
          />
        )}
      </div>

      <BaseModal
        isOpen={!!selectedUser}
        onClose={() => setSelectedUser(null)}
        title="Modify User"
        description={selectedUser?.email}
      >
        {selectedUser && (
          <div className="space-y-5">
            <form onSubmit={handleSubmit(onSubmitEdit)} className="space-y-3">
              <InputField label="Email" error={errors.email?.message} {...register('email')} />
              <Controller
                name="role"
                control={control}
                render={({ field }) => (
                  <SelectDropdown
                    label="Role"
                    options={roleOptions}
                    value={field.value}
                    onChange={field.onChange}
                    error={errors.role?.message}
                  />
                )}
              />
              <button
                type="submit"
                disabled={updateMutation.isPending}
                className="w-full rounded-lg bg-blue-600 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </form>

            <div className="space-y-1.5 border-t border-slate-100 pt-3">
              <SelectDropdown
                label="Department"
                options={departmentOptions}
                value={selectedUser.profile?.department ? String(selectedUser.profile.department) : ''}
                onChange={onChangeDepartment}
                disabled={departmentMutation.isPending}
              />
              <p className="text-[11px] text-slate-400">
                Select &quot;No Department&quot; to remove this user from their current department.
              </p>
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 pt-3">
              <span className="text-xs text-slate-500">
                Status:{' '}
                <span
                  className={
                    selectedUser.is_active
                      ? 'font-semibold text-emerald-600'
                      : 'font-semibold text-rose-500'
                  }
                >
                  {selectedUser.is_active ? 'Active' : 'Locked'}
                </span>
              </span>
              <button
                type="button"
                onClick={toggleLock}
                disabled={lockMutation.isPending || unlockMutation.isPending}
                className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-60"
              >
                {selectedUser.is_active ? (
                  <Lock className="h-3.5 w-3.5" />
                ) : (
                  <Unlock className="h-3.5 w-3.5" />
                )}
                {selectedUser.is_active ? 'Lock Account' : 'Unlock Account'}
              </button>
            </div>

            <form
              onSubmit={handlePasswordSubmit(onSubmitPassword)}
              className="space-y-2 border-t border-slate-100 pt-3"
            >
              <InputField
                label="Reset Password"
                type="password"
                placeholder="New default password"
                error={passwordErrors.new_password?.message}
                {...registerPassword('new_password')}
              />
              <button
                type="submit"
                disabled={resetPasswordMutation.isPending}
                className="w-full rounded-lg bg-amber-500 py-2 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-60"
              >
                {resetPasswordMutation.isPending ? 'Resetting...' : 'Reset Password'}
              </button>
            </form>
          </div>
        )}
      </BaseModal>
    </div>
  );
}
