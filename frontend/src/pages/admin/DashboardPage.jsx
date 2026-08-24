import { useState } from 'react';
import { format } from 'date-fns';
import {
  Building2, Users, UserCheck, Lock, UserX, ShieldAlert, Clock, AlertTriangle, FileWarning,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import StatCard from '../../components/common/cards/StatCard';
import DonutChartCard from '../../components/common/charts/DonutChartCard';
import SeverityBadge from '../../components/common/badges/SeverityBadge';
import { useAdminDashboard } from '../../hooks/queries/admin/useAdminDashboard';
import { useAuth } from '../../hooks/useAuth';

const JOB_STATUS_COLORS = ['#94a3b8', '#2563eb', '#f59e0b', '#f97316', '#ef4444'];
const CLIENTS_OVERVIEW_COLORS = ['#2563eb', '#94a3b8'];

const SECURITY_EVENTS_PER_PAGE = 3;

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
  const { user } = useAuth();
  const [eventsPage, setEventsPage] = useState(1);

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

  const securityEvents = data.recent_security_events;
  const eventsTotalPages = Math.max(1, Math.ceil(securityEvents.length / SECURITY_EVENTS_PER_PAGE));
  const visibleEvents = securityEvents.slice(
    (eventsPage - 1) * SECURITY_EVENTS_PER_PAGE,
    eventsPage * SECURITY_EVENTS_PER_PAGE
  );

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
        <h1 className="text-lg font-bold text-slate-900">
          Welcome back, {user?.full_name || user?.email || 'Admin'} 👋
        </h1>
        <p className="mt-0.5 text-xs text-slate-500">
          Company-wide governance overview across users, clients, projects, and system activity.
        </p>
      </div>

      <section className="grid grid-cols-1 gap-3.5 lg:grid-cols-3">
        <div className="space-y-3.5 lg:col-span-2">
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <DonutChartCard size="sm" title="Jobs by Status" data={jobsByStatusData} colors={JOB_STATUS_COLORS} />
            <DonutChartCard size="sm" title="Clients Overview" data={clientsOverviewData} colors={CLIENTS_OVERVIEW_COLORS} />
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard size="sm" label="Active Clients" value={data.active_clients} icon={Building2} color="blue" />
            <StatCard size="sm" label="Total Users" value={data.total_users} icon={Users} color="purple" />
            <StatCard size="sm" label="Active Accounts" value={data.active_accounts} icon={UserCheck} color="emerald" />
            <StatCard size="sm" label="Locked Accounts" value={data.locked_accounts} icon={Lock} color="rose" />
            <StatCard size="sm" label="Depts w/o Manager" value={data.departments_without_manager} icon={UserX} color="amber" />
            <StatCard size="sm" label="Overdue Jobs" value={data.overdue_jobs} icon={AlertTriangle} color="rose" />
            <StatCard size="sm" label="Total Work Hours" value={`${data.total_work_hours}h`} icon={Clock} color="blue" />
            <StatCard size="sm" label="Pending Timesheets" value={data.pending_timesheets} icon={FileWarning} color="amber" />
          </div>
        </div>

        <div className="space-y-3.5">
          <div className="rounded-xl border border-slate-200 bg-white p-3.5">
            <p className="mb-2.5 text-sm font-medium text-slate-900">Today&apos;s Activity</p>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(AUDIT_LABELS).map(([key, label]) => (
                <div key={key} className="rounded-lg bg-slate-50 px-2 py-1.5 text-center">
                  <p className="text-base font-bold text-slate-900">{data.audit_summary_today[key] || 0}</p>
                  <p className="text-[10px] leading-tight text-slate-500">{label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3.5">
            <div className="mb-2 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 shrink-0 text-amber-500" />
              <p className="text-sm font-medium text-slate-900">Recent Security Events</p>
            </div>
            {securityEvents.length === 0 ? (
              <p className="text-xs text-slate-400">No security events recorded yet.</p>
            ) : (
              <>
                <div className="divide-y divide-slate-100">
                  {visibleEvents.map((event) => (
                    <div key={event.id} className="flex items-center justify-between gap-2 py-1.5">
                      <div className="min-w-0">
                        <p className="truncate text-[11px] font-medium text-slate-800">
                          {event.action} · {event.table_name} #{event.record_id}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {format(new Date(event.created_at), 'HH:mm - yyyy-MM-dd')}
                        </p>
                      </div>
                      <SeverityBadge severity={event.severity} className="shrink-0 text-[10px]" />
                    </div>
                  ))}
                </div>

                <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2">
                  <p className="text-[10px] text-slate-400">
                    Page {eventsPage} of {eventsTotalPages}
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setEventsPage((p) => Math.max(1, p - 1))}
                      disabled={eventsPage === 1}
                      className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40 disabled:hover:bg-transparent"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEventsPage((p) => Math.min(eventsTotalPages, p + 1))}
                      disabled={eventsPage === eventsTotalPages}
                      className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40 disabled:hover:bg-transparent"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
