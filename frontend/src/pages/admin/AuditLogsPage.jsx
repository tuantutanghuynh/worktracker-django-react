import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import SideDrawer from '../../components/common/drawer/SideDrawer';
import AuditDiffViewer from '../../components/common/drawer/AuditDiffViewer';
import SeverityBadge from '../../components/common/badges/SeverityBadge';
import { useDebounce } from '../../hooks/useDebounce';
import { listAuditLogs } from '../../api/auditLogs';
import { listUsers } from '../../api/users';

// Admin page for read-only audit trail browsing. AuditLogViewSet is a
// ReadOnlyModelViewSet on the backend — no create/update/delete here by design.
export function AuditLogsPage() {
  const [keyword, setKeyword] = useState('');
  const debouncedKeyword = useDebounce(keyword, 400);
  const [selectedLog, setSelectedLog] = useState(null);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['audit-logs', { keyword: debouncedKeyword }],
    queryFn: () => listAuditLogs(debouncedKeyword ? { keyword: debouncedKeyword } : {}),
  });

  // AuditLogSerializer only returns the actor's raw user id — fetch the
  // full user list once and look up email/full_name by id, same pattern
  // used for the manager lookups on DepartmentsPage/JobsPage.
  const { data: users = [] } = useQuery({ queryKey: ['users', {}], queryFn: () => listUsers() });
  const userById = Object.fromEntries(users.map((u) => [u.id, u]));

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-slate-900">Audit Logs</h1>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="Search old/new values..."
          className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">Actor</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Table</th>
              <th className="px-4 py-3">Record</th>
              <th className="px-4 py-3">Severity</th>
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
