import axiosClient from '../../api/axiosClient';

export const managerReportService = {
  /**
   * Fetch manager dashboard summary metrics & charts
   * @param {Object} params - Query params (month, year)
   */
  getDashboard: async (params = {}) => {
    const response = await axiosClient.get('/manager/dashboard/', { params });
    return response.data;
  },

  /**
   * Fetch task summary report dataset
   * @param {Object} params - Query params (job_id, assignee_id, status, priority, deadline_from, deadline_to)
   */
  getTaskSummaryReport: async (params = {}) => {
    const response = await axiosClient.get('/manager/reports/task-summary/', { params });
    return response.data;
  },

  /**
   * Fetch detailed timesheet report dataset
   * @param {Object} params - Query params (work_date_from, work_date_to, employee_id, department_id, job_id, task_id, task_status, review_status, include_voided)
   */
  getTimesheetDetailReport: async (params = {}) => {
    const response = await axiosClient.get('/manager/reports/timesheet-detail/', { params });
    return response.data;
  },

  /**
   * Export report dataset as downloadable PDF / Excel / CSV binary stream
   * @param {Object} data - Export configuration { report_type, file_format, ...filters }
   */
  exportReport: async (data = {}) => {
    const response = await axiosClient.post('/manager/reports/export/', data, {
      responseType: 'blob',
    });
    return response;
  },

  /**
   * Fetch manager system notifications
   * @param {Object} params - Query params (is_read, event_type)
   */
  getNotifications: async (params = {}) => {
    const response = await axiosClient.get('/manager/system/notifications/', { params });
    return response.data;
  },

  /**
   * Mark single notification as read
   * @param {number|string} id - Notification ID
   */
  markNotificationRead: async (id) => {
    const response = await axiosClient.post(`/manager/system/notifications/${id}/mark-read/`);
    return response.data;
  },

  /**
   * Mark all notifications as read
   */
  markAllNotificationsRead: async () => {
    const response = await axiosClient.post('/manager/system/notifications/mark-all-read/');
    return response.data;
  },

  /**
   * Delete single notification
   * @param {number|string} id - Notification ID
   */
  deleteNotification: async (id) => {
    const response = await axiosClient.delete(`/manager/system/notifications/${id}/`);
    return response.data;
  },

  /**
   * Delete multiple notifications in batch
   * @param {Array<number|string>} ids - Array of Notification IDs
   */
  deleteNotificationsBatch: async (ids) => {
    const response = await axiosClient.post('/manager/system/notifications/delete-batch/', { ids });
    return response.data;
  },

  /**
   * Fetch system audit log entries
   * @param {Object} params - Query params (table_name, action, record_id, date_from, date_to)
   */
  getAuditLogs: async (params = {}) => {
    const response = await axiosClient.get('/manager/system/audit-logs/', { params });
    return response.data;
  },
};

export default managerReportService;
