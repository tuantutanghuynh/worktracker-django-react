import clsx from 'clsx';

const STATUS_STYLES = {
  PLANNING: 'bg-slate-50 text-slate-600 border-slate-200',
  TODO: 'bg-blue-50 text-blue-600 border-blue-200',
  ACTIVE: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  IN_PROGRESS: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  REVIEWING: 'bg-purple-50 text-purple-600 border-purple-200',
  ON_HOLD: 'bg-amber-50 text-amber-600 border-amber-200',
  COMPLETED: 'bg-orange-50 text-orange-600 border-orange-200',
  CANCELLED: 'bg-rose-50 text-rose-600 border-rose-200',
};

const STATUS_LABELS = {
  PLANNING: 'Planning',
  TODO: 'To Do',
  ACTIVE: 'Active',
  IN_PROGRESS: 'In Progress',
  REVIEWING: 'Reviewing',
  ON_HOLD: 'On Hold',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

export default function StatusBadge({ status, className }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
        STATUS_STYLES[status],
        className
      )}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
