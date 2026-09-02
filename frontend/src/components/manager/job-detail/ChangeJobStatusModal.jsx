import React, { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { AlertCircle } from 'lucide-react';
import BaseModal from '../../common/modal/BaseModal';
import SelectDropdown from '../../common/forms/SelectDropdown';
import { useChangeJobStatus } from '../../../hooks/queries/manager/useManagerJobs';

const changeJobStatusSchema = z
  .object({
    to_status: z.string().min(1, 'Please select a target status'),
    reason: z.string().optional().default(''),
  })
  .refine(
    (data) => {
      if (['ON_HOLD', 'CANCELLED'].includes(data.to_status)) {
        return Boolean(data.reason && data.reason.trim().length >= 3);
      }
      return true;
    },
    {
      message: 'A specific reason (at least 3 characters) is required when placing project ON HOLD or CANCELLED',
      path: ['reason'],
    }
  );

export default function ChangeJobStatusModal({
  isOpen,
  onClose,
  job,
  isClientInactive = false,
}) {
  const changeJobStatusMutation = useChangeJobStatus();

  const ALLOWED_TRANSITIONS = {
    PLANNING: isClientInactive
      ? [{ value: 'CANCELLED', label: 'CANCELLED - Discontinue project' }]
      : [
          { value: 'ACTIVE', label: 'ACTIVE - Start project execution' },
          { value: 'CANCELLED', label: 'CANCELLED - Discontinue project' },
        ],
    ACTIVE: isClientInactive
      ? [{ value: 'CANCELLED', label: 'CANCELLED - Discontinue project' }]
      : [
          { value: 'ON_HOLD', label: 'ON HOLD - Temporarily pause project' },
          { value: 'COMPLETED', label: 'COMPLETED - Mark project as finished' },
          { value: 'CANCELLED', label: 'CANCELLED - Discontinue project' },
        ],
    ON_HOLD: isClientInactive
      ? [{ value: 'CANCELLED', label: 'CANCELLED - Discontinue project' }]
      : [
          { value: 'ACTIVE', label: 'ACTIVE - Resume project execution' },
          { value: 'CANCELLED', label: 'CANCELLED - Discontinue project' },
        ],
    COMPLETED: [],
    CANCELLED: [],
  };

  const allowedOptions = job ? ALLOWED_TRANSITIONS[job.status] || [] : [];

  const {
    handleSubmit,
    control,
    register,
    watch,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(changeJobStatusSchema),
    defaultValues: {
      to_status: '',
      reason: '',
    },
  });

  const selectedTargetStatus = watch('to_status');

  useEffect(() => {
    if (job && isOpen) {
      const allowed = ALLOWED_TRANSITIONS[job.status] || [];
      reset({
        to_status: allowed.length > 0 ? allowed[0].value : '',
        reason: '',
      });
    }
  }, [job, isOpen, isClientInactive, reset]);

  const handleFormSubmit = (data) => {
    if (!job) return;
    changeJobStatusMutation.mutate(
      {
        id: job.id,
        newStatus: data.to_status,
        reason: data.reason.trim() || undefined,
      },
      {
        onSuccess: () => {
          onClose();
        },
      }
    );
  };

  if (!job) return null;

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Change Project Status"
      description={`Update lifecycle state for "${job.job_name}"`}
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4 pt-2">
        {/* Current Status */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Current Status
          </label>
          <div className="px-3.5 py-2.5 bg-slate-100 rounded-xl text-xs font-mono font-bold text-slate-700 border border-slate-200">
            {job.status}
          </div>
        </div>

        {/* New Target Status Select */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            New Target Status <span className="text-rose-500">*</span>
          </label>
          {allowedOptions.length === 0 ? (
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 font-medium">
              No further status transitions are permitted from <b>{job.status}</b>.
            </div>
          ) : (
            <Controller
              name="to_status"
              control={control}
              render={({ field }) => (
                <SelectDropdown
                  value={field.value}
                  onChange={field.onChange}
                  options={allowedOptions}
                  className="w-full"
                />
              )}
            />
          )}
          {errors.to_status && (
            <p className="mt-1 text-xs text-rose-600 font-semibold flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>{errors.to_status.message}</span>
            </p>
          )}
        </div>

        {/* Reason for Status Change */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Reason for Status Change
            {['ON_HOLD', 'CANCELLED'].includes(selectedTargetStatus) && (
              <span className="text-rose-500 ml-1">* (Required)</span>
            )}
          </label>
          <textarea
            {...register('reason')}
            rows={3}
            placeholder={
              ['ON_HOLD', 'CANCELLED'].includes(selectedTargetStatus)
                ? 'Please specify a clear reason for putting project on hold or cancelling...'
                : 'Optional notes for this status transition...'
            }
            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white resize-none transition"
          />
          {errors.reason && (
            <p className="mt-1 text-xs text-rose-600 font-semibold flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>{errors.reason.message}</span>
            </p>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={changeJobStatusMutation.isPending}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={
              changeJobStatusMutation.isPending || allowedOptions.length === 0
            }
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-md shadow-blue-500/20 transition cursor-pointer disabled:opacity-50"
          >
            {changeJobStatusMutation.isPending ? 'Updating...' : 'Confirm Change'}
          </button>
        </div>
      </form>
    </BaseModal>
  );
}
