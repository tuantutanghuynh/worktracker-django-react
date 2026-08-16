import axiosClient from '../../api/axiosClient';

export const managerTaskService = {
  /**
   * Fetch task list
   * @param {Object} params - Query params (job_id, assignee_id, status, priority, search, page)
   */
  getTasks: async (params = {}) => {
    const response = await axiosClient.get('/manager/tasks/', { params });
    return response.data;
  },

  /**
   * Fetch task detail
   * @param {number|string} id - Task ID
   */
  getTaskDetail: async (id) => {
    const response = await axiosClient.get(`/manager/tasks/${id}/`);
    return response.data;
  },

  /**
   * Create a task
   * @param {Object} data - { job_id, assignee_id, title, description, priority, deadline }
   */
  createTask: async (data) => {
    const response = await axiosClient.post('/manager/tasks/', data);
    return response.data;
  },

  /**
   * Update task (PATCH)
   * @param {number|string} id - Task ID
   * @param {Object} data - Partial fields to update
   */
  updateTask: async (id, data) => {
    const response = await axiosClient.patch(`/manager/tasks/${id}/`, data);
    return response.data;
  },

  /**
   * Change task status
   * @param {number|string} id - Task ID
   * @param {string} toStatus - Target status ('TODO', 'IN_PROGRESS', 'REVIEWING', 'COMPLETED', 'CANCELLED')
   * @param {string} [reason] - Reason for status change
   */
  changeTaskStatus: async (id, toStatus, reason = '') => {
    const response = await axiosClient.post(`/manager/tasks/${id}/status/`, {
      to_status: toStatus,
      reason,
    });
    return response.data;
  },

  /**
   * Approve task (REVIEWING -> COMPLETED)
   * @param {number|string} id - Task ID
   */
  approveTask: async (id) => {
    const response = await axiosClient.post(`/manager/tasks/${id}/approve/`);
    return response.data;
  },

  /**
   * Reject task (REVIEWING -> IN_PROGRESS)
   * @param {number|string} id - Task ID
   * @param {string} reason - Rejection reason
   */
  rejectTask: async (id, reason = '') => {
    const response = await axiosClient.post(`/manager/tasks/${id}/reject/`, { reason });
    return response.data;
  },

  /**
   * Cancel task
   * @param {number|string} id - Task ID
   * @param {string} reason - Cancellation reason
   */
  cancelTask: async (id, reason = '') => {
    const response = await axiosClient.post(`/manager/tasks/${id}/cancel/`, { reason });
    return response.data;
  },

  /**
   * LexoRank drag-and-drop move task
   * @param {number|string} id - Task ID being moved
   * @param {Object} moveParams - { to_status, prev_task_id, next_task_id, reason }
   */
  moveTask: async (id, { to_status, prev_task_id = null, next_task_id = null, reason = '' } = {}) => {
    const response = await axiosClient.post(`/manager/tasks/${id}/move/`, {
      to_status,
      prev_task_id,
      next_task_id,
      reason,
    });
    return response.data;
  },

  /**
   * Fetch Kanban board for a job
   * @param {number|string} jobId - Job ID
   */
  getJobKanban: async (jobId) => {
    const response = await axiosClient.get(`/manager/jobs/${jobId}/kanban/`);
    return response.data;
  },

  /**
   * Fetch comments for a task
   * @param {number|string} id - Task ID
   */
  getComments: async (id) => {
    const response = await axiosClient.get(`/manager/tasks/${id}/comments/`);
    return response.data;
  },

  /**
   * Add comment to task
   * @param {number|string} id - Task ID
   * @param {string} content - Comment content
   */
  addComment: async (id, content) => {
    const response = await axiosClient.post(`/manager/tasks/${id}/comments/`, { content });
    return response.data;
  },

  /**
   * Fetch task attachments
   * @param {number|string} id - Task ID
   */
  getAttachments: async (id) => {
    const response = await axiosClient.get(`/manager/tasks/${id}/attachments/`);
    return response.data;
  },

  /**
   * Upload file attachment to task
   * @param {number|string} id - Task ID
   * @param {FormData} formData - FormData containing 'file' or file payload
   */
  uploadAttachment: async (id, formData) => {
    const response = await axiosClient.post(`/manager/tasks/${id}/attachments/`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  /**
   * Fetch followers list for a task
   * @param {number|string} id - Task ID
   */
  getFollowers: async (id) => {
    const response = await axiosClient.get(`/manager/tasks/${id}/followers/`);
    return response.data;
  },

  /**
   * Follow task
   * @param {number|string} id - Task ID
   */
  followTask: async (id) => {
    const response = await axiosClient.post(`/manager/tasks/${id}/follow/`);
    return response.data;
  },

  /**
   * Unfollow task
   * @param {number|string} id - Task ID
   */
  unfollowTask: async (id) => {
    const response = await axiosClient.post(`/manager/tasks/${id}/unfollow/`);
    return response.data;
  },
};

export default managerTaskService;
