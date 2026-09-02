import { useForm, useWatch, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import InputField from '../../components/common/forms/InputField';
import SelectDropdown from '../../components/common/forms/SelectDropdown';
import { useAdminRoles, useAdminUsers, useCreateUser } from '../../hooks/queries/admin/useAdminUsers';
import { useAdminDepartments } from '../../hooks/queries/admin/useAdminDepartments';

// Same password-strength rules as ChangePasswordPage/ResetPasswordPage —
// the backend's UserCreateSerializer.password has no strength validation
// of its own, so this schema is the only thing enforcing it here.
const createUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string()
    .min(8, 'At least 8 characters')
    .regex(/[a-z]/, 'Must contain a lowercase letter')
    .regex(/[A-Z]/, 'Must contain an uppercase letter')
    .regex(/[0-9]/, 'Must contain a number')
    .regex(/[^A-Za-z0-9]/, 'Must contain a special symbol'),
  role: z.string().min(1, 'Role is required'),
  department: z.string().optional(),
  manager: z.string().optional(),
});

// Admin page to create a new user with a default password. The backend
// forces must_change_password=True on every new CustomUser, so the account
// will be required to set its own password on first login.
export function CreateUserPage() {
  const { data: roles = [] } = useAdminRoles();
  const roleOptions = roles.map((r) => ({ value: String(r.id), label: r.name }));

  // page_size=500 opts this dropdown out of the default 10/page pagination —
  // it needs every department, not just the first page of them.
  const { data: departmentsPage } = useAdminDepartments({ page_size: 500 });
  const departments = departmentsPage?.results || [];
  const departmentOptions = [
    { value: '', label: 'No Department' },
    ...departments.map((d) => ({ value: String(d.id), label: d.name })),
  ];

  const { data: managersPage } = useAdminUsers({ role: 'MANAGER', page_size: 500 });
  const managerOptions = [
    { value: '', label: 'No Manager' },
    ...(managersPage?.results || []).map((m) => ({
      value: String(m.id),
      label: m.profile?.full_name || m.email,
    })),
  ];

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm({ resolver: zodResolver(createUserSchema) });

  // Chi EMPLOYEE moi co tuyen bao cao. So sanh theo id vi dropdown Role
  // post id chu khong post code.
  const selectedRoleId = useWatch({ control, name: 'role' });
  const isCreatingEmployee =
    roles.find((r) => String(r.id) === String(selectedRoleId))?.code === 'EMPLOYEE';

  const createMutation = useCreateUser();

  function onSubmit(data) {
    createMutation.mutate(
      {
        email: data.email,
        password: data.password,
        role: Number(data.role),
        department: data.department ? Number(data.department) : null,
        manager: isCreatingEmployee && data.manager ? Number(data.manager) : null,
      },
      { onSuccess: () => reset({ email: '', password: '', role: '', department: '', manager: '' }) }
    );
  }

  return (
    <div className="max-w-md space-y-4">
      <h1 className="text-lg font-bold text-slate-900">Create User</h1>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-3 rounded-xl border border-slate-200 bg-white p-5"
      >
        <InputField
          label="Email (login ID)"
          type="email"
          required
          placeholder="name@company.com"
          error={errors.email?.message}
          {...register('email')}
        />

        {/* helperText thay vi the <p> rieng ben duoi: InputField tu an
            helperText khi co loi, nen nguoi dung khong thay 2 dong chu chong
            nhau luc go sai. */}
        <InputField
          label="Default Password"
          type="password"
          required
          placeholder="Min 8 chars, A-Z, a-z, 0-9, symbol"
          helperText="At least 8 characters, upper & lower case, a number, and a special symbol. The user must change it on first login."
          error={errors.password?.message}
          {...register('password')}
        />

        <Controller
          name="role"
          control={control}
          render={({ field }) => (
            <SelectDropdown
              theme="light"
              label="Role"
              required
              placeholder="-- Select a role --"
              options={roleOptions}
              value={field.value}
              onChange={field.onChange}
              error={errors.role?.message}
            />
          )}
        />

        <Controller
          name="department"
          control={control}
          render={({ field }) => (
            <SelectDropdown
              theme="light"
              label="Department (optional)"
              options={departmentOptions}
              value={field.value}
              onChange={field.onChange}
              error={errors.department?.message}
            />
          )}
        />

        {isCreatingEmployee && (
          <div className="space-y-1">
            <Controller
              name="manager"
              control={control}
              render={({ field }) => (
                <SelectDropdown
                  theme="light"
                  label="Manager"
                  options={managerOptions}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.manager?.message}
                />
              )}
            />
            <p className="text-[11px] text-amber-600">
              Assign one now. An employee without a Manager is invisible to every
              Manager and cannot be given any task.
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={createMutation.isPending}
          className="w-full rounded-lg bg-blue-600 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {createMutation.isPending ? 'Creating...' : 'Create User'}
        </button>
      </form>
    </div>
  );
}
