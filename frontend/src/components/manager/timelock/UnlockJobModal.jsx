import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import BaseModal from '../../common/modal/BaseModal';

const unlockJobSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(5, 'Unlock audit reason must be at least 5 characters')
    .max(500, 'Reason must be less than 500 characters'),
});

export default function UnlockJobModal({
  isOpen,
  onClose,
  target,
  onConfirm,
  isPending = false,
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(unlockJobSchema),
    defaultValues: {
      reason: '',
    },
  });

  useEffect(() => {
    if (isOpen) {
      reset({ reason: '' });
    }
  }, [isOpen, reset]);

  const handleFormSubmit = (data) => {
    onConfirm(data.reason);
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Unlock Time Period"
      description="Audit reason is required for security and compliance tracking."
      footer={
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit(handleFormSubmit)}
            disabled={isPending}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs shadow-md shadow-amber-500/20 cursor-pointer disabled:opacity-50 transition"
          >
            {isPending ? 'Unlocking...' : 'Confirm Unlock'}
          </button>
        </div>
      }
    >
      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4 text-xs">
        <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100 text-xs text-indigo-900 space-y-1">
          <p>
            Project: <strong>{target?.job_code} — {target?.job_name}</strong>
          </p>
          <p>
            Period: <strong>Month {String(target?.lock_month).padStart(2, '0')} / {target?.lock_year}</strong>
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700">
            Unlock Reason (Required for Audit Log) *
          </label>
          <textarea
            rows={3}
            {...register('reason')}
            placeholder="e.g. Unlocked per manager request for retroactive work log correction..."
            className="w-full px-3 py-2 bg-slate-100 rounded-xl text-xs border border-transparent focus:border-amber-400 focus:bg-white focus:outline-none"
            autoFocus
          />
          {errors.reason && (
            <p className="text-rose-500 text-[11px] font-medium mt-1">{errors.reason.message}</p>
          )}
        </div>
      </form>
    </BaseModal>
  );
}
