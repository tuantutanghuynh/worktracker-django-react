import clsx from 'clsx';

/**
 * EmployeeStatCard - bản StatCard riêng của Employee.
 *
 * Tách khỏi component dùng chung (components/common/cards/StatCard.jsx,
 * Admin đang dùng ở AuditLogsPage/DashboardPage) vì gradient + màu hex
 * tùy trang là nhu cầu riêng của Employee (My Tasks, My Team, My
 * Performance, Dashboard) — sửa/thêm màu ở đây không đụng, không xung
 * đột với code Admin hay Manager. Cùng lý do đã tách
 * EmployeeHorizontalBarChartCard khỏi components/common/charts/.
 *
 * Chỉ nhận `hex` (không có `color` named-palette như bản gốc) vì mọi
 * nơi Employee dùng đều truyền hex thật, không dùng bảng màu cố định.
 */

// size 'md' là mặc định; 'sm' dùng cho lưới 4 thẻ hẹp (My Tasks summary).
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

export default function EmployeeStatCard({
  icon: Icon,
  hex = '#67A2C5',
  label,
  value,
  subtext,
  size = 'md',
  className,
}) {
  const sizeStyle = SIZE_STYLES[size] ?? SIZE_STYLES.md;

  return (
    <div
      className={clsx('rounded-xl border shadow-sm', sizeStyle.container, className)}
      style={{
        backgroundImage: `linear-gradient(135deg, ${hex}66 0%, ${hex}26 100%)`,
        borderColor: `${hex}99`,
      }}
    >
      <div className="flex items-center justify-between">
        {Icon && (
          <div
            className={clsx('flex items-center justify-center rounded-lg shadow-sm', sizeStyle.icon)}
            style={{ backgroundImage: `linear-gradient(135deg, ${hex} 0%, ${hex}CC 100%)` }}
          >
            <Icon className={clsx(sizeStyle.iconGlyph, 'text-white')} />
          </div>
        )}
      </div>

      <div className="min-w-0">
        <p className={clsx('truncate font-medium text-slate-600', sizeStyle.label)} title={label}>
          {label}
        </p>
        <h3 className={clsx('truncate font-bold text-slate-900', sizeStyle.value)}>{value}</h3>
        {subtext && <p className="truncate text-[10px] text-slate-500">{subtext}</p>}
      </div>
    </div>
  );
}
