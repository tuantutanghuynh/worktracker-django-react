import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import BaseModal from './BaseModal';
import { cn } from '../../../utils/cn';

/**
 * ConfirmModal - Modal Hỏi Xác nhận YES / NO đơn thuần (Xóa, Lock, Logout)
 */
export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  description = 'Are you sure you want to proceed with this action?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  isLoading = false,
}) {
  const variantStyles = {
    danger: {
      btnConfirm: 'bg-rose-600 hover:bg-rose-700 text-white focus:ring-rose-500',
    },
    warning: {
      btnConfirm: 'bg-amber-600 hover:bg-amber-700 text-white focus:ring-amber-500',
    },
    primary: {
      btnConfirm: 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500',
    },
  }[variant] || variantStyles.danger;

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title={title} description={description}>
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
          type="button"
          onClick={onConfirm}
          disabled={isLoading}
          className={cn(
            'px-4 py-2 text-xs font-semibold rounded-xl transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-50 cursor-pointer',
            variantStyles.btnConfirm
          )}
        >
          {isLoading ? (
            <span>Processing...</span>
          ) : (
            <>
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{confirmText}</span>
            </>
          )}
        </button>
      </div>
    </BaseModal>
  );
}