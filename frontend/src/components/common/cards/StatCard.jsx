import clsx from 'clsx';

const COLOR_STYLES = {
  blue: 'bg-blue-50 text-blue-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600',
  purple: 'bg-purple-50 text-purple-600',
  rose: 'bg-rose-50 text-rose-600',
};

// size 'md' là bản gốc dùng chung; 'sm' chỉ dùng cho lưới 4 thẻ hẹp bên
// Admin Dashboard — thu nhỏ chữ + padding để label dài không bị tràn.
const SIZE_STYLES = {
  md: {
    container: 'space-y-1.5 p-3.5',
    icon: 'h-7 w-7',
    iconGlyph: 'h-3.5 w-3.5',
    label: 'text-xs',
    value: 'text-xl',
  },
  sm: {
    container: 'space-y-1 p-3',
    icon: 'h-6 w-6',
    iconGlyph: 'h-3 w-3',
    label: 'text-[11px]',
    value: 'text-lg',
  },
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
  size = 'md',
  className,
}) {
  const colorStyle = COLOR_STYLES[color] ?? COLOR_STYLES.blue;
  const sizeStyle = SIZE_STYLES[size] ?? SIZE_STYLES.md;

  return (
    <div
      className={clsx(
        'rounded-xl border border-slate-200/80 bg-white shadow-sm',
        sizeStyle.container,
        className
      )}
    >
      <div className="flex items-center justify-between">
        {Icon && (
          <div
            className={clsx(
              'flex items-center justify-center rounded-lg text-xs',
              sizeStyle.icon,
              colorStyle
            )}
          >
            <Icon className={sizeStyle.iconGlyph} />
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

      <div className="min-w-0">
        <p className={clsx('truncate font-medium text-slate-500', sizeStyle.label)} title={label}>
          {label}
        </p>
        <h3 className={clsx('truncate font-bold text-slate-900', sizeStyle.value)}>{value}</h3>
        {subtext && <p className="truncate text-[10px] text-slate-400">{subtext}</p>}
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