import React, { useState, useEffect } from 'react';
import { FileText, CheckCircle2 } from 'lucide-react';
import BaseModal from './BaseModal';
import { cn } from '../../../utils/cn';

const VARIANT_STYLES = {
  danger: {
    btnConfirm: 'bg-rose-600 hover:bg-rose-700 text-white focus:ring-rose-500',
  },
  warning: {
    btnConfirm: 'bg-amber-600 hover:bg-amber-700 text-white focus:ring-amber-500',
  },
  primary: {
    btnConfirm: 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500',
  },
  success: {
    btnConfirm: 'bg-emerald-600 hover:bg-emerald-700 text-white focus:ring-emerald-500',
  },
};

/**
 * PromptReasonModal - Modal Xác nhận KÈM Ô NHẬP LÝ DO (Textarea)
 */
export default function PromptReasonModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Reason Required',
  description = 'Please provide a detailed reason for this action.',
  placeholder = 'Type your reason here...',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  isLoading = false,
}) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setReason('');
      setError('');
    }
  }, [isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Reason statement is required.');
      return;
    }
    setError('');
    onConfirm(reason.trim());
  };

  const currentVariant = VARIANT_STYLES[variant] || VARIANT_STYLES.danger;

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title={title} description={description}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-slate-400" />
            <span>
              Reason Statement <span className="text-rose-500">*</span>
            </span>
          </label>
          <textarea
            rows={3}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (error) setError('');
            }}
            placeholder={placeholder}
            disabled={isLoading}
            className={cn(
              'w-full p-3 rounded-xl border text-xs font-medium text-slate-800 focus:outline-none transition-all placeholder:text-slate-400 resize-none',
              error
                ? 'border-rose-400 bg-rose-50/30 focus:ring-2 focus:ring-rose-500/20'
                : 'border-slate-200 bg-slate-50/50 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20'
            )}
          />
          {error && <p className="text-[11px] font-medium text-rose-500 mt-1">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
          >
            {cancelText}
          </button>

          <button
            type="submit"
            disabled={isLoading || !reason.trim()}
            className={cn(
              'px-4 py-2 text-xs font-semibold rounded-xl transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-50 cursor-pointer',
              currentVariant.btnConfirm
            )}
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            <span>{confirmText}</span>
          </button>
        </div>
      </form>
    </BaseModal>
  );
}