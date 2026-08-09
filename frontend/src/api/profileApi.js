import axiosClient from "./axiosClient"

// Employee self-service profile. Only full_name/phone_number are
// editable via updateProfile — department/avatar_url/joined_date are
// read-only on the backend. Avatar has its own endpoint (multipart)
// since it's a file, not part of the JSON profile body.

export async function getProfile() {
    const { data } = await axiosClient.get("/employee/me/profile/")
    return data
}

export async function updateProfile({ full_name, phone_number }) {
    const { data } = await axiosClient.patch("/employee/me/profile/", { full_name, phone_number })
    return data
}

export async function uploadAvatar(file) {
    const formData = new FormData()
    formData.append("avatar", file)
    const { data } = await axiosClient.patch("/employee/me/profile/avatar/", formData, {
        headers: { "Content-Type": "multipart/form-data" },
    })
    return data
}
