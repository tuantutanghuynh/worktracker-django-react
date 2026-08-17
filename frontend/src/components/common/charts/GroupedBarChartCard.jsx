import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export default function GroupedBarChartCard({
  title = 'Workload per Employee',
  data = [],
}) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">{title}</h3>
        <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-600">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-blue-600 inline-block" />
            <span>Open Tasks</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500 inline-block" />
            <span>Work Hours</span>
          </div>
        </div>
      </div>

      {data.length === 0 ? (
        <div className="h-[230px] flex items-center justify-center text-xs text-slate-400">
          No workload data for the selected period.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={230}>
          <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }}
              axisLine={{ stroke: '#e2e8f0' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#64748b' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#0f172a',
                border: 'none',
                borderRadius: '8px',
                color: '#ffffff',
                fontSize: '11px',
              }}
            />
            <Bar dataKey="openTasks" name="Open Tasks" fill="#2563eb" radius={[4, 4, 0, 0]} barSize={12} />
            <Bar dataKey="workHours" name="Work Hours" fill="#10b981" radius={[4, 4, 0, 0]} barSize={12} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
