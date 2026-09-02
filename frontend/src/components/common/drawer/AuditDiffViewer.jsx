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
import { format, parseISO } from 'date-fns';
import {
  getActionLabel,
  getFieldLabel,
  isHiddenField,
  formatAuditValue,
  summarizeLog,
} from '../../../utils/auditLabels';

/**
 * AuditDiffViewer - Audit Log Snapshot Comparison Component
 * Perfectly aligned 12-column grid layout with automatic date-fns ISO string formatting
 *
 * Supports polymorphic inputs: Can receive either a single `log` object OR individual props.
 * theme ('dark' | 'light'): visual theme, default 'dark'.
 */
export default function AuditDiffViewer({
  log,
  oldValues: propOldValues,
  newValues: propNewValues,
  action: propAction,
  timestamp: propTimestamp,
  user: propUser,
  severity: propSeverity,
  ipAddress: propIpAddress,
  summary: propSummary,
  theme = 'dark',
  className
}) {
  const [showUnchanged, setShowUnchanged] = useState(false);
  const isLight = theme === 'light';

  // Normalize data whether passed via `log` object or discrete props
  const oldValues = log?.old_values !== undefined ? log.old_values : propOldValues || {};
  const newValues = log?.new_values !== undefined ? log.new_values : propNewValues || {};
  const action = log?.action || propAction || 'UPDATE_RECORD';
  const timestamp = log?.created_at || propTimestamp;
  const rawUser = log?.actor_name || log?.actor_email || propUser;
  const severity = log?.severity || propSeverity || 'NORMAL';
  const ipAddress = log?.ip_address || propIpAddress;
  const summary = (log ? summarizeLog(log) : null) || propSummary;

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

  // Bỏ các cột thuần kỹ thuật (id, created_at, password...) — Admin/Manager không cần đối chiếu
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

  const severityConfigs = isLight
    ? {
        CRITICAL: { label: 'Critical', bg: 'bg-rose-50 text-rose-600 border-rose-200', icon: AlertTriangle },
        WARNING: { label: 'Warning', bg: 'bg-amber-50 text-amber-600 border-amber-200', icon: Info },
        NORMAL: { label: 'Normal', bg: 'bg-emerald-50 text-emerald-600 border-emerald-200', icon: CheckCircle2 },
      }
    : {
        CRITICAL: { label: 'Critical', bg: 'bg-rose-500/10 text-rose-400 border-rose-500/30', icon: AlertTriangle },
        WARNING: { label: 'Warning', bg: 'bg-amber-500/10 text-amber-400 border-amber-500/30', icon: Info },
        NORMAL: { label: 'Normal', bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30', icon: CheckCircle2 },
      };

  const currentSeverity = severityConfigs[severity] || severityConfigs.NORMAL;
  const SeverityIcon = currentSeverity.icon;

  // Mọi giá trị đi qua formatAuditValue: boolean -> Active/Locked, enum -> chữ thường hoa đầu, ISO datetime -> giờ + ngày
  const renderValue = (key, val) => {
    const formatted = formatAuditValue(key, val);
    if (formatted === null) return <span className={cn('italic', isLight ? 'text-slate-400' : 'text-slate-500')}>Not set</span>;
    return formatted;
  };

  const formattedDate = timestamp
    ? (() => {
        try {
          const d = typeof timestamp === 'string' ? parseISO(timestamp) : new Date(timestamp);
          return format(d, 'HH:mm:ss - dd/MM/yyyy');
        } catch {
          return String(timestamp);
        }
      })()
    : 'Recently';

  const userDisplayName = typeof rawUser === 'object'
    ? rawUser?.full_name || rawUser?.email || 'System User'
    : rawUser || 'System User';

  return (
    <div
      className={cn(
        'border rounded-xl p-5 space-y-5',
        isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-slate-900 border-slate-800 text-slate-100',
        className
      )}
    >
      {/* Header Bar */}
      <div className={cn('flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b', isLight ? 'border-slate-100' : 'border-slate-800')}>
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className={cn('p-2 rounded-lg border', isLight ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400')}>
              <FileDiff className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className={cn('text-base font-bold tracking-tight', isLight ? 'text-slate-900' : 'text-slate-100')}>
                  {getActionLabel(action)}
                </h3>
                <span className={cn('inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-bold rounded-full border', currentSeverity.bg)}>
                  <SeverityIcon className="w-3.5 h-3.5" />
                  {currentSeverity.label}
                </span>
              </div>
              {summary && (
                <p className={cn('text-xs mt-0.5', isLight ? 'text-slate-500' : 'text-slate-400')}>
                  {summary}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          <button
            type="button"
            onClick={() => setShowUnchanged(!showUnchanged)}
            className={cn(
              'text-xs px-3.5 py-1.5 rounded-lg border font-semibold transition-colors cursor-pointer',
              isLight
                ? 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600'
                : 'border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-slate-300'
            )}
          >
            {showUnchanged ? 'Hide Unchanged Fields' : 'Show All Fields'}
          </button>
        </div>
      </div>

      {/* 3 Metadata Cards */}
      <div className={cn(
        'grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl border text-xs',
        isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/70 border-slate-800/80'
      )}>
        <div className="space-y-1">
          <span className={cn('font-medium flex items-center gap-1.5 text-[11px]', isLight ? 'text-slate-500' : 'text-slate-400')}>
            <User className={cn('w-3.5 h-3.5', isLight ? 'text-indigo-500' : 'text-indigo-400')} /> Changed By
          </span>
          <p className={cn('font-bold truncate', isLight ? 'text-slate-900' : 'text-slate-100')}>
            {userDisplayName}
          </p>
        </div>

        <div className="space-y-1">
          <span className={cn('font-medium flex items-center gap-1.5 text-[11px]', isLight ? 'text-slate-500' : 'text-slate-400')}>
            <Clock className={cn('w-3.5 h-3.5', isLight ? 'text-emerald-500' : 'text-emerald-400')} /> Date &amp; Time
          </span>
          <p className={cn('font-semibold', isLight ? 'text-slate-800' : 'text-slate-200')}>
            {formattedDate}
          </p>
        </div>

        <div className="space-y-1">
          <span className={cn('font-medium flex items-center gap-1.5 text-[11px]', isLight ? 'text-slate-500' : 'text-slate-400')}>
            <Globe className={cn('w-3.5 h-3.5', isLight ? 'text-purple-500' : 'text-purple-400')} /> Access IP
          </span>
          <p className={cn('font-mono truncate', isLight ? 'text-slate-600' : 'text-slate-300')}>
            {ipAddress || 'Internal / Celery'}
          </p>
        </div>
      </div>

      {/* Comparison Diff Table (Synchronized 12-Column Grid Header & Body) */}
      <div className={cn('border rounded-xl overflow-hidden', isLight ? 'border-slate-200 bg-white' : 'border-slate-800 bg-slate-950/40')}>
        {/* Table Header */}
        <div className={cn(
          'grid grid-cols-1 md:grid-cols-12 gap-3 px-3.5 py-3 border-b text-xs font-bold items-center',
          isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-800/90 border-slate-800'
        )}>
          <div className={cn('md:col-span-4', isLight ? 'text-slate-700' : 'text-slate-200')}>Field Changed</div>
          <div className={isLight ? 'md:col-span-4 text-rose-600' : 'md:col-span-4 text-rose-400'}>Before Change (Old)</div>
          <div className={cn('hidden md:block md:col-span-1 text-center', isLight ? 'text-slate-400' : 'text-slate-500')}>➔</div>
          <div className={isLight ? 'md:col-span-3 text-emerald-600' : 'md:col-span-3 text-emerald-400'}>After Change (New)</div>
        </div>

        {/* Table Body */}
        {filteredItems.length === 0 ? (
          <div className={cn('p-8 text-center text-xs', isLight ? 'text-slate-400' : 'text-slate-500')}>
            No data changes recorded or all fields are identical.
          </div>
        ) : (
          <div className={cn('divide-y text-xs', isLight ? 'divide-slate-100' : 'divide-slate-800/60')}>
            {filteredItems.map(({ key, oldVal, newVal, status }) => {
              const statusBg = isLight
                ? {
                    modified: 'bg-amber-50/60 hover:bg-amber-50',
                    added: 'bg-emerald-50/60 hover:bg-emerald-50',
                    removed: 'bg-rose-50/60 hover:bg-rose-50',
                    unchanged: 'hover:bg-slate-50',
                  }[status]
                : {
                    modified: 'bg-amber-500/5 hover:bg-amber-500/10',
                    added: 'bg-emerald-500/5 hover:bg-emerald-500/10',
                    removed: 'bg-rose-500/5 hover:bg-rose-500/10',
                    unchanged: 'hover:bg-slate-800/40',
                  }[status];

              const isUnchanged = status === 'unchanged';
              const oldCellClass = isLight
                ? (isUnchanged ? 'bg-slate-50 border-slate-200 text-slate-400' : 'bg-rose-50 border-rose-200 text-rose-500 line-through')
                : (isUnchanged ? 'bg-slate-800/30 border-slate-700/40 text-slate-400' : 'bg-rose-950/30 border-rose-900/40 text-rose-300/90 line-through');
              const newCellClass = isLight
                ? (isUnchanged ? 'bg-slate-50 border-slate-200 text-slate-600' : 'bg-emerald-50 border-emerald-200 text-emerald-700')
                : (isUnchanged ? 'bg-slate-800/30 border-slate-700/40 text-slate-300' : 'bg-emerald-950/30 border-emerald-900/40 text-emerald-300');
              const badgeClass = isLight
                ? {
                    modified: 'bg-amber-100 text-amber-700',
                    added: 'bg-emerald-100 text-emerald-700',
                    removed: 'bg-rose-100 text-rose-700',
                    unchanged: 'bg-slate-100 text-slate-500',
                  }
                : {
                    modified: 'bg-amber-500/20 text-amber-300',
                    added: 'bg-emerald-500/20 text-emerald-300',
                    removed: 'bg-rose-500/20 text-rose-300',
                    unchanged: 'bg-slate-700/50 text-slate-400',
                  };

              return (
                <div key={key} className={cn("grid grid-cols-1 md:grid-cols-12 gap-3 p-3.5 items-center transition-colors", statusBg)}>
                  {/* Key Name Column (col-span-4) */}
                  <div className="md:col-span-4 flex items-center gap-2 font-sans">
                    <span className={cn('font-bold', isLight ? 'text-slate-800' : 'text-slate-200')}>{getFieldLabel(key)}</span>
                    {status === 'modified' && <span className={cn('px-1.5 py-0.5 text-[10px] font-bold rounded', badgeClass.modified)}>Modified</span>}
                    {status === 'added' && <span className={cn('px-1.5 py-0.5 text-[10px] font-bold rounded', badgeClass.added)}>Added</span>}
                    {status === 'removed' && <span className={cn('px-1.5 py-0.5 text-[10px] font-bold rounded', badgeClass.removed)}>Removed</span>}
                    {isUnchanged && <span className={cn('px-1.5 py-0.5 text-[10px] font-bold rounded', badgeClass.unchanged)}>Unchanged</span>}
                  </div>

                  {/* Old Value Column (col-span-4) */}
                  <div className={cn('md:col-span-4 p-2 rounded-lg border break-words font-semibold', oldCellClass)}>
                    {renderValue(key, oldVal)}
                  </div>

                  {/* Arrow Column (col-span-1) */}
                  <div className="hidden md:flex md:col-span-1 justify-center">
                    <ArrowRight className={cn('w-4 h-4', isUnchanged ? (isLight ? 'text-slate-300' : 'text-slate-700') : (isLight ? 'text-slate-500' : 'text-slate-400'))} />
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
