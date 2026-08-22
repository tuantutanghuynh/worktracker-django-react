import axiosClient from './axiosClient';

export const listClients = (params) =>
  axiosClient.get('/admin/clients/', { params }).then((r) => r.data);

export const createClient = (data) =>
  axiosClient.post('/admin/clients/', data).then((r) => r.data);

export const updateClient = (id, data) =>
  axiosClient.patch(`/admin/clients/${id}/`, data).then((r) => r.data);

export const deleteClient = (id) =>
  axiosClient.delete(`/admin/clients/${id}/`).then((r) => r.data);

export const restoreClient = (id) =>
  axiosClient.patch(`/admin/clients/${id}/restore/`).then((r) => r.data);
