import React from 'react';
import { PieChart as PieChartIcon } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

export default function DashboardDonutChart({
  donutItems = [],
  totalTaskCount = 0,
  isLoading = false,
}) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs h-full flex flex-col justify-between space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <PieChartIcon className="w-4 h-4 text-purple-600" />
          <span>Task Status Distribution</span>
        </h3>
        <span className="text-xs font-extrabold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-lg border border-blue-200">
          {totalTaskCount} tasks
        </span>
      </div>

      {/* Large Donut Chart + Legend */}
      <div className="flex items-center justify-center gap-4 py-2 flex-1">
        {/* 180px Donut Circle */}
        <div className="relative h-44 w-44 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={donutItems.map((item) => ({ name: item.label, value: item.count }))}
                dataKey="value"
                nameKey="name"
                innerRadius={56}
                outerRadius={78}
                paddingAngle={3}
                stroke="none"
              >
                {donutItems.map((entry) => (
                  <Cell key={entry.label} fill={entry.hexColor} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0];
                    return (
                      <div className="bg-slate-900 text-white p-2.5 rounded-xl text-xs space-y-0.5 shadow-lg border border-slate-800">
                        <p className="font-bold text-slate-200">{data.name}</p>
                        <p className="font-extrabold text-sm" style={{ color: data.payload.fill }}>
                          {data.value} tasks ({totalTaskCount ? Math.round((data.value / totalTaskCount) * 100) : 0}%)
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
            </PieChart>
          </ResponsiveContainer>

          {/* Center Text */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-black text-slate-900 tracking-tight">
              {isLoading ? 0 : totalTaskCount}
            </span>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              TASKS
            </span>
          </div>
        </div>

        {/* Status Legend Breakdown */}
        <div className="flex-1 space-y-2 text-xs">
          {donutItems.map((item) => {
            const pct = totalTaskCount ? Math.round((item.count / totalTaskCount) * 100) : 0;
            return (
              <div
                key={item.label}
                className="flex items-center justify-between hover:bg-slate-50 p-1.5 rounded-lg transition"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: item.hexColor }}
                  />
                  <span className="font-semibold text-slate-700 truncate">{item.label}</span>
                </div>
                <div className="text-right shrink-0">
                  <span className="font-bold text-slate-900 mr-1">{item.count}</span>
                  <span className="text-slate-400 font-medium text-[11px]">({pct}%)</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
        <span>Workflow Scope</span>
        <span className="text-emerald-700 font-bold">100% active</span>
      </div>
    </div>
  );
}
