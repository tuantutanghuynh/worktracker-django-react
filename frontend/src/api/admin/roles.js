import axiosClient from '../axiosClient';

export const listRoles = () =>
  axiosClient.get('/auth/roles/').then((r) => r.data);

export const getRole = (id) =>
  axiosClient.get(`/auth/roles/${id}/`).then((r) => r.data);

export const createRole = (data) =>
  axiosClient.post('/auth/roles/', data).then((r) => r.data);

export const updateRole = (id, data) =>
  axiosClient.patch(`/auth/roles/${id}/`, data).then((r) => r.data);

export const deleteRole = (id) =>
  axiosClient.delete(`/auth/roles/${id}/`).then((r) => r.data);

export const listPermissions = () =>
  axiosClient.get('/auth/permissions/').then((r) => r.data);

export const assignPermissions = (roleId, permissionIds) =>
  axiosClient
    .post(`/auth/roles/${roleId}/assign-permissions/`, { permission_ids: permissionIds })
    .then((r) => r.data);
