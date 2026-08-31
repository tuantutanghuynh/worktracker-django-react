import React from 'react';
import { Activity, PieChart as PieIcon } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  LabelList,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

/**
 * TaskSummaryAnalyticsView - Khối thống kê KPI và biểu đồ cho Báo cáo Task Summary
 * 
 * Props:
 * - kpis: { totalTasks, completed, inProgress, overdueTasks, completionRate }
 * - chartEffortData: Array<{ code, name, tasks, completed, inProgress, rate }>
 * - chartStatusData: Array<{ name, value, color }>
 */
export default function TaskSummaryAnalyticsView({
  kpis,
  chartEffortData = [],
  chartStatusData = [],
}) {
  return (
    <div className="space-y-6">
      {/* HÀNG 1: 3 THẺ CHỈ SỐ KPI TRẢI NGANG */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Tasks in Scope</span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">{kpis.totalTasks}</span>
            <span className="text-xs font-semibold text-slate-400">tasks</span>
          </div>
        </div>

        <div className="p-5 bg-emerald-50/50 rounded-2xl border border-emerald-200/80 shadow-2xs space-y-1">
          <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Completion Rate</span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-emerald-700">{kpis.completionRate}%</span>
            <span className="text-xs font-semibold text-emerald-600">({kpis.completed} completed)</span>
          </div>
        </div>

        <div className="p-5 bg-rose-50/50 rounded-2xl border border-rose-200/80 shadow-2xs space-y-1">
          <span className="text-xs font-bold text-rose-800 uppercase tracking-wider">Overdue Deliverables</span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-rose-700">{kpis.overdueTasks}</span>
            <span className="text-xs font-semibold text-rose-600">tasks past deadline</span>
          </div>
        </div>
      </div>

      {/* HÀNG 2: 2 BIỂU ĐỒ (CỘT BÊN TRÁI, TRÒN BÊN PHẢI) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Biểu đồ Cột bên trái (7 cols): Phân bổ Theo Dự án */}
        <div className="lg:col-span-7 p-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="w-full flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Tasks by Project</span>
            <Activity className="w-4 h-4 text-slate-400" />
          </div>

          {chartEffortData.length === 0 ? (
            <div className="h-88 flex items-center justify-center text-xs text-slate-400 italic">
              No project distribution data
            </div>
          ) : (
            <div className="w-full h-88">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartEffortData} margin={{ top: 25, right: 15, left: -15, bottom: 50 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis
                    dataKey="code"
                    height={55}
                    tick={{ fontSize: 12, fontWeight: 700, fill: '#334155' }}
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                    dy={6}
                    axisLine={{ stroke: '#E2E8F0' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fontWeight: 600, fill: '#64748b' }}
                    allowDecimals={false}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-slate-900/95 backdrop-blur-sm text-white p-3 rounded-xl shadow-2xl border border-slate-800 text-xs space-y-1.5 min-w-44">
                            <div className="font-bold border-b border-slate-800 pb-1 flex items-center justify-between gap-2">
                              <span className="text-blue-400 font-mono font-extrabold">{data.code}</span>
                              <span className="text-[10px] text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full font-bold border border-emerald-800/60">
                                {data.rate}% Done
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-300 font-medium truncate">{data.name}</div>
                            <div className="flex justify-between items-center text-slate-400 pt-1">
                              <span>Total Tasks:</span>
                              <span className="font-bold text-white">{data.tasks}</span>
                            </div>
                            <div className="flex justify-between items-center text-emerald-400">
                              <span>Completed:</span>
                              <span className="font-bold">{data.completed}</span>
                            </div>
                            <div className="flex justify-between items-center text-blue-400">
                              <span>In Progress / Open:</span>
                              <span className="font-bold">{data.inProgress}</span>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend verticalAlign="bottom" wrapperStyle={{ fontSize: '12px', fontWeight: 'bold', paddingTop: '36px' }} />
                  <Bar dataKey="completed" stackId="a" fill="#10B981" name="Completed Tasks" maxBarSize={40} />
                  <Bar dataKey="inProgress" stackId="a" fill="#3B82F6" name="In Progress / Open" radius={[6, 6, 0, 0]} maxBarSize={40}>
                    <LabelList
                      dataKey="tasks"
                      position="top"
                      formatter={(val) => (val > 0 ? `${val}` : '')}
                      style={{ fontSize: '11px', fontWeight: 'bold', fill: '#334155' }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Biểu đồ Tròn bên phải (5 cols): Phân bổ Trạng thái Task */}
        <div className="lg:col-span-5 p-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col items-center justify-between">
          <div className="w-full flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Task Status Distribution</span>
            <PieIcon className="w-4 h-4 text-slate-400" />
          </div>

          {chartStatusData.length === 0 ? (
            <div className="h-88 flex items-center justify-center text-xs text-slate-400 italic">
              No task data available
            </div>
          ) : (
            <div className="w-full h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {chartStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val, name) => [`${val} tasks`, name]}
                    contentStyle={{
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                      border: '1px solid #e2e8f0',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="w-full grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs font-bold text-slate-700 mt-2">
            {chartStatusData.map((item) => (
              <div key={item.name} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                <span className="truncate">{item.name}: {item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
