import clsx from 'clsx';

const PRIORITY_STYLES = {
  LOW: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  MEDIUM: 'bg-amber-50 text-amber-600 border-amber-200',
  HIGH: 'bg-rose-50 text-rose-600 border-rose-200',
};

const PRIORITY_LABELS = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
};

export default function PriorityBadge({ priority, className }) {
  return(
    <span
    className={clsx(
      'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
      PRIORITY_STYLES[priority],
      className)} 
    >
      {PRIORITY_LABELS[priority] ?? priority}
    </span>      
  );
}
