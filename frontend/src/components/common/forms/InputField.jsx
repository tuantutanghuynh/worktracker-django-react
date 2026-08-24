import { useState, forwardRef } from 'react';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';
import { cn } from '../../../utils/cn';

/**
 * InputField - Reusable Form Input Component
 * 
 * Props:
 * - label (string): Label text for input
 * - name (string): Field name
 * - type (string): 'text' | 'password' | 'email' | 'number' | 'date' | 'time' | etc.
 * - error (string | object): Error message string or object
 * - helperText (string): Subtle description text below input
 * - leftIcon (LucideIcon): Icon component rendered on the left
 * - rightIcon (LucideIcon): Icon component rendered on the right
 * - onRightIconClick (function): Action when right icon is clicked
 * - required (boolean): Red asterisk indicator
 * - disabled (boolean): Disabled state styling
 * - theme ('light' | 'dark'): 'light' (default) for the white BaseModal/page
 *   forms used across Admin; 'dark' keeps the original slate-900 look for
 *   components rendered inside a dark container (e.g. QuickLogWorkFormCard).
 */
const InputField = forwardRef(({
  label,
  name,
  type = 'text',
  placeholder,
  error,
  helperText,
  leftIcon: LeftIcon,
  rightIcon: RightIcon,
  onRightIconClick,
  required = false,
  disabled = false,
  theme = 'light',
  className,
  containerClassName,
  ...props
}, ref) => {
  const [showPassword, setShowPassword] = useState(false);

  const isPasswordType = type === 'password';
  const inputType = isPasswordType ? (showPassword ? 'text' : 'password') : type;
  const errorMessage = typeof error === 'string' ? error : error?.message;
  const isDark = theme === 'dark';

  return (
    <div className={cn("space-y-1.5 text-left w-full", containerClassName)}>
      {/* Label */}
      {label && (
        <label
          htmlFor={name}
          className={cn("block text-xs font-bold", isDark ? "text-slate-300" : "text-slate-700")}
        >
          {label}
          {required && <span className="text-rose-500 ml-1">*</span>}
        </label>
      )}

      {/* Input Outer Container */}
      <div className={cn("relative flex items-center rounded-xl", isDark ? "" : "shadow-2xs")}>
        {/* Left Icon */}
        {LeftIcon && (
          <div className="absolute left-3.5 pointer-events-none text-slate-400">
            <LeftIcon className="w-4 h-4" />
          </div>
        )}

        {/* Input Element */}
        <input
          ref={ref}
          id={name}
          name={name}
          type={inputType}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            "w-full rounded-xl text-xs font-medium transition-all duration-150 py-2.5",
            "focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500",
            isDark
              ? cn(
                  "bg-slate-900 border text-slate-100 placeholder-slate-500",
                  disabled ? "bg-slate-800/60 text-slate-500 border-slate-800 cursor-not-allowed" : "border-slate-700/80 hover:border-slate-600"
                )
              : disabled
                ? "bg-slate-100/90 text-slate-800 font-semibold border border-slate-200 cursor-not-allowed select-none"
                : "bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 hover:border-slate-300 focus:bg-white",
            LeftIcon ? "pl-10" : "pl-3.5",
            (isPasswordType || RightIcon) ? "pr-10" : "pr-3.5",
            errorMessage && (isDark ? "border-rose-500/80 focus:border-rose-500 focus:ring-rose-500/20" : "border-rose-400 focus:border-rose-500 focus:ring-rose-500/20"),
            className
          )}
          {...props}
        />

        {/* Right Icon / Password Toggle Button */}
        {isPasswordType ? (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            tabIndex={-1}
            className={cn("absolute right-3.5 transition-colors cursor-pointer", isDark ? "text-slate-400 hover:text-slate-200" : "text-slate-400 hover:text-slate-600")}
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        ) : RightIcon ? (
          <button
            type="button"
            onClick={onRightIconClick}
            disabled={!onRightIconClick}
            className={cn(
              "absolute right-3.5 text-slate-400",
              onRightIconClick && (isDark ? "hover:text-slate-200 transition-colors cursor-pointer" : "hover:text-slate-600 transition-colors cursor-pointer")
            )}
          >
            <RightIcon className="w-4 h-4" />
          </button>
        ) : null}
      </div>

      {/* Helper text or Error message */}
      {errorMessage ? (
        <p className={cn("text-[11px] font-semibold flex items-center gap-1", isDark ? "text-rose-400" : "text-rose-500")}>
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          {errorMessage}
        </p>
      ) : helperText ? (
        <p className={cn("text-[11px]", isDark ? "text-slate-400" : "text-slate-500")}>
          {helperText}
        </p>
      ) : null}
    </div>
  );
});

InputField.displayName = 'InputField';

export default InputField;
