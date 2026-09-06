import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, RotateCcw, Search, Briefcase, Building2 } from 'lucide-react';
import { format } from 'date-fns';
import BaseModal from '../../components/common/modal/BaseModal';
import ConfirmModal from '../../components/common/modal/ConfirmModal';
import InputField from '../../components/common/forms/InputField';
import SelectDropdown from '../../components/common/forms/SelectDropdown';
import SortableHeader from '../../components/common/table/SortableHeader';
import PaginationBar from '../../components/common/table/PaginationBar';
import ExportButton from '../../components/common/table/ExportButton';
import ClientJobsModal from '../../components/admin/clients/ClientJobsModal';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import { useDebounce } from '../../hooks/useDebounce';
import { useOrdering } from '../../hooks/useOrdering';
import { applyServerFieldErrors } from '../../utils/errorMessages';
import {
  useAdminClients,
  useAdminClientDeepLink,
  useCreateClient,
  useUpdateClient,
  useDeactivateClient,
  useRestoreClient,
} from '../../hooks/queries/admin/useAdminClients';

const PAGE_SIZE = 10; // khớp AdminPageNumberPagination.page_size ở backend

// Mirrors ClientSerializer on the backend (projects/admin/serializers.py).
// Backend stays the source of truth; these rules only stop the user from
// filling a whole form and losing it to a 400 on submit.
//
// Vietnamese tax code: 10 digits, optionally + a 3-digit branch suffix.
const TAX_CODE_PATTERN = /^\d{10}(-\d{3})?$/;
// Phone: allow the punctuation people actually type, then count the digits
// underneath rather than pinning one layout.
const PHONE_ALLOWED = /^[0-9+()\-.\s]+$/;
const countDigits = (value) => (value.match(/\d/g) || []).length;

// max() values match max_length in the Django models — without them the user
// only learns the limit after the request round-trips and fails.
const optionalText = (max, label) =>
  z.string().trim().max(max, `${label} must be ${max} characters or fewer`).optional();

const clientSchema = z.object({
  client_name: z
    .string()
    .trim()
    .min(2, 'Client name must be at least 2 characters')
    .max(255, 'Client name must be 255 characters or fewer'),
  tax_code: z
    .string()
    .trim()
    .min(1, 'Tax code is required')
    .regex(
      TAX_CODE_PATTERN,
      'Tax code must be 10 digits, optionally followed by a 3-digit branch suffix (e.g. 0123456789 or 0123456789-001)'
    ),
  contact_person: optionalText(150, 'Contact person'),
  contact_email: z
    .string()
    .trim()
    .email('Invalid email address')
    .max(155, 'Contact email must be 155 characters or fewer')
    .optional()
    .or(z.literal('')),
  contact_phone: z
    .string()
    .trim()
    .max(20, 'Contact phone must be 20 characters or fewer')
    .refine((v) => !v || PHONE_ALLOWED.test(v), {
      message: 'Phone may only contain digits and the characters + ( ) - . and spaces',
    })
    .refine((v) => !v || (countDigits(v) >= 8 && countDigits(v) <= 15), {
      message: 'Phone must contain between 8 and 15 digits',
    })
    .optional()
    .or(z.literal('')),
  address: optionalText(255, 'Address'),
  industry: optionalText(100, 'Industry'),
  notes: z.string().trim().max(2000, 'Notes must be 2000 characters or fewer').optional(),
});

const EMPTY_FORM = {
  client_name: '',
  tax_code: '',
  contact_person: '',
  contact_email: '',
  contact_phone: '',
  address: '',
  industry: '',
  notes: '',
};

// Admin page for CRUD on clients — mirrors DepartmentsPage's structure, plus
// soft-delete/restore (Client uses is_active, never a hard delete — matches
// ClientViewSet.perform_destroy on the backend). Data logic lives in
// hooks/queries/admin/useAdminClients.js — this file is JSX only.
export function ClientsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [modalState, setModalState] = useState(null); // null | { mode: 'create' } | { mode: 'edit', client }
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [jobsTarget, setJobsTarget] = useState(null); // client dang xem danh sach job
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [industryFilter, setIndustryFilter] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const [ordering, toggleSort] = useOrdering();
  const [page, setPage] = useState(1);

  // Reset to page 1 whenever the result set changes shape — otherwise a
  // narrower search/filter could leave the user stranded on a page number
  // that no longer exists. Adjusting state during render (React's own
  // pattern for this — see "Adjusting state based on a prop change") instead
  // of a useEffect, which would cause an extra render pass for no benefit.
  const filterKey = `${debouncedSearch}|${statusFilter}|${industryFilter}|${ordering}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setPage(1);
  }

  // Moi tham so o day deu la filter ClientViewSet.get_queryset() hieu san, nen
  // dua nguyen cuc nay cho endpoint export thi file tai ve khop dung nhung gi
  // dang hien tren man hinh.
  const listParams = {
    search: debouncedSearch || undefined,
    is_active: statusFilter || undefined,
    industry: industryFilter || undefined,
    ordering: ordering || undefined,
  };

  const { data, isLoading } = useAdminClients({ ...listParams, page });
  const clients = data?.results || [];
  const totalCount = data?.count || 0;

  const STATUS_FILTER_OPTIONS = [
    { value: '', label: 'All status' },
    { value: 'true', label: 'Active' },
    { value: 'false', label: 'Inactive' },
  ];

  // Danh sach nganh nghe dung TU DU LIEU THAT dang co, khong phai mot danh muc
  // co dinh — Client.industry la o nhap tu do nen mot danh muc cung se lech
  // ngay khi ai do go mot nganh moi. page_size=500 de lay het, khong bi cat o
  // trang dau nhu pagination mac dinh 10 dong.
  const { data: allClientsPage } = useAdminClients({ page_size: 500 });
  const industryOptions = [
    { value: '', label: 'All industries' },
    ...[...new Set(
      (allClientsPage?.results || [])
        .map((c) => (c.industry || '').trim())
        .filter(Boolean)
    )]
      .sort((a, b) => a.localeCompare(b))
      .map((name) => ({ value: name, label: name })),
  ];

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm({ resolver: zodResolver(clientSchema) });

  function openCreate() {
    reset(EMPTY_FORM);
    setModalState({ mode: 'create' });
  }

  // Deep-link support for notifications (bell dropdown / data-quality
  // alerts) that point at ?edit=<id> — fetches that one client directly
  // instead of relying on it being present on whatever page/filter is
  // currently loaded, then opens the edit modal and clears the param so
  // navigating away and back doesn't reopen it.
  const editId = searchParams.get('edit');
  const { data: deepLinkedClient } = useAdminClientDeepLink(editId);
  useEffect(() => {
    if (deepLinkedClient) {
      openEdit(deepLinkedClient);
      setSearchParams((prev) => {
        prev.delete('edit');
        return prev;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkedClient]);

  function openEdit(client) {
    reset({
      client_name: client.client_name,
      tax_code: client.tax_code,
      contact_person: client.contact_person || '',
      contact_email: client.contact_email || '',
      contact_phone: client.contact_phone || '',
      address: client.address || '',
      industry: client.industry || '',
      notes: client.notes || '',
    });
    setModalState({ mode: 'edit', client });
  }

  const createMutation = useCreateClient();
  const updateMutation = useUpdateClient();
  const deleteMutation = useDeactivateClient();
  const restoreMutation = useRestoreClient();
  const saveMutation = modalState?.mode === 'edit' ? updateMutation : createMutation;

  function onSubmit(data) {
    const payload = {
      client_name: data.client_name,
      tax_code: data.tax_code,
      contact_person: data.contact_person || null,
      contact_email: data.contact_email || null,
      contact_phone: data.contact_phone || null,
      address: data.address || null,
      industry: data.industry || null,
      notes: data.notes || null,
    };
    const mutation = modalState.mode === 'edit' ? updateMutation : createMutation;
    mutation.mutate(modalState.mode === 'edit' ? { id: modalState.client.id, payload } : payload, {
      onSuccess: () => setModalState(null),
      // Backend biet nhung luat trinh duyet khong biet: trung ten, trung ma
      // so thue. Gan loi ve dung o nhap thay vi chi bao o toast roi bien mat.
      onError: (err) => applyServerFieldErrors(err, setError, Object.keys(payload)),
    });
  }

  return (
    <div className="space-y-4">
      <AdminPageHeader
        icon={Building2}
        title="Clients"
        subtitle="Every organisation WorkTracker delivers projects for."
        count={totalCount}
        countLabel="client"
        actions={
          <>
            <ExportButton
              url="/admin/clients/export/"
              params={listParams}
              filename="worktracker_clients.xlsx"
            />
            <button
              type="button"
              onClick={openCreate}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" /> New Client
            </button>
          </>
        }
      />

      <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-end">
        <div className="relative flex-1 sm:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, tax code, email..."
            className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
        </div>
        <div className="w-full sm:w-40">
          <SelectDropdown
            theme="light"
            options={STATUS_FILTER_OPTIONS}
            value={statusFilter}
            onChange={setStatusFilter}
            placeholder="All status"
          />
        </div>
        <div className="w-full sm:w-52">
          <SelectDropdown
            theme="light"
            searchable
            options={industryOptions}
            value={industryFilter}
            onChange={setIndustryFilter}
            placeholder="All industries"
          />
        </div>
      </div>

      {/* table-fixed + width theo % nên bảng luôn vừa khung, không kéo ngang. */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[940px] table-fixed text-left text-xs">
          <thead className="bg-slate-50">
            <tr>
              {/* Ten khach hang kem nganh nghe ngay ben duoi, va o Contact gop
                  ca nguoi lien he lan email — bang truoc day chi co 4 cot chu
                  nen nhin rat trong, trong khi du lieu thi da co san. */}
              <SortableHeader label="Client" sortKey="client_name" ordering={ordering} onSort={toggleSort} className="w-[22%]" />
              <SortableHeader label="Tax Code" sortKey="tax_code" ordering={ordering} onSort={toggleSort} className="w-[12%]" />
              <SortableHeader label="Contact" sortKey="contact_email" ordering={ordering} onSort={toggleSort} className="w-[22%]" />
              <th className="w-[11%] px-3 py-2.5 text-[11px] font-semibold uppercase text-slate-500">Since</th>
              <SortableHeader label="Status" sortKey="is_active" ordering={ordering} onSort={toggleSort} className="w-[9%]" />
              {/* Cot rieng, co chu han hoi: Job la mot nhanh nghiep vu khac
                  han, khong phai mot "thao tac" tren client nhu Sua/Ngung. */}
              <th className="w-[16%] px-3 py-2.5 text-[11px] font-semibold uppercase text-slate-500">Jobs</th>
              <th className="w-[10%] px-3 py-2.5 text-right text-[11px] font-semibold uppercase text-slate-500">Actions</th>
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
            {!isLoading && clients.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-slate-400">
                  {search || statusFilter || industryFilter
                    ? 'No clients match the current filters.'
                    : 'No clients yet.'}
                </td>
              </tr>
            )}
            {clients.map((client) => (
              <tr key={client.id} className="transition-colors hover:bg-slate-50/70">
                <td className="max-w-0 px-3 py-2">
                  {/* Bam vao TEN de mo the sua thang, khong qua mot modal chi
                      de xem roi phai bam Edit lan nua. */}
                  <button
                    type="button"
                    onClick={() => openEdit(client)}
                    className="block max-w-full cursor-pointer truncate text-left font-medium text-slate-900 hover:text-blue-600 hover:underline"
                    title={client.client_name}
                  >
                    {client.client_name}
                  </button>
                  <span
                    className="block truncate text-[11px] text-slate-400"
                    title={client.industry || ''}
                  >
                    {client.industry || 'Industry not set'}
                  </span>
                </td>
                <td className="px-3 py-2 font-mono text-slate-500 truncate">{client.tax_code}</td>
                <td className="max-w-0 px-3 py-2">
                  <span
                    className="block truncate text-slate-700"
                    title={client.contact_person || ''}
                  >
                    {client.contact_person || '—'}
                  </span>
                  <span
                    className="block truncate text-[11px] text-slate-400"
                    title={client.contact_email || ''}
                  >
                    {client.contact_email || 'No email on file'}
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-slate-500">
                  {client.created_at ? format(new Date(client.created_at), 'yyyy-MM-dd') : '—'}
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  <span
                    className={
                      client.is_active
                        ? 'text-[11px] font-semibold text-emerald-600'
                        : 'text-[11px] font-semibold text-rose-500'
                    }
                  >
                    {client.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-3 py-2">
                  {/* Con so tren nut cho biet co dang mo cai gi khong, khong
                      phai mo ra moi biet la rong. */}
                  <button
                    type="button"
                    onClick={() => setJobsTarget(client)}
                    title={
                      client.job_count
                        ? `${client.active_job_count} of ${client.job_count} still open`
                        : 'No jobs for this client yet'
                    }
                    className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                  >
                    <Briefcase className="h-3.5 w-3.5" />
                    View jobs
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                        client.active_job_count > 0
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {client.job_count ?? 0}
                    </span>
                  </button>
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center justify-end gap-1">
                    {client.is_active ? (
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(client)}
                        className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => restoreMutation.mutate(client.id)}
                        className="rounded-lg p-1 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>

        <PaginationBar
          page={page}
          totalPages={Math.max(1, Math.ceil(totalCount / PAGE_SIZE))}
          onPageChange={setPage}
          totalItems={totalCount}
          pageSize={PAGE_SIZE}
        />
      </div>

      <BaseModal
        isOpen={!!modalState}
        onClose={() => setModalState(null)}
        title={modalState?.mode === 'edit' ? 'Edit Client' : 'New Client'}
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <InputField label="Client Name" required placeholder="Company legal name" error={errors.client_name?.message} {...register('client_name')} />
            <InputField label="Tax Code" required placeholder="10 or 13 digits" error={errors.tax_code?.message} {...register('tax_code')} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <InputField label="Contact Person" error={errors.contact_person?.message} {...register('contact_person')} />
            <InputField label="Contact Email" type="email" placeholder="name@company.com" error={errors.contact_email?.message} {...register('contact_email')} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <InputField label="Contact Phone" placeholder="+84 xxx xxx xxx" error={errors.contact_phone?.message} {...register('contact_phone')} />
            <InputField label="Industry" error={errors.industry?.message} {...register('industry')} />
          </div>
          <InputField label="Address" error={errors.address?.message} {...register('address')} />
          <InputField label="Notes" error={errors.notes?.message} {...register('notes')} />

          {/* Chi hien khi SUA: hai moc thoi gian nay truoc day nam trong modal
              "Client Details" da bo di. Chung la thong tin he thong, chi doc. */}
          {modalState?.mode === 'edit' && (
            <p className="border-t border-slate-100 pt-2 text-[11px] text-slate-400">
              Created {format(new Date(modalState.client.created_at), 'HH:mm - yyyy-MM-dd')}
              {' · '}
              Last updated {format(new Date(modalState.client.updated_at), 'HH:mm - yyyy-MM-dd')}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setModalState(null)}
              className="rounded-lg bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saveMutation.isPending}
              className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {saveMutation.isPending ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </BaseModal>

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteMutation.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) })}
        title="Deactivate Client"
        description={`"${deleteTarget?.client_name}" will be marked inactive (not deleted) — existing jobs are kept for history. Continue?`}
        confirmText="Deactivate"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />

      {/* Chi mount khi co client duoc chon — modal tu tai job theo ?client=<id>,
          nen khong mount thi khong ton mot request nao. */}
      {jobsTarget && (
        <ClientJobsModal client={jobsTarget} onClose={() => setJobsTarget(null)} />
      )}
    </div>
  );
}
