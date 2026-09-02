import React from 'react';
import { Lock, Unlock } from 'lucide-react';

export default function TimeLockStatCards({
  kpis = { total: 0, lockedCount: 0, unlockedCount: 0 },
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div className="p-4 bg-white border border-slate-200/80 rounded-2xl space-y-1 shadow-2xs">
        <span className="text-xs font-bold text-slate-500">Your Owned Projects</span>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-extrabold text-slate-900">{kpis.total}</span>
          <span className="text-xs font-semibold text-slate-400">managed jobs</span>
        </div>
      </div>

      <div className="p-4 bg-rose-50/50 border border-rose-200/80 rounded-2xl space-y-1 shadow-2xs">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-rose-800">Locked Projects (Frozen)</span>
          <Lock className="w-4 h-4 text-rose-600" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-extrabold text-rose-900">{kpis.lockedCount}</span>
          <span className="text-xs font-semibold text-rose-700">frozen for payroll</span>
        </div>
      </div>

      <div className="p-4 bg-emerald-50/50 border border-emerald-200/80 rounded-2xl space-y-1 shadow-2xs">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-emerald-800">Open for Submissions</span>
          <Unlock className="w-4 h-4 text-emerald-600" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-extrabold text-emerald-900">{kpis.unlockedCount}</span>
          <span className="text-xs font-semibold text-emerald-700">active reporting</span>
        </div>
      </div>
    </div>
  );
}
