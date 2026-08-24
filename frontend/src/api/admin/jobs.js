import axiosClient from '../axiosClient';

export const listJobs = (params) =>
  axiosClient.get('/admin/jobs/', { params }).then((r) => r.data);

export const createJob = (data) =>
  axiosClient.post('/admin/jobs/', data).then((r) => r.data);

export const updateJob = (id, data) =>
  axiosClient.patch(`/admin/jobs/${id}/`, data).then((r) => r.data);

// Doesn't hard-delete — JobViewSet.perform_destroy sets status to CANCELLED.
export const cancelJob = (id) =>
  axiosClient.delete(`/admin/jobs/${id}/`).then((r) => r.data);
