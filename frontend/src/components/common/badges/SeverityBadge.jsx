import clsx from 'clsx';

const SEVERITY_STYLES = {
  CRITICAL: 'bg-red-100 text-red-700 border-red-200',
  WARNING: 'bg-amber-100 text-amber-700 border-amber-200',
  NORMAL: 'bg-slate-100 text-slate-700 border-slate-200',
};

const SEVERITY_LABELS = {
  CRITICAL: 'Critical',
  WARNING: 'Warning',
  NORMAL: 'Normal',
};

export default function SeverityBadge({ severity, className }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
        SEVERITY_STYLES[severity],
        className
      )}
    >
      {SEVERITY_LABELS[severity] ?? severity}
    </span>
  );
}
