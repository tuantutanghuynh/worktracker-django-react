import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Pencil, Trash2, RotateCcw, Search } from 'lucide-react';
import { format } from 'date-fns';
import BaseModal from '../../components/common/modal/BaseModal';
import ConfirmModal from '../../components/common/modal/ConfirmModal';
import InputField from '../../components/common/forms/InputField';
import SortableHeader from '../../components/common/table/SortableHeader';
import PaginationBar from '../../components/common/table/PaginationBar';
import ExportButton from '../../components/common/table/ExportButton';
import { useDebounce } from '../../hooks/useDebounce';
import { useOrdering } from '../../hooks/useOrdering';
import {
  useAdminClients,
  useAdminClientDeepLink,
  useCreateClient,
  useUpdateClient,
  useDeactivateClient,
  useRestoreClient,
} from '../../hooks/queries/admin/useAdminClients';

const PAGE_SIZE = 15;

const clientSchema = z.object({
  client_name: z.string().min(1, 'Client name is required'),
  tax_code: z.string().min(1, 'Tax code is required'),
  contact_person: z.string().optional(),
  contact_email: z.string().email('Invalid email address').optional().or(z.literal('')),
  contact_phone: z.string().optional(),
  address: z.string().optional(),
  industry: z.string().optional(),
  notes: z.string().optional(),
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
  const [detailTarget, setDetailTarget] = useState(null);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const [ordering, toggleSort] = useOrdering();
  const [page, setPage] = useState(1);

  // Reset to page 1 whenever the result set changes shape — otherwise a
  // narrower search/filter could leave the user stranded on a page number
  // that no longer exists. Adjusting state during render (React's own
  // pattern for this — see "Adjusting state based on a prop change") instead
  // of a useEffect, which would cause an extra render pass for no benefit.
  const filterKey = `${debouncedSearch}|${ordering}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setPage(1);
  }

  const { data, isLoading } = useAdminClients({
    search: debouncedSearch || undefined,
    ordering: ordering || undefined,
    page,
  });
  const clients = data?.results || [];
  const totalCount = data?.count || 0;

  const {
    register,
    handleSubmit,
    reset,
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
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-900">Clients</h1>
        <div className="flex items-center gap-2">
          <ExportButton
            url="/admin/clients/export/"
            params={{ search: debouncedSearch || undefined, ordering: ordering || undefined }}
            filename="worktracker_clients.xlsx"
          />
          <button
            type="button"
            onClick={openCreate}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" /> New Client
          </button>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, tax code, email..."
          className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50">
            <tr>
              <SortableHeader label="Client Name" sortKey="client_name" ordering={ordering} onSort={toggleSort} />
              <SortableHeader label="Tax Code" sortKey="tax_code" ordering={ordering} onSort={toggleSort} />
              <SortableHeader label="Contact Email" sortKey="contact_email" ordering={ordering} onSort={toggleSort} />
              <SortableHeader label="Status" sortKey="is_active" ordering={ordering} onSort={toggleSort} />
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                  Loading...
                </td>
              </tr>
            )}
            {!isLoading && clients.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                  {search ? 'No clients match your search.' : 'No clients yet.'}
                </td>
              </tr>
            )}
            {clients.map((client) => (
              <tr key={client.id}>
                <td className="px-4 py-3 font-medium text-slate-900">
                  <button
                    type="button"
                    onClick={() => setDetailTarget(client)}
                    className="hover:text-blue-600 hover:underline cursor-pointer text-left"
                  >
                    {client.client_name}
                  </button>
                </td>
                <td className="px-4 py-3 text-slate-500">{client.tax_code}</td>
                <td className="px-4 py-3 text-slate-500">{client.contact_email || '—'}</td>
                <td className="px-4 py-3">
                  <span
                    className={
                      client.is_active
                        ? 'text-xs font-semibold text-emerald-600'
                        : 'text-xs font-semibold text-rose-500'
                    }
                  >
                    {client.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => openEdit(client)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    {client.is_active ? (
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(client)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => restoreMutation.mutate(client.id)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600"
                      >
                        <RotateCcw className="h-4 w-4" />
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

      <BaseModal
        isOpen={!!modalState}
        onClose={() => setModalState(null)}
        title={modalState?.mode === 'edit' ? 'Edit Client' : 'New Client'}
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <InputField label="Client Name" error={errors.client_name?.message} {...register('client_name')} />
            <InputField label="Tax Code" error={errors.tax_code?.message} {...register('tax_code')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <InputField label="Contact Person" error={errors.contact_person?.message} {...register('contact_person')} />
            <InputField label="Contact Email" type="email" error={errors.contact_email?.message} {...register('contact_email')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <InputField label="Contact Phone" error={errors.contact_phone?.message} {...register('contact_phone')} />
            <InputField label="Industry" error={errors.industry?.message} {...register('industry')} />
          </div>
          <InputField label="Address" error={errors.address?.message} {...register('address')} />
          <InputField label="Notes" error={errors.notes?.message} {...register('notes')} />

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

      <BaseModal
        isOpen={!!detailTarget}
        onClose={() => setDetailTarget(null)}
        title="Client Details"
        description={detailTarget?.client_name}
        maxWidth="max-w-lg"
      >
        {detailTarget && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span
                className={
                  detailTarget.is_active
                    ? 'inline-flex text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full'
                    : 'inline-flex text-xs font-semibold text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full'
                }
              >
                {detailTarget.is_active ? 'Active' : 'Inactive'}
              </span>
              <button
                type="button"
                onClick={() => {
                  setDetailTarget(null);
                  openEdit(detailTarget);
                }}
                className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:underline"
              >
                <Pencil className="h-3.5 w-3.5" /> Edit
              </button>
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div className="col-span-2">
                <dt className="text-xs font-medium text-slate-500">Client Name</dt>
                <dd className="text-slate-900 font-medium">{detailTarget.client_name}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">Tax Code</dt>
                <dd className="text-slate-800">{detailTarget.tax_code}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">Industry</dt>
                <dd className="text-slate-800">{detailTarget.industry || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">Contact Person</dt>
                <dd className="text-slate-800">{detailTarget.contact_person || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">Contact Email</dt>
                <dd className="text-slate-800">{detailTarget.contact_email || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">Contact Phone</dt>
                <dd className="text-slate-800">{detailTarget.contact_phone || '—'}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs font-medium text-slate-500">Address</dt>
                <dd className="text-slate-800">{detailTarget.address || '—'}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs font-medium text-slate-500">Notes</dt>
                <dd className="text-slate-800 whitespace-pre-wrap">{detailTarget.notes || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">Created</dt>
                <dd className="text-slate-500 text-xs">
                  {format(new Date(detailTarget.created_at), 'HH:mm - yyyy-MM-dd')}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">Last Updated</dt>
                <dd className="text-slate-500 text-xs">
                  {format(new Date(detailTarget.updated_at), 'HH:mm - yyyy-MM-dd')}
                </dd>
              </div>
            </dl>
          </div>
        )}
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
    </div>
  );
}
