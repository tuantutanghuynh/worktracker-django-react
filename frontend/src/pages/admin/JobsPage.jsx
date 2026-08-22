import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Search } from 'lucide-react';
import BaseModal from '../../components/common/modal/BaseModal';
import InputField from '../../components/common/forms/InputField';
import SelectDropdown from '../../components/common/forms/SelectDropdown';
import SortableHeader from '../../components/common/table/SortableHeader';
import PriorityBadge from '../../components/common/badges/PriorityBadge';
import StatusBadge from '../../components/common/badges/StatusBadge';
import { useDebounce } from '../../hooks/useDebounce';
import { useOrdering } from '../../hooks/useOrdering';
import { listJobs, createJob } from '../../api/jobs';
import { listClients } from '../../api/clients';
import { listUsers } from '../../api/users';

const PRIORITY_OPTIONS = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
];

// Mirrors JobSerializer.validate() on the backend (deadline must be on or
// after start_date, not strictly after — matching that exactly instead of
// being stricter here avoids the frontend rejecting something the API
// would actually accept).
const jobSchema = z
  .object({
    client: z.string().min(1, 'Client is required'),
    manager: z.string().min(1, 'Manager is required'),
    job_name: z.string().min(1, 'Job name is required'),
    job_code: z.string().optional(),
    priority: z.string().min(1, 'Priority is required'),
    description: z.string().optional(),
    start_date: z.string().min(1, 'Start date is required'),
    deadline: z.string().min(1, 'Deadline is required'),
  })
  .refine((data) => data.deadline >= data.start_date, {
    message: 'Deadline must be on or after start date',
    path: ['deadline'],
  });

// Admin page for Master Job Management — list existing jobs + create new
// ones with a Client/Manager picker and deadline validation.
export function JobsPage() {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const [ordering, toggleSort] = useOrdering();

  // Server-side search + sort — JobViewSet.get_queryset() handles ?search=
  // (OR across job name/client name/manager email) and OrderingFilter
  // handles ?ordering= (including __ lookups like client__client_name).
  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['jobs', { search: debouncedSearch, ordering }],
    queryFn: () => listJobs({ search: debouncedSearch || undefined, ordering: ordering || undefined }),
  });

  // Only active clients — the backend rejects assigning a job to an
  // inactive client anyway (JobSerializer.validate_client), so filtering
  // here keeps the dropdown from offering an option that would 400.
  const { data: clients = [] } = useQuery({
    queryKey: ['clients', { is_active: true }],
    queryFn: () => listClients({ is_active: true }),
  });
  const clientOptions = clients.map((c) => ({ value: String(c.id), label: c.client_name }));
  const clientNameById = Object.fromEntries(clients.map((c) => [c.id, c.client_name]));

  const { data: managers = [] } = useQuery({
    queryKey: ['users', { role: 'MANAGER' }],
    queryFn: () => listUsers({ role: 'MANAGER' }),
  });
  const managerOptions = managers.map((m) => ({ value: String(m.id), label: m.email }));
  const managerEmailById = Object.fromEntries(managers.map((m) => [m.id, m.email]));

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm({ resolver: zodResolver(jobSchema), defaultValues: { priority: 'MEDIUM' } });

  const createMutation = useMutation({
    mutationFn: (payload) => createJob(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      toast.success('Job created.');
      setIsCreateOpen(false);
      reset({ priority: 'MEDIUM' });
    },
    onError: (err) => {
      const data = err.response?.data;
      // Most DRF field errors come back as an array (["msg"]), but
      // JobSerializer.validate() raises the deadline check as a plain
      // string — normalize both shapes instead of assuming one.
      const firstMessage = (value) => (Array.isArray(value) ? value[0] : value);
      const msg =
        firstMessage(data?.deadline) ||
        firstMessage(data?.client) ||
        firstMessage(data?.job_code) ||
        data?.detail ||
        'Failed to create job.';
      toast.error(msg);
    },
  });

  function openCreate() {
    reset({
      client: '',
      manager: '',
      job_name: '',
      job_code: '',
      priority: 'MEDIUM',
      description: '',
      start_date: '',
      deadline: '',
    });
    setIsCreateOpen(true);
  }

  function onSubmit(data) {
    createMutation.mutate({
      client: Number(data.client),
      manager: Number(data.manager),
      job_name: data.job_name,
      job_code: data.job_code || null,
      priority: data.priority,
      description: data.description || null,
      start_date: data.start_date,
      deadline: data.deadline,
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-900">Jobs</h1>
        <button
          type="button"
          onClick={openCreate}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" /> New Job
        </button>
      </div>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search job, client, manager..."
          className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50">
            <tr>
              <SortableHeader label="Job" sortKey="job_name" ordering={ordering} onSort={toggleSort} />
              <SortableHeader label="Client" sortKey="client__client_name" ordering={ordering} onSort={toggleSort} />
              <SortableHeader label="Manager" sortKey="manager__email" ordering={ordering} onSort={toggleSort} />
              <SortableHeader label="Priority" sortKey="priority" ordering={ordering} onSort={toggleSort} />
              <SortableHeader label="Status" sortKey="status" ordering={ordering} onSort={toggleSort} />
              <SortableHeader label="Deadline" sortKey="deadline" ordering={ordering} onSort={toggleSort} />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                  Loading...
                </td>
              </tr>
            )}
            {!isLoading && jobs.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                  {search ? 'No jobs match your search.' : 'No jobs yet.'}
                </td>
              </tr>
            )}
            {jobs.map((job) => (
              <tr key={job.id}>
                <td className="px-4 py-3 font-medium text-slate-900">{job.job_name}</td>
                <td className="px-4 py-3 text-slate-500">{clientNameById[job.client] || job.client}</td>
                <td className="px-4 py-3 text-slate-500">{managerEmailById[job.manager] || job.manager}</td>
                <td className="px-4 py-3">
                  <PriorityBadge priority={job.priority} />
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={job.status} />
                </td>
                <td className="px-4 py-3 text-slate-500">{job.deadline}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <BaseModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="New Job" maxWidth="max-w-lg">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <InputField label="Job Name" error={errors.job_name?.message} {...register('job_name')} />

          <div className="grid grid-cols-2 gap-3">
            <Controller
              name="client"
              control={control}
              render={({ field }) => (
                <SelectDropdown
                  label="Client"
                  options={clientOptions}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.client?.message}
                />
              )}
            />
            <Controller
              name="manager"
              control={control}
              render={({ field }) => (
                <SelectDropdown
                  label="Manager"
                  options={managerOptions}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.manager?.message}
                />
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <InputField label="Start Date" type="date" error={errors.start_date?.message} {...register('start_date')} />
            <InputField label="Deadline" type="date" error={errors.deadline?.message} {...register('deadline')} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Controller
              name="priority"
              control={control}
              render={({ field }) => (
                <SelectDropdown
                  label="Priority"
                  options={PRIORITY_OPTIONS}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.priority?.message}
                />
              )}
            />
            <InputField label="Job Code (optional)" error={errors.job_code?.message} {...register('job_code')} />
          </div>

          <InputField
            label="Description (optional)"
            error={errors.description?.message}
            {...register('description')}
          />

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="rounded-lg bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {createMutation.isPending ? 'Creating...' : 'Create Job'}
            </button>
          </div>
        </form>
      </BaseModal>
    </div>
  );
}
