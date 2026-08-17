import { forwardRef } from 'react';
import clsx from 'clsx';

const SelectDropdown = forwardRef(function SelectDropdown(
  { label, error, options = [], placeholder = 'Select...', className, ...props },
  ref
) {
  return (
    <div className="space-y-1">
      {label && <label className="text-xs font-semibold text-slate-700">{label}</label>}
      <select
        ref={ref}
        className={clsx(
          'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30',
          error && 'border-rose-400 focus:ring-rose-400/30',
          className
        )}
        {...props}
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className="text-[11px] text-rose-500">{error}</p>}
    </div>
  );
});

export default SelectDropdown;
