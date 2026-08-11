import clsx from 'clsx';

const ROLE_STYLES = {
  ADMIN: 'bg-purple-100 text-purple-700 border-purple-200',
  MANAGER: 'bg-blue-100 text-blue-700 border-blue-200',
  EMPLOYEE: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};


const ROLE_LABELS = {
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  EMPLOYEE: 'Employee',
};


export default function RoleBadge({ role, className }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
        ROLE_STYLES[role],
        className
      )}
    >
      {ROLE_LABELS[role] ?? role}
    </span>
  );
}
