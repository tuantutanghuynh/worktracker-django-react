import { useEffect, useRef, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Plus, Search, Pencil, Ban, Users } from 'lucide-react';
import BaseModal from '../../components/common/modal/BaseModal';
import ConfirmModal from '../../components/common/modal/ConfirmModal';
import InputField from '../../components/common/forms/InputField';
import SelectDropdown from '../../components/common/forms/SelectDropdown';
import SortableHeader from '../../components/common/table/SortableHeader';
import PaginationBar from '../../components/common/table/PaginationBar';
import ExportButton from '../../components/common/table/ExportButton';
import PriorityBadge from '../../components/common/badges/PriorityBadge';
import StatusBadge from '../../components/common/badges/StatusBadge';
import { useDebounce } from '../../hooks/useDebounce';
import { useOrdering } from '../../hooks/useOrdering';
import {
  useAdminJobs,
  useCreateJob,
  useUpdateJob,
  useCancelJob,
  useAcquireJobLock,
  useReleaseJobLock,
} from '../../hooks/queries/admin/useAdminJobs';
import { useAdminClients } from '../../hooks/queries/admin/useAdminClients';
import { useAdminUsers } from '../../hooks/queries/admin/useAdminUsers';
import { getErrorMessage } from '../../utils/errorMessages';

const PAGE_SIZE = 10; // khớp AdminPageNumberPagination.page_size ở backend

const PRIORITY_OPTIONS = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
];

const STATUS_LABELS = {
  PLANNING: 'Planning',
  ACTIVE: 'Active',
  ON_HOLD: 'On Hold',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

const STATUS_OPTIONS = Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }));

// Bản sao ĐÚNG NGUYÊN của JobSerializer.ALLOWED_TRANSITIONS (backend, xem
// projects/admin/serializers.py). Dropdown Status chỉ liệt kê trạng thái
// thật sự chuyển được từ trạng thái hiện tại — trước đây hiện đủ 5 nên
// người dùng chọn xong bấm Save mới bị backend trả lỗi 400.
// Backend vẫn là nơi quyết định cuối cùng, đây chỉ là lớp chặn sớm cho UX.
const ALLOWED_TRANSITIONS = {
  PLANNING: ['ACTIVE', 'CANCELLED'],
  ACTIVE: ['ON_HOLD', 'COMPLETED', 'CANCELLED'],
  ON_HOLD: ['ACTIVE', 'CANCELLED'],
  COMPLETED: ['ACTIVE'],
  CANCELLED: ['ACTIVE'],
};

// Trạng thái hiện tại luôn nằm trong danh sách (giữ nguyên = hợp lệ), kèm
// các trạng thái chuyển được. Trả về [] nếu chưa biết trạng thái hiện tại.
function getStatusOptionsFor(currentStatus) {
  if (!currentStatus) return STATUS_OPTIONS;
  const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];
  return [currentStatus, ...allowed].map((value) => ({
    value,
    label: value === currentStatus ? `${STATUS_LABELS[value]} (current)` : STATUS_LABELS[value],
  }));
}

// Mirrors JobSerializer.validate() on the backend (deadline must be on or
// after start_date, not strictly after — matching that exactly instead of
// being stricter here avoids the frontend rejecting something the API
// would actually accept).
const jobSchema = z
  .object({
    client: z.string().min(1, 'Client is required'),
    manager: z.string().min(1, 'Manager is required'),
    job_name: z.string().trim().min(1, 'Job name is required'),
    job_code: z.string().optional(),
    priority: z.string().min(1, 'Priority is required'),
    description: z.string().optional(),
    start_date: z.string().min(1, 'Start date is required'),
    deadline: z.string().min(1, 'Deadline is required'),
  })
  .refine((data) => data.deadline >= format(new Date(), 'yyyy-MM-dd'), {
    message: 'Deadline cannot be in the past',
    path: ['deadline'],
  })
  .refine((data) => data.deadline >= data.start_date, {
    message: 'Deadline must be on or after start date',
    path: ['deadline'],
  });

// Edit deliberately excludes `client` — JobSerializer.validate_client()
// rejects ANY value pointing at an inactive client, including the job's own
// current one if it was deactivated after the job was created. Sending
// `client` unchanged on every edit would then 400 for jobs whose client
// happened to go inactive later, so this form just never touches it.
const editJobSchema = z
  .object({
    manager: z.string().min(1, 'Manager is required'),
    job_name: z.string().trim().min(1, 'Job name is required'),
    priority: z.string().min(1, 'Priority is required'),
    status: z.string().min(1, 'Status is required'),
    description: z.string().optional(),
    start_date: z.string().min(1, 'Start date is required'),
    deadline: z.string().min(1, 'Deadline is required'),
  })
  .refine((data) => data.deadline >= data.start_date, {
    message: 'Deadline must be on or after start date',
    path: ['deadline'],
  });

// Admin page for Master Job Management — list existing jobs, create new
// ones, edit/reassign manager, and cancel. Data logic lives in
// hooks/queries/admin/useAdminJobs.js — this file is JSX only.
export function JobsPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const [ordering, toggleSort] = useOrdering();
  const [page, setPage] = useState(1);

  // Adjusting state during render instead of a useEffect — see the same
  // comment on ClientsPage for why.
  const filterKey = `${debouncedSearch}|${ordering}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setPage(1);
  }

  const { data, isLoading } = useAdminJobs({
    search: debouncedSearch || undefined,
    ordering: ordering || undefined,
    page,
  });
  const jobs = data?.results || [];
  const totalCount = data?.count || 0;

  // Fetches every client regardless of is_active — needed so a job whose
  // client was later deactivated still shows its real name in the table
  // instead of falling back to a bare numeric id (the job itself is never
  // hidden by the backend when its client goes inactive, only the name
  // lookup broke when this only fetched active clients).
  // page_size=500 opts out of the default 10/page — needs every client.
  const { data: allClientsPage } = useAdminClients({ page_size: 500 });
  const allClients = allClientsPage?.results || [];
  const clientNameById = Object.fromEntries(allClients.map((c) => [c.id, c.client_name]));
  const clientActiveById = Object.fromEntries(allClients.map((c) => [c.id, c.is_active]));

  // The create-job dropdown still only offers active clients — the backend
  // rejects assigning a job to an inactive client anyway
  // (JobSerializer.validate_client), so this keeps the dropdown from
  // offering an option that would 400.
  const clientOptions = allClients
    .filter((c) => c.is_active)
    .map((c) => ({ value: String(c.id), label: c.client_name }));

  // Deliberately not filtered to is_active — a job's current manager may
  // since have been deactivated/locked, and that manager still needs to
  // show up here (marked Inactive) so reassigning away from them is
  // actually possible instead of the dropdown silently omitting them.
  const { data: managersPage } = useAdminUsers({ role: 'MANAGER', page_size: 500 });
  const managers = managersPage?.results || [];
  const managerOptions = managers.map((m) => ({
    value: String(m.id),
    label: m.is_active ? m.email : `${m.email} (Inactive)`,
  }));
  const managerEmailById = Object.fromEntries(managers.map((m) => [m.id, m.email]));

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm({ resolver: zodResolver(jobSchema), defaultValues: { priority: 'MEDIUM' } });

  const [editTarget, setEditTarget] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const {
    register: registerEdit,
    handleSubmit: handleEditSubmit,
    reset: resetEdit,
    control: editControl,
    formState: { errors: editErrors },
  } = useForm({ resolver: zodResolver(editJobSchema) });

  const createMutation = useCreateJob();
  const updateMutation = useUpdateJob();
  const cancelMutation = useCancelJob();
  const acquireLockMutation = useAcquireJobLock();
  const releaseLockMutation = useReleaseJobLock();

  // Mirrors editTarget's id into a ref purely so the unmount-safety effect
  // below can read the latest value in its cleanup without re-subscribing
  // on every change (and without reading a ref from render-time code,
  // which react-hooks/refs flags).
  const editTargetIdRef = useRef(null);
  useEffect(() => {
    editTargetIdRef.current = editTarget?.id ?? null;
  }, [editTarget]);

  // Safety net — if the admin navigates away without closing the modal
  // (route change, browser back), still release the lock instead of
  // leaving it held for the full 5-minute TTL.
  useEffect(() => {
    return () => {
      if (editTargetIdRef.current) releaseLockMutation.mutate(editTargetIdRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    createMutation.mutate(
      {
        client: Number(data.client),
        manager: Number(data.manager),
        job_name: data.job_name,
        job_code: data.job_code || null,
        priority: data.priority,
        description: data.description || null,
        start_date: data.start_date,
        deadline: data.deadline,
      },
      { onSuccess: () => setIsCreateOpen(false) }
    );
  }

  // Acquires the per-job editing lock before opening the modal — if another
  // admin already holds it, the backend returns 423 and the modal never
  // opens, avoiding two admins silently overwriting each other's changes.
  function openEditJob(job) {
    acquireLockMutation.mutate(job.id, {
      onSuccess: () => {
        resetEdit({
          manager: String(job.manager),
          job_name: job.job_name,
          priority: job.priority,
          status: job.status,
          description: job.description || '',
          start_date: job.start_date,
          deadline: job.deadline,
        });
        setEditTarget(job);
      },
      onError: (err) => toast.error(getErrorMessage(err, 'This job is currently being edited by someone else.')),
    });
  }

  function closeEditModal() {
    if (editTarget) releaseLockMutation.mutate(editTarget.id);
    setEditTarget(null);
  }

  function onSubmitEdit(data) {
    updateMutation.mutate(
      {
        id: editTarget.id,
        payload: {
          manager: Number(data.manager),
          job_name: data.job_name,
          priority: data.priority,
          status: data.status,
          description: data.description || null,
          start_date: data.start_date,
          deadline: data.deadline,
        },
      },
      { onSuccess: closeEditModal }
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-900">Jobs</h1>
        <div className="flex items-center gap-2">
          <ExportButton
            url="/admin/jobs/export/"
            params={{ search: debouncedSearch || undefined, ordering: ordering || undefined }}
            filename="worktracker_jobs.xlsx"
          />
          <button
            type="button"
            onClick={openCreate}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" /> New Job
          </button>
        </div>
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

      {/* table-fixed + width theo % nên bảng luôn vừa khung, không kéo ngang. */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full table-fixed text-left text-xs">
          <thead className="bg-slate-50">
            <tr>
              <SortableHeader label="Job" sortKey="job_name" ordering={ordering} onSort={toggleSort} className="w-[18%]" />
              <SortableHeader label="Client" sortKey="client__client_name" ordering={ordering} onSort={toggleSort} className="w-[14%]" />
              <SortableHeader label="Manager" sortKey="manager__email" ordering={ordering} onSort={toggleSort} className="w-[17%]" />
              <th className="w-[11%] px-3 py-2.5 text-left text-[11px] font-semibold uppercase text-slate-500">Team</th>
              <SortableHeader label="Priority" sortKey="priority" ordering={ordering} onSort={toggleSort} className="w-[10%]" />
              <SortableHeader label="Status" sortKey="status" ordering={ordering} onSort={toggleSort} className="w-[11%]" />
              <SortableHeader label="Deadline" sortKey="deadline" ordering={ordering} onSort={toggleSort} className="w-[10%]" />
              <th className="w-[9%] px-3 py-2.5 text-right text-[11px] font-semibold uppercase text-slate-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-slate-400">
                  Loading...
                </td>
              </tr>
            )}
            {!isLoading && jobs.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-slate-400">
                  {search ? 'No jobs match your search.' : 'No jobs yet.'}
                </td>
              </tr>
            )}
            {jobs.map((job) => (
              <tr key={job.id}>
                <td className="px-3 py-2 font-medium text-slate-900 truncate">
                  <button
                    type="button"
                    onClick={() => openEditJob(job)}
                    className="hover:text-blue-600 hover:underline cursor-pointer text-left truncate max-w-full"
                    title={job.job_name}
                  >
                    {job.job_name}
                  </button>
                </td>
                {/* Nhãn "Inactive" rút thành chấm tròn + tooltip — chuỗi dài
                    trước đây đẩy tên client/manager ra khỏi ô. */}
                <td className="px-3 py-2 text-slate-500 truncate" title={clientNameById[job.client] || job.client}>
                  {clientActiveById[job.client] === false && (
                    <span
                      className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-slate-400 align-middle"
                      title="Inactive client"
                    />
                  )}
                  {clientNameById[job.client] || job.client}
                </td>
                <td className="px-3 py-2 text-slate-500 truncate" title={managerEmailById[job.manager] || job.manager}>
                  {managers.find((m) => m.id === job.manager)?.is_active === false && (
                    <span
                      className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-amber-500 align-middle"
                      title="Inactive manager"
                    />
                  )}
                  {managerEmailById[job.manager] || job.manager}
                </td>
                <td className="px-3 py-2 text-slate-600 truncate">
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 font-semibold text-[11px] text-slate-700"
                    title={job.project_team?.map((m) => m.full_name || m.email).join(', ') || 'No team members allocated'}
                  >
                    <Users className="w-3 h-3 text-slate-400" />
                    {job.team_size || job.project_team?.length || 0}
                  </span>
                </td>
                <td className="px-3 py-2 truncate">
                  <PriorityBadge priority={job.priority} className="text-[10px] px-2" />
                </td>
                <td className="px-3 py-2 truncate">
                  <StatusBadge status={job.status} className="text-[10px] px-2" />
                </td>
                <td className="px-3 py-2 text-slate-500 truncate">{job.deadline}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => openEditJob(job)}
                      className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    {job.status !== 'CANCELLED' && (
                      <button
                        type="button"
                        onClick={() => setCancelTarget(job)}
                        className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                      >
                        <Ban className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <PaginationBar
          page={page}
          totalPages={Math.max(1, Math.ceil(totalCount / PAGE_SIZE))}
          onPageChange={setPage}
          totalItems={totalCount}
          pageSize={PAGE_SIZE}
        />
      </div>

      <BaseModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="New Job" maxWidth="max-w-2xl">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <InputField label="Job Name" required placeholder="Short, recognisable project name" error={errors.job_name?.message} {...register('job_name')} />

          <div className="grid grid-cols-2 gap-3">
            <Controller
              name="client"
              control={control}
              render={({ field }) => (
                <SelectDropdown
                  theme="light"
                  label="Client"
                  required
                  searchable
                  placeholder="Type to search..."
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
                  theme="light"
                  label="Manager"
                  required
                  searchable
                  placeholder="Type to search..."
                  options={managerOptions}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.manager?.message}
                />
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <InputField label="Start Date" required type="date" error={errors.start_date?.message} {...register('start_date')} />
            <InputField label="Deadline" required type="date" min={format(new Date(), 'yyyy-MM-dd')} error={errors.deadline?.message} {...register('deadline')} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Controller
              name="priority"
              control={control}
              render={({ field }) => (
                <SelectDropdown
                  theme="light"
                  label="Priority"
                  required
                  options={PRIORITY_OPTIONS}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.priority?.message}
                />
              )}
            />
            <InputField label="Job Code (optional)" placeholder="e.g. JOB-ERP-01" error={errors.job_code?.message} {...register('job_code')} />
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

      <BaseModal
        isOpen={!!editTarget}
        onClose={closeEditModal}
        title="Edit Job"
        description={editTarget?.job_name}
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleEditSubmit(onSubmitEdit)} className="space-y-3">
          <InputField label="Job Name" required placeholder="Short, recognisable project name" error={editErrors.job_name?.message} {...registerEdit('job_name')} />

          <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
            Client: <span className="font-semibold text-slate-700">{clientNameById[editTarget?.client]}</span>{' '}
            (fixed at creation)
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Controller
              name="manager"
              control={editControl}
              render={({ field }) => (
                <SelectDropdown
                  theme="light"
                  label="Manager"
                  required
                  searchable
                  placeholder="Type to search..."
                  options={managerOptions}
                  value={field.value}
                  onChange={field.onChange}
                  error={editErrors.manager?.message}
                />
              )}
            />
            <Controller
              name="status"
              control={editControl}
              render={({ field }) => (
                <SelectDropdown
                  theme="light"
                  label="Status"
                  required
                  options={getStatusOptionsFor(editTarget?.status)}
                  value={field.value}
                  onChange={field.onChange}
                  error={editErrors.status?.message}
                />
              )}
            />
          </div>

          {editTarget && (ALLOWED_TRANSITIONS[editTarget.status] || []).length < 4 && (
            <p className="-mt-1 text-[11px] text-slate-500">
              From <span className="font-semibold">{STATUS_LABELS[editTarget.status]}</span> you can only move to:{' '}
              <span className="font-semibold">
                {(ALLOWED_TRANSITIONS[editTarget.status] || []).map((s) => STATUS_LABELS[s]).join(', ') || 'no other status'}
              </span>
              .
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <InputField
              label="Start Date"
              required
              type="date"
              error={editErrors.start_date?.message}
              {...registerEdit('start_date')}
            />
            <InputField
              label="Deadline"
              required
              type="date"
              error={editErrors.deadline?.message}
              {...registerEdit('deadline')}
            />
          </div>

          <Controller
            name="priority"
            control={editControl}
            render={({ field }) => (
              <SelectDropdown
                theme="light"
                label="Priority"
                required
                options={PRIORITY_OPTIONS}
                value={field.value}
                onChange={field.onChange}
                error={editErrors.priority?.message}
              />
            )}
          />

          <InputField
            label="Description (optional)"
            error={editErrors.description?.message}
            {...registerEdit('description')}
          />

          {/* Project Team — CHI XEM.
              Admin tao Job rong roi gan cho Manager; Manager moi la nguoi
              chon nhan vien cua tuyen minh vao du an. Admin van xem duoc
              thanh vien de nam tinh hinh, nhung khong sua. */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-700">
                Project Team
              </label>
              <span className="text-[11px] text-slate-400">
                {(editTarget?.project_team || []).length} member(s)
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              The assigned Manager picks employees from their own reporting line. Admin has view-only access.
            </p>
            <div className="max-h-32 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/50 p-2 space-y-1 text-xs">
              {(editTarget?.project_team || []).length === 0 ? (
                <div className="text-slate-400 py-2 text-center">
                  The Manager has not assigned any employee yet
                </div>
              ) : (
                editTarget.project_team.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between gap-3 rounded-lg bg-white border border-slate-200/80 p-2"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-xs truncate text-slate-900">
                        {m.full_name || m.email}
                      </p>
                      <p className="text-[10px] text-slate-400 truncate">{m.email}</p>
                    </div>
                    <span className="text-[10px] text-slate-500 shrink-0">
                      {m.department_name || 'No Department'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={closeEditModal}
              className="rounded-lg bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </BaseModal>

      <ConfirmModal
        isOpen={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={() => cancelMutation.mutate(cancelTarget.id, { onSuccess: () => setCancelTarget(null) })}
        title="Cancel Job"
        description={`"${cancelTarget?.job_name}" will be marked CANCELLED — existing tasks are kept for history. Continue?`}
        confirmText="Cancel Job"
        variant="danger"
        isLoading={cancelMutation.isPending}
      />
    </div>
  );
}
