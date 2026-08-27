import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import BaseModal from '../../components/common/modal/BaseModal';
import ConfirmModal from '../../components/common/modal/ConfirmModal';
import InputField from '../../components/common/forms/InputField';
import SelectDropdown from '../../components/common/forms/SelectDropdown';
import SortableHeader from '../../components/common/table/SortableHeader';
import PaginationBar from '../../components/common/table/PaginationBar';
import ExportButton from '../../components/common/table/ExportButton';
import { useDebounce } from '../../hooks/useDebounce';
import { useOrdering } from '../../hooks/useOrdering';
import {
  useAdminDepartments,
  useAdminDepartmentDeepLink,
  useCreateDepartment,
  useUpdateDepartment,
  useDeleteDepartment,
} from '../../hooks/queries/admin/useAdminDepartments';
import { useAdminUsers } from '../../hooks/queries/admin/useAdminUsers';

const PAGE_SIZE = 10; // khớp AdminPageNumberPagination.page_size ở backend

const departmentSchema = z.object({
  name: z.string().min(1, 'Department name is required'),
  description: z.string().optional(),
  manager: z.string().optional(),
});

// Admin page for CRUD on departments — list table + create/edit modal +
// delete confirm. Data logic lives in
// hooks/queries/admin/useAdminDepartments.js — this file is JSX only.
export function DepartmentsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [modalState, setModalState] = useState(null); // null | { mode: 'create' } | { mode: 'edit', department }
  const [deleteTarget, setDeleteTarget] = useState(null);
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

  const { data, isLoading } = useAdminDepartments({
    search: debouncedSearch || undefined,
    ordering: ordering || undefined,
    page,
  });
  const departments = data?.results || [];
  const totalCount = data?.count || 0;

  // Managers double as the dropdown options and the lookup table used to
  // render a department's manager email in the table (the department API
  // only returns the manager's id, not a nested user object). page_size=500
  // opts out of the default 10/page — this needs every manager, not a page.
  const { data: managersPage } = useAdminUsers({ role: 'MANAGER', page_size: 500 });
  const managers = managersPage?.results || [];
  const managerOptions = managers.map((m) => ({ value: String(m.id), label: m.email }));
  const managerEmailById = Object.fromEntries(managers.map((m) => [m.id, m.email]));

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm({ resolver: zodResolver(departmentSchema) });

  function openCreate() {
    reset({ name: '', description: '', manager: '' });
    setModalState({ mode: 'create' });
  }

  // Deep-link support for notifications (bell dropdown / data-quality
  // alerts) that point at ?edit=<id> — fetches that one department directly
  // instead of relying on it being present on whatever page/filter is
  // currently loaded, then opens the edit modal and clears the param so
  // navigating away and back doesn't reopen it.
  const editId = searchParams.get('edit');
  const { data: deepLinkedDepartment } = useAdminDepartmentDeepLink(editId);
  useEffect(() => {
    if (deepLinkedDepartment) {
      openEdit(deepLinkedDepartment);
      setSearchParams((prev) => {
        prev.delete('edit');
        return prev;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkedDepartment]);

  function openEdit(department) {
    reset({
      name: department.name,
      description: department.description || '',
      manager: department.manager ? String(department.manager) : '',
    });
    setModalState({ mode: 'edit', department });
  }

  const createMutation = useCreateDepartment();
  const updateMutation = useUpdateDepartment();
  const deleteMutation = useDeleteDepartment();
  const saveMutation = modalState?.mode === 'edit' ? updateMutation : createMutation;

  function onSubmit(data) {
    const payload = {
      name: data.name,
      description: data.description || null,
      manager: data.manager || null,
    };
    const mutation = modalState.mode === 'edit' ? updateMutation : createMutation;
    mutation.mutate(modalState.mode === 'edit' ? { id: modalState.department.id, payload } : payload, {
      onSuccess: () => setModalState(null),
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-900">Departments</h1>
        <div className="flex items-center gap-2">
          <ExportButton
            url="/auth/departments/export/"
            params={{ search: debouncedSearch || undefined, ordering: ordering || undefined }}
            filename="worktracker_departments.xlsx"
          />
          <button
            type="button"
            onClick={openCreate}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" /> New Department
          </button>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, manager..."
          className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
        />
      </div>

      {/* table-fixed + width theo % nên bảng luôn vừa khung, không kéo ngang. */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full table-fixed text-left text-xs">
          <thead className="bg-slate-50">
            <tr>
              <SortableHeader label="Name" sortKey="name" ordering={ordering} onSort={toggleSort} className="w-[25%]" />
              <SortableHeader label="Description" sortKey="description" ordering={ordering} onSort={toggleSort} className="w-[36%]" />
              <SortableHeader label="Manager" sortKey="manager__email" ordering={ordering} onSort={toggleSort} className="w-[30%]" />
              <th className="w-[9%] px-3 py-2.5 text-right text-[11px] font-semibold uppercase text-slate-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-slate-400">
                  Loading...
                </td>
              </tr>
            )}
            {!isLoading && departments.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-slate-400">
                  {search ? 'No departments match your search.' : 'No departments yet.'}
                </td>
              </tr>
            )}
            {departments.map((dept) => (
              <tr key={dept.id}>
                <td className="px-3 py-2 font-medium text-slate-900 truncate" title={dept.name}>{dept.name}</td>
                <td className="px-3 py-2 text-slate-500 truncate" title={dept.description || ''}>
                  {dept.description || '—'}
                </td>
                <td className="px-3 py-2 text-slate-500 truncate" title={dept.manager ? managerEmailById[dept.manager] || '' : ''}>
                  {dept.manager ? managerEmailById[dept.manager] || dept.manager : '—'}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => openEdit(dept)}
                      className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(dept)}
                      className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
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
        title={modalState?.mode === 'edit' ? 'Edit Department' : 'New Department'}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <InputField label="Name" error={errors.name?.message} {...register('name')} />
          <InputField
            label="Description"
            error={errors.description?.message}
            {...register('description')}
          />
          <Controller
            name="manager"
            control={control}
            render={({ field }) => (
              <SelectDropdown
                label="Manager"
                placeholder="No manager"
                options={managerOptions}
                value={field.value}
                onChange={field.onChange}
                error={errors.manager?.message}
              />
            )}
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
        onConfirm={() => deleteMutation.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) })}
        title="Delete Department"
        description={`Are you sure you want to delete "${deleteTarget?.name}"?`}
        confirmText="Delete"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
