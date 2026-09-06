import React, { useEffect, useState, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Building2,
  AlertCircle,
  Search,
  Users,
  Calendar,
  ShieldCheck,
  Mail,
  Phone,
  MapPin,
  FileText,
  Lock,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { format, differenceInCalendarDays, parseISO } from 'date-fns';
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
    client_id: z
      .string()
      .min(1, 'Please select an enterprise client for this project'),
    client_name: z.string().optional(),
    client_is_active: z.boolean().optional(),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH'], {
      errorMap: () => ({ message: 'Please select a valid priority level' }),
    }),
    start_date: z.string().min(1, 'Start date is required'),
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
  clientsList = [],
  myTeamEmployees = [],
  onSubmit,
  isPending = false,
}) {
  const isClientInactive = Boolean(drawerMode === 'edit' && formData?.client_is_active === false);

  // Search & Filter state for team allocation
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('ALL');

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
    if (isOpen) {
      setMemberSearchQuery('');
      setSelectedDeptFilter('ALL');
      if (formData) {
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
      } else {
        reset({
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
        });
      }
    }
  }, [isOpen, formData, reset]);

  const watchClientId = watch('client_id');
  const watchStartDate = watch('start_date');
  const watchDeadline = watch('deadline');
  const selectedTeamMemberIds = watch('initial_team_member_ids') || [];
  const projectTeam = watch('project_team') || [];

  // Find active client object with all metadata
  const selectedClient = useMemo(() => {
    if (drawerMode === 'edit') {
      if (formData?.client && typeof formData.client === 'object') return formData.client;
      const match = clientsList.find((c) => String(c.id) === String(formData?.client_id));
      if (match) return match;
      return {
        client_name: formData?.client_name || 'Associated Client',
        is_active: formData?.client_is_active !== false,
      };
    }
    if (!watchClientId) return null;
    return clientsList.find((c) => String(c.id) === String(watchClientId)) || null;
  }, [drawerMode, formData, watchClientId, clientsList]);

  // Calculate project duration
  const durationInfo = useMemo(() => {
    if (!watchStartDate || !watchDeadline) return null;
    try {
      const s = parseISO(watchStartDate);
      const d = parseISO(watchDeadline);
      const days = differenceInCalendarDays(d, s) + 1;
      if (days < 0) return null;
      const months = (days / 30).toFixed(1);
      return { days, months };
    } catch {
      return null;
    }
  }, [watchStartDate, watchDeadline]);

  // Dynamic department list with member counts
  const departmentCounts = useMemo(() => {
    const counts = {};
    myTeamEmployees.forEach((emp) => {
      const deptName = emp.department_name || emp.profile?.department_name || 'Engineering';
      counts[deptName] = (counts[deptName] || 0) + 1;
    });
    return counts;
  }, [myTeamEmployees]);

  // Selected department breakdown counts
  const selectedDeptCounts = useMemo(() => {
    const counts = {};
    selectedTeamMemberIds.forEach((id) => {
      const emp = myTeamEmployees.find((e) => e.id === id);
      if (emp) {
        const rawDept = emp.department_name || emp.profile?.department_name || 'Engineering';
        const deptName = rawDept
          .replace(' Department', '')
          .replace('Engineering', 'Eng')
          .replace('Quality Assurance & Testing', 'QA')
          .replace('Cloud Infrastructure & DevOps', 'DevOps');
        counts[deptName] = (counts[deptName] || 0) + 1;
      }
    });
    return counts;
  }, [selectedTeamMemberIds, myTeamEmployees]);

  // Filtered employees list
  const filteredEmployees = useMemo(() => {
    const q = memberSearchQuery.toLowerCase().trim();
    return myTeamEmployees.filter((emp) => {
      const deptName = emp.department_name || emp.profile?.department_name || 'Engineering';
      const fullName = emp.full_name || emp.profile?.full_name || emp.email || '';
      const email = emp.email || '';

      const matchDept = selectedDeptFilter === 'ALL' || deptName === selectedDeptFilter;
      const matchSearch =
        !q || fullName.toLowerCase().includes(q) || email.toLowerCase().includes(q) || deptName.toLowerCase().includes(q);

      return matchDept && matchSearch;
    });
  }, [myTeamEmployees, memberSearchQuery, selectedDeptFilter]);

  // Quick Select / Deselect actions
  const handleSelectAll = () => {
    if (isClientInactive) return;
    const allFilteredIds = filteredEmployees.map((e) => e.id);
    const merged = Array.from(new Set([...selectedTeamMemberIds, ...allFilteredIds]));
    setValue('initial_team_member_ids', merged);
  };

  const handleDeselectAll = () => {
    if (isClientInactive) return;
    const lockedIds = projectTeam.filter((m) => (m.active_tasks_count || 0) > 0).map((m) => m.id);
    const filteredIdsSet = new Set(filteredEmployees.map((e) => e.id));
    const nextSelected = selectedTeamMemberIds.filter((id) => lockedIds.includes(id) || !filteredIdsSet.has(id));
    setValue('initial_team_member_ids', nextSelected);
  };

  const handleFormSubmit = (data) => {
    onSubmit(data);
  };

  return (
    <SideDrawer
      isOpen={isOpen}
      onClose={onClose}
      size="2xl"
      headerClassName="px-5 py-3"
      bodyClassName="p-4 pb-2 space-y-0"
      title={
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-600 font-bold">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 tracking-tight leading-tight">
              {drawerMode === 'create' ? 'Create New Project (Job)' : 'Edit Project Governance & Team'}
            </h2>
            <p className="text-[10px] text-slate-500 font-normal">
              Enterprise 2-column configuration • Scope, Client, & Resource Capacity
            </p>
          </div>
        </div>
      }
    >
      <form onSubmit={handleSubmit(handleFormSubmit)} className="flex flex-col h-full text-xs">
        
        {/* Frozen Alert Banner (If Client is Inactive) */}
        {isClientInactive && (
          <div className="mb-3 p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-center gap-2 shadow-xs">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <div>
              <p className="font-extrabold text-rose-900 text-[11px]">PROJECT FROZEN — CLIENT DEACTIVATED</p>
              <p className="text-rose-700 leading-relaxed text-[10px]">
                Client <strong>"{formData?.client_name}"</strong> is inactive. Project parameters and team membership are locked.
              </p>
            </div>
          </div>
        )}

        {/* 2-Column Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 pb-2">
          
          {/* ================= LEFT COLUMN: Project Details & Dark Client Section (7/12) ================= */}
          <div className="lg:col-span-7 space-y-3">
            
            {/* Box 1: Project Specifications */}
            <div className="bg-white p-3 rounded-xl border border-slate-200/90 shadow-2xs space-y-2.5">
              <div className="flex items-center gap-1.5 pb-1.5 border-b border-slate-100">
                <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                <h3 className="text-[11px] font-bold text-slate-900 uppercase tracking-wider">1. Project Specifications</h3>
              </div>

              {/* Project Name */}
              <div>
                <InputField
                  label="Project Name"
                  {...register('job_name')}
                  placeholder="e.g. Enterprise ERP Platform Phase 1"
                  disabled={isClientInactive}
                  error={errors.job_name?.message}
                  required
                />
              </div>

              {/* Project Code & Priority */}
              <div className="grid grid-cols-2 gap-2.5">
                <InputField
                  label="Project Code"
                  {...register('job_code')}
                  placeholder="e.g. JOB-ERP-01"
                  disabled={drawerMode === 'edit'}
                  error={errors.job_code?.message}
                  helperText={drawerMode === 'edit' ? 'System identifier.' : undefined}
                />

                <Controller
                  name="priority"
                  control={control}
                  render={({ field }) => (
                    <SelectDropdown
                      label="Priority Level"
                      theme="light"
                      disabled={isClientInactive}
                      value={field.value || 'MEDIUM'}
                      onChange={field.onChange}
                      required={true}
                      options={[
                        { value: 'HIGH', label: '🔴 High Priority' },
                        { value: 'MEDIUM', label: '🟡 Medium Priority' },
                        { value: 'LOW', label: '🔵 Low Priority' },
                      ]}
                    />
                  )}
                />
              </div>

              {/* Start Date & Deadline with Auto Duration Badge */}
              <div className="grid grid-cols-2 gap-2.5">
                <InputField
                  label="Start Date"
                  type="date"
                  {...register('start_date')}
                  disabled={drawerMode === 'edit'}
                  error={errors.start_date?.message}
                  required
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

              {/* Duration Summary Pill */}
              {durationInfo && (
                <div className="flex items-center justify-between text-[10px] px-2.5 py-1 bg-blue-50/70 border border-blue-100 rounded-lg text-blue-800">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Calendar className="w-3 h-3 text-blue-600 shrink-0" />
                    Estimated Sprint: <strong>{durationInfo.days} Calendar Days</strong>
                  </span>
                  <span className="text-blue-600 font-semibold text-[9px] bg-blue-100/80 px-1.5 py-0.5 rounded">
                    ~{durationInfo.months} Months
                  </span>
                </div>
              )}

              {/* Description */}
              <div>
                <label className="block font-bold text-slate-700 mb-0.5 text-[11px]">Project Scope & Deliverables</label>
                <textarea
                  rows={2}
                  {...register('description')}
                  disabled={isClientInactive}
                  placeholder="Enter project deliverables, scope milestones, and governance notes..."
                  className={cn(
                    'w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-400 resize-none',
                    isClientInactive && 'opacity-60 cursor-not-allowed bg-slate-100'
                  )}
                />
                {errors.description && (
                  <p className="text-rose-500 text-[10px] font-medium mt-0.5">{errors.description.message}</p>
                )}
              </div>
            </div>

            {/* ================= BOX 2: NEUMORPHISM SOFT MATTE GRAY THEME (Client Association & Governance) ================= */}
            <div className="bg-[#e8ecf2] border border-white/80 rounded-2xl p-3 shadow-[6px_6px_14px_rgba(166,178,198,0.42),-6px_-6px_14px_rgba(255,255,255,0.9)] space-y-2.5 text-slate-800">
              
              {/* Neumorphic Section Header */}
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-300/50">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.6)]"></span>
                  <h3 className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">2. Client Association & Governance</h3>
                </div>
                <span className="text-[9px] text-slate-600 font-mono font-medium px-2 py-0.5 bg-[#e0e5ed] rounded-full shadow-[inset_1px_1px_3px_rgba(166,178,198,0.4),inset_-1px_-1px_3px_rgba(255,255,255,0.8)] border border-white/60">
                  1 Client = 1 Manager Model
                </span>
              </div>

              {/* Client Dropdown (Create Mode) or Read-only Header (Edit Mode) */}
              {drawerMode === 'create' ? (
                <div>
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 mb-1">
                    <span>Select Enterprise Client <span className="text-rose-500">*</span></span>
                    <span className="text-[9px] text-slate-500 font-normal">Active Corporate Partners</span>
                  </div>
                  <select
                    {...register('client_id')}
                    className={cn(
                      'w-full bg-[#e2e8f0] border rounded-xl px-3 py-1.5 text-xs text-slate-800 font-semibold shadow-[inset_2px_2px_5px_rgba(166,178,198,0.5),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] focus:outline-none cursor-pointer transition',
                      errors.client_id
                        ? 'border-rose-500 focus:ring-2 focus:ring-rose-500/50'
                        : 'border-slate-200/80 focus:ring-2 focus:ring-blue-500/50'
                    )}
                  >
                    <option value="" className="text-slate-400">-- Choose Enterprise Client --</option>
                    {clientOptions.map((c) => (
                      <option key={c.value} value={c.value} className="bg-white text-slate-800">
                        {c.label}
                      </option>
                    ))}
                  </select>
                  {errors.client_id && (
                    <p className="text-rose-600 text-[10px] font-bold mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 text-rose-500 shrink-0" />
                      {errors.client_id.message}
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-between p-2 bg-[#e2e8f0] rounded-xl shadow-[inset_2px_2px_5px_rgba(166,178,198,0.45),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] border border-slate-200/60">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span className="font-bold text-slate-800 text-xs">{formData?.client_name || 'Associated Client'}</span>
                  </div>
                  <span className="text-[9px] font-mono px-2 py-0.5 bg-[#eef2f6] text-slate-600 rounded-full shadow-[1px_1px_3px_rgba(166,178,198,0.3)]">
                    Read-only
                  </span>
                </div>
              )}

              {/* Dynamic Rich Client Model Details Card (Neumorphic Extruded Surface) */}
              {selectedClient ? (
                <div className="p-2.5 bg-[#edf2f8] border border-white/90 rounded-xl space-y-2 shadow-[3px_3px_8px_rgba(166,178,198,0.35),-3px_-3px_8px_rgba(255,255,255,0.9)]">
                  
                  {/* Company Title, Industry & Status Badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-extrabold text-[11px] shadow-[2px_2px_6px_rgba(59,130,246,0.35)] shrink-0">
                        {(selectedClient.client_name || 'CL').substring(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-[11px] font-bold text-slate-900 tracking-tight truncate">
                          {selectedClient.client_name || 'Enterprise Client'}
                        </h4>
                        <p className="text-[10px] font-semibold text-blue-600 flex items-center gap-1 mt-0.5 truncate">
                          <Building2 className="w-2.5 h-2.5 text-blue-600 shrink-0" />
                          {selectedClient.industry || 'Corporate Partner'}
                        </p>
                      </div>
                    </div>

                    <span
                      className={cn(
                        'px-2 py-0.5 rounded-full text-[9px] font-bold border shadow-[1px_1px_3px_rgba(166,178,198,0.25)] flex items-center gap-1 shrink-0',
                        selectedClient.is_active !== false
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                      )}
                    >
                      <span
                        className={cn(
                          'w-1.5 h-1.5 rounded-full',
                          selectedClient.is_active !== false ? 'bg-emerald-500 animate-ping' : 'bg-rose-500'
                        )}
                      ></span>
                      {selectedClient.is_active !== false ? 'Active Partner' : 'Inactive'}
                    </span>
                  </div>

                  {/* 2-Column Model Fields Meta Grid (Neumorphic Inset Sub-blocks) */}
                  <div className="grid grid-cols-2 gap-1.5 pt-1.5 border-t border-slate-300/40 text-[10px]">
                    
                    {/* Contact Person & Email */}
                    <div className="bg-[#e4ebf3] p-1.5 rounded-lg shadow-[inset_1.5px_1.5px_3.5px_rgba(166,178,198,0.4),inset_-1.5px_-1.5px_3.5px_rgba(255,255,255,0.85)] border border-slate-200/40 min-w-0">
                      <span className="text-slate-500 block text-[9px] font-semibold uppercase tracking-wider">Contact Person</span>
                      <span className="font-bold text-slate-800 block mt-0.5 truncate">
                        {selectedClient.contact_person || 'Representative'}
                      </span>
                      {selectedClient.contact_email && (
                        <span className="text-slate-600 text-[9px] truncate block flex items-center gap-1 mt-0.5">
                          <Mail className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                          {selectedClient.contact_email}
                        </span>
                      )}
                    </div>

                    {/* Tax Code & Hotline */}
                    <div className="bg-[#e4ebf3] p-1.5 rounded-lg shadow-[inset_1.5px_1.5px_3.5px_rgba(166,178,198,0.4),inset_-1.5px_-1.5px_3.5px_rgba(255,255,255,0.85)] border border-slate-200/40 min-w-0">
                      <span className="text-slate-500 block text-[9px] font-semibold uppercase tracking-wider">Tax Code & Hotline</span>
                      <span className="font-mono font-bold text-slate-800 block mt-0.5 truncate">
                        {selectedClient.tax_code || 'N/A'}
                      </span>
                      {selectedClient.contact_phone && (
                        <span className="text-slate-600 text-[9px] truncate block flex items-center gap-1 mt-0.5">
                          <Phone className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                          {selectedClient.contact_phone}
                        </span>
                      )}
                    </div>

                    {/* Headquarter Address */}
                    {selectedClient.address && (
                      <div className="col-span-2 bg-[#e4ebf3] p-1.5 rounded-lg shadow-[inset_1.5px_1.5px_3.5px_rgba(166,178,198,0.4),inset_-1.5px_-1.5px_3.5px_rgba(255,255,255,0.85)] border border-slate-200/40">
                        <span className="text-slate-500 block text-[9px] font-semibold uppercase tracking-wider flex items-center gap-1">
                          <MapPin className="w-2.5 h-2.5 text-slate-400" /> Headquarters Address
                        </span>
                        <span className="text-slate-700 text-[10px] font-medium block mt-0.5 leading-snug">
                          {selectedClient.address}
                        </span>
                      </div>
                    )}

                    {/* Notes / Governance */}
                    {selectedClient.notes && (
                      <div className="col-span-2 bg-[#e4ebf3] p-1.5 rounded-lg shadow-[inset_1.5px_1.5px_3.5px_rgba(166,178,198,0.4),inset_-1.5px_-1.5px_3.5px_rgba(255,255,255,0.85)] border border-slate-200/40">
                        <span className="text-slate-500 block text-[9px] font-semibold uppercase tracking-wider flex items-center gap-1">
                          <FileText className="w-2.5 h-2.5 text-slate-400" /> Partnership Notes
                        </span>
                        <span className="text-slate-600 italic text-[9px] block mt-0.5">
                          "{selectedClient.notes}"
                        </span>
                      </div>
                    )}
                  </div>

                </div>
              ) : (
                <div className="p-3 bg-[#e2e8f0] border border-dashed border-slate-300 rounded-xl text-center text-slate-500 text-[11px] shadow-[inset_2px_2px_5px_rgba(166,178,198,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.8)]">
                  <Building2 className="w-5 h-5 mx-auto mb-1 text-slate-400 opacity-70" />
                  Please select an enterprise client above to inspect governance and contact metadata.
                </div>
              )}

            </div>

          </div>

          {/* ================= RIGHT COLUMN: Team Assignment & Capacity Matrix (5/12) ================= */}
          <div className="lg:col-span-5 flex flex-col bg-white rounded-xl border border-slate-200/90 shadow-2xs p-3 min-h-[500px]">
            
            {/* Team Header */}
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 shrink-0">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                  <h3 className="text-[11px] font-bold text-slate-900 uppercase tracking-wider">3. Allocate Team Capacity</h3>
                </div>
                <p className="text-[10px] text-slate-500 mt-0.5">Assign specialists to project lifecycle.</p>
              </div>
              <div className="text-right">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {selectedTeamMemberIds.length} / {myTeamEmployees.length} Selected
                </span>
              </div>
            </div>

            {/* Search & Department Filters */}
            <div className="pt-2 space-y-1.5 shrink-0">
              
              {/* Search input */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" />
                <input
                  type="text"
                  value={memberSearchQuery}
                  onChange={(e) => setMemberSearchQuery(e.target.value)}
                  placeholder="Search member name, email, department..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-7 pr-2.5 py-1 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                />
              </div>

              {/* Department Filter Chips */}
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
                  All ({myTeamEmployees.length})
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

              {/* Quick Select / Clear Controls */}
              {!isClientInactive && (
                <div className="flex items-center justify-between text-[10px] px-0.5">
                  <span className="text-slate-400 text-[9px] font-medium">
                    Showing {filteredEmployees.length} specialist{filteredEmployees.length !== 1 ? 's' : ''}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      className="text-indigo-600 hover:underline font-semibold cursor-pointer"
                    >
                      Select All
                    </button>
                    <span className="text-slate-300">•</span>
                    <button
                      type="button"
                      onClick={handleDeselectAll}
                      className="text-slate-500 hover:underline font-medium cursor-pointer"
                    >
                      Clear All
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Scrollable Employee Cards List - FULL FLEX-1 WITHOUT RESTRICTIVE MAX-H */}
            <div className="mt-2 flex-1 overflow-y-auto custom-scrollbar space-y-1.5 pr-0.5">
              {filteredEmployees.length === 0 ? (
                <div className="py-6 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <Users className="w-5 h-5 mx-auto mb-1 text-slate-400 opacity-60" />
                  No specialists match your search criteria.
                </div>
              ) : (
                filteredEmployees.map((emp) => {
                  const memberInfo = projectTeam.find((m) => m.id === emp.id);
                  const activeTasksCount = memberInfo?.active_tasks_count || 0;
                  const isLocked =
                    (drawerMode === 'edit' && activeTasksCount > 0) ||
                    (drawerMode === 'edit' && formData?.client_is_active === false);
                  const isChecked = isLocked || selectedTeamMemberIds.includes(emp.id);
                  const fullName = emp.full_name || emp.profile?.full_name || emp.email;
                  const deptName = emp.department_name || emp.profile?.department_name || 'Engineering';

                  return (
                    <label
                      key={emp.id}
                      className={cn(
                        'flex items-center justify-between p-2 rounded-lg transition text-xs border',
                        isLocked
                          ? 'bg-slate-100/90 border-slate-200/80 cursor-not-allowed select-none'
                          : isChecked
                          ? 'border-indigo-200 bg-indigo-50/40 hover:bg-indigo-50 cursor-pointer shadow-2xs'
                          : 'border-slate-200 bg-white hover:bg-slate-50 cursor-pointer'
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0 pr-1.5">
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
                            'rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer shrink-0',
                            isLocked && 'opacity-60 cursor-not-allowed'
                          )}
                        />

                        {/* Avatar */}
                        <div
                          className={cn(
                            'w-6 h-6 rounded-full flex items-center justify-center font-bold text-[9px] shrink-0 text-white',
                            isChecked ? 'bg-indigo-600' : 'bg-slate-400'
                          )}
                        >
                          {fullName.substring(0, 2).toUpperCase()}
                        </div>

                        <div className="min-w-0">
                          <p className={cn('text-xs font-semibold truncate', isLocked ? 'text-slate-700' : 'text-slate-900')}>
                            {fullName}
                          </p>
                          <p className="text-[9px] text-slate-400 truncate">{emp.email}</p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        {isLocked ? (
                          <span
                            title="Cannot remove member with active task assignments"
                            className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1"
                          >
                            <Lock className="w-2 h-2" />
                            {activeTasksCount > 0 ? `${activeTasksCount} active task${activeTasksCount > 1 ? 's' : ''}` : 'Locked'}
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-slate-100 text-slate-600 border border-slate-200/60">
                            {deptName.replace(' Department', '').replace('Engineering', 'Eng').replace('Quality Assurance & Testing', 'QA').replace('Cloud Infrastructure & DevOps', 'DevOps')}
                          </span>
                        )}
                      </div>
                    </label>
                  );
                })
              )}
            </div>

            {/* Capacity Allocation Breakdown Footer Bar - PINNED AT THE BOTTOM */}
            <div className="mt-auto pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-1 text-[9px] shrink-0">
              <span className="font-semibold text-slate-500 uppercase tracking-wider text-[8.5px]">
                Allocated:
              </span>
              <div className="flex flex-wrap items-center gap-1">
                {Object.keys(selectedDeptCounts).length === 0 ? (
                  <span className="text-slate-400 italic">None selected</span>
                ) : (
                  Object.entries(selectedDeptCounts).map(([dept, count]) => (
                    <span
                      key={dept}
                      className="px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold"
                    >
                      {dept}: {count}
                    </span>
                  ))
                )}
              </div>
            </div>

          </div>

        </div>

        {/* Sticky Footer Toolbar - With Generous Safe Bottom Padding */}
        <div className="mt-auto pt-3 pb-4 border-t border-slate-200 flex items-center justify-between shrink-0 bg-white">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="flex items-center gap-1 font-medium text-slate-700 text-[11px]">
              <Building2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              Client: <strong className="text-slate-900">{selectedClient?.client_name || 'None Selected'}</strong>
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-[11px]">
              Team: <strong className="text-indigo-600">{selectedTeamMemberIds.length} Members</strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 cursor-pointer font-medium transition text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || isClientInactive}
              className={cn(
                'px-5 py-2 font-bold rounded-lg shadow-xs transition flex items-center gap-1 text-xs',
                isClientInactive
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none border border-slate-300'
                  : 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer disabled:opacity-50'
              )}
            >
              {isPending ? (
                'Saving...'
              ) : drawerMode === 'create' ? (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  Create Project
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </div>

      </form>
    </SideDrawer>
  );
}
