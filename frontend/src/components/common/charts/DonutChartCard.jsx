import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

const DEFAULT_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#0ea5e9'];

// size 'md' là bản gốc dùng chung; 'sm' chỉ dùng cho 2 biểu đồ hẹp bên
// Admin Dashboard — thu nhỏ donut để nhường chỗ cho legend không bị cắt chữ.
const SIZE_STYLES = {
  md: { chart: 'h-32 w-32', gap: 'gap-5', legend: 'text-xs', dot: 'h-2 w-2', inner: 45, outer: 64 },
  sm: { chart: 'h-24 w-24', gap: 'gap-3', legend: 'text-[11px]', dot: 'h-1.5 w-1.5', inner: 34, outer: 48 },
};

export default function DonutChartCard({
  title,
  data,
  colors = DEFAULT_COLORS,
  centerValue,
  centerLabel,
  size = 'md',
}) {
  const total = data.reduce((sum, entry) => sum + entry.value, 0);
  const sizeStyle = SIZE_STYLES[size] ?? SIZE_STYLES.md;

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <p className="mb-3 text-sm font-medium text-slate-900">{title}</p>
      <div className={`flex items-center ${sizeStyle.gap}`}>
        <div className={`relative shrink-0 ${sizeStyle.chart}`}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius={sizeStyle.inner}
                outerRadius={sizeStyle.outer}
                paddingAngle={2}
              >
                {data.map((entry, index) => (
                  <Cell key={entry.name} fill={colors[index % colors.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          {centerValue != null && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-lg font-extrabold text-slate-900">
                {centerValue}
              </span>
              {centerLabel && (
                <span className="text-[9px] font-medium uppercase text-slate-400">
                  {centerLabel}
                </span>
              )}
            </div>
          )}
        </div>

        <div className={`min-w-0 flex-1 space-y-1 ${sizeStyle.legend}`}>
          {data.map((entry, index) => (
            <div key={entry.name} className="flex items-center justify-between gap-1.5">
              <div className="flex min-w-0 items-center gap-1.5">
                <span
                  className={`shrink-0 rounded-full ${sizeStyle.dot}`}
                  style={{ backgroundColor: colors[index % colors.length] }}
                />
                <span className="truncate font-medium text-slate-600">{entry.name}</span>
              </div>
              <span className="shrink-0 whitespace-nowrap font-bold text-slate-800">
                {entry.value} ({total ? Math.round((entry.value / total) * 100) : 0}%)
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}