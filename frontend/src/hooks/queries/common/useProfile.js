import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import profileService from '../../../services/common/profileService';
import { useAuthStore } from '../../../stores/authStore';

export const PROFILE_QUERY_KEY = ['profile', 'me'];

/**
 * Hook to fetch current authenticated user profile (Single Source of Truth from DB)
 */
export function useProfile() {
  return useQuery({
    queryKey: PROFILE_QUERY_KEY,
    queryFn: profileService.getProfile,
    staleTime: 60 * 1000, // 1 minute fresh cache
  });
}

/**
 * Hook to update user profile (full_name, phone_number)
 */
export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const { user, setUser } = useAuthStore();

  return useMutation({
    mutationFn: profileService.updateProfile,
    onSuccess: (data) => {
      queryClient.setQueryData(PROFILE_QUERY_KEY, (old) =>
        old ? { ...old, ...data } : data
      );
      queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEY });
      if (user) {
        setUser({ ...user, full_name: data.full_name });
      }
      toast.success('Profile information saved successfully!');
    },
    onError: (err) => {
      console.error('Update profile error:', err);
      toast.error(err.response?.data?.detail || 'Failed to update profile.');
    },
  });
}

/**
 * Hook to upload user avatar image
 */
export function useUploadAvatar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: profileService.uploadAvatar,
    onSuccess: (data) => {
      // Cập nhật tức thì React Query Cache với URL mới từ Database
      queryClient.setQueryData(PROFILE_QUERY_KEY, (old) =>
        old ? { ...old, avatar_url: data.avatar_url } : { avatar_url: data.avatar_url }
      );
      queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEY });
      toast.success('Avatar uploaded successfully!');
    },
    onError: (err) => {
      console.error('Upload avatar error:', err);
      const msg =
        err.response?.data?.avatar?.[0] ||
        err.response?.data?.detail ||
        'Failed to upload avatar.';
      toast.error(msg);
    },
  });
}

/**
 * Hook to change user password
 */
export function useChangePassword() {
  return useMutation({
    mutationFn: profileService.changePassword,
    onSuccess: (data) => {
      useAuthStore.getState().logout();
      toast.success(data?.detail || 'Password changed successfully. Please log in again with your new password.');
      setTimeout(() => {
        window.location.href = '/login';
      }, 500);
    },
    onError: (err) => {
      console.error('Change password error:', err);
      const msg =
        err.response?.data?.old_password?.[0] ||
        err.response?.data?.new_password?.[0] ||
        err.response?.data?.detail ||
        'Failed to change password. Please verify your current password.';
      toast.error(msg);
    },
  });
}
