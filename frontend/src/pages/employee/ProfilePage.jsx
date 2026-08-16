import { useAuth } from "../../hooks/useAuth"
import { useProfile } from "../../hooks/useProfile"
import { ProfileFormCard } from "../../components/common/profile/ProfileFormCard"
import { AvatarUploadCard } from "../../components/common/profile/AvatarUploadCard"
import { AccountSecurityCard } from "../../components/common/profile/AccountSecurityCard"

// Employee's own profile page — the only place that calls useProfile();
// the 3 profile cards stay pure (props in, callback out). Quick preview
// assembly ahead of Phase 3 — layout matches preview_employee_profile.html
// (4-col summary panel + 8-col form).
export function ProfilePage() {
    const { user } = useAuth()
    const { profile, loading, saving, error, saveProfile, changeAvatar } = useProfile()

    if (loading) {
        return <p className="text-xs text-slate-400">Loading profile...</p>
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">My Profile</h1>
                <p className="text-slate-500 text-xs">
                    Manage your personal information, avatar photo, and account security details.
                </p>
            </div>

            <div className="grid grid-cols-12 gap-6">
                <div className="col-span-4 space-y-6">
                    <AvatarUploadCard
                        avatarUrl={profile?.avatar_url}
                        email={user?.email}
                        onUpload={changeAvatar}
                        uploading={saving}
                    />
                    <AccountSecurityCard />
                </div>
                <div className="col-span-8">
                    <ProfileFormCard
                        profile={profile}
                        email={user?.email}
                        role={user?.role}
                        onSave={saveProfile}
                        saving={saving}
                        error={error}
                    />
                </div>
            </div>
        </div>
    )
}
