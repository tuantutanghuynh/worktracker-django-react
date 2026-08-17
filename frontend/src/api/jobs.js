import axiosClient from './axiosClient';

export const listJobs = (params) =>
  axiosClient.get('/admin/jobs/', { params }).then((r) => r.data);

export const createJob = (data) =>
  axiosClient.post('/admin/jobs/', data).then((r) => r.data);

export const updateJob = (id, data) =>
  axiosClient.patch(`/admin/jobs/${id}/`, data).then((r) => r.data);
