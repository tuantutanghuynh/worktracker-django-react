import { useState } from 'react';
import { 
  FileDiff, 
  ArrowRight, 
  User, 
  Globe, 
  AlertTriangle, 
  CheckCircle2, 
  Info,
  Clock
} from 'lucide-react';
import { cn } from '../../../utils/cn';
import { format } from 'date-fns';
import {
  getActionLabel,
  getFieldLabel,
  isHiddenField,
  formatAuditValue,
} from '../../../utils/auditLabels';

/**
 * AuditDiffViewer - Audit Log Snapshot Comparison Component
 * Perfectly aligned 12-column grid layout with automatic date-fns ISO string formatting
 */
export default function AuditDiffViewer({
  oldValues = {},
  newValues = {},
  action = 'UPDATE_RECORD',
  timestamp,
  user,
  severity = 'NORMAL',
  ipAddress,
  summary,
  className
}) {
  const [showUnchanged, setShowUnchanged] = useState(false);

  // Parse JSON string if necessary
  const parseData = (val) => {
    if (!val) return {};
    if (typeof val === 'string') {
      try { return JSON.parse(val); } catch { return { value: val }; }
    }
    return val;
  };

  const oldObj = parseData(oldValues);
  const newObj = parseData(newValues);

  // Bỏ các cột thuần kỹ thuật (id, created_at, password...) — Admin nghiệp
  // vụ không đọc được và cũng không cần đối chiếu.
  const allKeys = Array.from(new Set([...Object.keys(oldObj), ...Object.keys(newObj)])).filter(
    (key) => !isHiddenField(key)
  );

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
  // Many audit actions (CREATE, DELETE, LOCK/UNLOCK, RESET_PASSWORD...) only
  // ever log a partial new_values (or none at all), so no field can ever be
  // "unchanged" for them — the toggle would have zero visible effect. Only
  // show it when there's actually something for it to hide.
  const hasUnchangedFields = diffItems.some((item) => item.status === 'unchanged');

  const severityConfigs = {
    CRITICAL: { label: 'Critical', bg: 'bg-rose-500/10 text-rose-400 border-rose-500/30', icon: AlertTriangle },
    WARNING: { label: 'Warning', bg: 'bg-amber-500/10 text-amber-400 border-amber-500/30', icon: Info },
    NORMAL: { label: 'Normal', bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30', icon: CheckCircle2 },
  };

  const currentSeverity = severityConfigs[severity] || severityConfigs.NORMAL;
  const SeverityIcon = currentSeverity.icon;

  // Mọi giá trị đi qua formatAuditValue: boolean -> Active/Locked, enum ->
  // chữ thường hoa đầu, ISO datetime -> giờ + ngày, object -> liệt kê gọn.
  const renderValue = (key, val) => {
    const formatted = formatAuditValue(key, val);
    if (formatted === null) return <span className="text-slate-500 italic">Not set</span>;
    return formatted;
  };

  const formattedDate = timestamp 
    ? format(new Date(timestamp), 'HH:mm - yyyy-MM-dd')
    : 'Recently';

  return (
    <div className={cn("bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-5 text-slate-100", className)}>
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-400">
              <FileDiff className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-100 tracking-tight">
                  {getActionLabel(action)}
                </h3>
                <span className={cn("inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-bold rounded-full border", currentSeverity.bg)}>
                  <SeverityIcon className="w-3.5 h-3.5" />
                  {currentSeverity.label}
                </span>
              </div>
              {summary && (
                <p className="text-xs text-slate-400 mt-0.5">
                  {summary}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* View Mode Toggle — only rendered when there's an unchanged field to hide/show */}
        {hasUnchangedFields && (
          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <button
              type="button"
              onClick={() => setShowUnchanged(!showUnchanged)}
              className="text-xs px-3.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-slate-300 font-semibold transition-colors cursor-pointer"
            >
              {showUnchanged ? 'Hide Unchanged Fields' : 'Show All Fields'}
            </button>
          </div>
        )}
      </div>

      {/* 3 Metadata Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-950/70 p-3.5 rounded-xl border border-slate-800/80 text-xs">
        <div className="space-y-1">
          <span className="text-slate-400 font-medium flex items-center gap-1.5 text-[11px]">
            <User className="w-3.5 h-3.5 text-indigo-400" /> Changed By
          </span>
          <p className="font-bold text-slate-100 truncate">
            {user?.full_name || user?.email || 'System User'}
          </p>
        </div>

        <div className="space-y-1">
          <span className="text-slate-400 font-medium flex items-center gap-1.5 text-[11px]">
            <Clock className="w-3.5 h-3.5 text-emerald-400" /> Date &amp; Time
          </span>
          <p className="font-semibold text-slate-200">
            {formattedDate}
          </p>
        </div>

        <div className="space-y-1">
          <span className="text-slate-400 font-medium flex items-center gap-1.5 text-[11px]">
            <Globe className="w-3.5 h-3.5 text-purple-400" /> Access IP
          </span>
          <p className="font-mono text-slate-300 truncate">
            {ipAddress || 'Internal / Celery'}
          </p>
        </div>
      </div>

      {/* Comparison Diff Table (Synchronized 12-Column Grid Header & Body) */}
      <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
        {/* Table Header: Exactly matching 12-column grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-slate-800/90 px-3.5 py-3 border-b border-slate-800 text-xs font-bold items-center">
          <div className="md:col-span-4 text-slate-200">Field Changed</div>
          <div className="md:col-span-4 text-rose-400">Before Change (Old)</div>
          <div className="hidden md:block md:col-span-1 text-center text-slate-500">➔</div>
          <div className="md:col-span-3 text-emerald-400">After Change (New)</div>
        </div>

        {/* Table Body: Exactly matching 12-column grid */}
        {filteredItems.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No data changes recorded or all fields are identical.
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60 text-xs">
            {filteredItems.map(({ key, oldVal, newVal, status }) => {
              const statusBg = {
                modified: 'bg-amber-500/5 hover:bg-amber-500/10',
                added: 'bg-emerald-500/5 hover:bg-emerald-500/10',
                removed: 'bg-rose-500/5 hover:bg-rose-500/10',
                unchanged: 'hover:bg-slate-800/40',
              }[status];

              // Field không đổi thì 2 ô hiện trung tính (không đỏ/gạch
              // ngang, không xanh) — tô màu "đã xóa / đã thêm" cho giá trị
              // y hệt nhau khiến người đọc tưởng có thay đổi.
              const isUnchanged = status === 'unchanged';
              const oldCellClass = isUnchanged
                ? 'bg-slate-800/30 border-slate-700/40 text-slate-400'
                : 'bg-rose-950/30 border-rose-900/40 text-rose-300/90 line-through';
              const newCellClass = isUnchanged
                ? 'bg-slate-800/30 border-slate-700/40 text-slate-300'
                : 'bg-emerald-950/30 border-emerald-900/40 text-emerald-300';

              return (
                <div key={key} className={cn("grid grid-cols-1 md:grid-cols-12 gap-3 p-3.5 items-center transition-colors", statusBg)}>
                  {/* Key Name Column (col-span-4) */}
                  <div className="md:col-span-4 flex items-center gap-2 font-sans">
                    <span className="font-bold text-slate-200">{getFieldLabel(key)}</span>
                    {status === 'modified' && <span className="px-1.5 py-0.5 text-[10px] bg-amber-500/20 text-amber-300 font-bold rounded">Modified</span>}
                    {status === 'added' && <span className="px-1.5 py-0.5 text-[10px] bg-emerald-500/20 text-emerald-300 font-bold rounded">Added</span>}
                    {status === 'removed' && <span className="px-1.5 py-0.5 text-[10px] bg-rose-500/20 text-rose-300 font-bold rounded">Removed</span>}
                    {isUnchanged && <span className="px-1.5 py-0.5 text-[10px] bg-slate-700/50 text-slate-400 font-bold rounded">Unchanged</span>}
                  </div>

                  {/* Old Value Column (col-span-4) */}
                  <div className={cn('md:col-span-4 p-2 rounded-lg border break-words font-semibold', oldCellClass)}>
                    {renderValue(key, oldVal)}
                  </div>

                  {/* Arrow Column (col-span-1) */}
                  <div className="hidden md:flex md:col-span-1 justify-center">
                    <ArrowRight className={cn('w-4 h-4', isUnchanged ? 'text-slate-700' : 'text-slate-400')} />
                  </div>

                  {/* New Value Column (col-span-3) */}
                  <div className={cn('md:col-span-3 p-2 rounded-lg border break-words font-semibold', newCellClass)}>
                    {renderValue(key, newVal)}
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
