import React, { useState, useRef } from 'react';
import {
  Building2,
  Calendar,
  Clock,
  Users,
  Info,
  Paperclip,
  Trash2,
  FileText,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import SideDrawer from '../../common/drawer/SideDrawer';
import SelectDropdown from '../../common/forms/SelectDropdown';
import { cn } from '../../../utils/cn';
import { useCreateTask } from '../../../hooks/queries/manager/useManagerTasks';
import managerTaskService from '../../../services/manager/managerTaskService';

function formatDateSafe(dateStr) {
  if (!dateStr) return 'N/A';
  try {
    return format(parseISO(dateStr), 'dd/MM/yyyy');
  } catch {
    return dateStr;
  }
}

function formatBytes(bytes, decimals = 1) {
  if (!+bytes) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

const createTaskSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Task title is required.')
    .max(255, 'Task title cannot exceed 255 characters.'),
  assignee_id: z.string().optional().or(z.literal('')),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'),
  start_date: z.string().optional().or(z.literal('')),
  deadline: z.string().min(1, 'Deadline is required.'),
  description: z.string().optional().or(z.literal('')),
});

export default function CreateTaskDrawer({
  isOpen,
  onClose,
  job,
  employeeOptions = [],
}) {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const fileInputRef = useRef(null);
  const createTaskMutation = useCreateTask();

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(createTaskSchema),
    defaultValues: {
      title: '',
      assignee_id: '',
      priority: 'MEDIUM',
      start_date: '',
      deadline: '',
      description: '',
    },
  });

  const watchedStartDate = watch('start_date');

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
    const validFiles = [];
    for (const f of files) {
      if (f.size > MAX_FILE_SIZE) {
        toast.error(`File "${f.name}" exceeds 20MB limit.`);
        continue;
      }
      validFiles.push(f);
    }
    setSelectedFiles((prev) => [...prev, ...validFiles]);
    e.target.value = '';
  };

  const handleRemoveFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleClose = () => {
    setSelectedFiles([]);
    reset();
    onClose();
  };

  const onSubmitCreateTask = async (data) => {
    if (job?.client && job.client.is_active === false) {
      toast.error('Cannot create task because client is deactivated by Admin.');
      return;
    }
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    if (data.start_date && data.start_date < todayStr) {
      toast.error('Task start date cannot be in the past.');
      return;
    }
    if (data.start_date && job?.start_date && data.start_date < job.start_date) {
      toast.error(`Task start date cannot be earlier than project start date (${formatDateSafe(job.start_date)}).`);
      return;
    }
    if (data.deadline && data.deadline < todayStr) {
      toast.error('Task deadline cannot be in the past.');
      return;
    }
    if (data.start_date && data.deadline && data.start_date > data.deadline) {
      toast.error('Task start date cannot be later than task deadline.');
      return;
    }
    if (data.deadline && job?.deadline && data.deadline > job.deadline) {
      toast.error(`Task deadline cannot exceed project deadline (${formatDateSafe(job.deadline)}).`);
      return;
    }
    if (data.start_date && job?.deadline && data.start_date > job.deadline) {
      toast.error(`Task start date cannot exceed project deadline (${formatDateSafe(job.deadline)}).`);
      return;
    }

    const payload = {
      title: data.title.trim(),
      description: data.description?.trim() || undefined,
      job_id: Number(job.id),
      assignee_id: data.assignee_id ? Number(data.assignee_id) : undefined,
      priority: data.priority,
      start_date: data.start_date || undefined,
      deadline: data.deadline || undefined,
    };

    createTaskMutation.mutate(payload, {
      onSuccess: async (createdTask) => {
        if (selectedFiles.length > 0 && createdTask?.id) {
          for (const file of selectedFiles) {
            const formData = new FormData();
            formData.append('file', file);
            try {
              await managerTaskService.uploadAttachment(createdTask.id, formData);
            } catch (err) {
              console.error('Failed to upload attachment on task creation', err);
            }
          }
        }
        handleClose();
      },
    });
  };

  return (
    <SideDrawer
      isOpen={isOpen}
      onClose={handleClose}
      title="Create New Task"
      size="xl"
    >
      <div className="space-y-5">
        {/* 🌟 KHU VỰC THÔNG TIN DỰ ÁN TOÀN DIỆN (PROJECT OVERVIEW & TIMELINE HUB - LIGHT NEUMORPHISM) */}
        {job && (
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs space-y-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
                    Project Hub
                  </span>
                  <span className="text-[11px] font-mono text-slate-500 font-bold">
                    #JOB-{job.id} {job.job_code ? `(${job.job_code})` : ''}
                  </span>
                </div>
                <h3 className="text-sm font-extrabold text-slate-900 mt-1.5 leading-snug break-words">
                  {job.job_name}
                </h3>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {job.status}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-50 text-amber-700 border border-amber-200">
                  {job.priority || 'MEDIUM'}
                </span>
              </div>
            </div>

            {/* Client & Assigned Team (Dạt ra 2 biên) */}
            <div className="flex items-center justify-between gap-3 pt-2.5 border-t border-slate-100 text-xs">
              <div className="flex items-center gap-1.5 text-slate-500 min-w-0">
                <Building2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span className="truncate">Client: <strong className="text-slate-900">{job.client?.client_name || 'Internal'}</strong></span>
              </div>
              <div className="flex items-center gap-1 text-slate-700 font-bold shrink-0">
                <Users className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span>: {job.project_team?.length || employeeOptions.length} members</span>
              </div>
            </div>

            {/* Project Timeline & Constraints Bar */}
            <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-200/70 space-y-2 shadow-2xs">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-slate-500 font-semibold">Start:</span>
                  <span className="text-slate-900 font-mono">{formatDateSafe(job.start_date)}</span>
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-rose-500" />
                  <span className="text-slate-500 font-semibold">Deadline:</span>
                  <span className="text-slate-900 font-mono">{formatDateSafe(job.deadline)}</span>
                </span>
              </div>
              <div className="relative w-full bg-slate-200/70 h-1.5 rounded-full overflow-hidden">
                <div className="bg-gradient-to-r from-emerald-500 via-blue-500 to-rose-500 h-full w-full rounded-full opacity-90" />
              </div>
              <p className="text-[10px] text-slate-500 flex items-center gap-1">
                <Info className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span>Task dates must be within Project bounds ({formatDateSafe(job.start_date)} — {formatDateSafe(job.deadline)}).</span>
              </p>
            </div>
          </div>
        )}

        {/* Form Nhập Task Mới */}
        <form onSubmit={handleSubmit(onSubmitCreateTask)} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-800 mb-1">
              Task Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              {...register('title')}
              placeholder="e.g. Design Database Schema & API Contracts"
              className={cn(
                'w-full bg-slate-50 border rounded-xl p-2.5 text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors shadow-2xs',
                errors.title ? 'border-rose-400 focus:ring-rose-500 bg-rose-50/30' : 'border-slate-300'
              )}
            />
            {errors.title && (
              <p className="mt-1 text-[11px] text-rose-500 font-semibold">{errors.title.message}</p>
            )}
          </div>

          <div>
            <Controller
              name="assignee_id"
              control={control}
              render={({ field }) => (
                <SelectDropdown
                  label={
                    <span className="font-bold text-slate-800">
                      Assign to Employee <span className="text-slate-400 font-normal">(Optional — Defaults to Manager if unassigned)</span>
                    </span>
                  }
                  value={field.value}
                  onChange={field.onChange}
                  options={[
                    { value: '', label: '-- Unassigned (Save as Draft under Manager) --' },
                    ...employeeOptions,
                  ]}
                  placeholder="-- Search and select an employee --"
                  searchable={true}
                  theme="light"
                  error={errors.assignee_id?.message}
                />
              )}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Controller
              name="priority"
              control={control}
              render={({ field }) => (
                <SelectDropdown
                  label={<span className="font-bold text-slate-800">Priority <span className="text-rose-500">*</span></span>}
                  value={field.value}
                  onChange={field.onChange}
                  options={[
                    { value: 'HIGH', label: 'High Priority (Urgent)' },
                    { value: 'MEDIUM', label: 'Medium Priority (Standard)' },
                    { value: 'LOW', label: 'Low Priority (Minor)' },
                  ]}
                />
              )}
            />

            <div>
              <label className="block font-bold text-slate-800 mb-1">
                Start Date <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="date"
                {...register('start_date')}
                min={format(new Date(), 'yyyy-MM-dd')}
                max={job?.deadline || undefined}
                className={cn(
                  'w-full bg-slate-50 border rounded-xl p-2.5 text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors shadow-2xs',
                  errors.start_date ? 'border-rose-400 focus:ring-rose-500 bg-rose-50/30' : 'border-slate-300'
                )}
              />
              {errors.start_date && (
                <p className="mt-1 text-[11px] text-rose-500 font-semibold">{errors.start_date.message}</p>
              )}
            </div>

            <div>
              <label className="block font-bold text-slate-800 mb-1">
                Deadline <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                {...register('deadline')}
                min={watchedStartDate || format(new Date(), 'yyyy-MM-dd')}
                max={job?.deadline || undefined}
                className={cn(
                  'w-full bg-slate-50 border rounded-xl p-2.5 text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors shadow-2xs',
                  errors.deadline ? 'border-rose-400 focus:ring-rose-500 bg-rose-50/30' : 'border-slate-300'
                )}
              />
              {errors.deadline && (
                <p className="mt-1 text-[11px] text-rose-500 font-semibold">{errors.deadline.message}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-800 mb-1">Description & Acceptance Criteria</label>
            <textarea
              rows={3}
              {...register('description')}
              placeholder="Provide clear technical instructions, acceptance criteria, and expected deliverables..."
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed shadow-2xs placeholder:text-slate-400"
            />
            {errors.description && (
              <p className="mt-1 text-[11px] text-rose-500 font-semibold">{errors.description.message}</p>
            )}
          </div>

          {/* Vùng Đính Kèm Tệp (Attachments & Specifications) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-800 flex items-center gap-1.5">
                <Paperclip className="w-3.5 h-3.5 text-slate-500" />
                <span>Attachments & Specs <span className="text-slate-400 font-normal">(Optional)</span></span>
              </label>
              {selectedFiles.length > 0 && (
                <span className="text-[11px] font-bold text-blue-600">{selectedFiles.length} file(s) selected</span>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileChange}
              className="hidden"
            />

            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-blue-500 bg-slate-50/70 hover:bg-blue-50/30 rounded-xl p-3.5 text-center cursor-pointer transition-colors space-y-1"
            >
              <Paperclip className="w-4 h-4 text-slate-400 mx-auto" />
              <p className="text-xs font-semibold text-slate-700">
                Click to browse or drop specification files here
              </p>
              <p className="text-[10px] text-slate-400">
                Supports PDF, DOCX, XLSX, Images, ZIP up to 20MB each
              </p>
            </div>

            {selectedFiles.length > 0 && (
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {selectedFiles.map((file, idx) => (
                  <div
                    key={`${file.name}-${idx}`}
                    className="bg-white border border-slate-200 rounded-xl p-2.5 flex items-center justify-between gap-2 shadow-2xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                      <span className="text-xs font-medium text-slate-800 truncate">{file.name}</span>
                      <span className="text-[10px] font-semibold text-slate-400 shrink-0">({formatBytes(file.size)})</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveFile(idx)}
                      className="text-slate-400 hover:text-rose-600 p-1 rounded-md transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-200">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-100 cursor-pointer font-bold text-xs transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createTaskMutation.isPending}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer disabled:opacity-50 transition flex items-center gap-1.5"
            >
              {createTaskMutation.isPending ? 'Creating & Uploading...' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </SideDrawer>
  );
}
