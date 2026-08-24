import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Pencil, Trash2, ShieldCheck } from 'lucide-react';
import BaseModal from '../../components/common/modal/BaseModal';
import ConfirmModal from '../../components/common/modal/ConfirmModal';
import SideDrawer from '../../components/common/drawer/SideDrawer';
import InputField from '../../components/common/forms/InputField';
import {
  useAdminRolesList,
  useAdminPermissions,
  useCreateRole,
  useUpdateRole,
  useDeleteRole,
  useAssignPermissions,
} from '../../hooks/queries/admin/useAdminRoles';

const roleSchema = z.object({
  code: z.string().min(1, 'Code is required'),
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
});

// Groups a flat permission list ("user:create", "job:delete", ...) by the
// resource prefix before the colon, so the checklist reads as sections
// instead of one long alphabetical list.
function groupByResource(permissions) {
  const groups = {};
  for (const perm of permissions) {
    const [resource] = perm.code.split(':');
    (groups[resource] ||= []).push(perm);
  }
  return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
}

// Admin page for Role & Permission management (IAM) — list roles,
// create/edit/delete a role, and assign its permission set via a checklist
// drawer. Data logic lives in hooks/queries/admin/useAdminRoles.js — this
// file is JSX only.
export function RolesPermissionsPage() {
  const [modalState, setModalState] = useState(null); // null | { mode: 'create' } | { mode: 'edit', role }
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [permissionsRoleId, setPermissionsRoleId] = useState(null);
  const [checkedIds, setCheckedIds] = useState(new Set());

  const { data: roles = [], isLoading } = useAdminRolesList();
  const { data: permissions = [] } = useAdminPermissions();
  const permissionGroups = groupByResource(permissions);
  const selectedRole = roles.find((r) => r.id === permissionsRoleId);

  // Re-seeds the checklist from the newly-selected role's saved permissions
  // whenever the drawer target changes — adjusting state during render
  // (rather than a useEffect) avoids an extra re-render pass, same pattern
  // used for the ?edit= deep-link reset on the other admin pages.
  const [checkedForRoleId, setCheckedForRoleId] = useState(null);
  if (permissionsRoleId !== checkedForRoleId && selectedRole) {
    setCheckedForRoleId(permissionsRoleId);
    setCheckedIds(new Set(selectedRole.permission_ids || []));
  }

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({ resolver: zodResolver(roleSchema) });

  function openCreate() {
    reset({ code: '', name: '', description: '' });
    setModalState({ mode: 'create' });
  }

  function openEdit(role) {
    reset({ code: role.code, name: role.name, description: role.description || '' });
    setModalState({ mode: 'edit', role });
  }

  const createMutation = useCreateRole();
  const updateMutation = useUpdateRole();
  const deleteMutation = useDeleteRole();
  const assignMutation = useAssignPermissions();
  const saveMutation = modalState?.mode === 'edit' ? updateMutation : createMutation;

  function onSubmit(data) {
    const payload = { code: data.code, name: data.name, description: data.description || null };
    const mutation = modalState.mode === 'edit' ? updateMutation : createMutation;
    mutation.mutate(modalState.mode === 'edit' ? { id: modalState.role.id, payload } : payload, {
      onSuccess: () => setModalState(null),
    });
  }

  function toggleChecked(id) {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function onSavePermissions() {
    assignMutation.mutate({ roleId: permissionsRoleId, permissionIds: Array.from(checkedIds) });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Roles &amp; Permissions</h1>
          <p className="text-xs text-slate-500 mt-0.5">Manage roles and the permissions granted to each.</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" /> New Role
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-xs font-semibold uppercase text-slate-500">Code</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase text-slate-500">Name</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase text-slate-500">Description</th>
              <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-slate-500">Permissions</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase text-slate-500">Status</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">Actions</th>
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
            {!isLoading && roles.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                  No roles yet.
                </td>
              </tr>
            )}
            {roles.map((role) => (
              <tr key={role.id}>
                <td className="px-4 py-3 font-mono text-xs text-slate-600">{role.code}</td>
                <td className="px-4 py-3 font-medium text-slate-900">{role.name}</td>
                <td className="px-4 py-3 text-slate-500">{role.description || '—'}</td>
                <td className="px-4 py-3 text-center">
                  <button
                    type="button"
                    onClick={() => setPermissionsRoleId(role.id)}
                    className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-blue-600 hover:bg-blue-100"
                  >
                    <ShieldCheck className="h-3 w-3" />
                    {(role.permission_ids || []).length}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex px-2.5 py-0.5 text-[10px] font-bold rounded-full border ${
                      role.is_active
                        ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                        : 'bg-slate-100 text-slate-500 border-slate-200'
                    }`}
                  >
                    {role.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => openEdit(role)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(role)}
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
        title={modalState?.mode === 'edit' ? 'Edit Role' : 'New Role'}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <InputField
            label="Code"
            placeholder="e.g. SUPERVISOR"
            error={errors.code?.message}
            disabled={modalState?.mode === 'edit'}
            {...register('code')}
          />
          <InputField label="Name" error={errors.name?.message} {...register('name')} />
          <InputField label="Description" error={errors.description?.message} {...register('description')} />
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
        title="Delete Role"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? Any user still assigned this role will lose every permission it granted.`}
        confirmText="Delete"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />

      <SideDrawer
        isOpen={!!permissionsRoleId}
        onClose={() => setPermissionsRoleId(null)}
        title="Role Permissions"
        subtitle={selectedRole?.name}
        size="md"
        footer={
          <button
            type="button"
            onClick={onSavePermissions}
            disabled={assignMutation.isPending}
            className="w-full rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {assignMutation.isPending ? 'Saving...' : 'Save Permissions'}
          </button>
        }
      >
        {permissionGroups.map(([resource, perms]) => (
          <div key={resource} className="space-y-2">
            <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider">{resource}</h5>
            <div className="space-y-1.5">
              {perms.map((perm) => (
                <label
                  key={perm.id}
                  className="flex items-start gap-2.5 rounded-lg bg-slate-800/60 p-2.5 text-xs cursor-pointer hover:bg-slate-800"
                >
                  <input
                    type="checkbox"
                    checked={checkedIds.has(perm.id)}
                    onChange={() => toggleChecked(perm.id)}
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-slate-500 accent-blue-600"
                  />
                  <span className="text-slate-200">{perm.name}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </SideDrawer>
    </div>
  );
}
