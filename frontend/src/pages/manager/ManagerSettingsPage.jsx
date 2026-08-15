import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Settings,
  Bell,
  ShieldCheck,
  RotateCcw,
  Search,
  Filter,
  Calendar,
  Layers,
  History,
  User,
  Volume2,
  VolumeX,
  ExternalLink,
  Sliders,
  CheckCircle2,
  Lock,
  FileText
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';

import DataTable from '../../components/common/table/DataTable';
import SelectDropdown from '../../components/common/forms/SelectDropdown';
import { useManagerAuditLogs } from '../../hooks/queries/manager/useManagerAuditLogs';

function formatDateSafe(dateStr, pattern = 'dd/MM/yyyy HH:mm:ss') {
  if (!dateStr) return 'N/A';
  try {
    return format(parseISO(dateStr), pattern);
  } catch {
    return dateStr;
  }
}

export default function ManagerSettingsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('AUDIT_LOGS'); // 'AUDIT_LOGS' | 'PREFERENCES'

  // Preferences State (Persisted in localStorage)
  const [preferences, setPreferences] = useState(() => {
    try {
      const saved = localStorage.getItem('manager_user_preferences');
      return saved
        ? JSON.parse(saved)
        : {
            soundAlerts: true,
            autoRefreshFeed: true,
            tableDensity: 'STANDARD', // 'COMPACT' | 'STANDARD'
          };
    } catch {
      return {
        soundAlerts: true,
        autoRefreshFeed: true,
        tableDensity: 'STANDARD',
      };
    }
  });

  // Audit Logs Filter State
  const [selectedAction, setSelectedAction] = useState('');
  const [selectedTable, setSelectedTable] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // 🚀 TANSTACK REACT QUERY: Fetch Real Audit Logs from Database
  const {
    data: auditLogsResponse,
    isLoading: loadingLogs,
    isFetching: fetchingLogs,
    refetch: refetchLogs,
  } = useManagerAuditLogs({
    action: selectedAction || undefined,
    table_name: selectedTable || undefined,
  });

  // Handle Save Preferences
  const handleTogglePreference = (key) => {
    setPreferences((prev) => {
      const updated = { ...prev, [key]: !prev[key] };
      localStorage.setItem('manager_user_preferences', JSON.stringify(updated));
      toast.success('Preference updated!');
      return updated;
    });
  };

  const handleTableDensityChange = (density) => {
    setPreferences((prev) => {
      const updated = { ...prev, tableDensity: density };
      localStorage.setItem('manager_user_preferences', JSON.stringify(updated));
      toast.success(`Table layout set to ${density.toLowerCase()}.`);
      return updated;
    });
  };

  // Chuẩn hóa và lọc danh sách Audit Logs
  const auditLogsList = useMemo(() => {
    const raw = Array.isArray(auditLogsResponse)
      ? auditLogsResponse
      : auditLogsResponse?.results || [];

    if (!searchQuery.trim()) return raw;
    const q = searchQuery.toLowerCase();
    return raw.filter((log) => {
      const action = (log.action || '').toLowerCase();
      const table = (log.table_name || '').toLowerCase();
      const id = String(log.record_id || '');
      return action.includes(q) || table.includes(q) || id.includes(q);
    });
  }, [auditLogsResponse, searchQuery]);

  // Cấu hình Cột DataTable cho Audit Logs
  const auditColumns = [
    {
      header: 'Timestamp',
      accessorKey: 'created_at',
      cell: (row) => (
        <span className="font-mono text-xs text-slate-600 font-medium">
          {formatDateSafe(row.created_at)}
        </span>
      ),
    },
    {
      header: 'Action Taken',
      accessorKey: 'action',
      cell: (row) => {
        const action = row.action || 'ACTIVITY';
        let badgeColor = 'bg-blue-50 text-blue-700 border-blue-200';

        if (action.includes('CREATE') || action.includes('APPROVE') || action.includes('UNLOCK')) {
          badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
        } else if (action.includes('REJECT') || action.includes('DELETE') || action.includes('VOID')) {
          badgeColor = 'bg-rose-50 text-rose-700 border-rose-200';
        } else if (action.includes('LOCK') || action.includes('PASSWORD')) {
          badgeColor = 'bg-amber-50 text-amber-700 border-amber-200';
        }

        return (
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border uppercase tracking-wider ${badgeColor}`}
          >
            {action}
          </span>
        );
      },
    },
    {
      header: 'Resource / Table',
      accessorKey: 'table_name',
      cell: (row) => (
        <div className="flex items-center gap-1.5 text-xs text-slate-700">
          <Layers className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-semibold font-mono">{row.table_name || 'System'}</span>
        </div>
      ),
    },
    {
      header: 'Record ID',
      accessorKey: 'record_id',
      cell: (row) => (
        <span className="font-mono text-xs bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-200">
          #{row.record_id || 'N/A'}
        </span>
      ),
    },
    {
      header: 'Actor / User',
      accessorKey: 'user',
      cell: (row) => (
        <span className="text-xs font-semibold text-slate-800">
          {row.user?.full_name || row.user?.email || 'You (Manager)'}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto text-slate-800 pb-12">
      {/* 🌟 HERO HEADER */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold text-xl shadow-lg shadow-blue-500/20 shrink-0">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Manager Settings & Activity Audit</h1>
            <p className="text-xs text-slate-500 mt-1">
              Review verified manager activity logs, configure notifications, and manage account security preferences.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/manager/profile')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
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
          className={`flex-1 py-2 text-center rounded-xl text-xs font-bold transition-all ${
            activeTab === 'AUDIT_LOGS'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          Security Audit Trail
        </button>
        <button
          onClick={() => setActiveTab('PREFERENCES')}
          className={`flex-1 py-2 text-center rounded-xl text-xs font-bold transition-all ${
            activeTab === 'PREFERENCES'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          Preferences
        </button>
      </div>

      {/* 🛡️ TAB 1: REAL AUDIT TRAIL LOGS */}
      {activeTab === 'AUDIT_LOGS' && (
        <div className="space-y-4">
          {/* Filter Toolbar for Audit Logs */}
          <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1 flex-wrap">
              <div className="w-48">
                <SelectDropdown
                  value={selectedTable}
                  onChange={(val) => setSelectedTable(val)}
                  options={[
                    { value: '', label: 'All Resources' },
                    { value: 'tasks', label: 'Tasks' },
                    { value: 'jobs', label: 'Jobs / Projects' },
                    { value: 'timesheets', label: 'Timesheets' },
                    { value: 'timelocks', label: 'Time Locks' },
                    { value: 'users', label: 'Users & Profile' },
                  ]}
                  placeholder="Filter by Resource..."
                />
              </div>

              <div className="w-52">
                <SelectDropdown
                  value={selectedAction}
                  onChange={(val) => setSelectedAction(val)}
                  options={[
                    { value: '', label: 'All Actions' },
                    { value: 'APPROVE', label: 'Approve Actions' },
                    { value: 'REJECT', label: 'Reject Actions' },
                    { value: 'LOCK', label: 'Lock Actions' },
                    { value: 'UNLOCK', label: 'Unlock Actions' },
                    { value: 'CHANGE_PASSWORD', label: 'Password Changes' },
                  ]}
                  placeholder="Filter by Action..."
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative w-full md:w-56">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by action or ID..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-100 hover:bg-slate-100/80 focus:bg-white text-xs rounded-xl border border-transparent focus:border-blue-400 focus:outline-none"
                />
              </div>

              <button
                onClick={() => {
                  refetchLogs();
                  toast.success('Audit trail refreshed!');
                }}
                disabled={fetchingLogs}
                className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition cursor-pointer"
                title="Refresh audit trail"
              >
                <RotateCcw className={`w-4 h-4 ${fetchingLogs ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Audit DataTable */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900">Verified Activity & Security Audit Trail</h3>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                {auditLogsList.length} recorded events
              </span>
            </div>

            <DataTable
              columns={auditColumns}
              data={auditLogsList}
              isLoading={loadingLogs}
              emptyMessage="No audit trail events found matching the criteria."
            />
          </div>
        </div>
      )}

      {/* ⚙️ TAB 2: WORKSPACE & NOTIFICATION PREFERENCES */}
      {activeTab === 'PREFERENCES' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-6">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Workspace & Notification Preferences</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Personalize your workspace experience and audio feedback alerts.
            </p>
          </div>

          <div className="divide-y divide-slate-100 text-xs">
            {/* Preference 1: Audio Notification */}
            <div className="py-4 flex items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  {preferences.soundAlerts ? (
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
                onClick={() => handleTogglePreference('soundAlerts')}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  preferences.soundAlerts ? 'bg-blue-600' : 'bg-slate-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    preferences.soundAlerts ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Preference 2: Table Density */}
            <div className="py-4 flex items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-blue-600" />
                  <span className="font-bold text-slate-900">Table Density</span>
                </div>
                <p className="text-slate-500">
                  Choose row spacing across data tables for better information density.
                </p>
              </div>

              <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => handleTableDensityChange('COMPACT')}
                  className={`px-3 py-1 rounded-lg font-bold text-xs transition ${
                    preferences.tableDensity === 'COMPACT'
                      ? 'bg-white text-blue-600 shadow-xs'
                      : 'text-slate-600'
                  }`}
                >
                  Compact
                </button>
                <button
                  type="button"
                  onClick={() => handleTableDensityChange('STANDARD')}
                  className={`px-3 py-1 rounded-lg font-bold text-xs transition ${
                    preferences.tableDensity === 'STANDARD'
                      ? 'bg-white text-blue-600 shadow-xs'
                      : 'text-slate-600'
                  }`}
                >
                  Standard
                </button>
              </div>
            </div>

            {/* Preference 3: Auto Refresh Live Feed */}
            <div className="py-4 flex items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="font-bold text-slate-900">Auto Live Sync</span>
                </div>
                <p className="text-slate-500">
                  Keep real-time WebSocket connection alive in the background for instant notification badges.
                </p>
              </div>

              <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase">
                Active (WebSocket)
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
