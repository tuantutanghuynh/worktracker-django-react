import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Zap, TrendingUp, Award, Clock } from 'lucide-react';
import { format, parseISO, startOfWeek, addDays, isSameDay } from 'date-fns';

export default function TeamWeeklyCadenceChart({
  title = 'Team Weekly Productivity',
  heatmapRawData = [],
}) {
  // Aggregate daily totals across all team members for the week
  const { chartData, totalWeekHours, avgDailyHours, peakDay } = useMemo(() => {
    // Generate 7 days of current week (Mon -> Sun)
    const today = new Date();
    const weekStart = startOfWeek(today, { weekStartsOn: 1 }); // Monday

    const daysMap = {};
    for (let i = 0; i < 7; i++) {
      const d = addDays(weekStart, i);
      const dateKey = format(d, 'yyyy-MM-dd');
      daysMap[dateKey] = {
        dateStr: dateKey,
        dayName: format(d, 'EEE'),
        hours: 0,
        isToday: isSameDay(d, today),
      };
    }

    if (Array.isArray(heatmapRawData)) {
      heatmapRawData.forEach((item) => {
        if (item.work_date && daysMap[item.work_date]) {
          daysMap[item.work_date].hours += parseFloat(item.total_hours) || 0;
        }
      });
    }

    const data = Object.values(daysMap);
    const total = data.reduce((sum, d) => sum + d.hours, 0);
    const activeDays = data.filter((d) => d.hours > 0).length || 1;
    const avg = total > 0 ? (total / activeDays).toFixed(1) : '0.0';

    let maxHours = -1;
    let peak = 'N/A';
    data.forEach((d) => {
      if (d.hours > maxHours) {
        maxHours = d.hours;
        peak = `${d.dayName} (${d.hours.toFixed(1)}h)`;
      }
    });

    return {
      chartData: data,
      totalWeekHours: total.toFixed(1),
      avgDailyHours: avg,
      peakDay: maxHours > 0 ? peak : 'No logs yet',
    };
  }, [heatmapRawData]);

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs flex flex-col justify-between space-y-4">
      <div>
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
              <Zap className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">{title}</h3>
          </div>
          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
            {totalWeekHours}h logged
          </span>
        </div>

        {/* Aggregate 7-Day Bar Chart */}
        <div className="h-[220px] w-full mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="dayName"
                tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }}
                axisLine={{ stroke: '#e2e8f0' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-slate-900 text-white p-2.5 rounded-xl text-xs space-y-1 shadow-lg border border-slate-800">
                        <p className="font-bold text-slate-200">
                          {data.dayName} • {data.dateStr}
                        </p>
                        <p className="text-emerald-400 font-extrabold text-sm">
                          {data.hours.toFixed(1)} hrs total effort
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar
                dataKey="hours"
                fill="#10b981"
                radius={[6, 6, 0, 0]}
                barSize={20}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Cadence Summary Footer */}
      <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-3 text-xs">
        <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-100">
          <Clock className="w-4 h-4 text-blue-600 shrink-0" />
          <div className="truncate">
            <span className="text-[10px] text-slate-400 block font-medium">Daily Average</span>
            <span className="font-bold text-slate-800">{avgDailyHours}h / day</span>
          </div>
        </div>

        <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-100">
          <Award className="w-4 h-4 text-amber-600 shrink-0" />
          <div className="truncate">
            <span className="text-[10px] text-slate-400 block font-medium">Peak Cadence</span>
            <span className="font-bold text-slate-800 truncate">{peakDay}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
