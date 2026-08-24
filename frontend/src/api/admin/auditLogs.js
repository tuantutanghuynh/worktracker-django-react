import axiosClient from '../axiosClient';

export const listAuditLogs = (params) =>
  axiosClient.get('/admin/audit-logs/', { params }).then((r) => r.data);

export const getAuditLogFilterOptions = () =>
  axiosClient.get('/admin/audit-logs/filters/').then((r) => r.data);

export const getAuditLogSummary = (params) =>
  axiosClient.get('/admin/audit-logs/summary/', { params }).then((r) => r.data);
