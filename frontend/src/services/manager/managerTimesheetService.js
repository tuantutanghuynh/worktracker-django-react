import axiosClient from '../../api/axiosClient';

export const managerTimesheetService = {
  /**
   * Fetch log works list
   * @param {Object} params - Query params (status, user_id, job_id, task_id, work_date_from, work_date_to, page)
   */
  getLogWorks: async (params = {}) => {
    const response = await axiosClient.get('/manager/log-works/', { params });
    return response.data;
  },

  /**
   * Fetch log work detail
   * @param {number|string} id - LogWork ID
   */
  getLogWorkDetail: async (id) => {
    const response = await axiosClient.get(`/manager/log-works/${id}/`);
    return response.data;
  },

  /**
   * Approve a work log entry
   * @param {number|string} id - LogWork ID
   * @param {string} [note] - Approval note
   */
  approveLogWork: async (id, note = '') => {
    const response = await axiosClient.post(`/manager/log-works/${id}/approve/`, { note });
    return response.data;
  },

  /**
   * Reject a work log entry
   * @param {number|string} id - LogWork ID
   * @param {string} reason - Rejection reason
   */
  rejectLogWork: async (id, reason = '') => {
    const response = await axiosClient.post(`/manager/log-works/${id}/reject/`, { reason });
    return response.data;
  },

  /**
   * Correct/adjust hours and description of a work log entry
   * @param {number|string} id - LogWork ID
   * @param {Object} data - { hours_spent, description, adjustment_reason }
   */
  correctLogWork: async (id, { hours_spent, description, adjustment_reason = '' } = {}) => {
    const response = await axiosClient.post(`/manager/log-works/${id}/correct/`, {
      hours_spent,
      description,
      adjustment_reason,
    });
    return response.data;
  },

  /**
   * Void a work log entry
   * @param {number|string} id - LogWork ID
   * @param {string} reason - Reason for voiding
   */
  voidLogWork: async (id, reason = '') => {
    const response = await axiosClient.post(`/manager/log-works/${id}/void/`, { reason });
    return response.data;
  },

  /**
   * Fetch time locks list
   * @param {Object} params - Query params (job_id, lock_month, lock_year, is_locked, page)
   */
  getTimeLocks: async (params = {}) => {
    const response = await axiosClient.get('/manager/time-locks/', { params });
    return response.data;
  },

  /**
   * Fetch time lock detail
   * @param {number|string} id - TimeLock ID
   */
  getTimeLockDetail: async (id) => {
    const response = await axiosClient.get(`/manager/time-locks/${id}/`);
    return response.data;
  },

  /**
   * Lock a time period for a job
   * @param {Object} data - { job_id, lock_month, lock_year, reason }
   */
  createTimeLock: async ({ job_id, lock_month, lock_year, reason = '' } = {}) => {
    const response = await axiosClient.post('/manager/time-locks/', {
      job_id,
      lock_month,
      lock_year,
      reason,
    });
    return response.data;
  },

  /**
   * Unlock a previously locked time period
   * @param {number|string} id - TimeLock ID
   * @param {string} reason - Unlock reason
   */
  unlockTimeLock: async (id, reason = '') => {
    const response = await axiosClient.post(`/manager/time-locks/${id}/unlock/`, { reason });
    return response.data;
  },
};

export default managerTimesheetService;
