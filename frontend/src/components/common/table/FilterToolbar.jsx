// Pill-style filter toggle bar (frontend-design-system.md Mục 3). Doesn't
// know what the filters mean — caller decides labels/values/counts.
export function FilterToolbar({ filters, activeFilter, onChange }) {
    return (
        <div className="flex items-center space-x-1.5 text-xs">
            {filters.map(({ value, label }) => {
                const isActive = value === activeFilter
                return (
                    <button
                        key={value}
                        type="button"
                        onClick={() => onChange(value)}
                        className={
                            isActive
                                ? "px-3 py-1 rounded-full font-semibold bg-blue-600 text-white shadow-sm"
                                : "px-3 py-1 rounded-full font-medium text-slate-600 hover:bg-slate-200/60"
                        }
                    >
                        {label}
                    </button>
                )
            })}
        </div>
    )
}
