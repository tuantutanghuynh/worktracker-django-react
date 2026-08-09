// Generic 2+ state view switcher (e.g. List vs Kanban). Doesn't know
// what the views mean — caller supplies value/label/icon per option.
export function ViewToggle({ views, activeView, onChange }) {
    return (
        <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
            {views.map(({ value, label, icon: Icon }) => {
                const isActive = value === activeView
                return (
                    <button
                        key={value}
                        type="button"
                        onClick={() => onChange(value)}
                        title={label}
                        className={
                            isActive
                                ? "flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-white text-slate-900 shadow-sm text-xs font-semibold"
                                : "flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-slate-500 hover:text-slate-700 text-xs font-medium"
                        }
                    >
                        {Icon && <Icon size={14} />}
                        <span>{label}</span>
                    </button>
                )
            })}
        </div>
    )
}
