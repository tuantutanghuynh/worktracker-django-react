import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Settings,
  ShieldCheck,
  RotateCcw,
  Search,
  Filter,
  Calendar,
  Layers,
  User,
  Volume2,
  VolumeX,
  Sliders,
  CheckCircle2,
  Lock,
  AlertTriangle,
  Clock,
  ListFilter,
  ArrowRight,
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

// Generate concise English summary fallback
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

// Format complex values (objects, booleans, arrays) for human-friendly display
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

export default function ManagerSettingsPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  // Active Tab: 'AUDIT_LOGS' | 'PREFERENCES'
  const [activeTab, setActiveTab] = useState('AUDIT_LOGS');

  // ============================================================
  // 1. AUDIT LOGS FILTERS & TANSTACK QUERY
  // ============================================================
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

  // ============================================================
  // 2. GOVERNANCE & CUTOFF SETTINGS STATE
  // ============================================================
  const today = new Date();
  const currentDay = today.getDate();
  const currentMonth = today.getMonth() + 1;
  const currentYear = today.getFullYear();

  const [governanceSettings, setGovernanceSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('manager_governance_settings');
      return saved
        ? JSON.parse(saved)
        : {
            cutoffDay: 28, // Default cutoff: Day 28 of each month
            soundAlerts: true,
            cutoffReminders: true,
            tableDensity: 'STANDARD',
            defaultPageSize: 10,
          };
    } catch {
      return {
        cutoffDay: 28,
        soundAlerts: true,
        cutoffReminders: true,
        tableDensity: 'STANDARD',
        defaultPageSize: 10,
      };
    }
  });

  const handleUpdateGovernance = (key, value) => {
    setGovernanceSettings((prev) => {
      const updated = { ...prev, [key]: value };
      localStorage.setItem('manager_governance_settings', JSON.stringify(updated));
      toast.success('Preference updated successfully!');
      return updated;
    });
  };

  const isPastCutoff = currentDay >= governanceSettings.cutoffDay;

  // ============================================================
  // 3. DATATABLE COLUMNS CONFIGURATION (4 COLUMNS - FIT 100% NO OVERFLOW)
  // ============================================================
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
    <div className="space-y-6 max-w-6xl mx-auto text-slate-800 pb-16">
      {/* 🌟 HERO HEADER */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold text-xl shadow-lg shadow-blue-500/20 shrink-0">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-slate-900">Settings & Activity Audit</h1>
              <span className="px-2 py-0.5 text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200 rounded-full uppercase tracking-wider">
                Manager Scope
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Configure monthly timesheet cutoff schedule, notification preferences, and inspect verified system audit trails.
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

      {/* 🧭 NAVIGATION TABS */}
      <div className="flex items-center gap-2 p-1 bg-white rounded-2xl border border-slate-200/80 shadow-xs max-w-md">
        <button
          onClick={() => setActiveTab('AUDIT_LOGS')}
          className={`flex-1 py-2 px-3 text-center rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'AUDIT_LOGS'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Security & Activity Audit</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              activeTab === 'AUDIT_LOGS' ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {totalItems}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('PREFERENCES')}
          className={`flex-1 py-2 px-3 text-center rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'PREFERENCES'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Preferences & Cutoff</span>
          {isPastCutoff && <span className="w-2 h-2 rounded-full bg-amber-500" title="Cutoff day active" />}
        </button>
      </div>

      {/* ============================================================ */}
      {/* 🛡️ TAB 1: AUDIT TRAIL LOGS TABLE                             */}
      {/* ============================================================ */}
      {activeTab === 'AUDIT_LOGS' && (
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

          {/* Audit DataTable with Clickable Rows & 0 Horizontal Scroll */}
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
      )}

      {/* ============================================================ */}
      {/* ⚙️ TAB 2: PREFERENCES & MONTHLY CUTOFF GOVERNANCE            */}
      {/* ============================================================ */}
      {activeTab === 'PREFERENCES' && (
        <div className="space-y-6">
          {/* SECTION 1: MONTHLY CUTOFF DAY SETTING & STATUS BANNER */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
                    <Lock className="w-4 h-4" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900">Monthly Timesheet Cutoff Governance</h3>
                </div>
                <p className="text-xs text-slate-500">
                  Configure the monthly cutoff date. When the deadline passes, managers are prompted to review and lock all project time periods.
                </p>
              </div>

              <span className="px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-full text-xs font-bold">
                Current Period: Month {currentMonth}/{currentYear}
              </span>
            </div>

            {/* Cutoff Day Control Box */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200/80">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-800">
                  Monthly Timesheet Cutoff Day (Cutoff Day)
                </label>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Manager selects a fixed cutoff day of the month (1 - 31). Once past this day, the system prompts you to verify and lock all managed job periods.
                </p>
              </div>

              <div className="flex items-center gap-3 md:justify-end">
                <select
                  value={governanceSettings.cutoffDay}
                  onChange={(e) => handleUpdateGovernance('cutoffDay', parseInt(e.target.value, 10))}
                  className="px-4 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs cursor-pointer"
                >
                  {[...Array(31)].map((_, i) => (
                    <option key={i + 1} value={i + 1}>
                      Day {i + 1} of each month {i + 1 === 28 ? '(Recommended - Day 28)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Cutoff Status Evaluation Banner */}
            {isPastCutoff ? (
              <div className="p-4 bg-amber-50/90 border border-amber-200 rounded-xl flex items-start justify-between gap-3 text-xs">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="font-bold text-amber-900">
                      PERIOD CUTOFF REACHED (Today is Day {currentDay} &gt;= Cutoff Day {governanceSettings.cutoffDay})
                    </div>
                    <p className="text-amber-800">
                      Timesheets for Month {currentMonth}/{currentYear} are due for final review and locking. Please verify pending log works and lock eligible project periods.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => navigate('/manager/timelock')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs transition shrink-0 shadow-xs cursor-pointer"
                >
                  <span>Open Time Lock Portal</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="p-4 bg-blue-50/90 border border-blue-200 rounded-xl flex items-start justify-between gap-3 text-xs">
                <div className="flex items-start gap-3">
                  <Calendar className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="font-bold text-blue-900">
                      PERIOD CUTOFF SCHEDULE: Day {governanceSettings.cutoffDay}/{currentMonth}/{currentYear}
                    </div>
                    <p className="text-blue-700">
                      <strong>{governanceSettings.cutoffDay - currentDay} days remaining</strong> until the cutoff deadline. Team members can submit timesheet logs normally until cutoff.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => navigate('/manager/timelock')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-blue-50 text-blue-700 font-bold rounded-lg text-xs transition border border-blue-200 shrink-0 cursor-pointer shadow-2xs"
                >
                  <span>Time Lock Portal</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* SECTION 2: NOTIFICATION & WORKSPACE PREFERENCES */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-6">
            <div>
              <h3 className="text-base font-bold text-slate-900">Notification & Display Preferences</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Personalize your workspace experience, audio alerts, and display settings.
              </p>
            </div>

            <div className="divide-y divide-slate-100 text-xs">
              {/* Option 1: Audio Alert */}
              <div className="py-4 flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {governanceSettings.soundAlerts ? (
                      <Volume2 className="w-4 h-4 text-blue-600" />
                    ) : (
                      <VolumeX className="w-4 h-4 text-slate-400" />
                    )}
                    <span className="font-bold text-slate-900">Audio Sound Alerts</span>
                  </div>
                  <p className="text-slate-500">
                    Play an audible chime when new deliverable tasks are submitted for review or messages arrive.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleUpdateGovernance('soundAlerts', !governanceSettings.soundAlerts)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    governanceSettings.soundAlerts ? 'bg-blue-600' : 'bg-slate-200'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                      governanceSettings.soundAlerts ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Option 2: Cutoff Reminders */}
              <div className="py-4 flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span className="font-bold text-slate-900">Monthly Cutoff Reminders</span>
                  </div>
                  <p className="text-slate-500">
                    Display priority alert badges 1-2 days before the monthly cutoff deadline.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleUpdateGovernance('cutoffReminders', !governanceSettings.cutoffReminders)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    governanceSettings.cutoffReminders ? 'bg-blue-600' : 'bg-slate-200'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                      governanceSettings.cutoffReminders ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Option 3: Table Density */}
              <div className="py-4 flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-blue-600" />
                    <span className="font-bold text-slate-900">Table Row Density</span>
                  </div>
                  <p className="text-slate-500">
                    Choose row spacing across data tables for preferred information density.
                  </p>
                </div>

                <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => handleUpdateGovernance('tableDensity', 'COMPACT')}
                    className={`px-3 py-1 rounded-lg font-bold text-xs transition cursor-pointer ${
                      governanceSettings.tableDensity === 'COMPACT'
                        ? 'bg-white text-blue-600 shadow-xs'
                        : 'text-slate-600'
                    }`}
                  >
                    Compact
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdateGovernance('tableDensity', 'STANDARD')}
                    className={`px-3 py-1 rounded-lg font-bold text-xs transition cursor-pointer ${
                      governanceSettings.tableDensity === 'STANDARD'
                        ? 'bg-white text-blue-600 shadow-xs'
                        : 'text-slate-600'
                    }`}
                  >
                    Standard
                  </button>
                </div>
              </div>

              {/* Option 4: Default Page Size */}
              <div className="py-4 flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <ListFilter className="w-4 h-4 text-blue-600" />
                    <span className="font-bold text-slate-900">Default Pagination Limit</span>
                  </div>
                  <p className="text-slate-500">
                    Initial number of items loaded per page across management tables.
                  </p>
                </div>

                <select
                  value={governanceSettings.defaultPageSize}
                  onChange={(e) => handleUpdateGovernance('defaultPageSize', parseInt(e.target.value, 10))}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value={10}>10 items / page</option>
                  <option value={25}>25 items / page</option>
                  <option value={50}>50 items / page</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 🔍 100% LIGHT EXECUTIVE AUDIT INSPECTOR SIDE DRAWER          */}
      {/* ============================================================ */}
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
            {/* Executive Summary Card (Light Theme) */}
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

            {/* Business Change Delta Section (Light Clean Cards) */}
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
