import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import BaseModal from '../../components/common/modal/BaseModal';
import ConfirmModal from '../../components/common/modal/ConfirmModal';
import InputField from '../../components/common/forms/InputField';
import SelectDropdown from '../../components/common/forms/SelectDropdown';
import {
  listDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
} from '../../api/departments';
import { listUsers } from '../../api/users';

const departmentSchema = z.object({
  name: z.string().min(1, 'Department name is required'),
  description: z.string().optional(),
  manager: z.string().optional(),
});

// Admin page for CRUD on departments — list table + create/edit modal + delete confirm.
export function DepartmentsPage() {
  const queryClient = useQueryClient();
  const [modalState, setModalState] = useState(null); // null | { mode: 'create' } | { mode: 'edit', department }
  const [deleteTarget, setDeleteTarget] = useState(null);

  const { data: departments = [], isLoading } = useQuery({
    queryKey: ['departments'],
    queryFn: () => listDepartments(),
  });

  // Managers double as the dropdown options and the lookup table used to
  // render a department's manager email in the table (the department API
  // only returns the manager's id, not a nested user object).
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
    formState: { errors },
  } = useForm({ resolver: zodResolver(departmentSchema) });

  function openCreate() {
    reset({ name: '', description: '', manager: '' });
    setModalState({ mode: 'create' });
  }

  function openEdit(department) {
    reset({
      name: department.name,
      description: department.description || '',
      manager: department.manager ? String(department.manager) : '',
    });
    setModalState({ mode: 'edit', department });
  }

  const saveMutation = useMutation({
    mutationFn: (payload) =>
      modalState.mode === 'edit'
        ? updateDepartment(modalState.department.id, payload)
        : createDepartment(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      toast.success(modalState.mode === 'edit' ? 'Department updated.' : 'Department created.');
      setModalState(null);
    },
    onError: (err) => {
      toast.error(err.response?.data?.name?.[0] || err.response?.data?.detail || 'Save failed.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteDepartment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      toast.success('Department deleted.');
      setDeleteTarget(null);
    },
    onError: () => toast.error('Delete failed.'),
  });

  function onSubmit(data) {
    saveMutation.mutate({
      name: data.name,
      description: data.description || null,
      manager: data.manager || null,
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-900">Departments</h1>
        <button
          type="button"
          onClick={openCreate}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" /> New Department
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3">Manager</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                  Loading...
                </td>
              </tr>
            )}
            {!isLoading && departments.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                  No departments yet.
                </td>
              </tr>
            )}
            {departments.map((dept) => (
              <tr key={dept.id}>
                <td className="px-4 py-3 font-medium text-slate-900">{dept.name}</td>
                <td className="px-4 py-3 text-slate-500">{dept.description || '—'}</td>
                <td className="px-4 py-3 text-slate-500">
                  {dept.manager ? managerEmailById[dept.manager] || dept.manager : '—'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => openEdit(dept)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(dept)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
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
        title={modalState?.mode === 'edit' ? 'Edit Department' : 'New Department'}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <InputField label="Name" error={errors.name?.message} {...register('name')} />
          <InputField
            label="Description"
            error={errors.description?.message}
            {...register('description')}
          />
          <SelectDropdown
            label="Manager"
            placeholder="No manager"
            options={managerOptions}
            error={errors.manager?.message}
            {...register('manager')}
          />
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
        title="Delete Department"
        description={`Are you sure you want to delete "${deleteTarget?.name}"?`}
        confirmText="Delete"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
