import clsx from 'clsx';

const COLOR_STYLES = {
  blue: 'bg-blue-50 text-blue-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600',
  purple: 'bg-purple-50 text-purple-600',
  rose: 'bg-rose-50 text-rose-600',
};

export default function StatCard({
  icon: Icon,
  color = 'blue',
  label,
  value,
  subtext,
  trend,
  trendDirection = 'up',
  tag,
  className,
}) {
  const colorStyle = COLOR_STYLES[color] ?? COLOR_STYLES.blue;

  return (
    <div
      className={clsx(
        'space-y-1.5 rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-sm',
        className
      )}
    >
      <div className="flex items-center justify-between">
        {Icon && (
          <div
            className={clsx(
              'flex h-7 w-7 items-center justify-center rounded-lg text-xs',
              colorStyle
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </div>
        )}
        {tag && (
          <span
            className={clsx(
              'rounded-full px-1.5 py-0.5 text-[9px] font-bold',
              colorStyle
            )}
          >
            {tag}
          </span>
        )}
      </div>

      <div>
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <h3 className="text-xl font-bold text-slate-900">{value}</h3>
        {subtext && <p className="text-[10px] text-slate-400">{subtext}</p>}
      </div>

      {trend && (
        <p
          className={clsx(
            'pt-0.5 text-[10px] font-bold',
            trendDirection === 'up' ? 'text-emerald-600' : 'text-rose-500'
          )}
        >
          {trendDirection === 'up' ? '↑' : '↓'} {trend}{' '}
          <span className="font-normal text-slate-400">vs last month</span>
        </p>
      )}
    </div>
  );
}
