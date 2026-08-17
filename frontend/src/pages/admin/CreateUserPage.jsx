import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import InputField from '../../components/common/forms/InputField';
import SelectDropdown from '../../components/common/forms/SelectDropdown';
import { createUser, listRoles } from '../../api/users';

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
});

// Admin page to create a new user with a default password. The backend
// forces must_change_password=True on every new CustomUser, so the account
// will be required to set its own password on first login.
export function CreateUserPage() {
  const { data: roles = [] } = useQuery({ queryKey: ['roles'], queryFn: listRoles });
  const roleOptions = roles.map((r) => ({ value: String(r.id), label: r.name }));

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({ resolver: zodResolver(createUserSchema) });

  const createMutation = useMutation({
    mutationFn: (payload) => createUser(payload),
    onSuccess: () => {
      toast.success('User created. They must change this password on first login.');
      reset({ email: '', password: '', role: '' });
    },
    onError: (err) => {
      const data = err.response?.data;
      const msg =
        data?.email?.[0] || data?.password?.[0] || data?.role?.[0] || data?.detail ||
        'Failed to create user.';
      toast.error(msg);
    },
  });

  function onSubmit(data) {
    createMutation.mutate({
      email: data.email,
      password: data.password,
      role: Number(data.role),
    });
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

        <SelectDropdown
          label="Role"
          options={roleOptions}
          error={errors.role?.message}
          {...register('role')}
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
