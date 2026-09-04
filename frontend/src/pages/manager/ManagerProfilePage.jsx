import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { User, Mail, Phone, Building2, Camera, Save, RotateCcw, ShieldCheck, KeyRound } from "lucide-react";
import { toast } from "sonner";
import InputField from "../../components/common/forms/InputField";
import RoleBadge from "../../components/common/badges/RoleBadge";
import { useAuthStore } from "../../stores/authStore";
import { useProfile, useUpdateProfile, useUploadAvatar } from "../../hooks/queries/common/useProfile";

/**
 * Module: pages/manager/ManagerProfilePage
 * Description: Clean, balanced two-column profile management page for managers with quick navigation to system password change.
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

function getFullAvatarUrl(url) {
  /** Resolve avatar path safely against API base domain. */
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("blob:") || url.startsWith("data:")) {
    return url;
  }
  const base = API_BASE.replace(/\/api\/?$/, "").replace(/\/$/, "");
  const cleanPath = url.startsWith("/") ? url : `/${url}`;
  return `${base}${cleanPath}`;
}

export default function ManagerProfilePage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const { data: profileData, isLoading, isFetching, refetch } = useProfile();
  const updateProfileMutation = useUpdateProfile();
  const uploadAvatarMutation = useUploadAvatar();

  const [profileForm, setProfileForm] = useState({
    fullName: "",
    phone: "",
  });

  const [avatarPreview, setAvatarPreview] = useState(null);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    if (profileData) {
      setProfileForm({
        fullName: profileData.full_name || "",
        phone: profileData.phone_number || "",
      });
      setImageError(false);
    } else if (user) {
      setProfileForm({
        fullName: user.full_name || "",
        phone: "",
      });
    }
  }, [profileData, user]);

  const activeAvatarUrl = avatarPreview || profileData?.avatar_url;
  useEffect(() => {
    setImageError(false);
  }, [activeAvatarUrl]);

  const handleAvatarChange = (e) => {
    /** Validate and upload new avatar file via TanStack Query mutation. */
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Avatar file size must be 2MB or smaller.");
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setAvatarPreview(previewUrl);
    setImageError(false);

    uploadAvatarMutation.mutate(file, {
      onSuccess: () => {
        setTimeout(() => {
          setAvatarPreview(null);
        }, 500);
      },
      onError: () => {
        setAvatarPreview(null);
      },
    });
  };

  const handleSaveProfile = (e) => {
    /** Submit updated profile name and phone number to backend. */
    e.preventDefault();
    updateProfileMutation.mutate({
      full_name: profileForm.fullName.trim(),
      phone_number: profileForm.phone.trim(),
    });
  };

  const currentAvatar = getFullAvatarUrl(activeAvatarUrl);
  const currentEmail = user?.email || profileData?.email || "manager@worktracker.vn";

  const currentDepartment =
    profileData?.department_name ||
    (profileData?.department
      ? typeof profileData.department === "number"
        ? `Department #${profileData.department}`
        : profileData.department
      : user?.department || "Information Technology");

  const currentRole = user?.role || "MANAGER";

  const displayName = profileForm.fullName || user?.full_name || "Department Manager";
  const nameParts = displayName.trim().split(" ").filter(Boolean);
  const initials = nameParts.length >= 2 ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase() : displayName.slice(0, 2).toUpperCase();

  return (
    <div className='space-y-6 max-w-6xl mx-auto text-slate-800 pb-12'>
      {/* 🌟 HERO HEADER */}
      <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs'>
        <div className='flex items-start gap-4'>
          <div className='w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold text-xl shadow-lg shadow-blue-500/20 shrink-0'>
            <User className='w-6 h-6' />
          </div>
          <div>
            <h1 className='text-xl font-bold text-slate-900 tracking-tight'>Personal Profile</h1>
            <p className='text-xs text-slate-500 mt-0.5'>Manage your personal account credentials, department identity, and system access security.</p>
          </div>
        </div>

        {/* Action Buttons: Change Password & Reload */}
        <div className='flex items-center gap-2.5 shrink-0'>
          <button
            onClick={() => navigate("/change-password")}
            className='inline-flex items-center gap-2 px-4 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200/80 rounded-xl text-xs font-bold shadow-2xs transition cursor-pointer'
            title='Navigate to Change Password Page'>
            <KeyRound className='w-3.5 h-3.5 text-amber-600' />
            <span>Change Password</span>
          </button>

          <button
            onClick={() => {
              refetch();
              toast.success("Profile reloaded successfully!");
            }}
            disabled={isFetching}
            className='inline-flex items-center gap-2 px-4 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 shadow-2xs transition cursor-pointer disabled:opacity-60'>
            <RotateCcw className={`w-3.5 h-3.5 text-slate-500 ${isFetching ? "animate-spin" : ""}`} />
            <span>Reload Profile</span>
          </button>
        </div>
      </div>

      {/* ============================================================
          BỐ CỤC 2 KHỐI CÂN ĐỐI (HÌNH 1 BÊN TRÁI & HÌNH 2 BÊN PHẢI)
         ============================================================ */}
      <div className='grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch'>
        {/* KHỐI BÊN TRÁI (HÌNH 1): THẺ PROFILE IDENTITY (5 CỘT) */}
        <div className='lg:col-span-5 bg-white rounded-2xl border border-slate-200/80 p-6 text-center relative overflow-hidden shadow-xs flex flex-col justify-between'>
          <div className='absolute top-0 left-0 right-0 h-28 bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 opacity-95' />

          <div className='relative pt-6'>
            <div className='relative inline-block'>
              <div className='w-24 h-24 rounded-full border-4 border-white shadow-xl overflow-hidden bg-slate-100 mx-auto flex items-center justify-center'>
                {currentAvatar && !imageError ? (
                  <img key={currentAvatar} src={currentAvatar} alt={displayName} onError={() => setImageError(true)} className='w-full h-full object-cover' />
                ) : (
                  <div className='w-full h-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-extrabold text-2xl flex items-center justify-center tracking-wider'>
                    {initials}
                  </div>
                )}
              </div>

              <label
                htmlFor='avatar-upload'
                className='absolute bottom-0 right-0 p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg shadow-blue-600/30 cursor-pointer transition transform hover:scale-110 active:scale-95'
                title='Upload new avatar'>
                <Camera className='w-4 h-4' />
                <input
                  id='avatar-upload'
                  type='file'
                  accept='image/png,image/jpeg,image/jpg,image/webp'
                  onChange={handleAvatarChange}
                  className='hidden'
                  disabled={uploadAvatarMutation.isPending}
                />
              </label>
            </div>

            {uploadAvatarMutation.isPending && <p className='text-[11px] text-blue-600 font-semibold mt-2 animate-pulse'>Uploading avatar to server...</p>}

            <h2 className='text-base font-bold text-slate-900 mt-4 leading-tight'>{displayName}</h2>
            <p className='text-xs text-slate-400 font-medium mt-1 truncate max-w-[240px] mx-auto'>{currentEmail}</p>

            <div className='flex items-center justify-center gap-2 mt-3'>
              <RoleBadge role={currentRole} />
              <span className='px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wide'>
                ACTIVE
              </span>
            </div>
          </div>

          <div className='mt-8 pt-6 border-t border-slate-100 space-y-4 text-left text-xs'>
            <div className='flex items-center justify-between text-slate-600'>
              <span className='flex items-center gap-2.5 font-medium'>
                <Building2 className='w-4 h-4 text-slate-400' /> Department
              </span>
              <span className='font-bold text-slate-800 text-right truncate max-w-[180px]'>{currentDepartment}</span>
            </div>

            <div className='flex items-center justify-between text-slate-600'>
              <span className='flex items-center gap-2.5 font-medium'>
                <Mail className='w-4 h-4 text-slate-400' /> Email
              </span>
              <span className='font-bold text-slate-800 truncate max-w-[190px] text-right'>{currentEmail}</span>
            </div>

            <div className='flex items-center justify-between text-slate-600'>
              <span className='flex items-center gap-2.5 font-medium'>
                <Phone className='w-4 h-4 text-slate-400' /> Phone
              </span>
              <span className='font-bold text-slate-800'>{profileForm.phone || "+84 902 001 000"}</span>
            </div>

            <div className='flex items-center justify-between text-slate-600'></div>
          </div>
        </div>

        {/* KHỐI BÊN PHẢI (HÌNH 2): THẺ PERSONAL INFORMATION FORM (7 CỘT) */}
        <div className='lg:col-span-7 bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-xs flex flex-col justify-between'>
          <div>
            <div className='flex items-center justify-between mb-6 pb-4 border-b border-slate-100'>
              <div className='flex items-center space-x-3'>
                <div className='p-2.5 bg-blue-50 text-blue-600 rounded-xl'>
                  <User className='w-5 h-5' />
                </div>
                <div>
                  <h3 className='text-base font-bold text-slate-900'>Personal Information</h3>
                  <p className='text-xs text-slate-400'>Update your public display name and direct phone number</p>
                </div>
              </div>
            </div>

            <form id='managerProfileForm' onSubmit={handleSaveProfile} className='space-y-6'>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-5'>
                <InputField
                  label='Full Name'
                  value={profileForm.fullName}
                  onChange={(e) => setProfileForm({ ...profileForm, fullName: e.target.value })}
                  placeholder='e.g. Alexander Wright'
                  required
                />

                <InputField label='Email Address' type='email' value={currentEmail} disabled helperText='Primary corporate email cannot be modified directly.' />
              </div>

              <div className='grid grid-cols-1 md:grid-cols-2 gap-5'>
                <InputField
                  label='Phone Number'
                  value={profileForm.phone}
                  onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                  placeholder='e.g. +84 902 001 000'
                />

                <InputField label='Department' value={currentDepartment} disabled helperText='Managed via Enterprise Organization Directory.' />
              </div>
            </form>
          </div>

          <div className='flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 mt-6 border-t border-slate-100'>
            <span className='text-[11px] text-slate-400 italic text-center sm:text-left'>Changes will be synchronized immediately across all manager dashboards.</span>
            <button
              type='submit'
              form='managerProfileForm'
              disabled={updateProfileMutation.isPending}
              className='w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/25 transition cursor-pointer disabled:opacity-50 transform hover:-translate-y-0.5 active:translate-y-0'>
              <Save className='w-4 h-4' />
              <span>{updateProfileMutation.isPending ? "Saving Changes..." : "Save Profile"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
