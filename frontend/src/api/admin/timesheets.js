import axiosClient from '../axiosClient';

export const getTimesheetSummary = (params) =>
  axiosClient.get('/admin/timesheets/summary/', { params }).then((r) => r.data);

export const listTimesheetEmployees = (params) =>
  axiosClient.get('/admin/timesheets/employees/', { params }).then((r) => r.data);

export const getTimesheetEmployeeDetail = (userId, params) =>
  axiosClient.get(`/admin/timesheets/employees/${userId}/`, { params }).then((r) => r.data);

export const listGlobalTimeLocks = (params) =>
  axiosClient.get('/admin/timesheets/time-locks/', { params }).then((r) => r.data);

export const lockGlobalPeriod = (data) =>
  axiosClient.post('/admin/timesheets/time-locks/lock/', data).then((r) => r.data);

export const unlockGlobalPeriod = (id, reason) =>
  axiosClient.post(`/admin/timesheets/time-locks/${id}/unlock/`, { reason }).then((r) => r.data);
