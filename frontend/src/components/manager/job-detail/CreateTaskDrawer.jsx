import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  Building2,
  Calendar,
  Clock,
  Users,
  Info,
  Paperclip,
  Trash2,
  FileText,
  AlertCircle,
  Search,
  Check,
  UserCheck,
  Briefcase,
  Sparkles,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import SideDrawer from '../../common/drawer/SideDrawer';
import SelectDropdown from '../../common/forms/SelectDropdown';
import UserAvatar from '../../common/avatar/UserAvatar';
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

export default function CreateTaskDrawer({
  isOpen,
  onClose,
  job,
  employeeOptions = [],
  employeesList = [],
}) {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState('');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('ALL');
  const fileInputRef = useRef(null);
  const createTaskMutation = useCreateTask();

  const createTaskSchema = useMemo(() => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    return z
      .object({
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
      })
      .refine(
        (data) => {
          if (data.start_date && data.start_date < todayStr) return false;
          return true;
        },
        {
          message: 'Task start date cannot be in the past.',
          path: ['start_date'],
        }
      )
      .refine(
        (data) => {
          if (data.start_date && job?.start_date && data.start_date < job.start_date) return false;
          return true;
        },
        {
          message: `Start date cannot be earlier than project start (${formatDateSafe(job?.start_date)}).`,
          path: ['start_date'],
        }
      )
      .refine(
        (data) => {
          if (data.start_date && job?.deadline && data.start_date > job.deadline) return false;
          return true;
        },
        {
          message: `Start date cannot exceed project deadline (${formatDateSafe(job?.deadline)}).`,
          path: ['start_date'],
        }
      )
      .refine(
        (data) => {
          if (data.deadline && data.deadline < todayStr) return false;
          return true;
        },
        {
          message: 'Task deadline cannot be in the past.',
          path: ['deadline'],
        }
      )
      .refine(
        (data) => {
          if (data.start_date && data.deadline && data.start_date > data.deadline) return false;
          return true;
        },
        {
          message: 'Deadline cannot be earlier than task start date.',
          path: ['deadline'],
        }
      )
      .refine(
        (data) => {
          if (data.deadline && job?.deadline && data.deadline > job.deadline) return false;
          return true;
        },
        {
          message: `Deadline cannot exceed project deadline (${formatDateSafe(job?.deadline)}).`,
          path: ['deadline'],
        }
      );
  }, [job]);

  const {
    register,
    handleSubmit,
    control,
    setValue,
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

  // Đồng bộ form khi mở Drawer
  useEffect(() => {
    if (isOpen) {
      reset({
        title: '',
        assignee_id: '',
        priority: 'MEDIUM',
        start_date: '',
        deadline: '',
        description: '',
      });
      setSelectedFiles([]);
      setEmployeeSearchQuery('');
      setSelectedDeptFilter('ALL');
    }
  }, [isOpen, reset]);

  const watchedStartDate = watch('start_date');
  const watchAssigneeId = watch('assignee_id');

  // Chuẩn hóa danh sách nhân sự & bộ lọc phòng ban
  const normalizedEmployees = useMemo(() => {
    if (Array.isArray(employeesList) && employeesList.length > 0) {
      return employeesList.map((emp) => {
        const swp = emp.smart_workload_pressure;
        const status = swp?.workload_status || emp.workload_status || 'AVAILABLE';
        return {
          id: String(emp.user_id || emp.id),
          rawId: emp.user_id || emp.id,
          full_name: emp.full_name || emp.email,
          email: emp.email || '',
          avatar_url: emp.avatar_url || emp.avatar,
          department_name: emp.department_name || emp.departmentName || 'General Staff',
          workload_status: status,
          capacity_pct: swp?.capacity_pct !== undefined ? swp.capacity_pct : emp.capacity_pct,
        };
      });
    }
    return employeeOptions
      .filter((o) => o.value !== '')
      .map((opt) => ({
        id: String(opt.value),
        rawId: opt.value,
        full_name: opt.label ? opt.label.split(' (')[0] : 'Employee',
        email: opt.description ? opt.description.split(' • ')[0] : '',
        department_name: opt.description?.includes('•') ? opt.description.split(' • ')[1] : 'Staff',
        workload_status: opt.badge?.includes('Overloaded')
          ? 'OVERLOADED'
          : opt.badge?.includes('Balanced')
          ? 'BALANCED'
          : 'AVAILABLE',
      }));
  }, [employeesList, employeeOptions]);

  const departmentCounts = useMemo(() => {
    const counts = {};
    normalizedEmployees.forEach((emp) => {
      const dept = emp.department_name || 'Staff';
      counts[dept] = (counts[dept] || 0) + 1;
    });
    return counts;
  }, [normalizedEmployees]);

  const filteredEmployees = useMemo(() => {
    const q = employeeSearchQuery.toLowerCase().trim();
    return normalizedEmployees.filter((emp) => {
      const matchSearch =
        !q ||
        emp.full_name.toLowerCase().includes(q) ||
        emp.email.toLowerCase().includes(q) ||
        emp.department_name.toLowerCase().includes(q);

      const matchDept =
        selectedDeptFilter === 'ALL' || emp.department_name === selectedDeptFilter;

      return matchSearch && matchDept;
    });
  }, [normalizedEmployees, employeeSearchQuery, selectedDeptFilter]);

  const selectedEmployee = useMemo(() => {
    if (!watchAssigneeId) return null;
    return normalizedEmployees.find((e) => e.id === String(watchAssigneeId));
  }, [normalizedEmployees, watchAssigneeId]);

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
    setEmployeeSearchQuery('');
    setSelectedDeptFilter('ALL');
    reset();
    onClose();
  };

  const onSubmitCreateTask = async (data) => {
    if (job?.client && job.client.is_active === false) {
      toast.error('Cannot create task because client is deactivated by Admin.');
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
      title={
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse" />
          <span className="font-bold text-sm text-slate-900">Create New Task Deliverable</span>
          {job && (
            <span className="text-xs font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100">
              #JOB-{job.id}
            </span>
          )}
        </div>
      }
      subtitle={
        job ? (
          <span className="text-xs text-slate-500 flex items-center gap-1.5 truncate">
            <Briefcase className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate">{job.job_name}</span>
          </span>
        ) : (
          'Task Specification & Specialist Allocation'
        )
      }
      size="2xl"
      headerClassName="px-4 py-2.5"
      bodyClassName="px-4 py-3"
      footerClassName="px-4 py-2.5 bg-slate-50/90 border-t border-slate-200"
      footer={
        <div className="flex items-center justify-between w-full text-xs">
          <div className="flex items-center gap-3 text-slate-500">
            <span className="hidden sm:flex items-center gap-1">
              <UserCheck className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span>Assignee:</span>
              <strong className="text-slate-800 font-semibold">
                {selectedEmployee ? selectedEmployee.full_name : 'Unassigned (Manager Draft)'}
              </strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-3.5 py-1.5 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="create-task-form"
              disabled={createTaskMutation.isPending}
              className="px-4 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:from-blue-800 active:to-indigo-800 text-white font-bold rounded-xl shadow-xs cursor-pointer disabled:opacity-50 transition flex items-center gap-1.5"
            >
              {createTaskMutation.isPending ? (
                <>
                  <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Creating & Uploading...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Create Task Deliverable</span>
                </>
              )}
            </button>
          </div>
        </div>
      }
    >
      <form
        id="create-task-form"
        onSubmit={handleSubmit(onSubmitCreateTask)}
        className="space-y-4"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
          
          {/* ================= CỘT TRÁI: PROJECT HUB & TASK SPECIFICATIONS (7/12) ================= */}
          <div className="lg:col-span-7 flex flex-col space-y-3">
            
            {/* 🌟 1. PROJECT HUB & TIMELINE CONSTRAINTS (NEUMORPHISM SOFT MATTE GRAY THEME) */}
            {job && (
              <div className="bg-[#e8ecf2] rounded-2xl p-3 border border-white/80 shadow-[6px_6px_14px_rgba(166,178,198,0.42),-6px_-6px_14px_rgba(255,255,255,0.9)] space-y-2.5 text-slate-800">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-[#e0e5ed] text-blue-700 shadow-[inset_1px_1px_3px_rgba(166,178,198,0.4),inset_-1px_-1px_3px_rgba(255,255,255,0.8)] border border-white/60">
                        Project Hub
                      </span>
                      <span className="text-[11px] font-mono text-slate-600 font-bold">
                        #JOB-{job.id} {job.job_code ? `(${job.job_code})` : ''}
                      </span>
                    </div>
                    <h3 className="text-xs font-extrabold text-slate-900 mt-1 leading-snug truncate">
                      {job.job_name}
                    </h3>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-[1px_1px_3px_rgba(166,178,198,0.25)]">
                      {job.status}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-50 text-amber-700 border border-amber-200/80 shadow-[1px_1px_3px_rgba(166,178,198,0.25)]">
                      {job.priority || 'MEDIUM'}
                    </span>
                  </div>
                </div>

                {/* Client & Assigned Team */}
                <div className="flex items-center justify-between gap-3 pt-1.5 border-t border-slate-300/50 text-[11px]">
                  <div className="flex items-center gap-1.5 text-slate-600 min-w-0">
                    <Building2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span className="truncate">Client: <strong className="text-slate-900 font-bold">{job.client?.client_name || 'Internal'}</strong></span>
                  </div>
                  <div className="flex items-center gap-1 text-slate-700 font-bold shrink-0">
                    <Users className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span>{job.project_team?.length || normalizedEmployees.length} members</span>
                  </div>
                </div>

                {/* Project Timeline Inset Well */}
                <div className="bg-[#e2e8f0] rounded-xl p-2.5 border border-slate-200/60 space-y-1.5 shadow-[inset_2px_2px_5px_rgba(166,178,198,0.45),inset_-2px_-2px_5px_rgba(255,255,255,0.9)]">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-emerald-600 shrink-0" />
                      <span className="text-slate-500 font-medium">Start:</span>
                      <span className="text-slate-900 font-mono font-bold">{formatDateSafe(job.start_date)}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-rose-500 shrink-0" />
                      <span className="text-slate-500 font-medium">Deadline:</span>
                      <span className="text-slate-900 font-mono font-bold">{formatDateSafe(job.deadline)}</span>
                    </span>
                  </div>
                  <div className="relative w-full bg-slate-300/60 h-1.5 rounded-full overflow-hidden shadow-inner">
                    <div className="bg-gradient-to-r from-emerald-500 via-blue-500 to-rose-500 h-full w-full rounded-full opacity-90" />
                  </div>
                  <p className="text-[10px] text-slate-600 flex items-center gap-1 font-medium">
                    <Info className="w-3 h-3 text-blue-600 shrink-0" />
                    <span>Task dates must be within Project bounds ({formatDateSafe(job.start_date)} — {formatDateSafe(job.deadline)}).</span>
                  </p>
                </div>
              </div>
            )}

            {/* 📋 2. TASK CORE DETAILS & SPECIFICATIONS */}
            <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-3.5 space-y-3">
              <div className="flex items-center gap-1.5 pb-1.5 border-b border-slate-100">
                <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                <h3 className="text-[11px] font-bold text-slate-900 uppercase tracking-wider">
                  1. Task Scope & Deliverables
                </h3>
              </div>

              {/* Task Title */}
              <div>
                <label className="block font-bold text-slate-800 mb-1 text-xs">
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
                  <p className="mt-1 text-[11px] text-rose-500 font-semibold flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                    <span>{errors.title.message}</span>
                  </p>
                )}
              </div>

              {/* Priority, Start Date, Deadline */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <Controller
                  name="priority"
                  control={control}
                  render={({ field }) => (
                    <SelectDropdown
                      label={<span className="font-bold text-slate-800">Priority Level</span>}
                      value={field.value || 'MEDIUM'}
                      onChange={field.onChange}
                      required={true}
                      options={[
                        { value: 'HIGH', label: '🔴 High Priority' },
                        { value: 'MEDIUM', label: '🟡 Medium Priority' },
                        { value: 'LOW', label: '🔵 Low Priority' },
                      ]}
                      theme="light"
                    />
                  )}
                />

                <div>
                  <label className="block font-bold text-slate-800 mb-1 text-xs">
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
                    <p className="mt-1 text-[11px] text-rose-500 font-semibold flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                      <span>{errors.start_date.message}</span>
                    </p>
                  )}
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1 text-xs">
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
                    <p className="mt-1 text-[11px] text-rose-500 font-semibold flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                      <span>{errors.deadline.message}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block font-bold text-slate-800 mb-1 text-xs">
                  Description & Acceptance Criteria
                </label>
                <textarea
                  rows={2}
                  {...register('description')}
                  placeholder="Provide technical instructions, acceptance criteria, and expected deliverables..."
                  className={cn(
                    'w-full bg-slate-50 border rounded-xl p-2.5 text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed shadow-2xs placeholder:text-slate-400 resize-none',
                    errors.description ? 'border-rose-400 focus:ring-rose-500 bg-rose-50/30' : 'border-slate-300'
                  )}
                />
                {errors.description && (
                  <p className="mt-1 text-[11px] text-rose-500 font-semibold flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                    <span>{errors.description.message}</span>
                  </p>
                )}
              </div>

              {/* Attachments Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
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
                  className="border-2 border-dashed border-slate-300 hover:border-blue-500 bg-slate-50/70 hover:bg-blue-50/30 rounded-xl p-2.5 text-center cursor-pointer transition-colors space-y-0.5"
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
                  <div className="space-y-1.5 max-h-28 overflow-y-auto custom-scrollbar">
                    {selectedFiles.map((file, idx) => (
                      <div
                        key={`${file.name}-${idx}`}
                        className="bg-white border border-slate-200 rounded-xl p-2 flex items-center justify-between gap-2 shadow-2xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0" />
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

            </div>

          </div>

          {/* ================= CỘT PHẢI: ASSIGN SPECIALIST & WORKLOAD MATRIX (5/12) ================= */}
          <div className="lg:col-span-5 flex flex-col bg-white rounded-xl border border-slate-200/90 shadow-2xs p-3 min-h-[500px]">
            
            {/* Header Phân bổ Nhân sự */}
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 shrink-0">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                  <h3 className="text-[11px] font-bold text-slate-900 uppercase tracking-wider">
                    2. Assign Specialist
                  </h3>
                </div>
                <p className="text-[10px] text-slate-500 mt-0.5">Select a specialist for this task deliverable.</p>
              </div>

              <div className="text-right">
                <span className={cn(
                  'px-2 py-0.5 rounded-full text-[10px] font-bold border',
                  watchAssigneeId
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                    : 'bg-slate-100 text-slate-600 border-slate-200'
                )}>
                  {selectedEmployee ? '1 Specialist Assigned' : 'Unassigned (Draft)'}
                </span>
              </div>
            </div>

            {/* Search & Department Filter Chips */}
            <div className="pt-2 space-y-1.5 shrink-0">
              
              {/* Search input */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={employeeSearchQuery}
                  onChange={(e) => setEmployeeSearchQuery(e.target.value)}
                  placeholder="Search specialist name, email, department..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-7 pr-2.5 py-1 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
                />
              </div>

              {/* Department Chips */}
              <div className="flex items-center gap-1 overflow-x-auto pb-0.5 text-[9px] custom-scrollbar">
                <button
                  type="button"
                  onClick={() => setSelectedDeptFilter('ALL')}
                  className={cn(
                    'px-1.5 py-0.5 rounded font-semibold transition cursor-pointer shrink-0',
                    selectedDeptFilter === 'ALL'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  )}
                >
                  All ({normalizedEmployees.length})
                </button>
                {Object.entries(departmentCounts).map(([deptName, count]) => {
                  const shortName = deptName
                    .replace(' Department', '')
                    .replace('Engineering', 'Eng')
                    .replace('Quality Assurance & Testing', 'QA')
                    .replace('Cloud Infrastructure & DevOps', 'DevOps');
                  return (
                    <button
                      key={deptName}
                      type="button"
                      onClick={() => setSelectedDeptFilter(deptName)}
                      className={cn(
                        'px-1.5 py-0.5 rounded font-medium transition cursor-pointer shrink-0',
                        selectedDeptFilter === deptName
                          ? 'bg-indigo-600 text-white font-semibold'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                      )}
                    >
                      {shortName} ({count})
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Scrollable Specialists Selection List */}
            <div className="mt-2 flex-1 overflow-y-auto custom-scrollbar space-y-1.5 pr-0.5">
              
              {/* Option 0: Unassigned (Draft) */}
              <div
                onClick={() => setValue('assignee_id', '', { shouldValidate: true })}
                className={cn(
                  'p-2 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between',
                  !watchAssigneeId
                    ? 'bg-blue-50/70 border-blue-400 shadow-2xs'
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 font-bold text-xs flex items-center justify-center shrink-0 border border-slate-300">
                    ?
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-800 text-xs truncate">
                      -- Unassigned Task --
                    </p>
                    <p className="text-[10px] text-slate-400 truncate">
                      Save as Manager Backlog Draft
                    </p>
                  </div>
                </div>

                {!watchAssigneeId && (
                  <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0">
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </span>
                )}
              </div>

              {/* Filtered Employees Cards */}
              {filteredEmployees.length === 0 ? (
                <div className="py-6 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <Users className="w-5 h-5 mx-auto mb-1 text-slate-400 opacity-60" />
                  No specialists match your search criteria.
                </div>
              ) : (
                filteredEmployees.map((emp) => {
                  const isSelected = String(watchAssigneeId) === String(emp.id);
                  const isOverloaded = emp.workload_status === 'OVERLOADED';
                  const isBalanced = emp.workload_status === 'BALANCED';

                  return (
                    <div
                      key={emp.id}
                      onClick={() => setValue('assignee_id', String(emp.id), { shouldValidate: true })}
                      className={cn(
                        'p-2 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between group',
                        isSelected
                          ? 'bg-indigo-50/80 border-indigo-500 shadow-2xs ring-1 ring-indigo-500/20'
                          : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/70'
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <UserAvatar
                          user={emp}
                          src={emp.avatar_url}
                          fullName={emp.full_name}
                          size="sm"
                          className="shrink-0 shadow-2xs"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-slate-900 text-xs truncate">
                              {emp.full_name}
                            </span>
                            <span className="text-[9px] font-medium px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded border border-slate-200 shrink-0">
                              {emp.department_name}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 truncate mt-0.5">
                            {emp.email}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <span
                          className={cn(
                            'text-[9px] font-extrabold px-1.5 py-0.5 rounded-full border shrink-0',
                            isOverloaded
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : isBalanced
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-slate-50 text-slate-600 border-slate-200'
                          )}
                        >
                          {isOverloaded ? '🔴 Overloaded' : isBalanced ? '🟢 Balanced' : '⚪ Available'}
                        </span>

                        <div className={cn(
                          'w-4 h-4 rounded-full border flex items-center justify-center transition-colors',
                          isSelected
                            ? 'bg-indigo-600 border-indigo-600 text-white'
                            : 'border-slate-300 group-hover:border-slate-400 bg-white'
                        )}>
                          {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Pinned Selected Assignee Preview Footer */}
            <div className="mt-2 pt-2 border-t border-slate-100 shrink-0">
              {selectedEmployee ? (
                <div className="p-2 bg-indigo-50/60 border border-indigo-200 rounded-xl flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <UserAvatar
                      user={selectedEmployee}
                      src={selectedEmployee.avatar_url}
                      fullName={selectedEmployee.full_name}
                      size="xs"
                      className="shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 truncate text-[11px]">{selectedEmployee.full_name}</p>
                      <p className="text-[10px] text-indigo-700 font-semibold truncate">{selectedEmployee.department_name}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setValue('assignee_id', '', { shouldValidate: true })}
                    className="text-[10px] font-bold text-rose-600 hover:underline cursor-pointer shrink-0"
                  >
                    Unassign
                  </button>
                </div>
              ) : (
                <div className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] text-slate-500 text-center">
                  💡 No specialist selected. Task will be saved as draft under Manager.
                </div>
              )}
            </div>

          </div>

        </div>
      </form>
    </SideDrawer>
  );
}
