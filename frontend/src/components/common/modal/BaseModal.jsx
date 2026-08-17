import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '../../../utils/cn';

/**
 * BaseModal - Component Khung Nền tảng dùng @radix-ui/react-dialog
 */
export default function BaseModal({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidth = 'max-w-md',
}) {
  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        {/* Backdrop Overlay mờ nền */}
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200" />

        {/* Khung chứa Modal */}
        <Dialog.Content
          className={cn(
            'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[calc(100%-2rem)] bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden focus:outline-none transition-all animate-in zoom-in-95 duration-200',
            maxWidth
          )}
        >
          {/* Header Modal */}
          <div className="flex items-start justify-between p-5 border-b border-slate-100">
            <div>
              <Dialog.Title className="text-base font-bold text-slate-900 leading-snug">
                {title}
              </Dialog.Title>
              {description && (
                <Dialog.Description className="text-xs text-slate-500 mt-0.5">
                  {description}
                </Dialog.Description>
              )}
            </div>

            <Dialog.Close
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors focus:outline-none cursor-pointer"
            >
              <X className="w-4 h-4" />
            </Dialog.Close>
          </div>

          {/* Nội dung bên trong Modal */}
          <div className="p-5">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}