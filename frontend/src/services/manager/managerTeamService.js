import axiosClient from '../../api/axiosClient';

export const managerTeamService = {
  /**
   * Fetch team employees list with workload utilization summary
   * @param {Object} params - Query params (department_id, search, start_date, end_date, page)
   */
  getEmployees: async (params = {}) => {
    const response = await axiosClient.get('/manager/accounts/employees/', { params });
    return response.data;
  },

  /**
   * Fetch list of departments for dropdown selection
   */
  getDepartments: async () => {
    const response = await axiosClient.get('/manager/accounts/departments/');
    return response.data;
  },

  /**
   * Assign employee to department
   * @param {number|string} userId - Employee User ID
   * @param {number|string} departmentId - Department ID
   */
  assignDepartment: async (userId, departmentId) => {
    const response = await axiosClient.patch(`/manager/accounts/employees/${userId}/department/`, {
      department_id: departmentId,
    });
    return response.data;
  },
};

export default managerTeamService;
