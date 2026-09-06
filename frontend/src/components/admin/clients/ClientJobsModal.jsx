import { useEffect, useRef, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Search, Ban, Users, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import BaseModal from '../../common/modal/BaseModal';
import ConfirmModal from '../../common/modal/ConfirmModal';
import InputField from '../../common/forms/InputField';
import SelectDropdown from '../../common/forms/SelectDropdown';
import SortableHeader from '../../common/table/SortableHeader';
import PaginationBar from '../../common/table/PaginationBar';
import ExportButton from '../../common/table/ExportButton';
import PriorityBadge from '../../common/badges/PriorityBadge';
import StatusBadge from '../../common/badges/StatusBadge';
import { useDebounce } from '../../../hooks/useDebounce';
import { useOrdering } from '../../../hooks/useOrdering';
import {
  useAdminJobs,
  useCreateJob,
  useUpdateJob,
  useCancelJob,
  useAcquireJobLock,
  useReleaseJobLock,
} from '../../../hooks/queries/admin/useAdminJobs';
import { useAdminUsers } from '../../../hooks/queries/admin/useAdminUsers';
import { getErrorMessage, applyServerFieldErrors } from '../../../utils/errorMessages';

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

// Bản sao ĐÚNG NGUYÊN của JobSerializer.ALLOWED_TRANSITIONS (backend, xem
// projects/admin/serializers.py). Dropdown Status chỉ liệt kê trạng thái thật
// sự chuyển được từ trạng thái hiện tại. Backend vẫn là nơi quyết định cuối
// cùng, đây chỉ là lớp chặn sớm cho UX.
const ALLOWED_TRANSITIONS = {
  PLANNING: ['ACTIVE', 'CANCELLED'],
  ACTIVE: ['ON_HOLD', 'COMPLETED', 'CANCELLED'],
  ON_HOLD: ['ACTIVE', 'CANCELLED'],
  COMPLETED: ['ACTIVE'],
  CANCELLED: ['ACTIVE'],
};

// Trạng thái hiện tại luôn nằm trong danh sách (giữ nguyên = hợp lệ), kèm các
// trạng thái chuyển được.
function getStatusOptionsFor(currentStatus) {
  const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];
  return [currentStatus, ...allowed].map((value) => ({
    value,
    label: value === currentStatus ? `${STATUS_LABELS[value]} (current)` : STATUS_LABELS[value],
  }));
}

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'All status' },
  ...Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label })),
];

const PRIORITY_FILTER_OPTIONS = [
  { value: '', label: 'All priorities' },
  ...PRIORITY_OPTIONS,
];

const FIELD_NAMES = [
  'job_name', 'job_code', 'manager', 'priority', 'status',
  'start_date', 'deadline', 'description',
];

// Mirrors JobSerializer.validate() on the backend. `clientSince` là ngày tạo
// khách hàng — mốc sớm nhất mà Job của họ được phép bắt đầu.
const buildJobSchema = (clientSince, { requireStatus = false, checkPastDeadline = false } = {}) => {
  const shape = {
    job_name: z
      .string()
      .trim()
      .min(2, 'Job name must be at least 2 characters')
      .max(255, 'Job name must be 255 characters or fewer'),
    job_code: z.string().trim().max(20, 'Job code must be 20 characters or fewer').optional(),
    manager: z.string().min(1, 'Manager is required'),
    priority: z.string().min(1, 'Priority is required'),
    start_date: z.string().min(1, 'Start date is required'),
    deadline: z.string().min(1, 'Deadline is required'),
    description: z
      .string()
      .trim()
      .max(2000, 'Description must be 2000 characters or fewer')
      .optional(),
  };
  if (requireStatus) shape.status = z.string().min(1, 'Status is required');

  let schema = z
    .object(shape)
    .refine((d) => !clientSince || d.start_date >= clientSince, {
      message: `Start date cannot be before the client was created (${clientSince})`,
      path: ['start_date'],
    })
    .refine((d) => d.deadline >= d.start_date, {
      message: 'Deadline must be on or after start date',
      path: ['deadline'],
    });

  // Chỉ áp khi TẠO. Job đang sửa có thể đã quá hạn từ lâu — chặn ở đây thì
  // không đổi nổi trạng thái của nó sang Completed nữa.
  if (checkPastDeadline) {
    schema = schema.refine((d) => d.deadline >= format(new Date(), 'yyyy-MM-dd'), {
      message: 'Deadline cannot be in the past',
      path: ['deadline'],
    });
  }
  return schema;
};

/**
 * Toàn bộ màn hình quản lý Job của MỘT khách hàng, mở từ trang Clients.
 *
 * Thay cho trang /admin/jobs cũ: Job luôn thuộc về một khách hàng, nên xem
 * chúng trong ngữ cảnh khách hàng đó đúng hơn là một danh sách phẳng rồi phải
 * lọc ngược lại. Search, Export, sắp xếp và phân trang đều mang theo client id.
 *
 * Ba màn hình trong CÙNG một modal (`view`: list | create | edit) thay vì modal
 * lồng modal — chồng hai lớp overlay lên nhau vừa rối vừa dễ bấm nhầm ra ngoài
 * làm đóng cả hai.
 */
export default function ClientJobsModal({ client, onClose }) {
  const [view, setView] = useState('list');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const [ordering, toggleSort] = useOrdering();
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [editTarget, setEditTarget] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);

  // Adjusting state during render thay vì useEffect — xem ClientsPage.
  const filterKey = `${debouncedSearch}|${statusFilter}|${priorityFilter}|${ordering}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setPage(1);
  }

  // Mọi tham số ở đây đều là filter mà JobViewSet.get_queryset() hiểu sẵn, nên
  // đưa nguyên cục này cho endpoint export thì file tải về khớp đúng những gì
  // đang hiện trên màn hình.
  const listParams = {
    client: client?.id,
    search: debouncedSearch || undefined,
    status: statusFilter || undefined,
    priority: priorityFilter || undefined,
    ordering: ordering || undefined,
  };

  // enabled: chặn cứng trường hợp thiếu client id. Axios BỎ HẲN tham số có giá
  // trị undefined, nên `client: undefined` sẽ thành một request không lọc gì và
  // trả về job của MỌI khách hàng — đúng thứ màn hình này không được phép hiện.
  const { data, isLoading } = useAdminJobs(
    { ...listParams, page },
    { enabled: !!client?.id }
  );
  const jobs = data?.results || [];
  const totalCount = data?.count || 0;

  // Không lọc theo is_active: manager của một job có thể đã bị khóa sau đó, và
  // người đó vẫn phải hiện ra (kèm nhãn Inactive) thì mới chuyển job sang
  // manager khác được.
  const { data: managersPage } = useAdminUsers({ role: 'MANAGER', page_size: 500 });
  const managers = managersPage?.results || [];
  const managerOptions = managers.map((m) => ({
    value: String(m.id),
    label: m.is_active ? m.email : `${m.email} (Inactive)`,
  }));
  // JobSerializer chỉ trả về `manager` là id, không có email.
  const managerEmailById = Object.fromEntries(managers.map((m) => [m.id, m.email]));

  const clientSince = client?.created_at ? format(new Date(client.created_at), 'yyyy-MM-dd') : '';

  const {
    register,
    handleSubmit,
    reset,
    control,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(buildJobSchema(clientSince, { checkPastDeadline: true })),
    defaultValues: { priority: 'MEDIUM' },
  });

  const {
    register: registerEdit,
    handleSubmit: handleEditSubmit,
    reset: resetEdit,
    control: editControl,
    setError: setEditError,
    formState: { errors: editErrors },
  } = useForm({ resolver: zodResolver(buildJobSchema(clientSince, { requireStatus: true })) });

  const createMutation = useCreateJob();
  const updateMutation = useUpdateJob();
  const cancelMutation = useCancelJob();
  const acquireLockMutation = useAcquireJobLock();
  const releaseLockMutation = useReleaseJobLock();

  // Soi id của job đang sửa vào một ref để effect dọn dẹp bên dưới đọc được giá
  // trị mới nhất mà không phải đăng ký lại mỗi lần đổi.
  const editTargetIdRef = useRef(null);
  useEffect(() => {
    editTargetIdRef.current = editTarget?.id ?? null;
  }, [editTarget]);

  // Lưới an toàn: đóng cả modal (hoặc rời trang) khi đang mở form sửa thì vẫn
  // phải nhả khóa, không để nó bị giữ hết 5 phút TTL.
  useEffect(() => {
    return () => {
      if (editTargetIdRef.current) releaseLockMutation.mutate(editTargetIdRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openCreate() {
    reset({
      job_name: '',
      job_code: '',
      manager: '',
      priority: 'MEDIUM',
      description: '',
      start_date: '',
      deadline: '',
    });
    setView('create');
  }

  function onSubmitCreate(form) {
    createMutation.mutate(
      {
        // client KHÔNG lấy từ form — luôn là khách hàng đang mở, nên không có
        // cách nào tạo nhầm Job sang khách hàng khác.
        client: client.id,
        manager: Number(form.manager),
        job_name: form.job_name,
        job_code: form.job_code || null,
        priority: form.priority,
        description: form.description || null,
        start_date: form.start_date,
        deadline: form.deadline,
      },
      {
        onSuccess: () => {
          setView('list');
          setPage(1);
        },
        onError: (err) => applyServerFieldErrors(err, setError, FIELD_NAMES),
      }
    );
  }

  // Giành khóa sửa của job TRƯỚC khi mở form — nếu admin khác đang giữ thì
  // backend trả 423 và form không mở, tránh hai người ghi đè lên nhau.
  function openEdit(job) {
    acquireLockMutation.mutate(job.id, {
      onSuccess: () => {
        resetEdit({
          manager: String(job.manager),
          job_name: job.job_name,
          job_code: job.job_code || '',
          priority: job.priority,
          status: job.status,
          description: job.description || '',
          start_date: job.start_date,
          deadline: job.deadline,
        });
        setEditTarget(job);
        setView('edit');
      },
      onError: (err) =>
        toast.error(getErrorMessage(err, 'This job is currently being edited by someone else.')),
    });
  }

  function closeEdit() {
    if (editTarget) releaseLockMutation.mutate(editTarget.id);
    setEditTarget(null);
    setView('list');
  }

  function onSubmitEdit(form) {
    updateMutation.mutate(
      {
        id: editTarget.id,
        payload: {
          // Không gửi `client`: JobSerializer.validate_client() từ chối MỌI giá
          // trị trỏ vào client không active, kể cả chính client hiện tại của
          // job nếu nó bị vô hiệu hóa sau khi job được tạo.
          manager: Number(form.manager),
          job_name: form.job_name,
          job_code: form.job_code || null,
          priority: form.priority,
          status: form.status,
          description: form.description || null,
          start_date: form.start_date,
          deadline: form.deadline,
        },
      },
      {
        onSuccess: closeEdit,
        onError: (err) => applyServerFieldErrors(err, setEditError, FIELD_NAMES),
      }
    );
  }

  // ---------------------------------------------------------------- create
  if (view === 'create') {
    return (
      <BaseModal
        isOpen
        onClose={() => setView('list')}
        title="New Job"
        description={client.client_name}
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleSubmit(onSubmitCreate)} className="space-y-3">
          {/* Khách hàng cố định, hiện ra cho rõ ràng chứ không cho đổi. */}
          <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
            Client: <span className="font-semibold text-slate-700">{client.client_name}</span>{' '}
            (fixed — opened from this client)
          </div>

          <InputField
            label="Job Name"
            required
            placeholder="Short, recognisable project name"
            error={errors.job_name?.message}
            {...register('job_name')}
          />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <InputField
              label="Start Date"
              type="date"
              required
              min={clientSince}
              helperText={clientSince ? `Client added on ${clientSince}` : undefined}
              error={errors.start_date?.message}
              {...register('start_date')}
            />
            <InputField
              label="Deadline"
              type="date"
              required
              min={clientSince}
              error={errors.deadline?.message}
              {...register('deadline')}
            />
          </div>

          <InputField
            label="Job Code (optional)"
            placeholder="e.g. JOB-ERP-01"
            error={errors.job_code?.message}
            {...register('job_code')}
          />
          <InputField
            label="Description (optional)"
            error={errors.description?.message}
            {...register('description')}
          />

          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={() => setView('list')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to jobs
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
    );
  }

  // ------------------------------------------------------------------ edit
  if (view === 'edit' && editTarget) {
    return (
      <BaseModal
        isOpen
        onClose={closeEdit}
        title="Edit Job"
        description={editTarget.job_name}
        maxWidth="max-w-4xl"
      >
        <form onSubmit={handleEditSubmit(onSubmitEdit)}>
          {/* Cột trái là những ô NHẬP được, cột phải là Project Team — vốn chỉ
              đọc và là thứ chiếm nhiều chiều cao nhất. */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-0">
            <div className="space-y-3 sm:border-r sm:border-slate-200 sm:pr-6">
              <InputField
                label="Job Name"
                required
                error={editErrors.job_name?.message}
                {...registerEdit('job_name')}
              />

              <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                Client: <span className="font-semibold text-slate-700">{client.client_name}</span>{' '}
                (fixed at creation)
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                      options={getStatusOptionsFor(editTarget.status)}
                      value={field.value}
                      onChange={field.onChange}
                      error={editErrors.status?.message}
                    />
                  )}
                />
              </div>

              {(ALLOWED_TRANSITIONS[editTarget.status] || []).length < 4 && (
                <p className="-mt-1 text-[11px] text-slate-500">
                  From <span className="font-semibold">{STATUS_LABELS[editTarget.status]}</span>{' '}
                  you can only move to:{' '}
                  <span className="font-semibold">
                    {(ALLOWED_TRANSITIONS[editTarget.status] || [])
                      .map((s) => STATUS_LABELS[s])
                      .join(', ') || 'no other status'}
                  </span>
                  .
                </p>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <InputField
                  label="Start Date"
                  required
                  type="date"
                  min={clientSince}
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
                label="Job Code (optional)"
                error={editErrors.job_code?.message}
                {...registerEdit('job_code')}
              />
              <InputField
                label="Description (optional)"
                error={editErrors.description?.message}
                {...registerEdit('description')}
              />
            </div>

            {/* Project Team — CHỈ XEM.
                Admin tạo Job rỗng rồi giao cho Manager; Manager mới là người
                chọn nhân viên của tuyến mình vào dự án. */}
            <div className="space-y-1.5 border-t border-slate-200 pt-5 sm:border-t-0 sm:pl-6 sm:pt-0">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-700">Project Team</label>
                <span className="text-[11px] text-slate-400">
                  {(editTarget.project_team || []).length} member(s)
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                The assigned Manager picks employees from their own reporting line. Admin has
                view-only access.
              </p>
              <div className="max-h-72 space-y-1 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/50 p-2 text-xs">
                {(editTarget.project_team || []).length === 0 ? (
                  <div className="py-2 text-center text-slate-400">
                    The Manager has not assigned any employee yet
                  </div>
                ) : (
                  editTarget.project_team.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-slate-200/80 bg-white p-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-slate-900">
                          {m.full_name || m.email}
                        </p>
                        <p className="truncate text-[10px] text-slate-400">{m.email}</p>
                      </div>
                      <span className="shrink-0 text-[10px] text-slate-500">
                        {m.department_name || 'No Department'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="mt-5 flex justify-end gap-2 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={closeEdit}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to jobs
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
    );
  }

  // ------------------------------------------------------------------ list
  return (
    <>
      <BaseModal
        isOpen
        onClose={onClose}
        title="Jobs"
        description={`${totalCount} job${totalCount === 1 ? '' : 's'} for ${client.client_name}`}
        maxWidth="max-w-6xl"
      >
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search job or manager..."
                className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>
            <div className="w-full sm:w-36">
              <SelectDropdown
                theme="light"
                options={STATUS_FILTER_OPTIONS}
                value={statusFilter}
                onChange={setStatusFilter}
                placeholder="All status"
              />
            </div>
            <div className="w-full sm:w-36">
              <SelectDropdown
                theme="light"
                options={PRIORITY_FILTER_OPTIONS}
                value={priorityFilter}
                onChange={setPriorityFilter}
                placeholder="All priorities"
              />
            </div>
            <div className="flex items-center gap-2">
              {/* Cùng listParams với bảng, nên file tải về khớp đúng những gì
                  đang hiện — kể cả bộ lọc theo client. */}
              <ExportButton
                url="/admin/jobs/export/"
                params={listParams}
                filename={`worktracker_jobs_${client.id}.xlsx`}
              />
              <button
                type="button"
                onClick={openCreate}
                className="flex shrink-0 items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" /> New Job
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-200">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] table-fixed text-left text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    <SortableHeader label="Job" sortKey="job_name" ordering={ordering} onSort={toggleSort} className="w-[28%]" />
                    <SortableHeader label="Manager" sortKey="manager__email" ordering={ordering} onSort={toggleSort} className="w-[20%]" />
                    <th className="w-[8%] px-3 py-2.5 text-[11px] font-semibold uppercase text-slate-500">Team</th>
                    <SortableHeader label="Priority" sortKey="priority" ordering={ordering} onSort={toggleSort} className="w-[11%]" />
                    <SortableHeader label="Status" sortKey="status" ordering={ordering} onSort={toggleSort} className="w-[12%]" />
                    <SortableHeader label="Deadline" sortKey="deadline" ordering={ordering} onSort={toggleSort} className="w-[13%]" />
                    <th className="w-[8%] px-3 py-2.5 text-right text-[11px] font-semibold uppercase text-slate-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoading && (
                    <tr>
                      <td colSpan={7} className="px-3 py-6 text-center text-slate-400">
                        Loading...
                      </td>
                    </tr>
                  )}
                  {!isLoading && jobs.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-3 py-6 text-center text-slate-400">
                        {search || statusFilter || priorityFilter
                          ? 'No jobs match the current filters.'
                          : 'No jobs for this client yet.'}
                      </td>
                    </tr>
                  )}
                  {jobs.map((job) => (
                    <tr key={job.id}>
                      {/* Bấm vào TÊN để mở thẻ sửa — cột Actions chỉ còn Cancel. */}
                      <td className="max-w-0 px-3 py-2">
                        <button
                          type="button"
                          onClick={() => openEdit(job)}
                          className="block max-w-full cursor-pointer truncate text-left font-medium text-slate-900 hover:text-blue-600 hover:underline"
                          title={job.job_name}
                        >
                          {job.job_name}
                        </button>
                        {job.job_code && (
                          <span className="block truncate text-[10px] text-slate-400">
                            {job.job_code}
                          </span>
                        )}
                      </td>
                      <td
                        className="max-w-0 truncate px-3 py-2 text-slate-500"
                        title={managerEmailById[job.manager] || ''}
                      >
                        {managers.find((m) => m.id === job.manager)?.is_active === false && (
                          <span
                            className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-amber-500 align-middle"
                            title="Inactive manager"
                          />
                        )}
                        {managerEmailById[job.manager] || job.manager}
                      </td>
                      <td className="truncate px-3 py-2 text-slate-600">
                        <span
                          className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700"
                          title={
                            job.project_team?.map((m) => m.full_name || m.email).join(', ') ||
                            'No team members allocated'
                          }
                        >
                          <Users className="h-3 w-3 text-slate-400" />
                          {job.team_size || job.project_team?.length || 0}
                        </span>
                      </td>
                      <td className="truncate px-3 py-2">
                        <PriorityBadge priority={job.priority} className="px-2 text-[10px]" />
                      </td>
                      <td className="truncate px-3 py-2">
                        <StatusBadge status={job.status} className="px-2 text-[10px]" />
                      </td>
                      <td className="truncate px-3 py-2 text-slate-500">{job.deadline}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end">
                          {job.status !== 'CANCELLED' && (
                            <button
                              type="button"
                              title="Cancel job"
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
            </div>
          </div>

          <PaginationBar
            page={page}
            totalPages={Math.max(1, Math.ceil(totalCount / PAGE_SIZE))}
            onPageChange={setPage}
            totalItems={totalCount}
            pageSize={PAGE_SIZE}
          />
        </div>
      </BaseModal>

      <ConfirmModal
        isOpen={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={() =>
          cancelMutation.mutate(cancelTarget.id, { onSuccess: () => setCancelTarget(null) })
        }
        title="Cancel Job"
        description={`"${cancelTarget?.job_name}" will be marked CANCELLED — existing tasks are kept for history. Continue?`}
        confirmText="Cancel Job"
        variant="danger"
        isLoading={cancelMutation.isPending}
      />
    </>
  );
}
