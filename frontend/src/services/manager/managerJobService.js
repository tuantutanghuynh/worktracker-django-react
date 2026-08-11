import axiosClient from '../../api/axiosClient';

export const managerJobService = {
  /**
   * Fetch paginated list of jobs for manager
   * @param {Object} params - Query params (status, priority, search, page, page_size)
   */
  getJobs: async (params = {}) => {
    const response = await axiosClient.get('/manager/jobs/', { params });
    return response.data;
  },

  /**
   * Fetch single job detail
   * @param {number|string} id - Job ID
   */
  getJobDetail: async (id) => {
    const response = await axiosClient.get(`/manager/jobs/${id}/`);
    return response.data;
  },

  /**
   * Create a new job
   * @param {Object} data - { job_name, description, client_id, deadline, priority }
   */
  createJob: async (data) => {
    const response = await axiosClient.post('/manager/jobs/', data);
    return response.data;
  },

  /**
   * Update existing job details
   * @param {number|string} id - Job ID
   * @param {Object} data - Partial job data to update
   */
  updateJob: async (id, data) => {
    const response = await axiosClient.patch(`/manager/jobs/${id}/`, data);
    return response.data;
  },

  /**
   * Change job status with state machine validation
   * @param {number|string} id - Job ID
   * @param {string} newStatus - New status ('PLANNING', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'PAUSED')
   * @param {string} [reason] - Optional reason for status change
   */
  changeJobStatus: async (id, newStatus, reason = '') => {
    const response = await axiosClient.post(`/manager/jobs/${id}/status/`, {
      new_status: newStatus,
      reason,
    });
    return response.data;
  },
};

export default managerJobService;
