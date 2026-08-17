import axiosClient from './axiosClient';

export const listUsers = (params) =>
  axiosClient.get('/auth/users/', { params }).then((r) => r.data);

export const createUser = (data) =>
  axiosClient.post('/auth/users/', data).then((r) => r.data);

export const updateUser = (id, data) =>
  axiosClient.patch(`/auth/users/${id}/`, data).then((r) => r.data);

export const lockUser = (id) =>
  axiosClient.patch(`/auth/users/${id}/lock/`).then((r) => r.data);

export const unlockUser = (id) =>
  axiosClient.patch(`/auth/users/${id}/unlock/`).then((r) => r.data);

export const resetUserPassword = (id, new_password) =>
  axiosClient.patch(`/auth/users/${id}/reset-password/`, { new_password }).then((r) => r.data);

export const listRoles = () =>
  axiosClient.get('/auth/roles/').then((r) => r.data);
