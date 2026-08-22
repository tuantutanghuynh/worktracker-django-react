import { useQuery } from '@tanstack/react-query';
import { Building2, Briefcase, Users, AlertTriangle, Clock } from 'lucide-react';
import StatCard from '../../components/common/cards/StatCard';
import DonutChartCard from '../../components/common/charts/DonutChartCard';
import { getDashboard } from '../../api/dashboard';

const JOB_STATUS_COLORS = ['#94a3b8', '#2563eb', '#f59e0b', '#f97316', '#ef4444'];
const TASK_STATUS_COLORS = ['#94a3b8', '#2563eb', '#8b5cf6', '#f97316', '#ef4444'];

const AUDIT_LABELS = {
  account_created: 'Accounts created',
  account_locked: 'Accounts locked',
  role_changed: 'Roles changed',
  deadline_changed: 'Job deadlines changed',
  timesheet_locked: 'Timesheets locked',
};

// Admin Global Dashboard — GET /api/admin/dashboard/ is cached server-side
// for 30s (DashboardView), so this page doesn't need its own aggressive
// polling on top of that.
export function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: getDashboard,
  });

  if (isLoading || !data) {
    return <p className="text-sm text-slate-400">Loading dashboard...</p>;
  }

  const jobsByStatusData = ['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'].map((key) => ({
    name: key,
    value: data.jobs_by_status[key] || 0,
  }));
  const taskStatusData = ['TODO', 'IN_PROGRESS', 'REVIEWING', 'COMPLETED', 'CANCELLED'].map((key) => ({
    name: key,
    value: data.task_status[key] || 0,
  }));

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-slate-900">Dashboard</h1>

      <section className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Active Clients" value={data.active_clients} icon={Building2} color="blue" />
        <StatCard label="Running Jobs" value={data.running_jobs} icon={Briefcase} color="emerald" />
        <StatCard label="Total Users" value={data.total_users} icon={Users} color="purple" />
        <StatCard label="Overdue Jobs" value={data.overdue_jobs} icon={AlertTriangle} color="rose" />
        <StatCard label="Total Work Hours" value={data.total_work_hours} icon={Clock} color="amber" />
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DonutChartCard title="Jobs by Status" data={jobsByStatusData} colors={JOB_STATUS_COLORS} />
        <DonutChartCard title="Tasks by Status" data={taskStatusData} colors={TASK_STATUS_COLORS} />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="mb-3 text-sm font-medium text-slate-900">Today&apos;s Activity</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {Object.entries(AUDIT_LABELS).map(([key, label]) => (
            <div key={key} className="rounded-lg bg-slate-50 p-3 text-center">
              <p className="text-xl font-bold text-slate-900">{data.audit_summary_today[key] || 0}</p>
              <p className="text-[11px] text-slate-500">{label}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
