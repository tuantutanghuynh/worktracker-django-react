import axiosClient from './axiosClient';

export const listClients = (params) =>
  axiosClient.get('/admin/clients/', { params }).then((r) => r.data);
