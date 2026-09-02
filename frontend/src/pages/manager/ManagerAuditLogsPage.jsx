import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  ShieldCheck,
  RotateCcw,
  Search,
  Filter,
  Calendar,
  Layers,
  User,
  CheckCircle2,
  Lock,
  AlertTriangle,
  Clock,
  ChevronRight,
  Info,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';

import DataTable from '../../components/common/table/DataTable';
import SelectDropdown from '../../components/common/forms/SelectDropdown';
import SideDrawer from '../../components/common/drawer/SideDrawer';
import AuditDiffViewer from '../../components/common/drawer/AuditDiffViewer';
import { useManagerAuditLogs } from '../../hooks/queries/manager/useManagerAuditLogs';
import { useAuthStore } from '../../stores/authStore';
import {
  summarizeLog,
  getModuleLabel,
  getActionLabel,
} from '../../utils/auditLabels';

// Safe date formatter for display
function formatDateSafe(dateStr, pattern = 'dd/MM/yyyy HH:mm:ss') {
  if (!dateStr) return 'N/A';
  try {
    return format(parseISO(dateStr), pattern);
  } catch {
    return dateStr;
  }
}

export default function ManagerAuditLogsPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  // Filters State
  const [selectedResource, setSelectedResource] = useState('');
  const [selectedAction, setSelectedAction] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Inspector Drawer State
  const [inspectLog, setInspectLog] = useState(null);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);

  // Fetch real audit logs from database
  const {
    data: auditLogsResponse,
    isLoading: loadingLogs,
    isFetching: fetchingLogs,
    refetch: refetchLogs,
  } = useManagerAuditLogs({
    table_name: selectedResource || undefined,
    action: selectedAction || undefined,
    severity: selectedSeverity || undefined,
    search: searchQuery.trim() || undefined,
  });

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedResource, selectedAction, selectedSeverity, searchQuery]);

  // Normalize audit logs list
  const auditLogsList = useMemo(() => {
    if (Array.isArray(auditLogsResponse)) return auditLogsResponse;
    if (Array.isArray(auditLogsResponse?.results)) return auditLogsResponse.results;
    return [];
  }, [auditLogsResponse]);

  // Paginated rows for DataTable
  const totalItems = auditLogsList.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const paginatedAuditLogs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return auditLogsList.slice(start, start + pageSize);
  }, [auditLogsList, currentPage, pageSize]);

  // Open Inspector with clean data object
  const handleInspect = useCallback((rowContext) => {
    const cleanData = rowContext?.row?.original || rowContext?.original || rowContext || {};
    setInspectLog(cleanData);
    setIsInspectorOpen(true);
  }, []);

  // Columns Configuration with Fixed Proportions & Clean Smart Summary
  const auditColumns = [
    {
      header: 'Timestamp',
      accessorKey: 'created_at',
      className: 'w-[14%] min-w-[120px]',
      cell: (row) => {
        const rawDate = row.created_at;
        return (
          <div className="py-1 space-y-0.5 whitespace-nowrap">
            <div className="font-mono text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>{formatDateSafe(rawDate, 'dd/MM/yyyy')}</span>
            </div>
            <div className="font-mono text-[11px] text-slate-400 pl-5">
              {formatDateSafe(rawDate, 'HH:mm:ss')}
            </div>
          </div>
        );
      },
    },
    {
      header: 'Action & Severity',
      accessorKey: 'action',
      className: 'w-[20%] min-w-[170px]',
      cell: (row) => {
        const action = row.action || 'ACTIVITY';
        const severity = row.severity || 'NORMAL';

        let badgeColor = 'bg-slate-100 text-slate-700 border-slate-200';

        if (action.includes('APPROVE') || action.includes('UNLOCK') || action.includes('RESTORE')) {
          badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
        } else if (action.includes('REJECT') || action.includes('DELETE') || action.includes('VOID')) {
          badgeColor = 'bg-rose-50 text-rose-700 border-rose-200';
        } else if (action.includes('LOCK') || action.includes('PASSWORD') || action.includes('CHANGE')) {
          badgeColor = 'bg-amber-50 text-amber-700 border-amber-200';
        } else if (action.includes('REPORT') || action.includes('EXPORT')) {
          badgeColor = 'bg-blue-50 text-blue-700 border-blue-200';
        } else if (action.includes('CREATE') || action.includes('ADD')) {
          badgeColor = 'bg-indigo-50 text-indigo-700 border-indigo-200';
        } else if (action.includes('UPDATE') || action.includes('EDIT')) {
          badgeColor = 'bg-sky-50 text-sky-700 border-sky-200';
        }

        let severityDot = 'bg-emerald-500';
        if (severity === 'CRITICAL') severityDot = 'bg-rose-500 animate-pulse';
        if (severity === 'WARNING') severityDot = 'bg-amber-500';

        return (
          <div className="whitespace-nowrap">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border uppercase tracking-wider ${badgeColor}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${severityDot}`} />
              <span className="truncate max-w-[150px]">{getActionLabel(action)}</span>
            </span>
          </div>
        );
      },
    },
    {
      header: 'Activity Description',
      accessorKey: 'summary',
      className: 'w-[44%] max-w-0',
      cell: (row) => {
        const summaryText = summarizeLog(row);
        return (
          <div className="pr-4 overflow-hidden" title={summaryText}>
            <p className="text-xs text-slate-800 font-medium truncate leading-relaxed">
              {summaryText}
            </p>
          </div>
        );
      },
    },
    {
      header: 'Target & Actor',
      accessorKey: 'table_name',
      className: 'w-[22%] min-w-[180px]',
      cell: (row) => {
        const isMe = row.actor_email === user?.email || (!row.actor_email && !row.actor_name);
        return (
          <div className="flex items-center justify-between gap-2 group min-w-0">
            <div className="space-y-0.5 min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-xs text-slate-700 truncate">
                <Layers className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="font-semibold text-[10px] text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 shrink-0">
                  {getModuleLabel(row.table_name)}
                </span>
                {row.record_id && row.record_id !== 0 ? (
                  <span className="font-mono text-[10px] text-blue-600 font-bold shrink-0">
                    #{row.record_id}
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-400 font-mono shrink-0">#Global</span>
                )}
              </div>
              <div className="text-[11px] text-slate-600 flex items-center gap-1 truncate">
                <span className="font-medium truncate">{row.actor_name || 'System'}</span>
                {isMe && (
                  <span className="text-[9px] bg-blue-50 text-blue-700 border border-blue-100 px-1 rounded font-bold shrink-0">
                    You
                  </span>
                )}
              </div>
            </div>

            {/* Clickable Cue Indicator */}
            <div className="text-slate-300 group-hover:text-blue-600 transition-colors pr-1 shrink-0">
              <ChevronRight className="w-4 h-4" />
            </div>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto text-slate-800 pb-16 antialiased">
      {/* 🌟 HERO HEADER */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold text-xl shadow-lg shadow-blue-500/20 shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-slate-900">Security & Activity Audit Logs</h1>
              <span className="px-2.5 py-0.5 text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200 rounded-full uppercase tracking-wider">
                Manager Scope
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Real-time immutable audit trail for team task assignments, QA approvals, timesheet actions, and system activities.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => navigate('/manager/timelock')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold rounded-xl text-xs transition border border-amber-200/80 cursor-pointer shadow-2xs"
          >
            <Lock className="w-3.5 h-3.5 text-amber-600" />
            <span>Time Lock Portal</span>
          </button>
          <button
            onClick={() => navigate('/manager/profile')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer shadow-2xs"
          >
            <User className="w-3.5 h-3.5" />
            <span>Account Profile</span>
          </button>
        </div>
      </div>

      {/* 🔍 FILTER TOOLBAR */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-blue-600" />
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Audit Log Search &amp; Filters
            </h2>
          </div>

          {(selectedResource || selectedAction || selectedSeverity || searchQuery) && (
            <button
              onClick={() => {
                setSelectedResource('');
                setSelectedAction('');
                setSelectedSeverity('');
                setSearchQuery('');
              }}
              className="text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1 transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Filter 1: Resource / Module */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1.5">
              Target Resource
            </label>
            <SelectDropdown
              value={selectedResource}
              onChange={setSelectedResource}
              options={[
                { value: '', label: 'All Resources' },
                { value: 'tasks', label: 'Tasks' },
                { value: 'jobs', label: 'Projects (Jobs)' },
                { value: 'log_works', label: 'Timesheet & Work Logs' },
                { value: 'time_locks', label: 'Period Locks' },
                { value: 'reports', label: 'Reports' },
                { value: 'users', label: 'User Accounts' },
              ]}
              className="w-full"
            />
          </div>

          {/* Filter 2: Action Type */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1.5">
              Action Type
            </label>
            <SelectDropdown
              value={selectedAction}
              onChange={setSelectedAction}
              options={[
                { value: '', label: 'All Actions' },
                { value: 'CREATE_TASK', label: 'Create Task' },
                { value: 'UPDATE_TASK', label: 'Update Task' },
                { value: 'UPDATE_TASK_STATUS', label: 'Change Task Status' },
                { value: 'REORDER_TASK', label: 'Reorder Kanban Task' },
                { value: 'APPROVE_TASK', label: 'Approve Task (QA)' },
                { value: 'REJECT_TASK', label: 'Reject Task (QA)' },
                { value: 'APPROVE_LOG_WORK', label: 'Approve Work Log' },
                { value: 'REJECT_LOG_WORK', label: 'Reject Work Log' },
                { value: 'LOCK_TIMESHEET', label: 'Lock Timesheet' },
                { value: 'UNLOCK_TIMESHEET', label: 'Unlock Timesheet' },
                { value: 'REPORT_EXPORTED', label: 'Export Report' },
              ]}
              className="w-full"
            />
          </div>

          {/* Filter 3: Severity */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1.5">
              Severity
            </label>
            <SelectDropdown
              value={selectedSeverity}
              onChange={setSelectedSeverity}
              options={[
                { value: '', label: 'All Severities' },
                { value: 'NORMAL', label: 'Normal' },
                { value: 'WARNING', label: 'Warning' },
                { value: 'CRITICAL', label: 'Critical' },
              ]}
              className="w-full"
            />
          </div>

          {/* Filter 4: Keyword Search */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1.5">
              Search Keywords
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search description, actor, ID..."
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 📋 AUDIT LOG TABLE (TABLE-FIXED, ZERO HORIZONTAL SCROLLBAR) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-900">
              Activity &amp; Governance Audit Trail
            </h3>
            <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-mono text-[10px] font-bold border border-blue-200">
              Click any row to inspect details
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span>
              Showing <b className="text-slate-800">{paginatedAuditLogs.length}</b> of{' '}
              <b className="text-slate-800">{totalItems}</b> scoped events
            </span>
            <button
              onClick={() => {
                refetchLogs();
                toast.success('Audit logs refreshed!');
              }}
              className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition cursor-pointer"
              title="Refresh Audit Logs"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${fetchingLogs ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <DataTable
          columns={auditColumns}
          data={paginatedAuditLogs}
          isLoading={loadingLogs}
          onRowClick={(row) => handleInspect(row)}
          emptyMessage="No audit logs matching your current filters."
          pagination={{
            page: currentPage,
            pageSize,
            totalItems,
            totalPages,
            onPageChange: setCurrentPage,
            onPageSizeChange: (newSize) => {
              setPageSize(newSize);
              setCurrentPage(1);
            },
          }}
        />
      </div>

      {/* 🔍 SLIDE-OVER AUDIT INSPECTOR DRAWER */}
      <SideDrawer
        isOpen={isInspectorOpen}
        onClose={() => setIsInspectorOpen(false)}
        title="Audit Log Deep Inspector"
        description={`Immutable Event Record #${inspectLog?.id || '—'}`}
        maxWidth="max-w-2xl"
      >
        {inspectLog && (
          <AuditDiffViewer
            log={inspectLog}
            onClose={() => setIsInspectorOpen(false)}
          />
        )}
      </SideDrawer>
    </div>
  );
}
