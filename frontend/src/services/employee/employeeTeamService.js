import axiosClient from '../../api/axiosClient';

export const employeeTeamService = {
  /**
   * Lấy danh sách dự án Employee đang tham gia, kèm Manager + đồng
   * nghiệp cùng dự án.
   */
  getMyTeam: async () => {
    const response = await axiosClient.get('/employee/team/');
    return response.data;
  },
};

export default employeeTeamService;
