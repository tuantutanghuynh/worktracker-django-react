import { useState, useEffect } from "react"
import { getProfile, updateProfile, uploadAvatar } from "../api/profileApi"

// Backend returns avatar_url as a relative path (MEDIA_URL="/media/"),
// not a full URL — resolve it against the API host, same idea as
// axiosClient's baseURL, or <img src> would resolve against the
// frontend's own origin instead of the backend serving the file.
function resolveAvatarUrl(url) {
    if (!url) return null
    if (url.startsWith("http")) return url
    return `${import.meta.env.VITE_API_BASE_URL}${url}`
}

// Reads any DRF error shape generically: {detail}, {non_field_errors},
// or a per-field error — takes the first message found, in that order.
function extractErrorMessage(err, fallback) {
    const data = err.response?.data
    if (!data) return fallback
    if (data.detail) return data.detail
    const firstKey = Object.keys(data)[0]
    return firstKey ? (data[firstKey]?.[0] ?? fallback) : fallback
}

// Wraps the Employee self-service profile flow: fetches on mount,
// exposes update/avatar-upload actions with their own loading state.
// Pages call this hook; they never touch profileApi directly.
export function useProfile() {
    const [profile, setProfile] = useState(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState(null)

    // Fetches the profile once on mount. No setState call happens before
    // the first `await` here (unlike a plain `fetchProfile()` call would),
    // which is what react-hooks/set-state-in-effect actually checks for —
    // `loading` already starts `true` via useState above, so there's
    // nothing to set synchronously before the request resolves.
    useEffect(() => {
        let cancelled = false

        async function loadProfile() {
            try {
                const data = await getProfile()
                if (cancelled) return
                setProfile({ ...data, avatar_url: resolveAvatarUrl(data.avatar_url) })
            } catch (err) {
                if (cancelled) return
                setError(extractErrorMessage(err, "Failed to load profile"))
            } finally {
                if (!cancelled) setLoading(false)
            }
        }

        loadProfile()

        return () => {
            cancelled = true
        }
    }, [])

    // Saves full_name/phone_number; returns true/false so the form can
    // decide whether to show a success state.
    async function saveProfile({ full_name, phone_number }) {
        setSaving(true)
        setError(null)
        try {
            const data = await updateProfile({ full_name, phone_number })
            setProfile((prev) => ({ ...prev, ...data }))
            return true
        } catch (err) {
            setError(extractErrorMessage(err, "Failed to save profile"))
            return false
        } finally {
            setSaving(false)
        }
    }

    // Uploads a new avatar file; updates just the avatar_url on success.
    async function changeAvatar(file) {
        setSaving(true)
        setError(null)
        try {
            const { avatar_url } = await uploadAvatar(file)
            setProfile((prev) => ({ ...prev, avatar_url: resolveAvatarUrl(avatar_url) }))
            return true
        } catch (err) {
            setError(extractErrorMessage(err, "Failed to upload avatar"))
            return false
        } finally {
            setSaving(false)
        }
    }

    return { profile, loading, saving, error, saveProfile, changeAvatar }
}
