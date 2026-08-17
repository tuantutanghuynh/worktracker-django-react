import { forwardRef } from 'react';
import clsx from 'clsx';

const InputField = forwardRef(function InputField(
  { label, error, className, ...props },
  ref
) {
  return (
    <div className="space-y-1">
      {label && <label className="text-xs font-semibold text-slate-700">{label}</label>}
      <input
        ref={ref}
        className={clsx(
          'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30',
          error && 'border-rose-400 focus:ring-rose-400/30',
          className
        )}
        {...props}
      />
      {error && <p className="text-[11px] text-rose-500">{error}</p>}
    </div>
  );
});

export default InputField;
