import React, { useState } from 'react';
import { 
  FileDiff, 
  ArrowRight, 
  User, 
  Calendar, 
  Globe, 
  Database, 
  Tag, 
  AlertTriangle, 
  CheckCircle2, 
  Info,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { cn } from '../../../utils/cn';
import { format } from 'date-fns';

/**
 * AuditDiffViewer - Audit Log Snapshot Comparison Component
 * 
 * Props:
 * - oldValues (Object | string): Data before change (JSON or Object)
 * - newValues (Object | string): Data after change (JSON or Object)
 * - action (string): Action name (e.g. 'UPDATE_TASK', 'LOCK_TIMESHEET')
 * - tableName (string): DB Table name (e.g. 'tasks', 'log_works')
 * - recordId (string | number): Record ID
 * - timestamp (string | Date): Log timestamp
 * - user (Object): { full_name, email, avatar_url }
 * - severity ('CRITICAL' | 'WARNING' | 'NORMAL'): Severity level
 * - ipAddress (string): Client request IP address
 * - summary (string): Action summary description
 */
export default function AuditDiffViewer({
  oldValues = {},
  newValues = {},
  action = 'UPDATE_RECORD',
  tableName = 'N/A',
  recordId = 'N/A',
  timestamp,
  user,
  severity = 'NORMAL',
  ipAddress,
  summary,
  className
}) {
  const [viewMode, setViewMode] = useState('side-by-side'); // 'side-by-side' | 'unified'
  const [showUnchanged, setShowUnchanged] = useState(false);

  // Parse JSON string if necessary
  const parseData = (val) => {
    if (!val) return {};
    if (typeof val === 'string') {
      try { return JSON.parse(val); } catch (e) { return { value: val }; }
    }
    return val;
  };

  const oldObj = parseData(oldValues);
  const newObj = parseData(newValues);

  // Extract all unique keys from oldObj and newObj
  const allKeys = Array.from(new Set([...Object.keys(oldObj), ...Object.keys(newObj)]));

  // Determine key status: 'added' | 'removed' | 'modified' | 'unchanged'
  const diffItems = allKeys.map((key) => {
    const oldVal = oldObj[key];
    const newVal = newObj[key];

    const hasOld = key in oldObj;
    const hasNew = key in newObj;

    let status = 'unchanged';
    if (!hasOld && hasNew) status = 'added';
    else if (hasOld && !hasNew) status = 'removed';
    else if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) status = 'modified';

    return { key, oldVal, newVal, status };
  });

  const filteredItems = diffItems.filter(item => showUnchanged || item.status !== 'unchanged');

  const severityConfigs = {
    CRITICAL: { label: 'Critical', bg: 'bg-rose-500/10 text-rose-400 border-rose-500/30', icon: AlertTriangle },
    WARNING: { label: 'Warning', bg: 'bg-amber-500/10 text-amber-400 border-amber-500/30', icon: Info },
    NORMAL: { label: 'Normal', bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30', icon: CheckCircle2 },
  };

  const currentSeverity = severityConfigs[severity] || severityConfigs.NORMAL;
  const SeverityIcon = currentSeverity.icon;

  const renderValue = (val) => {
    if (val === null || val === undefined) return <span className="text-slate-500 italic">null</span>;
    if (typeof val === 'boolean') return <span className="font-semibold text-purple-400">{val ? 'true' : 'false'}</span>;
    if (typeof val === 'object') return <pre className="text-xs font-mono whitespace-pre-wrap">{JSON.stringify(val, null, 2)}</pre>;
    return String(val);
  };

  return (
    <div className={cn("bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-5 text-slate-100", className)}>
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <FileDiff className="w-5 h-5 text-indigo-400" />
            <h3 className="text-base font-bold text-slate-100 tracking-tight">
              {action}
            </h3>
            <span className={cn("inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full border", currentSeverity.bg)}>
              <SeverityIcon className="w-3.5 h-3.5" />
              {currentSeverity.label}
            </span>
          </div>
          {summary && (
            <p className="text-xs text-slate-400">
              {summary}
            </p>
          )}
        </div>

        {/* View mode toggle */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setShowUnchanged(!showUnchanged)}
            className="text-xs px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/60 hover:bg-slate-800 text-slate-300 transition-colors cursor-pointer"
          >
            {showUnchanged ? 'Hide Unchanged Fields' : 'Show All Fields'}
          </button>
        </div>
      </div>

      {/* Metadata Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950/60 p-3 rounded-lg border border-slate-800/80 text-xs">
        <div className="space-y-1">
          <span className="text-slate-400 font-medium flex items-center gap-1">
            <User className="w-3.5 h-3.5 text-slate-500" /> Performed by:
          </span>
          <p className="font-semibold text-slate-200 truncate">
            {user?.full_name || user?.email || 'System User'}
          </p>
        </div>
        <div className="space-y-1">
          <span className="text-slate-400 font-medium flex items-center gap-1">
            <Database className="w-3.5 h-3.5 text-slate-500" /> DB Table (ID):
          </span>
          <p className="font-mono text-indigo-400">
            {tableName} (#{recordId})
          </p>
        </div>
        <div className="space-y-1">
          <span className="text-slate-400 font-medium flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-slate-500" /> Timestamp:
          </span>
          <p className="text-slate-300">
            {timestamp ? format(new Date(timestamp), 'HH:mm - yyyy-MM-dd') : 'N/A'}
          </p>
        </div>
        <div className="space-y-1">
          <span className="text-slate-400 font-medium flex items-center gap-1">
            <Globe className="w-3.5 h-3.5 text-slate-500" /> IP Request:
          </span>
          <p className="font-mono text-slate-300">
            {ipAddress || 'Internal / Celery'}
          </p>
        </div>
      </div>

      {/* Diff Table */}
      <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950/40">
        <div className="bg-slate-800/80 px-4 py-2.5 flex items-center justify-between border-b border-slate-800 text-xs font-semibold text-slate-300">
          <span>Attribute Name (Field)</span>
          <div className="flex items-center gap-8">
            <span className="text-rose-400">Previous Value (Old)</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-emerald-400">Updated Value (New)</span>
          </div>
        </div>

        {filteredItems.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No data changes recorded or all fields are identical.
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60 font-mono text-xs">
            {filteredItems.map(({ key, oldVal, newVal, status }) => {
              const statusBg = {
                modified: 'bg-amber-500/5 hover:bg-amber-500/10',
                added: 'bg-emerald-500/5 hover:bg-emerald-500/10',
                removed: 'bg-rose-500/5 hover:bg-rose-500/10',
                unchanged: 'hover:bg-slate-800/40',
              }[status];

              return (
                <div key={key} className={cn("grid grid-cols-1 md:grid-cols-12 gap-2 p-3 items-baseline transition-colors", statusBg)}>
                  {/* Key Column */}
                  <div className="md:col-span-4 flex items-center gap-2 font-sans">
                    <span className="font-semibold text-slate-200 break-all">{key}</span>
                    {status === 'modified' && <span className="px-1.5 py-0.5 text-[10px] bg-amber-500/20 text-amber-300 rounded">Modified</span>}
                    {status === 'added' && <span className="px-1.5 py-0.5 text-[10px] bg-emerald-500/20 text-emerald-300 rounded">Added</span>}
                    {status === 'removed' && <span className="px-1.5 py-0.5 text-[10px] bg-rose-500/20 text-rose-300 rounded">Removed</span>}
                  </div>

                  {/* Old Value */}
                  <div className="md:col-span-4 text-rose-300/90 line-through bg-rose-950/20 p-1.5 rounded border border-rose-900/30 break-all">
                    {renderValue(oldVal)}
                  </div>

                  {/* Arrow Indicator */}
                  <div className="hidden md:flex md:col-span-1 justify-center text-slate-500">
                    <ArrowRight className="w-4 h-4 self-center" />
                  </div>

                  {/* New Value */}
                  <div className="md:col-span-3 text-emerald-300 bg-emerald-950/20 p-1.5 rounded border border-emerald-900/30 break-all">
                    {renderValue(newVal)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
