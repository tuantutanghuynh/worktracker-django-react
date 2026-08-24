import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import InputField from '../../components/common/forms/InputField';
import SelectDropdown from '../../components/common/forms/SelectDropdown';
import { useAdminRoles, useCreateUser } from '../../hooks/queries/admin/useAdminUsers';
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
});

// Admin page to create a new user with a default password. The backend
// forces must_change_password=True on every new CustomUser, so the account
// will be required to set its own password on first login.
export function CreateUserPage() {
  const { data: roles = [] } = useAdminRoles();
  const roleOptions = roles.map((r) => ({ value: String(r.id), label: r.name }));

  // page_size=500 opts this dropdown out of the default 15/page pagination —
  // it needs every department, not just the first page of them.
  const { data: departmentsPage } = useAdminDepartments({ page_size: 500 });
  const departments = departmentsPage?.results || [];
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
  } = useForm({ resolver: zodResolver(createUserSchema) });

  const createMutation = useCreateUser();

  function onSubmit(data) {
    createMutation.mutate(
      {
        email: data.email,
        password: data.password,
        role: Number(data.role),
        department: data.department ? Number(data.department) : null,
      },
      { onSuccess: () => reset({ email: '', password: '', role: '', department: '' }) }
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
          error={errors.email?.message}
          {...register('email')}
        />

        <InputField
          label="Default Password"
          type="password"
          error={errors.password?.message}
          {...register('password')}
        />
        <p className="text-[11px] text-slate-400">
          At least 8 characters, upper &amp; lower case, a number, and a special symbol. The
          user will be forced to change this password on first login.
        </p>

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

        <Controller
          name="department"
          control={control}
          render={({ field }) => (
            <SelectDropdown
              label="Department (optional)"
              options={departmentOptions}
              value={field.value}
              onChange={field.onChange}
              error={errors.department?.message}
            />
          )}
        />

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
