import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { getActionLabel, summarizeLog } from '../../utils/auditLabels';

const JOB_STATUS_COLORS = ['#94a3b8', '#2563eb', '#f59e0b', '#f97316', '#ef4444'];
const CLIENTS_OVERVIEW_COLORS = ['#2563eb', '#94a3b8'];

// Biểu đồ đọc cho NGƯỜI xem, nên dùng nhãn tiếng Anh bình thường chứ không
// phải mã hàng trong DB ("ON_HOLD" gạch dưới viết hoa là thứ chỉ máy hiểu).
const JOB_STATUS_LABELS = {
  PLANNING: 'Planning',
  ACTIVE: 'Active',
  ON_HOLD: 'On Hold',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

// 6 = 2 hàng × 3 cột trên desktop. Trước đây khối này bị nhét vào cột phải hẹp
// nên chỉ hiện được 3 dòng, còn dưới nó là một mảng trắng dài.
const SECURITY_EVENTS_PER_PAGE = 6;

const AUDIT_LABELS = {
  account_created: 'Accounts created',
  account_locked: 'Accounts locked',
  role_changed: 'Roles changed',
  password_reset: 'Passwords reset',
};

// Admin Global Dashboard — GET /api/admin/dashboard/ is cached server-side for
// 30s (DashboardView), so this page doesn't need its own aggressive polling on
// top of that.
export function DashboardPage() {
  const { data, isLoading } = useAdminDashboard();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [eventsPage, setEventsPage] = useState(1);

  if (isLoading || !data) {
    return <p className="text-sm text-slate-400">Loading dashboard...</p>;
  }

  const jobsByStatusData = Object.entries(JOB_STATUS_LABELS).map(([key, label]) => ({
    name: label,
    value: data.jobs_by_status[key] || 0,
  }));
  const totalJobs = jobsByStatusData.reduce((sum, d) => sum + d.value, 0);

  const clientsOverviewData = [
    { name: 'Active', value: data.clients_overview.active || 0 },
    { name: 'Inactive', value: data.clients_overview.inactive || 0 },
  ];

  const securityEvents = data.recent_security_events;
  const eventsTotalPages = Math.max(1, Math.ceil(securityEvents.length / SECURITY_EVENTS_PER_PAGE));
  const visibleEvents = securityEvents.slice(
    (eventsPage - 1) * SECURITY_EVENTS_PER_PAGE,
    eventsPage * SECURITY_EVENTS_PER_PAGE
  );

  return (
    <div className="space-y-3.5">
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
        <h1 className="break-words text-base font-bold text-slate-900 sm:text-lg">
          Welcome back, {user?.full_name || user?.email || 'Admin'} 👋
        </h1>
        <p className="mt-0.5 text-xs text-slate-500">
          Company-wide governance overview across users, clients, projects, and system activity.
        </p>
      </div>

      {/* Dải số liệu chạy hết bề ngang thay vì nhét vào 2/3 trái như trước —
          8 thẻ xếp 4 cột thành 2 hàng gọn, phần còn lại của trang dành cho
          biểu đồ nên không còn cột nào bị bỏ trống. */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard size="sm" label="Active Clients" value={data.active_clients} icon={Building2} color="blue" />
        <StatCard size="sm" label="Total Users" value={data.total_users} icon={Users} color="purple" />
        <StatCard size="sm" label="Active Accounts" value={data.active_accounts} icon={UserCheck} color="emerald" />
        <StatCard size="sm" label="Locked Accounts" value={data.locked_accounts} icon={Lock} color="rose" />
        <StatCard size="sm" label="Depts w/o Manager" value={data.departments_without_manager} icon={UserX} color="amber" />
        <StatCard size="sm" label="Overdue Jobs" value={data.overdue_jobs} icon={AlertTriangle} color="rose" />
        <StatCard size="sm" label="Total Work Hours" value={`${data.total_work_hours}h`} icon={Clock} color="blue" />
        <StatCard size="sm" label="Pending Timesheets" value={data.pending_timesheets} icon={FileWarning} color="amber" />
      </section>

      {/* Hai biểu đồ + hoạt động hôm nay chia đều ba cột nên hàng này không hở
          đáy như bố cục 2/3 - 1/3 cũ. */}
      <section className="grid grid-cols-1 gap-3.5 md:grid-cols-2 lg:grid-cols-3">
        <DonutChartCard
          title="Jobs by Status"
          data={jobsByStatusData}
          colors={JOB_STATUS_COLORS}
          centerValue={totalJobs}
          centerLabel="Jobs"
        />
        <DonutChartCard
          title="Clients Overview"
          data={clientsOverviewData}
          colors={CLIENTS_OVERVIEW_COLORS}
          centerValue={data.clients_overview.total || 0}
          centerLabel="Clients"
        />

        <div className="rounded-xl border border-slate-200 bg-white p-4 md:col-span-2 lg:col-span-1">
          <p className="mb-3 text-sm font-medium text-slate-900">Today&apos;s Activity</p>
          <div className="grid grid-cols-2 gap-2.5">
            {Object.entries(AUDIT_LABELS).map(([key, label]) => (
              <div key={key} className="rounded-lg bg-slate-50 px-2 py-3 text-center">
                <p className="text-xl font-bold text-slate-900">
                  {data.audit_summary_today[key] || 0}
                </p>
                <p className="mt-0.5 text-[10px] leading-tight text-slate-500">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 shrink-0 text-amber-500" />
            <p className="text-sm font-medium text-slate-900">Recent Security Events</p>
          </div>
          {securityEvents.length > 0 && (
            <div className="flex items-center gap-1">
              <p className="mr-1 text-[10px] text-slate-400">
                Page {eventsPage} of {eventsTotalPages}
              </p>
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
          )}
        </div>

        {securityEvents.length === 0 ? (
          <p className="text-xs text-slate-400">No security events recorded yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {visibleEvents.map((event) => (
              // Bấm vào để mở đúng bản ghi đó trong Audit Log. Dùng ?log=<id>
              // chứ không phải bộ lọc: AuditLogsPage tải thẳng bản ghi này rồi
              // mở ngăn chi tiết, không phụ thuộc vào việc nó có tình cờ nằm
              // trong trang/bộ lọc đang hiện bên đó hay không.
              <button
                key={event.id}
                type="button"
                onClick={() => navigate(`/admin/audit-logs?log=${event.id}`)}
                title={summarizeLog(event)}
                className="flex items-center justify-between gap-2 rounded-lg border border-slate-200/80 bg-slate-50/60 px-3 py-2 text-left transition-colors hover:border-blue-300 hover:bg-blue-50/60"
              >
                <div className="min-w-0">
                  {/* Câu tóm tắt nghiệp vụ, không phải mã hàng trong DB —
                      "LOCK_TIMESHEET · time_locks #5" là thứ chỉ máy hiểu. */}
                  <p className="truncate text-[11px] font-medium text-slate-800">
                    {summarizeLog(event)}
                  </p>
                  <p className="truncate text-[10px] text-slate-400">
                    {getActionLabel(event.action)} ·{' '}
                    {format(new Date(event.created_at), 'HH:mm - yyyy-MM-dd')}
                  </p>
                </div>
                <SeverityBadge severity={event.severity} className="shrink-0 text-[10px]" />
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
