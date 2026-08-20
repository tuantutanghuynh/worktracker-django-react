import React, { useState, forwardRef } from 'react';
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
  className,
  containerClassName,
  ...props
}, ref) => {
  const [showPassword, setShowPassword] = useState(false);

  const isPasswordType = type === 'password';
  const inputType = isPasswordType ? (showPassword ? 'text' : 'password') : type;
  const errorMessage = typeof error === 'string' ? error : error?.message;

  return (
    <div className={cn("space-y-1.5 text-left w-full", containerClassName)}>
      {/* Label */}
      {label && (
        <label htmlFor={name} className="block text-xs font-bold text-slate-700">
          {label}
          {required && <span className="text-rose-500 ml-1">*</span>}
        </label>
      )}

      {/* Input Outer Container */}
      <div className="relative flex items-center rounded-xl shadow-2xs">
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
            disabled
              ? "bg-slate-100/90 text-slate-800 font-semibold border border-slate-200 cursor-not-allowed select-none"
              : "bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 hover:border-slate-300 focus:bg-white",
            LeftIcon ? "pl-10" : "pl-3.5",
            (isPasswordType || RightIcon) ? "pr-10" : "pr-3.5",
            errorMessage && "border-rose-400 focus:border-rose-500 focus:ring-rose-500/20",
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
            className="absolute right-3.5 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
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
              onRightIconClick && "hover:text-slate-600 transition-colors cursor-pointer"
            )}
          >
            <RightIcon className="w-4 h-4" />
          </button>
        ) : null}
      </div>

      {/* Helper text or Error message */}
      {errorMessage ? (
        <p className="text-[11px] text-rose-500 font-semibold flex items-center gap-1">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          {errorMessage}
        </p>
      ) : helperText ? (
        <p className="text-[11px] text-slate-500">
          {helperText}
        </p>
      ) : null}
    </div>
  );
});

InputField.displayName = 'InputField';

export default InputField;
