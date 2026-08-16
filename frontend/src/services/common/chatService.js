import axiosClient from '../../api/axiosClient';

/**
 * Service API quản lý Kênh Chat Dự Án và Chat 1-1
 * Sử dụng chung cho cả Manager, Employee và Admin
 */
export const chatService = {
  /**
   * Lấy danh sách các phòng chat (gồm job_channels và direct_messages)
   */
  getRooms: async () => {
    const response = await axiosClient.get('/chat/rooms/');
    return response.data;
  },

  /**
   * Lấy lịch sử tin nhắn của một phòng chat cụ thể (tối đa 100 tin gần nhất)
   * Tự động đánh dấu đã đọc
   * @param {number|string} roomId - ID phòng chat
   */
  getRoomMessages: async (roomId) => {
    const response = await axiosClient.get(`/chat/rooms/${roomId}/messages/`);
    return response.data;
  },

  /**
   * Gửi tin nhắn mới (văn bản và/hoặc tệp đính kèm)
   * @param {number|string} roomId - ID phòng chat
   * @param {Object} data - { content, attachment_url, attachment_name, attachment_size }
   */
  sendMessage: async (roomId, data) => {
    const response = await axiosClient.post(`/chat/rooms/${roomId}/send_message/`, data);
    return response.data;
  },

  /**
   * Khởi tạo hoặc lấy phòng chat 1-1 với một người dùng cụ thể
   * @param {number|string} targetUserId - ID người nhận
   */
  startDirect: async (targetUserId) => {
    const response = await axiosClient.post('/chat/rooms/start_direct/', {
      target_user_id: targetUserId,
    });
    return response.data;
  },

  /**
   * Tải tệp tin đính kèm lên Server nội bộ an toàn (Giới hạn tối đa 20MB)
   * @param {File} file - Tệp tin cần tải lên
   */
  uploadAttachment: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await axiosClient.post('/chat/rooms/upload_attachment/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  /**
   * Lấy danh bạ toàn bộ nhân sự trong công ty để bắt đầu cuộc hội thoại 1-1
   */
  getDirectory: async () => {
    const response = await axiosClient.get('/chat/rooms/directory/');
    return response.data;
  },
};
