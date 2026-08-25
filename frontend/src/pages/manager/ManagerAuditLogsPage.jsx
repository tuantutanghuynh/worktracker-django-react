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
import { useManagerAuditLogs } from '../../hooks/queries/manager/useManagerAuditLogs';
import { useAuthStore } from '../../stores/authStore';

// Safe date formatter for display
function formatDateSafe(dateStr, pattern = 'dd/MM/yyyy HH:mm:ss') {
  if (!dateStr) return 'N/A';
  try {
    return format(parseISO(dateStr), pattern);
  } catch {
    return dateStr;
  }
}

// Generate concise summary fallback
function getReadableSummary(row) {
  if (row?.summary && typeof row.summary === 'string' && row.summary.trim()) {
    return row.summary.trim();
  }

  const action = row?.action || 'ACTIVITY';
  const table = (row?.table_name || 'record').toLowerCase();
  const id = row?.record_id && row.record_id !== 0 ? `#${row.record_id}` : '';
  const actor = row?.actor_name || 'User';

  if (action === 'REPORT_EXPORTED') {
    const reportType = row?.new_values?.report_type || 'Report';
    const fmt = row?.new_values?.file_format || 'File';
    return `${actor} exported ${reportType} report as ${fmt} file`;
  }
  if (action.includes('APPROVE')) {
    return `${actor} approved ${table} ${id}`.trim();
  }
  if (action.includes('REJECT')) {
    return `${actor} rejected ${table} ${id}`.trim();
  }
  if (action.includes('LOCK')) {
    return `${actor} locked period for ${table} ${id}`.trim();
  }
  if (action.includes('UNLOCK')) {
    return `${actor} unlocked period for ${table} ${id}`.trim();
  }
  if (action.includes('CREATE')) {
    return `${actor} created new ${table} ${id}`.trim();
  }
  if (action.includes('UPDATE')) {
    return `${actor} updated ${table} ${id}`.trim();
  }
  if (action.includes('RESTORE')) {
    return `${actor} restored deleted ${table} ${id}`.trim();
  }
  if (action.includes('DELETE')) {
    return `${actor} deleted ${table} ${id}`.trim();
  }

  return `${actor} performed ${action.replace(/_/g, ' ')} on ${table} ${id}`.trim();
}

// Format complex values for human-friendly display
function formatDisplayValue(val) {
  if (val === null || val === undefined) return 'None';
  if (typeof val === 'boolean') return val ? 'True' : 'False';
  if (typeof val === 'object') {
    if (Array.isArray(val)) {
      return val.length === 0 ? 'None' : val.map((v) => formatDisplayValue(v)).join(', ');
    }
    const entries = Object.entries(val).filter(([_, v]) => v !== undefined && v !== null && v !== '');
    if (entries.length === 0) return 'Standard';
    return entries.map(([k, v]) => `${k.replace(/_/g, ' ')}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join(' | ');
  }
  return String(val);
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

  // Columns Configuration
  const auditColumns = [
    {
      header: 'Timestamp',
      accessorKey: 'created_at',
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
              <span>{action.replace(/_/g, ' ')}</span>
            </span>
          </div>
        );
      },
    },
    {
      header: 'Activity Description',
      accessorKey: 'summary',
      cell: (row) => (
        <div className="pr-4">
          <p className="text-xs text-slate-800 font-medium line-clamp-2 leading-relaxed break-words">
            {getReadableSummary(row)}
          </p>
        </div>
      ),
    },
    {
      header: 'Target & Actor',
      accessorKey: 'table_name',
      cell: (row) => {
        const isMe = row.actor_email === user?.email || (!row.actor_email && !row.actor_name);
        return (
          <div className="flex items-center justify-between gap-3 group">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-xs text-slate-700">
                <Layers className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="font-semibold font-mono text-[10px] text-slate-900 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                  {row.table_name || 'System'}
                </span>
                {row.record_id && row.record_id !== 0 ? (
                  <span className="font-mono text-[10px] text-blue-600 font-bold">
                    #{row.record_id}
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-400 font-mono">#Global</span>
                )}
              </div>
              <div className="text-[11px] text-slate-600 flex items-center gap-1">
                <span className="font-medium">{row.actor_name || 'System'}</span>
                {isMe && (
                  <span className="text-[9px] bg-blue-50 text-blue-700 border border-blue-100 px-1 rounded font-bold">
                    You
                  </span>
                )}
              </div>
            </div>

            {/* Clickable Cue Indicator */}
            <div className="text-slate-300 group-hover:text-blue-600 transition-colors pr-2">
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

      {/* 🛡️ AUDIT TRAIL LOGS TABLE SECTION */}
      <div className="space-y-4">
        {/* Filter Toolbar */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-500" />
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Audit Log Search & Filters
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setSelectedResource('');
                  setSelectedAction('');
                  setSelectedSeverity('');
                  setSearchQuery('');
                }}
                className="text-xs text-slate-400 hover:text-slate-600 font-semibold transition cursor-pointer"
              >
                Reset Filters
              </button>
              <button
                onClick={() => {
                  refetchLogs();
                  toast.success('Audit trail refreshed!');
                }}
                disabled={fetchingLogs}
                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition cursor-pointer"
                title="Refresh audit trail"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${fetchingLogs ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Filter 1: Target Resource */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">Target Resource</label>
              <SelectDropdown
                value={selectedResource}
                onChange={(val) => setSelectedResource(val)}
                options={[
                  { value: '', label: 'All Resources' },
                  { value: 'tasks', label: 'Tasks' },
                  { value: 'jobs', label: 'Jobs / Projects' },
                  { value: 'timesheets', label: 'Timesheets & Logs' },
                  { value: 'timelocks', label: 'Time Locks' },
                  { value: 'reports', label: 'Reports & Analytics' },
                  { value: 'users', label: 'Users & Profile' },
                ]}
                placeholder="Filter Resource..."
              />
            </div>

            {/* Filter 2: Action Type */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">Action Type</label>
              <SelectDropdown
                value={selectedAction}
                onChange={(val) => setSelectedAction(val)}
                options={[
                  { value: '', label: 'All Actions' },
                  { value: 'APPROVE', label: 'Approve Actions' },
                  { value: 'REJECT', label: 'Reject Actions' },
                  { value: 'LOCK', label: 'Lock Actions' },
                  { value: 'UNLOCK', label: 'Unlock Actions' },
                  { value: 'REPORT', label: 'Report Exports' },
                  { value: 'CREATE', label: 'Create Actions' },
                  { value: 'UPDATE', label: 'Update / Edit' },
                  { value: 'RESTORE', label: 'Restore Actions' },
                  { value: 'DELETE', label: 'Delete Actions' },
                ]}
                placeholder="Filter Action..."
              />
            </div>

            {/* Filter 3: Severity */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">Severity</label>
              <SelectDropdown
                value={selectedSeverity}
                onChange={(val) => setSelectedSeverity(val)}
                options={[
                  { value: '', label: 'All Severities' },
                  { value: 'NORMAL', label: 'Normal (Routine)' },
                  { value: 'WARNING', label: 'Warning (Review)' },
                  { value: 'CRITICAL', label: 'Critical (High Risk)' },
                ]}
                placeholder="Filter Severity..."
              />
            </div>

            {/* Filter 4: Keyword Search */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">Search Keywords</label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search description, actor, ID..."
                  className="w-full pl-8 pr-3 py-2 bg-slate-50 hover:bg-slate-100 focus:bg-white text-xs rounded-xl border border-slate-200 focus:border-blue-400 focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Audit DataTable with Clickable Rows */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <h3 className="text-sm font-bold text-slate-900">Activity & Governance Audit Trail</h3>
              <span className="text-[11px] text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full font-medium ml-2">
                Click any row to inspect details
              </span>
            </div>
            <span className="text-xs text-slate-500 font-medium">
              Showing <strong className="text-slate-900">{totalItems}</strong> scoped events
            </span>
          </div>

          <DataTable
            columns={auditColumns}
            data={paginatedAuditLogs}
            isLoading={loadingLogs}
            onRowClick={(row) => handleInspect(row)}
            emptyMessage="No audit trail events found matching the criteria."
            pagination={{
              currentPage,
              totalPages,
              totalItems,
              pageSize,
              pageSizeOptions: [10, 25, 50, 100],
              onPageChange: setCurrentPage,
              onPageSizeChange: (size) => {
                setPageSize(size);
                setCurrentPage(1);
              },
            }}
          />
        </div>
      </div>

      {/* 🔍 100% LIGHT EXECUTIVE AUDIT INSPECTOR SIDE DRAWER */}
      <SideDrawer
        isOpen={isInspectorOpen}
        onClose={() => setIsInspectorOpen(false)}
        size="lg"
        theme="light"
        title={
          <div className="flex items-center gap-2 text-slate-900">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <span className="font-bold text-base">Activity Audit Inspector</span>
          </div>
        }
        subtitle="Detailed audit breakdown and verified property state changes"
      >
        {inspectLog && (
          <div className="space-y-5 text-xs text-slate-800">
            {/* Executive Summary Card */}
            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-blue-50 text-blue-700 border border-blue-200 uppercase tracking-wider">
                  {inspectLog.action || 'ACTIVITY'}
                </span>
                <span className="text-slate-500 font-mono text-xs font-bold">
                  Audit ID: #{inspectLog.id}
                </span>
              </div>

              <div className="text-sm font-bold text-slate-900 leading-snug">
                {getReadableSummary(inspectLog)}
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs pt-3 border-t border-slate-200">
                <div className="space-y-0.5">
                  <span className="text-slate-400 font-medium">Timestamp:</span>
                  <p className="font-semibold font-mono text-slate-800">{formatDateSafe(inspectLog.created_at)}</p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-slate-400 font-medium">Client IP Address:</span>
                  <p className="font-semibold font-mono text-slate-800">{inspectLog.ip_address || 'System Internal'}</p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-slate-400 font-medium">Actor / User:</span>
                  <p className="font-semibold text-slate-800">{inspectLog.actor_name || 'System'} ({inspectLog.actor_email || 'N/A'})</p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-slate-400 font-medium">Target Resource:</span>
                  <p className="font-semibold font-mono text-slate-800">{inspectLog.table_name || 'system'} #{inspectLog.record_id || 'Global'}</p>
                </div>
              </div>
            </div>

            {/* Business Change Delta Section */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                State & Property Changes
              </h4>

              {inspectLog.old_values || inspectLog.new_values ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Before (Old State) */}
                  <div className="p-4 bg-rose-50/50 rounded-xl border border-rose-200/80 space-y-2.5">
                    <div className="font-bold text-rose-800 text-xs uppercase tracking-wider flex items-center justify-between">
                      <span>Before Change</span>
                      <span className="text-[10px] bg-rose-100 text-rose-700 px-1.5 py-0.2 rounded font-bold">Old State</span>
                    </div>

                    {inspectLog.old_values && typeof inspectLog.old_values === 'object' && Object.keys(inspectLog.old_values).length > 0 ? (
                      <div className="space-y-2 bg-white p-3 rounded-lg border border-rose-100 text-xs shadow-2xs">
                        {Object.entries(inspectLog.old_values).map(([key, val]) => (
                          <div key={key} className="py-1 border-b border-slate-50 last:border-0 space-y-0.5">
                            <span className="text-slate-500 font-medium capitalize text-[11px] block">{key.replace(/_/g, ' ')}:</span>
                            <span className="font-bold text-rose-700 font-mono text-xs block break-words">
                              {formatDisplayValue(val)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400 italic p-3 bg-white/60 rounded-lg border border-rose-100">
                        None (New record created or initial state)
                      </div>
                    )}
                  </div>

                  {/* After (New State) */}
                  <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-200/80 space-y-2.5">
                    <div className="font-bold text-emerald-800 text-xs uppercase tracking-wider flex items-center justify-between">
                      <span>After Change</span>
                      <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.2 rounded font-bold">New State</span>
                    </div>

                    {inspectLog.new_values && typeof inspectLog.new_values === 'object' && Object.keys(inspectLog.new_values).length > 0 ? (
                      <div className="space-y-2 bg-white p-3 rounded-lg border border-emerald-100 text-xs shadow-2xs">
                        {Object.entries(inspectLog.new_values).map(([key, val]) => (
                          <div key={key} className="py-1 border-b border-slate-50 last:border-0 space-y-0.5">
                            <span className="text-slate-500 font-medium capitalize text-[11px] block">{key.replace(/_/g, ' ')}:</span>
                            <span className="font-bold text-emerald-700 font-mono text-xs block break-words">
                              {formatDisplayValue(val)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400 italic p-3 bg-white/60 rounded-lg border border-emerald-100">
                        None (Record was removed)
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-6 bg-slate-50 rounded-xl border border-slate-200 text-center text-slate-500 text-xs">
                  No property delta changes recorded for this activity.
                </div>
              )}
            </div>
          </div>
        )}
      </SideDrawer>
    </div>
  );
}
