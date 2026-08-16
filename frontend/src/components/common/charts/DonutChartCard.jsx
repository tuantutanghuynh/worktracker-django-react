import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

const DEFAULT_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#0ea5e9'];

export default function DonutChartCard({
  title,
  data,
  colors = DEFAULT_COLORS,
  centerValue,
  centerLabel,
}) {
  const total = data.reduce((sum, entry) => sum + entry.value, 0);

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <p className="mb-3 text-sm font-medium text-slate-900">{title}</p>
      <div className="flex items-center gap-5">
        <div className="relative h-32 w-32 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius={45}
                outerRadius={64}
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

        <div className="flex-1 space-y-1.5 text-xs">
          {data.map((entry, index) => (
            <div key={entry.name} className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: colors[index % colors.length] }}
                />
                <span className="font-medium text-slate-600">{entry.name}</span>
              </div>
              <span className="font-bold text-slate-800">
                {entry.value} ({total ? Math.round((entry.value / total) * 100) : 0}%)
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}