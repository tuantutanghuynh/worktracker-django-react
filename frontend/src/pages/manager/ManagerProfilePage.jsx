import React, { useState } from 'react';
import { 
  User, 
  Mail, 
  Phone, 
  Building2, 
  ShieldCheck, 
  KeyRound, 
  Camera, 
  Save, 
  Lock, 
  CheckCircle2, 
  Sparkles,
  AlertCircle,
  Briefcase
} from 'lucide-react';
import { toast } from 'sonner';
import InputField from '../../components/common/forms/InputField';
import RoleBadge from '../../components/common/badges/RoleBadge';

export default function ManagerProfilePage() {
  // Avatar state
  const [avatarUrl, setAvatarUrl] = useState(
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80'
  );
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Profile Form state
  const [profile, setProfile] = useState({
    fullName: 'Trần Thị Thu Hà',
    email: 'ha.tran@worktracker.vn',
    phone: '0988 123 456',
    department: 'Phòng Phát triển Dự án',
    title: 'Senior Project Manager',
    bio: 'Quản lý 12 dự án phát triển phần mềm doanh nghiệp & chuyển đổi số.',
  });
  const [savingProfile, setSavingProfile] = useState(false);

  // Security Form state
  const [security, setSecurity] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    enable2FA: true,
  });
  const [savingSecurity, setSavingSecurity] = useState(false);
  const [securityError, setSecurityError] = useState('');

  // Handle Avatar Upload Simulation
  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Dung lượng ảnh vượt quá 5MB. Vui lòng chọn ảnh nhỏ hơn.');
        return;
      }
      setUploadingAvatar(true);
      const reader = new FileReader();
      reader.onloadend = () => {
        setTimeout(() => {
          setAvatarUrl(reader.result);
          setUploadingAvatar(false);
          toast.success('Đã cập nhật ảnh đại diện thành công!');
        }, 600);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle Profile Update
  const handleSaveProfile = (e) => {
    e.preventDefault();
    setSavingProfile(true);
    setTimeout(() => {
      setSavingProfile(false);
      toast.success('Đã lưu thông tin cá nhân thành công!');
    }, 500);
  };

  // Handle Security Update
  const handleSaveSecurity = (e) => {
    e.preventDefault();
    setSecurityError('');

    if (!security.currentPassword) {
      setSecurityError('Vui lòng nhập mật khẩu hiện tại');
      return;
    }
    if (security.newPassword && security.newPassword.length < 6) {
      setSecurityError('Mật khẩu mới phải có ít nhất 6 ký tự');
      return;
    }
    if (security.newPassword !== security.confirmPassword) {
      setSecurityError('Xác nhận mật khẩu mới không khớp');
      return;
    }

    setSavingSecurity(true);
    setTimeout(() => {
      setSavingSecurity(false);
      setSecurity((prev) => ({ ...prev, currentPassword: '', newPassword: '', confirmPassword: '' }));
      toast.success('Đã đổi mật khẩu và cập nhật cài đặt bảo mật!');
    }, 600);
  };

  return (
    <div className="space-y-6 text-slate-100 max-w-6xl mx-auto">
      {/* Page Title Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <User className="w-6 h-6 text-indigo-400" />
            Hồ Sơ Cá Nhân & Tài Khoản
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Cập nhật ảnh đại diện, thông tin làm việc và tùy chọn bảo mật tài khoản Manager
          </p>
        </div>
        <RoleBadge role="MANAGER" size="lg" />
      </div>

      {/* Main Grid: Left Avatar & Stats | Right Profile Forms */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: AvatarUploadCard & Quick Stats */}
        <div className="space-y-6">
          {/* Avatar Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center space-y-4 shadow-sm relative overflow-hidden">
            <div className="relative inline-block mx-auto">
              <img
                src={avatarUrl}
                alt="Manager Avatar"
                className="w-32 h-32 rounded-2xl object-cover ring-4 ring-slate-800 shadow-md"
              />
              <label
                htmlFor="avatar-input"
                className="absolute -bottom-2 -right-2 p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer shadow-lg transition-transform hover:scale-105"
                title="Đổi ảnh đại diện"
              >
                <Camera className="w-4 h-4" />
                <input
                  id="avatar-input"
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
              </label>
              {uploadingAvatar && (
                <div className="absolute inset-0 bg-slate-950/70 rounded-2xl flex items-center justify-center text-xs font-semibold text-white">
                  <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>

            <div className="space-y-1">
              <h2 className="text-lg font-bold text-white">{profile.fullName}</h2>
              <p className="text-xs text-indigo-400 font-medium">{profile.title}</p>
              <p className="text-xs text-slate-400">{profile.email}</p>
            </div>

            <div className="pt-4 border-t border-slate-800/80 grid grid-cols-2 gap-3 text-left">
              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                <span className="text-[11px] text-slate-400 block">Dự án quản lý</span>
                <span className="text-base font-bold text-slate-100">12 Dự án</span>
              </div>
              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                <span className="text-[11px] text-slate-400 block">Cấp bậc</span>
                <span className="text-base font-bold text-emerald-400">Senior L4</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Profile Form & Account Security Cards */}
        <div className="lg:col-span-2 space-y-6">
          {/* Profile Details Form Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-sm">
            <div className="border-b border-slate-800 pb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold text-slate-100">Thông Tin Hồ Sơ</h3>
              </div>
              <span className="text-xs text-slate-400">Cập nhật chi tiết cá nhân</span>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InputField
                  label="Họ và Tên"
                  name="fullName"
                  value={profile.fullName}
                  onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}
                  leftIcon={User}
                  required
                />
                <InputField
                  label="Địa chỉ Email"
                  name="email"
                  type="email"
                  value={profile.email}
                  onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                  leftIcon={Mail}
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InputField
                  label="Số điện thoại"
                  name="phone"
                  value={profile.phone}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                  leftIcon={Phone}
                />
                <InputField
                  label="Chức danh / Vị trí"
                  name="title"
                  value={profile.title}
                  onChange={(e) => setProfile({ ...profile, title: e.target.value })}
                  leftIcon={Briefcase}
                />
              </div>

              <InputField
                label="Phòng ban làm việc"
                name="department"
                value={profile.department}
                onChange={(e) => setProfile({ ...profile, department: e.target.value })}
                leftIcon={Building2}
              />

              {/* Bio / Description */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">Giới thiệu ngắn (Bio)</label>
                <textarea
                  rows={3}
                  value={profile.bio}
                  onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 transition"
                  placeholder="Mô tả công việc hoặc vai trò của bạn..."
                />
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="px-5 py-2.5 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-md hover:shadow-indigo-600/30 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {savingProfile ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  <span>Lưu Thay Đổi</span>
                </button>
              </div>
            </form>
          </div>

          {/* Account Security Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-sm">
            <div className="border-b border-slate-800 pb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold text-slate-100">Bảo Mật Tài Khoản & Mật Khẩu</h3>
              </div>
              <span className="text-xs text-slate-400">Đổi mật khẩu định kỳ</span>
            </div>

            <form onSubmit={handleSaveSecurity} className="space-y-4">
              {securityError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{securityError}</span>
                </div>
              )}

              <InputField
                label="Mật khẩu hiện tại"
                name="currentPassword"
                type="password"
                value={security.currentPassword}
                onChange={(e) => setSecurity({ ...security, currentPassword: e.target.value })}
                leftIcon={Lock}
                required
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InputField
                  label="Mật khẩu mới"
                  name="newPassword"
                  type="password"
                  value={security.newPassword}
                  onChange={(e) => setSecurity({ ...security, newPassword: e.target.value })}
                  leftIcon={KeyRound}
                />
                <InputField
                  label="Xác nhận mật khẩu mới"
                  name="confirmPassword"
                  type="password"
                  value={security.confirmPassword}
                  onChange={(e) => setSecurity({ ...security, confirmPassword: e.target.value })}
                  leftIcon={KeyRound}
                />
              </div>

              {/* 2FA Option */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-slate-200 block">Xác thực 2 lớp (2FA / OTP)</span>
                  <span className="text-[11px] text-slate-400 block">
                    Yêu cầu mã xác thực ứng dụng khi đăng nhập từ thiết bị lạ
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={security.enable2FA}
                  onChange={(e) => setSecurity({ ...security, enable2FA: e.target.checked })}
                  className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                />
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={savingSecurity}
                  className="px-5 py-2.5 text-xs font-bold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 transition flex items-center gap-2 disabled:opacity-50"
                >
                  {savingSecurity ? (
                    <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  )}
                  <span>Cập Nhật Mật Khẩu</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

