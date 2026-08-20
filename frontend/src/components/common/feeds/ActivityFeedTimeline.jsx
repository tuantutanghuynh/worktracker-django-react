import React, { useState } from 'react';
import { 
  CheckCircle2, 
  Clock, 
  MessageSquare, 
  FilePlus, 
  Lock, 
  Unlock, 
  AlertCircle, 
  UserCheck, 
  Filter,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { cn } from '../../../utils/cn';
import { formatDistanceToNow } from 'date-fns';
import UserAvatar from '../avatar/UserAvatar';

/**
 * ActivityFeedTimeline - System Activity & Event Stream Timeline Component
 * 
 * Props:
 * - activities (Array): Array of activity objects:
 *     [{
 *        id, user: { full_name, avatar_url, role },
 *        eventType: 'TASK_ASSIGNED' | 'TASK_STATUS_CHANGED' | 'TASK_COMMENT' | 'TIMESHEET_LOCK' | 'REPORT_EXPORTED',
 *        title: string,
 *        description: string,
 *        timestamp: string | Date,
 *        metadata: Object (e.g. { oldStatus, newStatus, taskTitle, jobId })
 *     }]
 * - isLoading (boolean): Loading spinner state
 * - filterType (string): Current filter selected
 * - onFilterChange (function): Handler for switching filter
 * - onItemClick (function): Handler when clicking an activity card
 */
export default function ActivityFeedTimeline({
  activities = [],
  isLoading = false,
  filterType = 'ALL',
  onFilterChange,
  onItemClick,
  className
}) {
  const [selectedCategory, setSelectedCategory] = useState(filterType);

  const categories = [
    { key: 'ALL', label: 'All Activities' },
    { key: 'TASKS', label: 'Tasks' },
    { key: 'TIMESHEET', label: 'Timesheet & Lock' },
    { key: 'SYSTEM', label: 'System' },
  ];

  const handleCategoryClick = (key) => {
    setSelectedCategory(key);
    if (onFilterChange) onFilterChange(key);
  };

  // Event Config Mapping (Icons & Colors)
  const getEventConfig = (type) => {
    switch (type) {
      case 'TASK_ASSIGNED':
        return { icon: UserCheck, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' };
      case 'TASK_STATUS_CHANGED':
        return { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' };
      case 'TASK_COMMENT':
        return { icon: MessageSquare, color: 'text-indigo-400', bg: 'bg-indigo-500/10 border-indigo-500/20' };
      case 'TIMESHEET_LOCK':
        return { icon: Lock, color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' };
      case 'TIMESHEET_UNLOCK':
        return { icon: Unlock, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' };
      case 'TASK_ATTACHMENT':
        return { icon: FilePlus, color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/20' };
      default:
        return { icon: Sparkles, color: 'text-slate-400', bg: 'bg-slate-800 border-slate-700' };
    }
  };

  const filteredActivities = activities.filter((act) => {
    if (selectedCategory === 'ALL') return true;
    if (selectedCategory === 'TASKS') return act.eventType?.startsWith('TASK_');
    if (selectedCategory === 'TIMESHEET') return act.eventType?.startsWith('TIMESHEET_');
    if (selectedCategory === 'SYSTEM') return !act.eventType?.startsWith('TASK_') && !act.eventType?.startsWith('TIMESHEET_');
    return true;
  });

  return (
    <div className={cn("bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-5 text-slate-100", className)}>
      {/* Header & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            Activity Feed Stream
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time system-wide activity timeline stream
          </p>
        </div>

        {/* Filter Pill Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800 overflow-x-auto">
          {categories.map((cat) => (
            <button
              key={cat.key}
              type="button"
              onClick={() => handleCategoryClick(cat.key)}
              className={cn(
                "px-3 py-1 text-xs font-semibold rounded-md transition-all whitespace-nowrap cursor-pointer",
                selectedCategory === cat.key
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline Stream Container */}
      {isLoading ? (
        <div className="py-12 text-center text-xs text-slate-400 space-y-2">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p>Loading activity stream...</p>
        </div>
      ) : filteredActivities.length === 0 ? (
        <div className="py-12 text-center text-xs text-slate-500 bg-slate-950/40 rounded-xl border border-slate-800/80">
          No activities recorded for this filter.
        </div>
      ) : (
        <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
          {filteredActivities.map((item) => {
            const config = getEventConfig(item.eventType);
            const Icon = config.icon;
            const formattedTime = item.timestamp
              ? formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })
              : 'Recently';

            return (
              <div
                key={item.id}
                onClick={() => onItemClick && onItemClick(item)}
                className={cn(
                  "relative group transition-all cursor-pointer p-4 bg-slate-950/60 border border-slate-800/80 rounded-xl hover:border-slate-700 hover:bg-slate-800/40",
                  onItemClick && "hover:shadow-md hover:scale-[1.005]"
                )}
              >
                {/* Timeline Dot Icon */}
                <div className={cn(
                  "absolute -left-8 top-4 w-5 h-5 rounded-full border flex items-center justify-center bg-slate-900",
                  config.bg
                )}>
                  <Icon className={cn("w-3 h-3", config.color)} />
                </div>

                {/* Content Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <UserAvatar user={item.user} size="xs" />
                    <span className="text-xs font-bold text-slate-200">
                      {item.user?.full_name || 'System User'}
                    </span>
                    {item.user?.role && (
                      <span className="px-1.5 py-0.2 text-[10px] bg-slate-800 text-slate-400 rounded border border-slate-700 font-mono">
                        {item.user.role}
                      </span>
                    )}
                  </div>

                  <span className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-500" />
                    {formattedTime}
                  </span>
                </div>

                {/* Event Description */}
                <div className="mt-2 space-y-1">
                  <h4 className="text-xs font-semibold text-slate-100 group-hover:text-blue-400 transition-colors">
                    {item.title}
                  </h4>
                  {item.description && (
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {item.description}
                    </p>
                  )}
                </div>

                {/* Optional Status Change Diff Pill */}
                {item.metadata?.oldStatus && item.metadata?.newStatus && (
                  <div className="mt-3 inline-flex items-center gap-2 px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-lg text-[11px] font-mono">
                    <span className="text-slate-400">{item.metadata.oldStatus}</span>
                    <ArrowRight className="w-3 h-3 text-slate-500" />
                    <span className="text-emerald-400 font-semibold">{item.metadata.newStatus}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
