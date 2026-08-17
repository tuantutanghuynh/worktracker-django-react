import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../../utils/cn';

/**
 * SideDrawer - Slided-over Panel Container Component
 * 
 * Props:
 * - isOpen (boolean): controls drawer visibility
 * - onClose (function): callback on close action
 * - title (string | ReactNode): header title
 * - subtitle / description (string | ReactNode): optional header description
 * - children (ReactNode): drawer content
 * - footer (ReactNode): sticky footer action buttons
 * - size ('sm' | 'md' | 'lg' | 'xl' | 'full'): width size variant
 * - position ('right' | 'left'): slide direction
 * - showCloseButton (boolean): whether to display the X button
 */
export default function SideDrawer({
  isOpen = false,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = 'md',
  position = 'right',
  showCloseButton = true,
  className,
}) {
  // Handle ESC key press to close drawer
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && onClose) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',        // ~448px
    md: 'max-w-lg',        // ~512px
    lg: 'max-w-2xl',       // ~672px
    xl: 'max-w-4xl',       // ~896px
    full: 'max-w-full',
  };

  const slideInClass = position === 'right' ? 'animate-slide-in-right' : 'animate-slide-in-left';

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true">
      {/* Backdrop backdrop-blur */}
      <div 
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className={cn("fixed inset-y-0 flex max-w-full", position === 'right' ? 'right-0 pl-10' : 'left-0 pr-10')}>
        <div 
          className={cn(
            "w-screen bg-slate-900 border-l border-slate-800 text-slate-100 shadow-2xl flex flex-col focus:outline-none",
            sizeClasses[size] || sizeClasses.md,
            slideInClass,
            className
          )}
        >
          {/* Header */}
          {(title || showCloseButton) && (
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-slate-900/90 backdrop-blur shrink-0">
              <div>
                {title && (
                  <h2 className="text-lg font-bold text-slate-100 tracking-tight">
                    {title}
                  </h2>
                )}
                {subtitle && (
                  <p className="mt-0.5 text-xs text-slate-400">
                    {subtitle}
                  </p>
                )}
              </div>
              {showCloseButton && (
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-slate-700"
                  aria-label="Close drawer"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          )}

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
            {children}
          </div>

          {/* Footer Sticky */}
          {footer && (
            <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/95 backdrop-blur flex items-center justify-end gap-3 shrink-0">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
