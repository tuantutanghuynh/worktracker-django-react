import axiosClient from './axiosClient';

// Shared endpoint for every authenticated role — see backend
// system/employee/urls_employee.py (mounted at /api/notifications/,
// not role-gated despite living in the "employee" app).
export const listNotifications = (params) =>
  axiosClient.get('/notifications/', { params }).then((r) => r.data);

export const markNotificationRead = (id) =>
  axiosClient.patch(`/notifications/${id}/read/`).then((r) => r.data);
