import React from 'react';
import { Briefcase } from 'lucide-react';

export default function KanbanHeader({
  activeJobId,
  onJobChange,
  availableJobs = [],
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Interactive Kanban Board</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Drag &amp; drop tasks to update workflow statuses with instant real-time sync.
        </p>
      </div>

      {/* Selected Job Filter Dropdown */}
      <div className="flex items-center gap-3 w-full sm:w-auto shrink-0">
        <div className="flex items-center gap-2 bg-white px-3.5 py-2 rounded-xl border border-slate-200 shadow-2xs w-full sm:w-auto max-w-full overflow-hidden">
          <Briefcase className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={activeJobId}
            onChange={(e) => onJobChange(e.target.value)}
            className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer w-full truncate pr-2"
          >
            {availableJobs.length === 0 ? (
              <option value="">No active projects available</option>
            ) : (
              availableJobs.map((j) => (
                <option key={j.id} value={j.id} title={`${j.job_code || `JOB-${j.id}`} - ${j.job_name}`}>
                  {j.job_code || `JOB-${j.id}`} - {j.job_name}
                </option>
              ))
            )}
          </select>
        </div>
      </div>
    </div>
  );
}
