import React, { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Building2, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import SideDrawer from '../../common/drawer/SideDrawer';
import InputField from '../../common/forms/InputField';
import SelectDropdown from '../../common/forms/SelectDropdown';
import { cn } from '../../../utils/cn';

const jobFormSchema = z
  .object({
    job_name: z
      .string()
      .trim()
      .min(3, 'Project name must be at least 3 characters')
      .max(255, 'Project name must be less than 255 characters'),
    job_code: z
      .string()
      .trim()
      .max(50, 'Project code must be less than 50 characters')
      .optional()
      .or(z.literal('')),
    client_id: z.string().optional().or(z.literal('')),
    client_name: z.string().optional(),
    client_is_active: z.boolean().optional(),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH'], {
      errorMap: () => ({ message: 'Please select a valid priority level' }),
    }),
    start_date: z.string().optional().or(z.literal('')),
    deadline: z.string().min(1, 'Deadline date is required'),
    description: z.string().optional().or(z.literal('')),
    initial_team_member_ids: z.array(z.number()).default([]),
    project_team: z.array(z.any()).optional(),
  })
  .refine(
    (data) => {
      if (data.start_date && data.deadline) {
        return data.start_date <= data.deadline;
      }
      return true;
    },
    {
      message: 'Deadline date cannot be earlier than start date',
      path: ['deadline'],
    }
  );

export default function JobFormDrawer({
  isOpen,
  onClose,
  drawerMode = 'create',
  formData,
  clientOptions = [],
  myTeamEmployees = [],
  onSubmit,
  isPending = false,
}) {
  const isClientInactive = Boolean(drawerMode === 'edit' && formData?.client_is_active === false);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(jobFormSchema),
    defaultValues: {
      job_name: '',
      job_code: '',
      client_id: '',
      client_name: '',
      client_is_active: true,
      priority: 'MEDIUM',
      start_date: format(new Date(), 'yyyy-MM-dd'),
      deadline: '',
      description: '',
      initial_team_member_ids: [],
      project_team: [],
    },
  });

  // Sync form values when drawer opens or formData changes
  useEffect(() => {
    if (isOpen && formData) {
      reset({
        job_name: formData.job_name || '',
        job_code: formData.job_code || '',
        client_id: formData.client_id ? String(formData.client_id) : '',
        client_name: formData.client_name || '',
        client_is_active: formData.client_is_active !== undefined ? formData.client_is_active : true,
        priority: formData.priority || 'MEDIUM',
        start_date: formData.start_date || format(new Date(), 'yyyy-MM-dd'),
        deadline: formData.deadline || '',
        description: formData.description || '',
        initial_team_member_ids: formData.initial_team_member_ids || [],
        project_team: formData.project_team || [],
      });
    }
  }, [isOpen, formData, reset]);

  const selectedTeamMemberIds = watch('initial_team_member_ids') || [];
  const projectTeam = watch('project_team') || [];

  const handleFormSubmit = (data) => {
    if (drawerMode === 'create' && !data.client_id) {
      return;
    }
    onSubmit(data);
  };

  return (
    <SideDrawer
      isOpen={isOpen}
      onClose={onClose}
      title={drawerMode === 'create' ? 'Create New Project (Job)' : 'Edit Project Details'}
    >
      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4 text-xs">
        {/* Frozen Alert Banner */}
        {isClientInactive && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2.5 shadow-2xs">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <div>
              <p className="font-extrabold text-rose-900">PROJECT FROZEN — CLIENT INACTIVE</p>
              <p className="text-rose-700 leading-relaxed text-[11px]">
                Client <strong>"{formData?.client_name}"</strong> is deactivated by Admin. Project details and team membership modifications are locked.
              </p>
            </div>
          </div>
        )}

        {/* Project Name */}
        <div>
          <InputField
            label="Project Name"
            {...register('job_name')}
            placeholder="e.g. ERP Implementation Phase 1"
            disabled={isClientInactive}
            error={errors.job_name?.message}
            required
          />
        </div>

        {/* Client (Edit Mode: Read-only card) */}
        {drawerMode === 'edit' && (
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Client</label>
            <div className="flex items-center gap-2.5 p-2.5 bg-slate-100/90 rounded-xl border border-slate-200 text-xs font-medium text-slate-800">
              <Building2 className="w-4 h-4 text-slate-500 shrink-0" />
              <span className="font-semibold text-slate-900">{formData?.client_name || 'Associated Client'}</span>
              {formData?.client_is_active === false && (
                <span className="ml-1 px-1.5 py-0.2 rounded text-[10px] font-extrabold bg-rose-100 text-rose-700 border border-rose-200">
                  Inactive
                </span>
              )}
              <span className="ml-auto text-[10px] font-normal px-2 py-0.5 bg-slate-200 text-slate-600 rounded-md">
                Read-only
              </span>
            </div>
          </div>
        )}

        {/* Project Code & Priority */}
        <div className="grid grid-cols-2 gap-3">
          <InputField
            label="Project Code"
            {...register('job_code')}
            placeholder="e.g. JOB-ERP-01"
            disabled={drawerMode === 'edit'}
            error={errors.job_code?.message}
            helperText={drawerMode === 'edit' ? 'Unique project identifier.' : undefined}
          />

          <Controller
            name="priority"
            control={control}
            render={({ field }) => (
              <SelectDropdown
                label="Priority Level"
                required
                theme="light"
                disabled={isClientInactive}
                value={field.value}
                onChange={field.onChange}
                options={[
                  { value: 'HIGH', label: 'High Priority' },
                  { value: 'MEDIUM', label: 'Medium Priority' },
                  { value: 'LOW', label: 'Low Priority' },
                ]}
              />
            )}
          />
        </div>

        {/* Client Dropdown (Create Mode) */}
        {drawerMode === 'create' && (
          <div>
            <label className="block font-bold text-slate-700 mb-1 text-xs">
              Select Client <span className="text-rose-500">*</span>
            </label>
            <select
              {...register('client_id')}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Choose Client --</option>
              {clientOptions.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
            {errors.client_id && (
              <p className="text-rose-500 text-[11px] font-medium mt-1">{errors.client_id.message}</p>
            )}
          </div>
        )}

        {/* Start Date & Deadline */}
        <div className="grid grid-cols-2 gap-3">
          <InputField
            label="Start Date"
            type="date"
            {...register('start_date')}
            disabled={drawerMode === 'edit'}
            error={errors.start_date?.message}
            helperText={drawerMode === 'edit' ? 'Start date is fixed.' : undefined}
          />

          <InputField
            label="Deadline Date"
            type="date"
            min={drawerMode === 'create' ? format(new Date(), 'yyyy-MM-dd') : undefined}
            {...register('deadline')}
            disabled={isClientInactive}
            error={errors.deadline?.message}
            required
          />
        </div>

        {/* Project Description */}
        <div>
          <label className="block font-bold text-slate-700 mb-1 text-xs">Project Description</label>
          <textarea
            rows={3}
            {...register('description')}
            disabled={isClientInactive}
            placeholder="Enter deliverables, scope, and objectives..."
            className={cn(
              'w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-400',
              isClientInactive && 'opacity-60 cursor-not-allowed bg-slate-100'
            )}
          />
          {errors.description && (
            <p className="text-rose-500 text-[11px] font-medium mt-1">{errors.description.message}</p>
          )}
        </div>

        {/* Team Members Assignment */}
        {myTeamEmployees.length > 0 && (
          <div className="pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <label className="block font-bold text-slate-700 text-xs">
                {drawerMode === 'create' ? 'Assign Team Members' : 'Manage Project Team'} ({selectedTeamMemberIds.length}/{myTeamEmployees.length})
              </label>
              {!isClientInactive && (
                <div className="flex items-center gap-2 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setValue('initial_team_member_ids', myTeamEmployees.map((e) => e.id))}
                    className="text-blue-600 hover:underline cursor-pointer font-medium"
                  >
                    Select All
                  </button>
                  <span className="text-slate-300">•</span>
                  <button
                    type="button"
                    onClick={() => {
                      const lockedIds = projectTeam
                        .filter((m) => (m.active_tasks_count || 0) > 0)
                        .map((m) => m.id);
                      setValue('initial_team_member_ids', lockedIds);
                    }}
                    className="text-slate-500 hover:underline cursor-pointer font-medium"
                  >
                    Deselect All
                  </button>
                </div>
              )}
            </div>

            <div className="max-h-48 overflow-y-auto space-y-1.5 p-2 bg-slate-50 rounded-xl border border-slate-200">
              {myTeamEmployees.map((emp) => {
                const memberInfo = projectTeam.find((m) => m.id === emp.id);
                const activeTasksCount = memberInfo?.active_tasks_count || 0;
                const isLocked =
                  (drawerMode === 'edit' && activeTasksCount > 0) ||
                  (drawerMode === 'edit' && formData?.client_is_active === false);
                const isChecked = isLocked || selectedTeamMemberIds.includes(emp.id);

                return (
                  <label
                    key={emp.id}
                    className={cn(
                      'flex items-center justify-between p-2 rounded-lg transition text-xs',
                      isLocked
                        ? 'bg-slate-100/90 border border-slate-200/80 cursor-not-allowed select-none'
                        : 'hover:bg-white border border-transparent hover:border-slate-200 cursor-pointer'
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={isLocked}
                        onChange={(e) => {
                          if (isLocked) return;
                          if (e.target.checked) {
                            setValue('initial_team_member_ids', [...selectedTeamMemberIds, emp.id]);
                          } else {
                            setValue(
                              'initial_team_member_ids',
                              selectedTeamMemberIds.filter((id) => id !== emp.id)
                            );
                          }
                        }}
                        className={cn(
                          'rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5',
                          isLocked && 'opacity-60 cursor-not-allowed'
                        )}
                      />
                      <span className={cn('font-medium truncate', isLocked ? 'text-slate-700' : 'text-slate-800')}>
                        {emp.full_name || emp.profile?.full_name || emp.email}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isLocked ? (
                        <span
                          title="Cannot modify team assignment"
                          className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1"
                        >
                          🔒 {activeTasksCount > 0 ? `${activeTasksCount} active task${activeTasksCount > 1 ? 's' : ''}` : 'Locked'}
                        </span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200/80 text-slate-600 font-medium">
                          {emp.department_name || emp.profile?.department_name || 'Member'}
                        </span>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 cursor-pointer font-medium"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isPending || isClientInactive}
            className={cn(
              'px-4 py-2 font-bold rounded-xl shadow-xs transition',
              isClientInactive
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none border border-slate-300'
                : 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer disabled:opacity-50'
            )}
          >
            {isPending
              ? 'Saving...'
              : drawerMode === 'create'
              ? 'Create Project'
              : 'Save Changes'}
          </button>
        </div>
      </form>
    </SideDrawer>
  );
}
