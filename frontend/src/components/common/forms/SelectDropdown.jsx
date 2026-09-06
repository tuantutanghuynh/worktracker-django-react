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
 * - theme ('dark' | 'light'): visual theme, default 'dark' (original look,
 *   unchanged for every existing caller). Pass 'light' to render on a
 *   white/light-card background (e.g. QuickLogWorkFormCard's light variant).
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
  containerClassName,
  theme = 'dark'
}) {
  const isLight = theme === 'light';
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef(null);

  const selectedOption = options.find(o => String(o.value) === String(value));

  const [openUpward, setOpenUpward] = useState(false);
  const menuRef = useRef(null);

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

  // Tìm khối cha gần nhất có thể cuộn dọc (thân modal, panel, ...).
  // null nghĩa là dropdown nằm thẳng trên trang, không có khối cuộn nào.
  const timKhoiCuon = (el) => {
    for (let p = el?.parentElement; p && p !== document.body; p = p.parentElement) {
      const overflowY = window.getComputedStyle(p).overflowY;
      if (overflowY === 'auto' || overflowY === 'scroll') return p;
    }
    return null;
  };

  // Tự động tính toán hướng mở.
  //
  // Khi dropdown nằm trong một khối cuộn được (điển hình: thân modal), LUÔN mở
  // xuống dưới rồi cuộn khối đó để lộ menu ra. Lật lên trên trong modal là sai:
  // menu đè lên chính những ô nhập phía trên nó — bấm đổi Manager thì ô Name bị
  // che mất, đúng lỗi đang gặp. Menu tràn khỏi đáy khối cuộn chỉ làm khối đó
  // cuộn được thêm, không mất gì.
  //
  // Ngoài khối cuộn (trang phẳng) thì giữ nguyên cách cũ: lật lên nếu phía dưới
  // không đủ 250px mà phía trên thì đủ — ở đó cuộn không cứu được vì menu sẽ
  // nằm ngoài khung nhìn thật.
  useEffect(() => {
    if (!isOpen || !dropdownRef.current) return;

    const khoiCuon = timKhoiCuon(dropdownRef.current);
    if (khoiCuon) {
      setOpenUpward(false);
      // Đợi menu render xong mới cuộn, nếu không chiều cao đo được vẫn là 0.
      const id = requestAnimationFrame(() => {
        menuRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      });
      return () => cancelAnimationFrame(id);
    }

    const rect = dropdownRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    setOpenUpward(spaceBelow < 250 && rect.top > 250);
  }, [isOpen]);

  const stripAccents = (str) => {
    if (!str) return '';
    return String(str)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toLowerCase();
  };

  const cleanQuery = stripAccents(searchQuery.trim());
  const filteredOptions = options.filter((o) => {
    if (!cleanQuery) return true;
    return (
      stripAccents(o.label).includes(cleanQuery) ||
      stripAccents(o.badge).includes(cleanQuery) ||
      stripAccents(o.description).includes(cleanQuery)
    );
  });

  const handleSelect = (optionValue) => {
    if (onChange) onChange(optionValue);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <div ref={dropdownRef} className={cn("space-y-1.5 text-left relative w-full", containerClassName)}>
      {/* Label */}
      {label && (
        <label className={cn("block text-xs font-semibold", isLight ? "text-slate-600" : "text-slate-300")}>
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
          "w-full border rounded-lg text-xs font-medium px-3.5 py-2.5 flex items-center justify-between transition-all duration-150 cursor-pointer",
          "focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500",
          isLight ? "bg-white text-slate-900" : "bg-slate-900 text-slate-100",
          disabled
            ? isLight ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed" : "bg-slate-800/60 text-slate-500 border-slate-800 cursor-not-allowed"
            : isLight ? "border-slate-200 hover:border-slate-300" : "border-slate-700/80 hover:border-slate-600",
          error && "border-rose-500/80 focus:border-rose-500 focus:ring-rose-500/20",
          className
        )}
      >
        <div className="flex items-center gap-2 truncate">
          {LeftIcon && <LeftIcon className={cn("w-4 h-4 shrink-0", isLight ? "text-slate-400" : "text-slate-400")} />}
          {selectedOption && value !== '' ? (
            <span className={cn("truncate font-semibold", isLight ? "text-slate-900" : "text-slate-100")}>{selectedOption.label}</span>
          ) : (
            <span className={isLight ? "text-slate-400" : "text-slate-500"}>{placeholder}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          {selectedOption && value !== '' && !required && !disabled && (
            <span
              role="button"
              tabIndex={0}
              title="Clear selection"
              onClick={(e) => {
                e.stopPropagation();
                if (onChange) onChange('');
                setIsOpen(false);
                setSearchQuery('');
              }}
              className={cn(
                "p-0.5 rounded-md transition-colors hover:bg-slate-200/80 cursor-pointer",
                isLight ? "text-slate-400 hover:text-slate-700" : "text-slate-400 hover:text-slate-200"
              )}
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown className={cn("w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0", isOpen && "rotate-180")} />
        </div>
      </button>

      {/* Dropdown Menu Panel */}
      {isOpen && !disabled && (
        <div ref={menuRef} className={cn(
          "absolute left-0 right-0 z-50 border rounded-xl shadow-2xl overflow-hidden",
          openUpward ? "bottom-full mb-1 animate-slide-in-bottom" : "top-full mt-1 animate-slide-in-top",
          isLight ? "bg-white border-slate-200" : "bg-slate-900 border-slate-800"
        )}>
          {/* Optional Search Input */}
          {searchable && (
            <div className={cn("p-2 border-b", isLight ? "border-slate-100 bg-slate-50" : "border-slate-800 bg-slate-950/60")}>
              <div className="relative flex items-center">
                <Search className="w-3.5 h-3.5 absolute left-3 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search..."
                  className={cn(
                    "w-full border rounded-lg pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:border-blue-500",
                    isLight ? "bg-white border-slate-200 text-slate-900" : "bg-slate-900 border-slate-800 text-slate-100"
                  )}
                  autoFocus
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className={cn("absolute right-2 cursor-pointer", isLight ? "text-slate-400 hover:text-slate-600" : "text-slate-400 hover:text-slate-200")}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Options List */}
          <div className={cn("max-h-56 overflow-y-auto p-1 custom-scrollbar divide-y", isLight ? "divide-slate-100" : "divide-slate-800/40")}>
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
                      isSelected
                        ? isLight ? "bg-blue-50 text-blue-600 font-bold" : "bg-blue-600/15 text-blue-400 font-bold"
                        : isLight ? "text-slate-700 hover:bg-slate-50" : "text-slate-200 hover:bg-slate-800/80",
                      opt.disabled && "opacity-40 cursor-not-allowed hover:bg-transparent"
                    )}
                  >
                    <div className="space-y-0.5 min-w-0 pr-2">
                      <div className="flex items-center gap-2">
                        <span className="truncate">{opt.label}</span>
                        {opt.badge && (
                          <span className={cn(
                            "px-1.5 py-0.2 text-[10px] rounded font-mono border",
                            isLight ? "bg-slate-100 text-slate-500 border-slate-200" : "bg-slate-800 text-slate-400 border-slate-700"
                          )}>
                            {opt.badge}
                          </span>
                        )}
                      </div>
                      {opt.description && (
                        <p className={cn("text-[11px] truncate", isLight ? "text-slate-500" : "text-slate-400")}>
                          {opt.description}
                        </p>
                      )}
                    </div>
                    {isSelected && <Check className={cn("w-4 h-4 shrink-0", isLight ? "text-blue-600" : "text-blue-400")} />}
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
