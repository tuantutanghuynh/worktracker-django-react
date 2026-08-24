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

// Short-lived (5min) Redis lock — held for the duration of the edit modal
// so a second admin opening the same job gets a 423 instead of silently
// overwriting the first admin's changes on save.
export const acquireJobLock = (id) =>
  axiosClient.post(`/admin/jobs/${id}/acquire-lock/`).then((r) => r.data);

export const releaseJobLock = (id) =>
  axiosClient.delete(`/admin/jobs/${id}/release-lock/`).then((r) => r.data);
