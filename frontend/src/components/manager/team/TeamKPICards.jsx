import React from 'react';
import { Users, AlertTriangle, CheckCircle2, Zap } from 'lucide-react';

export default function TeamKPICards({
  kpis = { total: 0, overloaded: 0, balanced: 0, available: 0 },
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Members</span>
          <Users className="w-4 h-4 text-blue-600" />
        </div>
        <div className="flex items-baseline justify-between pt-0.5">
          <span className="text-2xl font-extrabold text-slate-900">{kpis.total}</span>
          <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200/60">
            Total Staff
          </span>
        </div>
      </div>

      <div className="bg-rose-50/40 p-4 rounded-2xl border border-rose-100 shadow-2xs space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-rose-700 uppercase tracking-wider">Overloaded</span>
          <AlertTriangle className="w-4 h-4 text-rose-600" />
        </div>
        <div className="flex items-baseline justify-between pt-0.5">
          <span className="text-2xl font-extrabold text-rose-900">{kpis.overloaded}</span>
          <span className="text-[10px] font-extrabold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full border border-rose-200/60">
            &gt;100% Load
          </span>
        </div>
      </div>

      <div className="bg-amber-50/40 p-4 rounded-2xl border border-amber-100 shadow-2xs space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">Balanced</span>
          <CheckCircle2 className="w-4 h-4 text-amber-600" />
        </div>
        <div className="flex items-baseline justify-between pt-0.5">
          <span className="text-2xl font-extrabold text-amber-900">{kpis.balanced}</span>
          <span className="text-[10px] font-extrabold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-200/60">
            Optimal (50–100%)
          </span>
        </div>
      </div>

      <div className="bg-emerald-50/40 p-4 rounded-2xl border border-emerald-100 shadow-2xs space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Available</span>
          <Zap className="w-4 h-4 text-emerald-600" />
        </div>
        <div className="flex items-baseline justify-between pt-0.5">
          <span className="text-2xl font-extrabold text-emerald-900">{kpis.available}</span>
          <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200/60">
            Ready to Assign
          </span>
        </div>
      </div>
    </div>
  );
}
