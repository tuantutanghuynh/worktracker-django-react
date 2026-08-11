import clsx from 'clsx';

export default function SystemPolicyCard({ title, description, value, icon: Icon, className }) {
  return (
    <div
      className={clsx(
        'flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm',
        className
      )}
    >
      {Icon && (
        <div className="rounded-full bg-slate-100 p-2">
          <Icon className="h-5 w-5 text-slate-600" />
        </div>
      )}
      <div className="flex-1">
        <p className="text-sm font-medium text-slate-900">{title}</p>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
      <p className="text-sm font-semibold text-slate-700">{value}</p>
    </div>
  );
}
