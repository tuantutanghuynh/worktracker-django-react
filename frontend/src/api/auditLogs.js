import axiosClient from './axiosClient';

export const listAuditLogs = (params) =>
  axiosClient.get('/admin/audit-logs/', { params }).then((r) => r.data);
