import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import profileService from '../../../services/common/profileService';
import { useAuthStore } from '../../../stores/authStore';
import { getErrorMessage } from '../../../utils/errorMessages';

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
      toast.error(getErrorMessage(err, 'Could not save your profile. Please try again.'));
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
      toast.error(getErrorMessage(err, 'Could not upload the avatar. Please try again.'));
    },
  });
}

/**
 * Hook to change user password
 */
export function useChangePassword() {
  return useMutation({
    mutationFn: profileService.changePassword,
    onSuccess: () => {
      toast.success('Password changed successfully!');
    },
    onError: (err) => {
      console.error('Change password error:', err);
      toast.error(
        getErrorMessage(err, 'Could not change the password. Check your current password.')
      );
    },
  });
}
