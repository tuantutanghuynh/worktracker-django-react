import axiosClient from '../../api/axiosClient';

export const profileService = {
  /**
   * Fetch current authenticated user's profile details
   */
  getProfile: async () => {
    const response = await axiosClient.get('/employee/me/profile/');
    return response.data;
  },

  /**
   * Update profile information (full_name, phone_number)
   * @param {Object} data - Profile fields to update
   */
  updateProfile: async (data) => {
    const response = await axiosClient.patch('/employee/me/profile/', data);
    return response.data;
  },

  /**
   * Upload user avatar image
   * @param {File} file - Image file (<= 2MB)
   */
  uploadAvatar: async (file) => {
    const formData = new FormData();
    formData.append('avatar', file);
    const response = await axiosClient.patch('/employee/me/profile/avatar/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  /**
   * Change current user's password
   * @param {Object} data - { old_password, new_password }
   */
  changePassword: async (data) => {
    const response = await axiosClient.post('/auth/change-password/', data);
    return response.data;
  },
};

export default profileService;
