import axiosClient from '../axiosClient';

export const listAuditLogs = (params) =>
  axiosClient.get('/admin/audit-logs/', { params }).then((r) => r.data);

// Lay dung MOT ban ghi. Dung cho deep-link ?log=<id> tu Dashboard: khong the
// dua vao viec ban ghi do co nam trong trang/bo loc hien tai hay khong.
export const getAuditLog = (id) =>
  axiosClient.get(`/admin/audit-logs/${id}/`).then((r) => r.data);

export const getAuditLogFilterOptions = () =>
  axiosClient.get('/admin/audit-logs/filters/').then((r) => r.data);

export const getAuditLogSummary = (params) =>
  axiosClient.get('/admin/audit-logs/summary/', { params }).then((r) => r.data);
