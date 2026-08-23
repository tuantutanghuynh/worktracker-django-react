import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import SideDrawer from '../../components/common/drawer/SideDrawer';
import AuditDiffViewer from '../../components/common/drawer/AuditDiffViewer';
import SeverityBadge from '../../components/common/badges/SeverityBadge';
import SortableHeader from '../../components/common/table/SortableHeader';
import SelectDropdown from '../../components/common/forms/SelectDropdown';
import InputField from '../../components/common/forms/InputField';
import { useOrdering } from '../../hooks/useOrdering';
import { listAuditLogs, getAuditLogFilterOptions } from '../../api/auditLogs';
import { listUsers } from '../../api/users';

const EMPTY_FILTERS = { actor: '', action: '', table_name: '', date_from: '', date_to: '' };
const ROLE_TABS = [
  { value: 'ADMIN', label: 'Admin' },
  { value: 'MANAGER', label: 'Manager' },
  { value: 'EMPLOYEE', label: 'Employee' },
];

// Admin page for read-only audit trail browsing. AuditLogViewSet is a
// ReadOnlyModelViewSet on the backend — no create/update/delete here by design.
export function AuditLogsPage() {
  const [roleTab, setRoleTab] = useState('ADMIN');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [selectedLog, setSelectedLog] = useState(null);
  const [ordering, toggleSort] = useOrdering();

  function setFilter(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  // Switching role tab makes the previously-picked Actor (scoped to the old
  // role's option list) stale, so clear it along with the rest of the filters.
  function selectRoleTab(role) {
    setRoleTab(role);
    setFilters(EMPTY_FILTERS);
  }

  // Server-side filters (exact match, not free-text) + sort — OrderingFilter
  // handles ?ordering= (default stays -created_at when none is chosen, set
  // via AuditLogViewSet.get_queryset()'s own .order_by()). actor_role scopes
  // the whole tab to that role's actions (accounts/manager/system/admin.
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['audit-logs', { ...filters, actor_role: roleTab, ordering }],
    queryFn: () =>
      listAuditLogs({
        actor_role: roleTab,
        actor: filters.actor || undefined,
        action: filters.action || undefined,
        table_name: filters.table_name || undefined,
        date_from: filters.date_from || undefined,
        date_to: filters.date_to || undefined,
        ordering: ordering || undefined,
      }),
  });

  // AuditLogSerializer only returns the actor's raw user id — fetch the
  // full user list once and look up email/full_name by id, same pattern
  // used for the manager lookups on DepartmentsPage/JobsPage. Also doubles
  // as the options source for the Actor filter dropdown, scoped to the
  // currently selected role tab.
  const { data: users = [] } = useQuery({ queryKey: ['users', {}], queryFn: () => listUsers() });
  const userById = Object.fromEntries(users.map((u) => [u.id, u]));
  const actorOptions = users
    .filter((u) => u.role_detail?.code === roleTab)
    .map((u) => ({ value: String(u.id), label: u.email }));

  // Populated from the values actually present in the table (see
  // AuditLogViewSet.filter_options), not hardcoded, so it never drifts out
  // of sync as new action types get added elsewhere in the app.
  const { data: filterOptions } = useQuery({
    queryKey: ['audit-logs-filter-options'],
    queryFn: getAuditLogFilterOptions,
  });
  const actionOptions = (filterOptions?.actions || []).map((a) => ({ value: a, label: a }));
  const tableOptions = (filterOptions?.tables || []).map((t) => ({ value: t, label: t }));

  const hasActiveFilters = Object.values(filters).some(Boolean);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-900">Audit Logs</h1>
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
            label="Table"
            placeholder="All tables"
            options={tableOptions}
            value={filters.table_name}
            onChange={(val) => setFilter('table_name', val)}
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
            onClick={() => setFilters(EMPTY_FILTERS)}
            className="mt-3 flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-700"
          >
            <X className="h-3.5 w-3.5" /> Clear filters
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50">
            <tr>
              <SortableHeader label="Time" sortKey="created_at" ordering={ordering} onSort={toggleSort} />
              <SortableHeader label="Actor" sortKey="user__email" ordering={ordering} onSort={toggleSort} />
              <SortableHeader label="Action" sortKey="action" ordering={ordering} onSort={toggleSort} />
              <SortableHeader label="Table" sortKey="table_name" ordering={ordering} onSort={toggleSort} />
              <SortableHeader label="Record" sortKey="record_id" ordering={ordering} onSort={toggleSort} />
              <SortableHeader label="Severity" sortKey="severity" ordering={ordering} onSort={toggleSort} />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                  Loading...
                </td>
              </tr>
            )}
            {!isLoading && logs.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                  No audit logs found.
                </td>
              </tr>
            )}
            {logs.map((log) => (
              <tr
                key={log.id}
                onClick={() => setSelectedLog(log)}
                className="cursor-pointer hover:bg-slate-50"
              >
                <td className="px-4 py-3 text-slate-500">{new Date(log.created_at).toLocaleString()}</td>
                <td className="px-4 py-3 text-slate-700">
                  {log.user ? userById[log.user]?.email || `#${log.user}` : 'System'}
                </td>
                <td className="px-4 py-3 font-medium text-slate-900">{log.action}</td>
                <td className="px-4 py-3 text-slate-500">{log.table_name}</td>
                <td className="px-4 py-3 text-slate-500">#{log.record_id}</td>
                <td className="px-4 py-3">
                  <SeverityBadge severity={log.severity} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
            tableName={selectedLog.table_name}
            recordId={selectedLog.record_id}
            timestamp={selectedLog.created_at}
            user={selectedLog.user ? userById[selectedLog.user] : null}
            severity={selectedLog.severity}
            ipAddress={selectedLog.ip_address}
            summary={selectedLog.summary}
            oldValues={selectedLog.old_values}
            newValues={selectedLog.new_values}
          />
        )}
      </SideDrawer>
    </div>
  );
}
