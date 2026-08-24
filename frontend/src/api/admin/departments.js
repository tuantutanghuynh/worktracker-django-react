import axiosClient from '../axiosClient';

export const listDepartments = (params) =>
  axiosClient.get('/auth/departments/', { params }).then((r) => r.data);

export const getDepartment = (id) =>
  axiosClient.get(`/auth/departments/${id}/`).then((r) => r.data);

export const createDepartment = (data) =>
  axiosClient.post('/auth/departments/', data).then((r) => r.data);

export const updateDepartment = (id, data) =>
  axiosClient.patch(`/auth/departments/${id}/`, data).then((r) => r.data);

export const deleteDepartment = (id) =>
  axiosClient.delete(`/auth/departments/${id}/`).then((r) => r.data);
