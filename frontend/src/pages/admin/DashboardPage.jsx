import { format } from 'date-fns';
import { Building2, Users, UserCheck, Lock, UserX, ShieldAlert } from 'lucide-react';
import StatCard from '../../components/common/cards/StatCard';
import DonutChartCard from '../../components/common/charts/DonutChartCard';
import SeverityBadge from '../../components/common/badges/SeverityBadge';
import { useAdminDashboard } from '../../hooks/queries/admin/useAdminDashboard';

const JOB_STATUS_COLORS = ['#94a3b8', '#2563eb', '#f59e0b', '#f97316', '#ef4444'];
const CLIENTS_OVERVIEW_COLORS = ['#2563eb', '#94a3b8'];

const AUDIT_LABELS = {
  account_created: 'Accounts created',
  account_locked: 'Accounts locked',
  role_changed: 'Roles changed',
  password_reset: 'Passwords reset',
};

// Admin Global Dashboard — GET /api/admin/dashboard/ is cached server-side
// for 30s (DashboardView), so this page doesn't need its own aggressive
// polling on top of that.
export function DashboardPage() {
  const { data, isLoading } = useAdminDashboard();

  if (isLoading || !data) {
    return <p className="text-sm text-slate-400">Loading dashboard...</p>;
  }

  const jobsByStatusData = ['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'].map((key) => ({
    name: key,
    value: data.jobs_by_status[key] || 0,
  }));
  const clientsOverviewData = [
    { name: 'ACTIVE', value: data.clients_overview.active || 0 },
    { name: 'INACTIVE', value: data.clients_overview.inactive || 0 },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-slate-900">Dashboard</h1>

      <section className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Active Clients" value={data.active_clients} icon={Building2} color="blue" />
        <StatCard label="Total Users" value={data.total_users} icon={Users} color="purple" />
        <StatCard label="Active Accounts" value={data.active_accounts} icon={UserCheck} color="emerald" />
        <StatCard label="Locked Accounts" value={data.locked_accounts} icon={Lock} color="rose" />
        <StatCard
          label="Departments w/o Manager"
          value={data.departments_without_manager}
          icon={UserX}
          color="amber"
        />
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DonutChartCard title="Jobs by Status" data={jobsByStatusData} colors={JOB_STATUS_COLORS} />
        <DonutChartCard title="Clients Overview" data={clientsOverviewData} colors={CLIENTS_OVERVIEW_COLORS} />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="mb-3 text-sm font-medium text-slate-900">Today&apos;s Activity</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Object.entries(AUDIT_LABELS).map(([key, label]) => (
            <div key={key} className="rounded-lg bg-slate-50 p-3 text-center">
              <p className="text-xl font-bold text-slate-900">{data.audit_summary_today[key] || 0}</p>
              <p className="text-[11px] text-slate-500">{label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-amber-500" />
          <p className="text-sm font-medium text-slate-900">Recent Security Events</p>
        </div>
        {data.recent_security_events.length === 0 ? (
          <p className="text-xs text-slate-400">No security events recorded yet.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {data.recent_security_events.map((event) => (
              <div key={event.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-slate-800 truncate">
                    {event.action} · {event.table_name} #{event.record_id}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {format(new Date(event.created_at), 'HH:mm - yyyy-MM-dd')}
                  </p>
                </div>
                <SeverityBadge severity={event.severity} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
