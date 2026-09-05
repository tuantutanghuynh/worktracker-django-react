import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useForm, useWatch, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Search, Lock, Unlock, Plus } from 'lucide-react';
import BaseModal from '../../components/common/modal/BaseModal';
import InputField from '../../components/common/forms/InputField';
import SelectDropdown from '../../components/common/forms/SelectDropdown';
import SortableHeader from '../../components/common/table/SortableHeader';
import PaginationBar from '../../components/common/table/PaginationBar';
import ExportButton from '../../components/common/table/ExportButton';
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
  useAssignUserManager,
  useResetUserPassword,
  useCreateUser,
} from '../../hooks/queries/admin/useAdminUsers';
import { useAdminDepartments } from '../../hooks/queries/admin/useAdminDepartments';
import { getErrorMessage, applyServerFieldErrors } from '../../utils/errorMessages';

const PAGE_SIZE = 10; // khớp AdminPageNumberPagination.page_size ở backend

// Form SUA chi con Role. Email da bi go khoi form vi la dinh danh dang nhap.
const editUserSchema = z.object({
  role: z.string().min(1, 'Role is required'),
});

// Form TAO user. Tach rieng khoi editUserSchema vi tao thi bat buoc co mat
// khau va email, con sua thi email khong doi duoc (dinh danh dang nhap).
const createUserSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Email is required')
    .email('Invalid email address')
    .max(155, 'Email must be 155 characters or fewer'),
  password: z
    .string()
    .min(8, 'At least 8 characters')
    .max(128, 'Password must be 128 characters or fewer')
    .regex(/[a-z]/, 'Must contain a lowercase letter')
    .regex(/[A-Z]/, 'Must contain an uppercase letter')
    .regex(/[0-9]/, 'Must contain a number')
    .regex(/[^A-Za-z0-9]/, 'Must contain a special symbol'),
  role: z.string().min(1, 'Role is required'),
  department: z.string().optional(),
  manager: z.string().optional(),
});

const EMPTY_CREATE_FORM = { email: '', password: '', role: '', department: '', manager: '' };

const resetPasswordSchema = z.object({
  new_password: z.string()
    .min(8, 'At least 8 characters')
    .max(128, 'Password must be 128 characters or fewer')
    .regex(/[a-z]/, 'Must contain a lowercase letter')
    .regex(/[A-Z]/, 'Must contain an uppercase letter')
    .regex(/[0-9]/, 'Must contain a number')
    .regex(/[^A-Za-z0-9]/, 'Must contain a special symbol'),
});

// Admin page listing every user account, with search + filters and the
// ability to modify a user's email/role/status/password/department. The
// list is always shown (no tab switching) — the search box just narrows
// it, and Export sends the exact same filters so the file matches what's
// on screen. Data logic lives in hooks/queries/admin/useAdminUsers.js —
// this file is JSX only.
export function SearchUserPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const [roleFilter, setRoleFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [managerFilter, setManagerFilter] = useState('');
  // Hai dropdown Department va Manager luu NGAY khi chon, khong qua nut Save
  // nen khong nam trong zodResolver cua form. Giu loi cua chung o state rieng
  // de hien ngay duoi o nhap thay vi chi bao o toast roi bien mat.
  const [departmentError, setDepartmentError] = useState(null);
  const [managerError, setManagerError] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [ordering, toggleSort] = useOrdering();
  const [page, setPage] = useState(1);

  // Reset to page 1 whenever a filter, the search term, or the sort changes
  // — otherwise narrowing the result set could leave the user stranded on a
  // page number that no longer exists. Adjusting state during render
  // (React's own pattern for this) instead of a useEffect.
  const filterKey = `${debouncedSearch}|${roleFilter}|${departmentFilter}|${statusFilter}|${ordering}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setPage(1);
  }

  // Every param here maps 1:1 onto a filter UserViewSet.get_queryset()
  // already understands, so the same object can be handed to the export
  // endpoint unchanged.
  const listParams = {
    email: debouncedSearch || undefined,
    role: roleFilter || undefined,
    department: departmentFilter || undefined,
    is_active: statusFilter || undefined,
    manager: managerFilter || undefined,
    ordering: ordering || undefined,
  };

  const { data, isLoading } = useAdminUsers({ ...listParams, page });
  const rows = data?.results || [];
  const totalCount = data?.count || 0;

  const { data: roles = [] } = useAdminRoles();
  const roleOptions = roles.map((r) => ({ value: String(r.id), label: r.name }));
  // The list filter matches on role CODE (role__code), not the id the edit
  // form posts — hence a separate option list built from the same roles.
  const roleFilterOptions = [
    { value: '', label: 'All roles' },
    ...roles.map((r) => ({ value: r.code, label: r.name })),
  ];

  const STATUS_FILTER_OPTIONS = [
    { value: '', label: 'All status' },
    { value: 'true', label: 'Active' },
    { value: 'false', label: 'Locked' },
  ];

  // page_size=500 opts this dropdown/lookup out of the default 10/page —
  // needs every department, not just the first page of them.
  const { data: departmentsPage } = useAdminDepartments({ page_size: 500 });
  const departments = departmentsPage?.results || [];
  const departmentNameById = Object.fromEntries(departments.map((d) => [d.id, d.name]));
  const departmentOptions = [
    { value: '', label: 'No Department' },
    ...departments.map((d) => ({ value: String(d.id), label: d.name })),
  ];
  // Bản dùng cho filter
  const departmentFilterOptions = [
    { value: '', label: 'All departments' },
    ...departments.map((d) => ({ value: String(d.id), label: d.name })),
  ];

  // Danh sach Manager de do 2 dropdown ben duoi. Tai qua chinh endpoint
  // users voi role=MANAGER; page_size=500 de lay het, khong bi cat o trang
  // dau nhu pagination mac dinh 10 dong.
  const { data: managersPage } = useAdminUsers({ role: 'MANAGER', page_size: 500 });
  const managers = managersPage?.results || [];
  const managerLabel = (m) => m.profile?.full_name || m.email;
  const managerOptions = [
    { value: '', label: 'No Manager' },
    ...managers.map((m) => ({ value: String(m.id), label: managerLabel(m) })),
  ];
  // Ban dung cho filter: them muc "Chua gan" de Admin tim ra nhung nhan vien
  // khong thuoc tuyen nao — ho vo hinh voi moi Manager nen phai gan lai.
  const managerFilterOptions = [
    { value: '', label: 'All managers' },
    { value: 'none', label: 'No Manager assigned' },
    ...managers.map((m) => ({ value: String(m.id), label: managerLabel(m) })),
  ];

  const hasActiveFilters = Boolean(
    search || roleFilter || departmentFilter || statusFilter || managerFilter
  );

  function clearFilters() {
    setSearch('');
    setRoleFilter('');
    setDepartmentFilter('');
    setStatusFilter('');
    setManagerFilter('');
  }

  // Form TAO user — tach hoan toan khoi form SUA de hai form khong dam nhau
  // (react-hook-form giu state rieng cho moi useForm).
  const {
    register: registerCreate,
    handleSubmit: handleCreateSubmit,
    reset: resetCreate,
    control: controlCreate,
    setError: setCreateError,
    formState: { errors: createErrors },
  } = useForm({ resolver: zodResolver(createUserSchema), defaultValues: EMPTY_CREATE_FORM });

  // Chi EMPLOYEE moi co tuyen bao cao. So sanh theo id vi dropdown Role post
  // id chu khong post code.
  const createRoleId = useWatch({ control: controlCreate, name: 'role' });
  const isCreatingEmployee =
    roles.find((r) => String(r.id) === String(createRoleId))?.code === 'EMPLOYEE';

  const createMutation = useCreateUser();

  function openCreate() {
    resetCreate(EMPTY_CREATE_FORM);
    setIsCreateOpen(true);
  }

  function onSubmitCreate(data) {
    createMutation.mutate(
      {
        email: data.email,
        password: data.password,
        role: Number(data.role),
        department: data.department ? Number(data.department) : null,
        manager: isCreatingEmployee && data.manager ? Number(data.manager) : null,
      },
      {
        onSuccess: () => setIsCreateOpen(false),
        // Trung email chi backend biet — gan thang vao o Email thay vi toast.
        onError: (err) =>
          applyServerFieldErrors(err, setCreateError, [
            'email', 'password', 'role', 'department', 'manager',
          ]),
      }
    );
  }

  const {
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
    // Xoa loi cua nguoi vua xem, neu khong no con dinh lai o nguoi moi mo.
    setDepartmentError(null);
    setManagerError(null);
    setSelectedUser(user);
    reset({ role: user.role_detail ? String(user.role_detail.id) : '' });
    resetPasswordForm({ new_password: '' });
  }

  const updateMutation = useUpdateUser();
  const lockMutation = useLockUser();
  const unlockMutation = useUnlockUser();
  const departmentMutation = useAssignUserDepartment();
  const managerMutation = useAssignUserManager();
  const resetPasswordMutation = useResetUserPassword();

  function onSubmitEdit(data) {
    updateMutation.mutate(
      // Khong gui email: backend da read_only, gui len chi bi bo qua.
      { id: selectedUser.id, payload: { role: Number(data.role) } },
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
    setDepartmentError(null);
    departmentMutation.mutate(
      { id: selectedUser.id, departmentId },
      {
        onSuccess: () => {
          setDepartmentError(null);
          setSelectedUser((prev) => ({ ...prev, profile: { ...prev.profile, department: departmentId } }));
        },
        onError: (err) => setDepartmentError(getErrorMessage(err, 'Could not change the department.')),
      }
    );
  }

  function onChangeManager(val) {
    const managerId = val ? Number(val) : null;
    setManagerError(null);
    managerMutation.mutate(
      { id: selectedUser.id, managerId },
      {
        onSuccess: () => {
          setManagerError(null);
          setSelectedUser((prev) => ({ ...prev, profile: { ...prev.profile, manager: managerId } }));
        },
        onError: (err) => setManagerError(getErrorMessage(err, 'Could not change the manager.')),
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
        <div>
          <h1 className="text-lg font-bold text-slate-900">User List</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            {totalCount} account{totalCount === 1 ? '' : 's'} matching the current filters.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton
            url="/auth/users/export/"
            params={listParams}
            filename="worktracker_users.xlsx"
          />
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" /> New User
          </button>
        </div>
      </div>

      {/* Thanh search + filter: mọi giá trị ở đây được gửi y hệt sang endpoint
          export, nên file tải về khớp đúng những gì đang thấy trên bảng. */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-500">Search</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by email..."
                className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>
          </div>
          <SelectDropdown
            theme="light"
            label="Role"
            placeholder="All roles"
            options={roleFilterOptions}
            value={roleFilter}
            onChange={setRoleFilter}
          />
          <SelectDropdown
            theme="light"
            label="Department"
            searchable
            placeholder="Type to search..."
            options={departmentFilterOptions}
            value={departmentFilter}
            onChange={setDepartmentFilter}
          />
          <SelectDropdown
            theme="light"
            label="Manager"
            searchable
            placeholder="Type to search..."
            options={managerFilterOptions}
            value={managerFilter}
            onChange={setManagerFilter}
          />
          <SelectDropdown
            theme="light"
            label="Status"
            placeholder="All status"
            options={STATUS_FILTER_OPTIONS}
            value={statusFilter}
            onChange={setStatusFilter}
          />
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="mt-3 text-xs font-semibold text-blue-600 hover:text-blue-700"
          >
            Clear all filters
          </button>
        )}
      </div>

      {/* table-fixed + width theo % nên bảng luôn vừa khung, không kéo ngang. */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full table-fixed text-left text-xs">
          <thead className="bg-slate-50">
            <tr>
              <SortableHeader label="Email" sortKey="email" ordering={ordering} onSort={toggleSort} className="w-[28%]" />
              <SortableHeader label="Role" sortKey="role__code" ordering={ordering} onSort={toggleSort} className="w-[14%]" />
              <SortableHeader
                label="Department"
                sortKey="profile__department__name"
                ordering={ordering}
                onSort={toggleSort}
                className="w-[22%]"
              />
              <SortableHeader
                label="Manager"
                sortKey="profile__manager__email"
                ordering={ordering}
                onSort={toggleSort}
                className="w-[24%]"
              />
              <SortableHeader label="Status" sortKey="is_active" ordering={ordering} onSort={toggleSort} className="w-[12%]" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-slate-400">
                  Loading...
                </td>
              </tr>
            )}
            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-slate-400">
                  {hasActiveFilters ? 'No users match these filters.' : 'No users yet.'}
                </td>
              </tr>
            )}
            {rows.map((u) => (
              <tr key={u.id} onClick={() => openUser(u)} className="cursor-pointer hover:bg-slate-50">
                <td className="px-3 py-2 font-medium text-slate-900 truncate" title={u.email}>{u.email}</td>
                <td className="px-3 py-2 truncate">
                  {u.role_detail && <RoleBadge role={u.role_detail.code} className="text-[10px] px-2" />}
                </td>
                <td className="px-3 py-2 text-slate-500 truncate">
                  {u.profile?.department ? departmentNameById[u.profile.department] || `#${u.profile.department}` : '—'}
                </td>
                <td className="px-3 py-2 truncate" title={u.profile?.manager_email || ''}>
                  {u.role_detail?.code !== 'EMPLOYEE' ? (
                    <span className="text-slate-300">—</span>
                  ) : u.profile?.manager_email ? (
                    <span
                      className={
                        u.profile.manager_is_active === false
                          ? 'text-rose-500'
                          : 'text-slate-500'
                      }
                    >
                      {u.profile.manager_email}
                      {u.profile.manager_is_active === false && ' (locked)'}
                    </span>
                  ) : (
                    // Chua gan Manager = khong Manager nao nhin thay nguoi nay,
                    // cung khong ai giao viec duoc. To do de Admin thay ngay.
                    <span className="text-[11px] font-semibold text-amber-600">Unassigned</span>
                  )}
                </td>
                <td className="px-3 py-2 truncate">
                  <span
                    className={
                      u.is_active
                        ? 'text-[11px] font-semibold text-emerald-600'
                        : 'text-[11px] font-semibold text-rose-500'
                    }
                  >
                    {u.is_active ? 'Active' : 'Locked'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <PaginationBar
          page={page}
          totalPages={Math.max(1, Math.ceil(totalCount / PAGE_SIZE))}
          onPageChange={setPage}
          totalItems={totalCount}
          pageSize={PAGE_SIZE}
        />
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
              {/* Email la DINH DANH DANG NHAP nen khong cho sua. Backend cung
                  da dat read_only (accounts/admin/serializers.py) — day chi
                  la lop hien thi cho ro rang. */}
              <InputField
                label="Email (login ID)"
                value={selectedUser.email}
                disabled
                readOnly
                helperText="The sign-in ID cannot be changed. Lock this account and create a new one if the address must change."
              />
              <Controller
                name="role"
                control={control}
                render={({ field }) => (
                  <SelectDropdown
                    theme="light"
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
                theme="light"
                label="Department"
                searchable
                placeholder="Type to search..."
                options={departmentOptions}
                value={selectedUser.profile?.department ? String(selectedUser.profile.department) : ''}
                onChange={onChangeDepartment}
                disabled={departmentMutation.isPending}
                error={departmentError}
              />
              {!departmentError && (
                <p className="text-[11px] text-slate-400">
                  Select &quot;No Department&quot; to remove this user from their current department.
                </p>
              )}
            </div>

            {selectedUser.role_detail?.code === 'EMPLOYEE' && (
              <div className="space-y-1.5 border-t border-slate-100 pt-3">
                <SelectDropdown
                  theme="light"
                  label="Manager"
                  searchable
                  placeholder="Type to search..."
                  options={managerOptions}
                  value={selectedUser.profile?.manager ? String(selectedUser.profile.manager) : ''}
                  onChange={onChangeManager}
                  disabled={managerMutation.isPending}
                  error={managerError}
                />
                {!managerError && (
                  <p className="text-[11px] text-slate-400">
                    The assigned Manager controls who can see this employee and give them
                    tasks. Leave empty and no Manager will see them.
                  </p>
                )}
              </div>
            )}

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
                required
                placeholder="Min 8 chars, A-Z, a-z, 0-9, symbol"
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

      {/* Modal TAO user — thay cho trang /admin/users/create rieng, de giong
          cach ClientsPage va DepartmentsPage lam. */}
      <BaseModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="New User"
        description="The account will be required to change this password on first sign-in."
      >
        <form onSubmit={handleCreateSubmit(onSubmitCreate)} className="space-y-3">
          <InputField
            label="Email (login ID)"
            type="email"
            required
            placeholder="name@company.com"
            helperText="This becomes the sign-in ID and cannot be changed later."
            error={createErrors.email?.message}
            {...registerCreate('email')}
          />

          <InputField
            label="Default Password"
            type="password"
            required
            placeholder="Min 8 chars, A-Z, a-z, 0-9, symbol"
            helperText="At least 8 characters, upper & lower case, a number, and a special symbol."
            error={createErrors.password?.message}
            {...registerCreate('password')}
          />

          <Controller
            name="role"
            control={controlCreate}
            render={({ field }) => (
              <SelectDropdown
                theme="light"
                label="Role"
                required
                placeholder="-- Select a role --"
                options={roleOptions}
                value={field.value}
                onChange={field.onChange}
                error={createErrors.role?.message}
              />
            )}
          />

          <Controller
            name="department"
            control={controlCreate}
            render={({ field }) => (
              <SelectDropdown
                theme="light"
                label="Department (optional)"
                searchable
                placeholder="Type to search..."
                options={departmentOptions}
                value={field.value}
                onChange={field.onChange}
                error={createErrors.department?.message}
              />
            )}
          />

          {isCreatingEmployee && (
            <div className="space-y-1">
              <Controller
                name="manager"
                control={controlCreate}
                render={({ field }) => (
                  <SelectDropdown
                    theme="light"
                    label="Manager"
                    searchable
                    placeholder="Type to search..."
                    options={managerOptions}
                    value={field.value}
                    onChange={field.onChange}
                    error={createErrors.manager?.message}
                  />
                )}
              />
              {!createErrors.manager && (
                <p className="text-[11px] text-amber-600">
                  Assign one now. An employee without a Manager is invisible to every
                  Manager and cannot be given any task.
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="rounded-lg bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {createMutation.isPending ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </form>
      </BaseModal>
    </div>
  );
}
