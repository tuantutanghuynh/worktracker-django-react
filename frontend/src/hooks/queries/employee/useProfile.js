import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getProfile, updateProfile, uploadAvatar } from "../../../api/profileApi"
import { getErrorMessage } from "../../../utils/errorMessages"

// Backend returns avatar_url as a relative path (MEDIA_URL="/media/"),
// not a full URL — resolve it against the API host, same idea as
// axiosClient's baseURL, or <img src> would resolve against the
// frontend's own origin instead of the backend serving the file.
function resolveAvatarUrl(url) {
    if (!url) return null
    if (url.startsWith("http")) return url
    return `${import.meta.env.VITE_API_BASE_URL}${url}`
}

export const profileKeys = {
    all: ['employee-profile'],
    me: () => [...profileKeys.all, 'me'],
}

// Wraps the Employee self-service profile flow: 1 query + 2 mutations
// (update info, upload avatar) that both invalidate the same query key
// afterward so the UI reflects saved data without manually merging
// response shapes by hand.
export function useProfile() {
    const queryClient = useQueryClient()

    const { data, isLoading, error: queryError } = useQuery({
        queryKey: profileKeys.me(),
        queryFn: getProfile,
        select: (data) => ({ ...data, avatar_url: resolveAvatarUrl(data.avatar_url) }),
    })

    const updateMutation = useMutation({
        mutationFn: updateProfile,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: profileKeys.me() })
            toast.success('Profile updated successfully!')
        },
        onError: (err) => {
            toast.error(getErrorMessage(err, 'Failed to save profile'))
        },
    })

    const avatarMutation = useMutation({
        mutationFn: uploadAvatar,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: profileKeys.me() })
            toast.success('Avatar updated successfully!')
        },
        onError: (err) => {
            toast.error(getErrorMessage(err, 'Failed to upload avatar'))
        },
    })

    return {
        profile: data,
        loading: isLoading,
        saving: updateMutation.isPending || avatarMutation.isPending,
        error: queryError ? getErrorMessage(queryError, 'Failed to load profile') : null,
        saveProfile: updateMutation.mutateAsync,
        changeAvatar: avatarMutation.mutateAsync,
    }
}
