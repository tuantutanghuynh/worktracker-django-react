import { useState } from 'react';
import { format } from 'date-fns';
import { X, ListChecks, ShieldAlert, UserPen, Lock, Database, ChevronRight } from 'lucide-react';
import AuditDiffViewer from '../../components/common/drawer/AuditDiffViewer';
import SideDrawer from '../../components/common/drawer/SideDrawer';
import SeverityBadge from '../../components/common/badges/SeverityBadge';
import SortableHeader from '../../components/common/table/SortableHeader';
import PaginationBar from '../../components/common/table/PaginationBar';
import ExportButton from '../../components/common/table/ExportButton';
import SelectDropdown from '../../components/common/forms/SelectDropdown';
import InputField from '../../components/common/forms/InputField';
import StatCard from '../../components/common/cards/StatCard';
import { useOrdering } from '../../hooks/useOrdering';
import {
  useAdminAuditLogs,
  useAdminAuditLogFilterOptions,
  useAdminAuditLogSummary,
} from '../../hooks/queries/admin/useAdminAuditLogs';
import { useAdminUsers } from '../../hooks/queries/admin/useAdminUsers';
import { getActionLabel, summarizeLog } from '../../utils/auditLabels';

const PAGE_SIZE = 10; // khớp AdminPageNumberPagination.page_size ở backend
const EMPTY_FILTERS = { actor: '', action: '', severity: '', date_from: '', date_to: '' };
const ROLE_TABS = [
  { value: 'ADMIN', label: 'Admin' },
  { value: 'MANAGER', label: 'Manager' },
  { value: 'EMPLOYEE', label: 'Employee' },
];
const SEVERITY_OPTIONS = [
  { value: 'CRITICAL', label: 'Critical' },
  { value: 'WARNING', label: 'Warning' },
  { value: 'NORMAL', label: 'Normal' },
];


// Admin page for read-only audit trail browsing. AuditLogViewSet is a
// ReadOnlyModelViewSet on the backend — no create/update/delete here by
// design. Layout follows the KPI cards + filter toolbar + table-with-
// persistent-detail-panel format from origin/LongNguyen's admin audit log
// mockup, adapted to read from this branch's actual API shape.
export function AuditLogsPage() {
  const [roleTab, setRoleTab] = useState('ADMIN');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [selectedLog, setSelectedLog] = useState(null);
  const [ordering, toggleSort] = useOrdering();
  const [page, setPage] = useState(1);

  function setFilter(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  }

  // Switching role tab makes the previously-picked Actor (scoped to the old
  // role's option list) stale, so clear it along with the rest of the filters.
  function selectRoleTab(role) {
    setRoleTab(role);
    setFilters(EMPTY_FILTERS);
    setSelectedLog(null);
    setPage(1);
  }

  // Wraps toggleSort so changing sort also resets to page 1 — sorting
  // through useOrdering doesn't go through setFilter above.
  function handleSort(key) {
    toggleSort(key);
    setPage(1);
  }

  // Server-side filters (exact match, not free-text) + sort + pagination —
  // OrderingFilter handles ?ordering= (default stays -created_at when none
  // is chosen, set via AuditLogViewSet.get_queryset()'s own .order_by()),
  // actor_role scopes the whole tab to that role's actions, and
  // AdminPageNumberPagination handles ?page= (10/page).
  const { data, isLoading } = useAdminAuditLogs({
    actor_role: roleTab,
    actor: filters.actor || undefined,
    action: filters.action || undefined,
    severity: filters.severity || undefined,
    date_from: filters.date_from || undefined,
    date_to: filters.date_to || undefined,
    ordering: ordering || undefined,
    page,
  });
  const logs = data?.results || [];
  const totalCount = data?.count || 0;

  // Powers the 5 KPI cards — scoped to today + the active role tab, same as
  // the table, so the cards always describe what's currently on screen.
  const { data: summary } = useAdminAuditLogSummary({ actor_role: roleTab });

  // AuditLogSerializer only returns the actor's raw user id — fetch the
  // full user list once and look up email/full_name by id, same pattern
  // used for the manager lookups on DepartmentsPage/JobsPage. Also doubles
  // as the options source for the Actor filter dropdown, scoped to the
  // currently selected role tab. page_size=500 opts out of the default
  // 10/page — needs every user, not a page of them.
  const { data: usersPage } = useAdminUsers({ page_size: 500 });
  const users = usersPage?.results || [];
  const userById = Object.fromEntries(users.map((u) => [u.id, u]));
  const actorOptions = users
    .filter((u) => u.role_detail?.code === roleTab)
    .map((u) => ({ value: String(u.id), label: u.email }));

  // Populated from the values actually present in the table (see
  // AuditLogViewSet.filter_options), not hardcoded, so it never drifts out
  // of sync as new action types get added elsewhere in the app.
  const { data: filterOptions } = useAdminAuditLogFilterOptions();
  const actionOptions = (filterOptions?.actions || []).map((a) => ({
    value: a,
    label: getActionLabel(a),
  }));

  const hasActiveFilters = Object.values(filters).some(Boolean);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Audit Logs</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Track sensitive system actions and data changes across WorkTracker.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg border border-slate-200 bg-slate-100 p-1 text-xs font-semibold">
            {ROLE_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => selectRoleTab(tab.value)}
                className={`rounded-md px-3 py-1.5 transition-colors ${
                  roleTab === tab.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <ExportButton
            url="/admin/audit-logs/export/"
            params={{
              actor_role: roleTab,
              actor: filters.actor || undefined,
              action: filters.action || undefined,
              severity: filters.severity || undefined,
              date_from: filters.date_from || undefined,
              date_to: filters.date_to || undefined,
              ordering: ordering || undefined,
            }}
            filename="worktracker_audit_logs.xlsx"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          label="Total Logs Today"
          value={summary?.total_logs_today ?? '—'}
          subtext="Recorded events"
          icon={ListChecks}
          color="blue"
        />
        <StatCard
          label="Sensitive Actions"
          value={summary?.sensitive_actions ?? '—'}
          subtext="Elevated privileges"
          icon={ShieldAlert}
          color="rose"
        />
        <StatCard
          label="Account Changes"
          value={summary?.account_changes ?? '—'}
          subtext="Role/Lock updates"
          icon={UserPen}
          color="amber"
        />
        <StatCard
          label="Timesheet Locks"
          value={summary?.timesheet_locks ?? '—'}
          subtext="Period locks"
          icon={Lock}
          color="purple"
        />
        <StatCard
          label="Data Changes"
          value={summary?.data_changes ?? '—'}
          subtext="Job/Client updates"
          icon={Database}
          color="emerald"
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <SelectDropdown
            label="Action"
            placeholder="All actions"
            options={actionOptions}
            value={filters.action}
            onChange={(val) => setFilter('action', val)}
          />
          <SelectDropdown
            label="Severity"
            placeholder="All severities"
            options={SEVERITY_OPTIONS}
            value={filters.severity}
            onChange={(val) => setFilter('severity', val)}
          />
          <SelectDropdown
            label="Actor"
            placeholder="All users"
            searchable
            options={actorOptions}
            value={filters.actor}
            onChange={(val) => setFilter('actor', val)}
          />
          <InputField
            label="From"
            type="date"
            value={filters.date_from}
            onChange={(e) => setFilter('date_from', e.target.value)}
          />
          <InputField
            label="To"
            type="date"
            value={filters.date_to}
            onChange={(e) => setFilter('date_to', e.target.value)}
          />
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={() => {
              setFilters(EMPTY_FILTERS);
              setPage(1);
            }}
            className="mt-3 flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-700"
          >
            <X className="h-3.5 w-3.5" /> Clear filters
          </button>
        )}
      </div>

      {/* table-fixed + width theo % nên bảng luôn vừa khung; cột Actor rộng
          hơn để email dài hiện đủ, không bị cắt "...". */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full table-fixed text-left text-xs">
          <thead className="bg-slate-50">
            <tr>
              <SortableHeader label="Time" sortKey="created_at" ordering={ordering} onSort={handleSort} className="w-[10%]" />
              <SortableHeader label="Actor" sortKey="user__email" ordering={ordering} onSort={handleSort} className="w-[26%]" />
              <SortableHeader label="Action" sortKey="action" ordering={ordering} onSort={handleSort} className="w-[18%]" />
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase text-slate-500">Summary</th>
              <SortableHeader label="Severity" sortKey="severity" ordering={ordering} onSort={handleSort} className="w-[12%]" />
              <th className="w-8 px-2 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-slate-400">
                  Loading...
                </td>
              </tr>
            )}
            {!isLoading && logs.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-slate-400">
                  No audit logs found.
                </td>
              </tr>
            )}
            {logs.map((log) => (
              <tr
                key={log.id}
                onClick={() => setSelectedLog(log)}
                className="cursor-pointer hover:bg-slate-50 transition-colors"
              >
                <td className="px-3 py-2 text-[11px] text-slate-500 truncate">
                  {format(new Date(log.created_at), 'HH:mm:ss')}
                </td>
                <td className="px-3 py-2 text-slate-700 truncate" title={log.user ? userById[log.user]?.email : 'System'}>
                  {log.user ? userById[log.user]?.email || `#${log.user}` : 'System'}
                </td>
                <td className="px-3 py-2 font-semibold text-slate-900 truncate" title={getActionLabel(log.action)}>
                  {getActionLabel(log.action)}
                </td>
                <td className="px-3 py-2 text-slate-600 truncate" title={summarizeLog(log)}>
                  {summarizeLog(log)}
                </td>
                <td className="px-3 py-2 truncate">
                  <SeverityBadge severity={log.severity} className="text-[10px] px-2" />
                </td>
                <td className="px-3 py-2 text-slate-300">
                  <ChevronRight className="h-4 w-4" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <PaginationBar
          page={page}
          totalPages={Math.max(1, Math.ceil(totalCount / PAGE_SIZE))}
          onPageChange={setPage}
          totalItems={totalCount}
          pageSize={PAGE_SIZE}
        />
      </div>

      <SideDrawer
        isOpen={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        title="Audit Log Detail"
        size="lg"
      >
        {selectedLog && (
          <AuditDiffViewer
            action={selectedLog.action}
            recordId={selectedLog.record_id}
            timestamp={selectedLog.created_at}
            user={selectedLog.user ? userById[selectedLog.user] : null}
            severity={selectedLog.severity}
            ipAddress={selectedLog.ip_address}
            summary={summarizeLog(selectedLog)}
            oldValues={selectedLog.old_values}
            newValues={selectedLog.new_values}
          />
        )}
      </SideDrawer>
    </div>
  );
}
