import clsx from 'clsx';

const INTENSITY_STYLES = [
  'bg-slate-100',
  'bg-yellow-200',
  'bg-green-300',
  'bg-green-500',
  'bg-green-700',
];
function getIntensityLevel(hours) {
  if (hours <= 0) return 0;
  if (hours <= 2) return 1;
  if (hours <= 4) return 2;
  if (hours <= 6) return 3;
  return 4;
}
export default function ProductivityHeatmap({ title, data }) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <p className="mb-2 text-sm font-medium text-slate-900">{title}</p>

      <div className="space-y-1.5">
        {data.map((row) => (
          <div key={row.label} className="flex items-center gap-2">
            <span className="w-14 shrink-0 truncate text-[9px] font-semibold text-slate-600">
              {row.label}
            </span>
            <div className="flex gap-0.5">
              {row.cells.map((cell) => (
                <span
                  key={cell.date}
                  title={`${cell.date}: ${cell.hours}h`}
                  className={clsx(
                    'h-3.5 w-2 rounded-sm',
                    INTENSITY_STYLES[getIntensityLevel(cell.hours)]
                  )}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-1.5 text-[9px] text-slate-400">
        <div className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm bg-slate-100 border border-slate-300" />
          <span>0h</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm bg-yellow-200" />
          <span>1-2h</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm bg-green-300" />
          <span>2-4h</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm bg-green-500" />
          <span>4-6h</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm bg-green-700" />
          <span>6h+</span>
        </div>
      </div>
    </div>
  );
}
