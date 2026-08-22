import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, RotateCcw } from 'lucide-react';
import BaseModal from '../../components/common/modal/BaseModal';
import ConfirmModal from '../../components/common/modal/ConfirmModal';
import InputField from '../../components/common/forms/InputField';
import { listClients, createClient, updateClient, deleteClient, restoreClient } from '../../api/clients';

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
// ClientViewSet.perform_destroy on the backend).
export function ClientsPage() {
  const queryClient = useQueryClient();
  const [modalState, setModalState] = useState(null); // null | { mode: 'create' } | { mode: 'edit', client }
  const [deleteTarget, setDeleteTarget] = useState(null);

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: () => listClients(),
  });

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

  const saveMutation = useMutation({
    mutationFn: (payload) =>
      modalState.mode === 'edit'
        ? updateClient(modalState.client.id, payload)
        : createClient(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success(modalState.mode === 'edit' ? 'Client updated.' : 'Client created.');
      setModalState(null);
    },
    onError: (err) => {
      const data = err.response?.data;
      const firstMessage = (value) => (Array.isArray(value) ? value[0] : value);
      toast.error(
        firstMessage(data?.tax_code) || firstMessage(data?.client_name) || data?.detail || 'Save failed.'
      );
    },
  });

  // Client never gets hard-deleted — this calls DELETE, but the backend
  // only flips is_active to False (ClientViewSet.perform_destroy).
  const deleteMutation = useMutation({
    mutationFn: (id) => deleteClient(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Client deactivated.');
      setDeleteTarget(null);
    },
    onError: () => toast.error('Delete failed.'),
  });

  const restoreMutation = useMutation({
    mutationFn: (id) => restoreClient(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Client restored.');
    },
    onError: () => toast.error('Restore failed.'),
  });

  function onSubmit(data) {
    saveMutation.mutate({
      client_name: data.client_name,
      tax_code: data.tax_code,
      contact_person: data.contact_person || null,
      contact_email: data.contact_email || null,
      contact_phone: data.contact_phone || null,
      address: data.address || null,
      industry: data.industry || null,
      notes: data.notes || null,
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-900">Clients</h1>
        <button
          type="button"
          onClick={openCreate}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" /> New Client
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Client Name</th>
              <th className="px-4 py-3">Tax Code</th>
              <th className="px-4 py-3">Contact Email</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
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
                  No clients yet.
                </td>
              </tr>
            )}
            {clients.map((client) => (
              <tr key={client.id}>
                <td className="px-4 py-3 font-medium text-slate-900">{client.client_name}</td>
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

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
        title="Deactivate Client"
        description={`"${deleteTarget?.client_name}" will be marked inactive (not deleted) — existing jobs are kept for history. Continue?`}
        confirmText="Deactivate"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
