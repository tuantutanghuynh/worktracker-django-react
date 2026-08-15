import React from 'react';
import { cn } from '../../../utils/cn';

const INTENSITY_STYLES = [
  'bg-slate-100 border border-slate-200/50',
  'bg-emerald-200 border border-emerald-300',
  'bg-emerald-400 border border-emerald-500',
  'bg-emerald-600 border border-emerald-700',
  'bg-emerald-800 border border-emerald-900',
];

function getIntensityLevel(hours) {
  if (hours <= 0) return 0;
  if (hours <= 2) return 1;
  if (hours <= 4) return 2;
  if (hours <= 6) return 3;
  return 4;
}

export default function ProductivityHeatmap({ title = 'Team Weekly Productivity', data = [] }) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs flex flex-col justify-between">
      <div>
        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
          {title}
        </h3>

        {data.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            No productivity records logged in this period.
          </div>
        ) : (
          <div className="space-y-2 max-h-[190px] overflow-y-auto pr-1 custom-scrollbar">
            {data.map((row) => (
              <div key={row.label} className="flex items-center gap-2">
                <span className="w-20 shrink-0 truncate text-[10px] font-semibold text-slate-700">
                  {row.label}
                </span>
                <div className="flex gap-1 flex-wrap">
                  {row.cells.map((cell, idx) => (
                    <span
                      key={idx}
                      title={`${cell.date}: ${cell.hours}h`}
                      className={cn(
                        'h-4 w-3 rounded-xs transition-transform hover:scale-125 cursor-pointer',
                        INTENSITY_STYLES[getIntensityLevel(cell.hours)]
                      )}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-[9px] font-medium text-slate-500">
        <span className="text-[10px] font-semibold text-slate-400">Hours:</span>
        <div className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-xs bg-slate-100 border border-slate-300" />
          <span>0h</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-xs bg-emerald-200" />
          <span>1-2h</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-xs bg-emerald-400" />
          <span>2-4h</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-xs bg-emerald-600" />
          <span>4-6h</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-xs bg-emerald-800" />
          <span>6h+</span>
        </div>
      </div>
    </div>
  );
}