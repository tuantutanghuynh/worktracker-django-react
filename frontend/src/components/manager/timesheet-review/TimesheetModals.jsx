import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import BaseModal from '../../common/modal/BaseModal';
import InputField from '../../common/forms/InputField';

const rejectTimesheetSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, 'Rejection reason must be at least 3 characters')
    .max(500, 'Rejection reason must be less than 500 characters'),
});

const correctTimesheetSchema = z.object({
  hours_spent: z.coerce
    .number({ invalid_type_error: 'Please enter a valid number of hours' })
    .min(0.1, 'Hours must be at least 0.1')
    .max(8.0, 'Hours cannot exceed 8.0 per day'),
  description: z.string().optional().default(''),
  adjustment_reason: z
    .string()
    .trim()
    .min(3, 'Adjustment reason must be at least 3 characters')
    .max(500, 'Adjustment reason must be less than 500 characters'),
});

export function TimesheetRejectModal({
  isOpen,
  onClose,
  targetLogWork,
  onConfirm,
  isPending = false,
}) {
  const taskTitle =
    targetLogWork?.task?.title ||
    targetLogWork?.task_title ||
    `Task #${targetLogWork?.task?.id || targetLogWork?.task_id || targetLogWork?.id || ''}`;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(rejectTimesheetSchema),
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
      title={`Reject LogWork #${targetLogWork?.id || ''}`}
      size="md"
      footer={
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-100 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit(handleFormSubmit)}
            disabled={isPending}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-extrabold shadow-sm transition cursor-pointer disabled:opacity-50"
          >
            {isPending ? 'Rejecting...' : 'Confirm Rejection'}
          </button>
        </div>
      }
    >
      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-3 text-xs">
        <p className="text-slate-600">
          Please provide a specific reason for rejecting this work log entry for <strong>{taskTitle}</strong>.
        </p>
        <InputField
          label="Rejection Reason *"
          placeholder="e.g., Logged hours exceed task scope; please adjust description."
          {...register('reason')}
          error={errors.reason?.message}
          multiline
          rows={3}
        />
      </form>
    </BaseModal>
  );
}

export function TimesheetCorrectModal({
  isOpen,
  onClose,
  targetLogWork,
  onConfirm,
  isPending = false,
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(correctTimesheetSchema),
    defaultValues: {
      hours_spent: targetLogWork?.hours_spent || '',
      description: targetLogWork?.description || '',
      adjustment_reason: '',
    },
  });

  useEffect(() => {
    if (isOpen && targetLogWork) {
      reset({
        hours_spent: targetLogWork.hours_spent || '',
        description: targetLogWork.description || '',
        adjustment_reason: '',
      });
    }
  }, [isOpen, targetLogWork, reset]);

  const handleFormSubmit = (data) => {
    onConfirm(data);
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Adjust Hours for LogWork #${targetLogWork?.id || ''}`}
      size="md"
      footer={
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-100 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit(handleFormSubmit)}
            disabled={isPending}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-extrabold shadow-sm transition cursor-pointer disabled:opacity-50"
          >
            {isPending ? 'Saving...' : 'Save Adjustment'}
          </button>
        </div>
      }
    >
      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-3.5 text-xs">
        <InputField
          label="Corrected Hours Spent *"
          type="number"
          step="0.25"
          min="0.1"
          max="8.0"
          {...register('hours_spent')}
          error={errors.hours_spent?.message}
        />

        <InputField
          label="Work Description"
          {...register('description')}
          error={errors.description?.message}
          multiline
          rows={2}
        />

        <InputField
          label="Adjustment Reason *"
          placeholder="e.g., Reduced hours to reflect actual verified task work."
          {...register('adjustment_reason')}
          error={errors.adjustment_reason?.message}
          multiline
          rows={2}
        />
      </form>
    </BaseModal>
  );
}
