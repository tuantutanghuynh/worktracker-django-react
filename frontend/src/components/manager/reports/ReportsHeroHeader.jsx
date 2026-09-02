import React from 'react';
import { BarChart3, RotateCcw, FileSpreadsheet, FileText } from 'lucide-react';
import { cn } from '../../../utils/cn';

export default function ReportsHeroHeader({
  onRefresh,
  isFetching = false,
  onExport,
  exporting = false,
}) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold text-xl shadow-lg shadow-blue-500/20 shrink-0">
          <BarChart3 className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Project Delivery &amp; Actual Effort Reports</h1>
          <p className="text-xs text-slate-500 mt-1">
            Analyze actual effort across tasks and projects for delivery tracking and data analytics export.
          </p>
        </div>
      </div>

      {/* Nút Làm mới & Xuất File Báo Cáo */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={onRefresh}
          disabled={isFetching}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold rounded-xl border border-slate-200 text-xs shadow-2xs transition cursor-pointer"
        >
          <RotateCcw className={cn('w-3.5 h-3.5 text-slate-500', isFetching && 'animate-spin')} />
          <span>Refresh</span>
        </button>

        <button
          onClick={() => onExport('XLSX')}
          disabled={exporting}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-md shadow-emerald-500/20 transition cursor-pointer disabled:opacity-50"
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-white" />
          <span>{exporting ? 'Exporting...' : 'Export Excel (.xlsx)'}</span>
        </button>

        <button
          onClick={() => onExport('PDF')}
          disabled={exporting}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow-md shadow-rose-500/20 transition cursor-pointer disabled:opacity-50"
        >
          <FileText className="w-3.5 h-3.5 text-white" />
          <span>{exporting ? 'Exporting...' : 'Export PDF'}</span>
        </button>
      </div>
    </div>
  );
}
