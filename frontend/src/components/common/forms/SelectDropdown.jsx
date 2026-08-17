import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, Check, AlertCircle, X } from 'lucide-react';
import { cn } from '../../../utils/cn';

/**
 * SelectDropdown - Custom Select Dropdown Component
 * 
 * Props:
 * - label (string): Dropdown label
 * - options (Array): [{ value, label, badge, description, disabled }]
 * - value (string | number): Selected option value
 * - onChange (function): Callback (value) => void
 * - placeholder (string): Default unselected prompt
 * - error (string): Error text
 * - searchable (boolean): Include inline search filter input
 * - disabled (boolean): Disabled state
 * - required (boolean): Required field indicator
 * - leftIcon (LucideIcon): Optional icon on the trigger button
 */
export default function SelectDropdown({
  label,
  options = [],
  value,
  onChange,
  placeholder = '-- Select option --',
  error,
  searchable = false,
  disabled = false,
  required = false,
  leftIcon: LeftIcon,
  className,
  containerClassName
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef(null);

  const selectedOption = options.find(o => String(o.value) === String(value));

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter(o => 
    o.label?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    o.badge?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelect = (optionValue) => {
    if (onChange) onChange(optionValue);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <div ref={dropdownRef} className={cn("space-y-1.5 text-left relative w-full", containerClassName)}>
      {/* Label */}
      {label && (
        <label className="block text-xs font-semibold text-slate-300">
          {label}
          {required && <span className="text-rose-500 ml-1">*</span>}
        </label>
      )}

      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full bg-slate-900 border text-slate-100 rounded-lg text-xs font-medium px-3.5 py-2.5 flex items-center justify-between transition-all duration-150 cursor-pointer",
          "focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500",
          disabled ? "bg-slate-800/60 text-slate-500 border-slate-800 cursor-not-allowed" : "border-slate-700/80 hover:border-slate-600",
          error && "border-rose-500/80 focus:border-rose-500 focus:ring-rose-500/20",
          className
        )}
      >
        <div className="flex items-center gap-2 truncate">
          {LeftIcon && <LeftIcon className="w-4 h-4 text-slate-400 shrink-0" />}
          {selectedOption ? (
            <span className="truncate text-slate-100 font-semibold">{selectedOption.label}</span>
          ) : (
            <span className="text-slate-500">{placeholder}</span>
          )}
        </div>
        <ChevronDown className={cn("w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0", isOpen && "rotate-180")} />
      </button>

      {/* Dropdown Menu Panel */}
      {isOpen && !disabled && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden animate-slide-in-top">
          {/* Optional Search Input */}
          {searchable && (
            <div className="p-2 border-b border-slate-800 bg-slate-950/60">
              <div className="relative flex items-center">
                <Search className="w-3.5 h-3.5 absolute left-3 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                  autoFocus
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Options List */}
          <div className="max-h-56 overflow-y-auto divide-y divide-slate-800/40 p-1 custom-scrollbar">
            {filteredOptions.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500">
                No options found
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = String(opt.value) === String(value);

                return (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={opt.disabled}
                    onClick={() => handleSelect(opt.value)}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-lg text-xs transition-colors flex items-center justify-between group cursor-pointer",
                      isSelected ? "bg-blue-600/15 text-blue-400 font-bold" : "text-slate-200 hover:bg-slate-800/80",
                      opt.disabled && "opacity-40 cursor-not-allowed hover:bg-transparent"
                    )}
                  >
                    <div className="space-y-0.5 min-w-0 pr-2">
                      <div className="flex items-center gap-2">
                        <span className="truncate">{opt.label}</span>
                        {opt.badge && (
                          <span className="px-1.5 py-0.2 text-[10px] bg-slate-800 text-slate-400 rounded font-mono border border-slate-700">
                            {opt.badge}
                          </span>
                        )}
                      </div>
                      {opt.description && (
                        <p className="text-[11px] text-slate-400 truncate">
                          {opt.description}
                        </p>
                      )}
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-blue-400 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <p className="text-[11px] text-rose-400 font-medium flex items-center gap-1">
          <AlertCircle className="w-3 h-3 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
