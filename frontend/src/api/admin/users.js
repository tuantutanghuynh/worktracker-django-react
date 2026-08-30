import axiosClient from '../axiosClient';

export const listUsers = (params) =>
  axiosClient.get('/auth/users/', { params }).then((r) => r.data);

export const getUser = (id) =>
  axiosClient.get(`/auth/users/${id}/`).then((r) => r.data);

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

// department: null clears the assignment (UserViewSet.assign_department
// treats a missing/null "department" key in the body as "unassign").
export const assignUserDepartment = (id, department) =>
  axiosClient.patch(`/auth/users/${id}/assign-department/`, { department }).then((r) => r.data);

// Gan Manager phu trach cho mot Employee. Truyen manager=null de go
// (dua ve "Chua gan") — backend coi khoa "manager" bang null la bo gan,
// giong cach assign-department xu ly.
export const assignUserManager = (id, manager) =>
  axiosClient.patch(`/auth/users/${id}/assign-manager/`, { manager }).then((r) => r.data);

export const listRoles = () =>
  axiosClient.get('/auth/roles/').then((r) => r.data);
