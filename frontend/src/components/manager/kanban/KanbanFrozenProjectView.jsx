import React from 'react';
import { PauseCircle } from 'lucide-react';

export default function KanbanFrozenProjectView({
  currentJob,
  availableJobs = [],
  onSwitchActiveProject,
  onReturnToJobs,
}) {
  return (
    <div className="bg-white rounded-2xl border border-rose-200/80 p-8 sm:p-12 text-center shadow-xs space-y-4 max-w-2xl mx-auto my-6">
      <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200 shadow-2xs">
        <PauseCircle className="w-7 h-7" />
      </div>
      <div className="space-y-1.5">
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800 uppercase tracking-wider">
          PROJECT FROZEN — CLIENT INACTIVE
        </span>
        <h3 className="text-base sm:text-lg font-extrabold text-slate-900">
          {currentJob?.job_name || 'Selected Project'}
        </h3>
        <p className="text-xs text-slate-600 leading-relaxed max-w-lg mx-auto">
          This project is frozen because client <strong>"{currentJob?.client?.client_name || 'Unknown'}"</strong> is deactivated by Admin. 
          Tasks in this project are frozen and hidden from the active Kanban workflow to avoid distractions.
        </p>
      </div>
      <div className="pt-3 flex items-center justify-center gap-3">
        {availableJobs.length > 0 && (
          <button
            type="button"
            onClick={onSwitchActiveProject}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-xs transition cursor-pointer"
          >
            Switch to Active Project
          </button>
        )}
        <button
          type="button"
          onClick={onReturnToJobs}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
        >
          Return to My Projects
        </button>
      </div>
    </div>
  );
}
