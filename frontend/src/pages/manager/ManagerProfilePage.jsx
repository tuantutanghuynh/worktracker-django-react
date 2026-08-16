import React, { useState, useEffect } from 'react';
import {
  User,
  Mail,
  Phone,
  Building2,
  KeyRound,
  Camera,
  Save,
  Lock,
  RotateCcw,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import InputField from '../../components/common/forms/InputField';
import RoleBadge from '../../components/common/badges/RoleBadge';
import { useAuthStore } from '../../stores/authStore';
import {
  useProfile,
  useUpdateProfile,
  useUploadAvatar,
  useChangePassword,
} from '../../hooks/queries/common/useProfile';

export default function ManagerProfilePage() {
  const { user } = useAuthStore();

  // 🚀 TANSTACK REACT QUERY HOOKS
  const { data: profileData, isLoading, isFetching, refetch } = useProfile();
  const updateProfileMutation = useUpdateProfile();
  const uploadAvatarMutation = useUploadAvatar();
  const changePasswordMutation = useChangePassword();

  // Local Form state
  const [profileForm, setProfileForm] = useState({
    fullName: '',
    phone: '',
  });

  // Security Form state
  const [securityForm, setSecurityForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [securityError, setSecurityError] = useState('');

  // Sync profile data from React Query into local form
  useEffect(() => {
    if (profileData) {
      setProfileForm({
        fullName: profileData.full_name || '',
        phone: profileData.phone_number || '',
      });
    } else if (user) {
      setProfileForm({
        fullName: user.full_name || '',
        phone: '',
      });
    }
  }, [profileData, user]);

  // 📷 AVATAR UPLOAD VIA TANSTACK MUTATION
  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Avatar file size must be 2MB or smaller.');
      return;
    }

    uploadAvatarMutation.mutate(file);
  };

  // 💾 SAVE PROFILE VIA TANSTACK MUTATION
  const handleSaveProfile = (e) => {
    e.preventDefault();
    updateProfileMutation.mutate({
      full_name: profileForm.fullName.trim(),
      phone_number: profileForm.phone.trim(),
    });
  };

  // 🔒 CHANGE PASSWORD VIA TANSTACK MUTATION
  const handleSaveSecurity = (e) => {
    e.preventDefault();
    setSecurityError('');

    if (!securityForm.currentPassword) {
      setSecurityError('Please enter your current password.');
      return;
    }
    if (!securityForm.newPassword || securityForm.newPassword.length < 6) {
      setSecurityError('New password must be at least 6 characters.');
      return;
    }
    if (securityForm.newPassword !== securityForm.confirmPassword) {
      setSecurityError('New password confirmation does not match.');
      return;
    }

    changePasswordMutation.mutate(
      {
        old_password: securityForm.currentPassword,
        new_password: securityForm.newPassword,
      },
      {
        onSuccess: () => {
          setSecurityForm({
            currentPassword: '',
            newPassword: '',
            confirmPassword: '',
          });
        },
        onError: (err) => {
          const errMsg =
            err.response?.data?.old_password?.[0] ||
            err.response?.data?.new_password?.[0] ||
            err.response?.data?.detail ||
            'Failed to change password. Please verify your current password.';
          setSecurityError(errMsg);
        },
      }
    );
  };

  const currentAvatar = profileData?.avatar_url || user?.avatar_url;
  const currentEmail = user?.email || profileData?.email || '';
  const currentDepartment = profileData?.department || user?.department || 'Management Dept';
  const currentRole = user?.role || 'MANAGER';

  return (
    <div className="space-y-6 max-w-6xl mx-auto text-slate-800 pb-12">
      {/* 🌟 HERO HEADER */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold text-xl shadow-lg shadow-blue-500/20 shrink-0">
            <User className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Personal Profile & Security</h1>
            <p className="text-xs text-slate-500 mt-1">
              Manage your personal account credentials, department identity, and system access security.
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            refetch();
            toast.success('Profile reloaded!');
          }}
          disabled={isFetching}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 shadow-2xs transition cursor-pointer"
        >
          <RotateCcw className={`w-3.5 h-3.5 text-slate-500 ${isFetching ? 'animate-spin' : ''}`} />
          <span>Reload Profile</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ============================================================
            CỘT TRÁI: THẺ HỒ SƠ TỔNG QUAN & AVATAR
           ============================================================ */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 text-center relative overflow-hidden shadow-xs">
            <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-r from-blue-600 to-indigo-600 opacity-90" />

            <div className="relative pt-6">
              <div className="relative inline-block">
                <div className="w-24 h-24 rounded-full border-4 border-white shadow-lg overflow-hidden bg-slate-100 mx-auto flex items-center justify-center">
                  {currentAvatar ? (
                    <img
                      src={currentAvatar}
                      alt="Avatar"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-blue-100 text-blue-700 font-extrabold text-2xl flex items-center justify-center uppercase">
                      {(profileForm.fullName || currentEmail || 'U').charAt(0)}
                    </div>
                  )}
                </div>

                <label
                  htmlFor="avatar-upload"
                  className="absolute bottom-0 right-0 p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-md cursor-pointer transition transform hover:scale-105"
                  title="Upload new avatar"
                >
                  <Camera className="w-4 h-4" />
                  <input
                    id="avatar-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="hidden"
                    disabled={uploadAvatarMutation.isPending}
                  />
                </label>
              </div>

              {uploadAvatarMutation.isPending && (
                <p className="text-[11px] text-blue-600 font-semibold mt-2 animate-pulse">
                  Uploading avatar to server...
                </p>
              )}

              <h2 className="text-base font-bold text-slate-900 mt-4">
                {profileForm.fullName || currentEmail}
              </h2>
              <p className="text-xs text-slate-400 font-medium">{currentEmail}</p>

              <div className="flex items-center justify-center gap-2 mt-3">
                <RoleBadge role={currentRole} />
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase">
                  Active
                </span>
              </div>
            </div>

            <div className="mt-6 pt-5 border-t border-slate-100 space-y-3 text-left text-xs">
              <div className="flex items-center justify-between text-slate-600">
                <span className="flex items-center gap-2 font-medium">
                  <Building2 className="w-4 h-4 text-slate-400" /> Department
                </span>
                <span className="font-bold text-slate-800">{currentDepartment}</span>
              </div>

              <div className="flex items-center justify-between text-slate-600">
                <span className="flex items-center gap-2 font-medium">
                  <Mail className="w-4 h-4 text-slate-400" /> Email
                </span>
                <span className="font-bold text-slate-800 truncate max-w-[160px]">
                  {currentEmail}
                </span>
              </div>

              <div className="flex items-center justify-between text-slate-600">
                <span className="flex items-center gap-2 font-medium">
                  <Phone className="w-4 h-4 text-slate-400" /> Phone
                </span>
                <span className="font-bold text-slate-800">
                  {profileForm.phone || 'Not provided'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ============================================================
            CỘT PHẢI: FORM CHỈNH SỬA THÔNG TIN & ĐỔI MẬT KHẨU
           ============================================================ */}
        <div className="lg:col-span-2 space-y-6">
          {/* 📝 FORM 1: THÔNG TIN HỒ SƠ */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Personal Information</h3>
                  <p className="text-xs text-slate-400">Update your public name and contact phone number</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InputField
                  label="Full Name"
                  value={profileForm.fullName}
                  onChange={(e) => setProfileForm({ ...profileForm, fullName: e.target.value })}
                  placeholder="e.g. John Doe"
                  required
                />

                <InputField
                  label="Email Address"
                  type="email"
                  value={currentEmail}
                  disabled
                  helperText="Primary email cannot be changed directly."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InputField
                  label="Phone Number"
                  value={profileForm.phone}
                  onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                  placeholder="e.g. 0988 123 456"
                />

                <InputField
                  label="Department"
                  value={currentDepartment}
                  disabled
                  helperText="Managed via System Admin / Team Directory"
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={updateProfileMutation.isPending}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{updateProfileMutation.isPending ? 'Saving Changes...' : 'Save Profile'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* 🔒 FORM 2: BẢO MẬT & ĐỔI MẬT KHẨU */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Security & Password</h3>
                  <p className="text-xs text-slate-400">Ensure your account uses a strong password</p>
                </div>
              </div>
            </div>

            {securityError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{securityError}</span>
              </div>
            )}

            <form onSubmit={handleSaveSecurity} className="space-y-4">
              <InputField
                label="Current Password"
                type="password"
                value={securityForm.currentPassword}
                onChange={(e) => setSecurityForm({ ...securityForm, currentPassword: e.target.value })}
                placeholder="Enter current password"
                required
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InputField
                  label="New Password"
                  type="password"
                  value={securityForm.newPassword}
                  onChange={(e) => setSecurityForm({ ...securityForm, newPassword: e.target.value })}
                  placeholder="Min 6 characters"
                  required
                />

                <InputField
                  label="Confirm New Password"
                  type="password"
                  value={securityForm.confirmPassword}
                  onChange={(e) => setSecurityForm({ ...securityForm, confirmPassword: e.target.value })}
                  placeholder="Repeat new password"
                  required
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={changePasswordMutation.isPending}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-md transition cursor-pointer disabled:opacity-50"
                >
                  <Lock className="w-4 h-4" />
                  <span>{changePasswordMutation.isPending ? 'Updating Password...' : 'Change Password'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
