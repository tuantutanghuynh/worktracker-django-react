import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import {
  Search,
  Bell,
  User,
  Settings,
  LogOut,
  ChevronRight,
  Menu,
} from 'lucide-react';
import { useUIStore } from '../../../stores/useUIStore';
import { useAuth } from '../../../hooks/useAuth';
import { useNotificationStore } from '../../../stores/useNotificationStore';
import { useProfile } from '../../../hooks/queries/common/useProfile';
import UserAvatar from '../avatar/UserAvatar';

// Bản ánh xạ Nhãn đường dẫn Breadcrumbs sang Tiếng Anh
const ROUTE_LABELS = {
  manager: 'Manager',
  employee: 'Employee',
  dashboard: 'Dashboard',
  jobs: 'Projects & Jobs',
  kanban: 'Kanban Board',
  team: 'Team Members',
  timesheet: 'Timesheet',
  timesheets: 'Timesheets',
  review: 'Review',
  timelock: 'Period Lock',
  timelocks: 'Period Lock',
  reports: 'Reports & Analytics',
  notifications: 'Notification Center',
  profile: 'My Profile',
  settings: 'System Settings',
  'my-tasks': 'My Tasks',
  'my-performance': 'My Performance',
};

// Mỗi role có Home/Notifications/Profile/Settings khác nhau — Header dùng
// chung cho cả 3 role nên không được hardcode 1 path cố định, phải tra
// theo role hiện tại.
const ROLE_LINKS = {
  ADMIN: { home: '/admin', notifications: '/admin/notifications', profile: '/admin/profile', settings: '/admin/profile' },
  MANAGER: { home: '/manager/dashboard', notifications: '/manager/notifications', profile: '/manager/profile', settings: '/manager/settings' },
  EMPLOYEE: { home: '/', notifications: '/employee/notifications', profile: '/employee/profile', settings: '/employee/profile' },
};

export default function Header({ onOpenSearchModal }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { toggleSidebar } = useUIStore();
  const { unreadCount } = useNotificationStore();

  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Lấy thông tin user đăng nhập từ useAuth (Zustand Store)
  const { user, logout } = useAuth();
  const displayUser = user || { email: 'manager@worktracker.vn', role: 'MANAGER' };

  // Header dùng chung Manager + Employee + Admin — 3 role có route gốc
  // khác nhau, không được hardcode theo 1 role cho tất cả.
  const userRole = (displayUser.role || '').toUpperCase();
  const roleLinks = ROLE_LINKS[userRole] || ROLE_LINKS.EMPLOYEE;
  const homePath = roleLinks.home;
  const notificationsPath = roleLinks.notifications;

  // Đóng Dropdown khi click ra ngoài vùng menu
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setUserDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Tính toán chuỗi Breadcrumb động
  const pathSegments = location.pathname.split('/').filter(Boolean);
  const breadcrumbs = pathSegments.map((segment, idx) => {
    const path = '/' + pathSegments.slice(0, idx + 1).join('/');
    const isLast = idx === pathSegments.length - 1;

    let label = ROUTE_LABELS[segment.toLowerCase()] || segment;
    if (!isNaN(segment)) {
      label = `Detail #${segment}`;
    }

    return { path, label, isLast };
  });

  // Xử lý Đăng xuất an toàn
  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const { data: profile } = useProfile();
  const avatarUser = {
    full_name: profile?.full_name || displayUser.full_name,
    email: displayUser.email,
    avatar_url: profile?.avatar_url,
    role: displayUser.role,
  };

  return (
    <header className="h-16 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-50">
      {/* Nút Toggle Sidebar trên Mobile & Thanh điều hướng Breadcrumb */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={toggleSidebar}
          className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          title="Toggle Navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Thanh Breadcrumb Động */}
        <nav aria-label="Breadcrumb" className="hidden sm:flex items-center gap-1.5 text-xs sm:text-sm font-medium text-slate-500 overflow-hidden">
          <Link to={homePath} className="hover:text-blue-600 transition-colors shrink-0">
            Home
          </Link>
          {breadcrumbs.map((crumb) => (
            <React.Fragment key={crumb.path}>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              {crumb.isLast ? (
                <span className="font-semibold text-slate-900 truncate">
                  {crumb.label}
                </span>
              ) : (
                <Link to={crumb.path} className="hover:text-blue-600 transition-colors truncate">
                  {crumb.label}
                </Link>
              )}
            </React.Fragment>
          ))}
        </nav>
      </div>

      {/* Bên Phải: Nút Tìm kiếm, Chuông thông báo & Avatar User */}
      <div className="flex items-center gap-2 sm:gap-4">
        {/* Nút Mở Modal Tìm kiếm Quick Search (Ctrl + K) */}
        <button
          onClick={onOpenSearchModal}
          className="flex items-center gap-2 px-3 py-1.5 bg-slate-100/80 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs text-slate-500 transition-colors"
          title="Quick Search (Ctrl + K)"
        >
          <Search className="w-4 h-4 text-slate-400" />
          <span className="hidden md:inline font-medium">Search jobs, tasks...</span>
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 bg-white border border-slate-200 rounded shadow-2xs">
            Ctrl K
          </kbd>
        </button>

        {/* Biểu tượng Chuông Thông báo */}
        <Link
          to={notificationsPath}
          className="relative p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          title="Notifications Center"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-xs">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Link>

        {/* Avatar Người dùng & Dropdown Menu */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setUserDropdownOpen(!userDropdownOpen)}
            className="flex items-center gap-2 p-0.5 rounded-full hover:ring-2 hover:ring-blue-500/20 transition-all focus:outline-none cursor-pointer"
          >
            <UserAvatar user={avatarUser} size="sm" />
          </button>

          {/* Menu Dropdown Tài khoản */}
          {userDropdownOpen && (
            <div className="absolute right-0 mt-2 w-60 bg-white rounded-xl shadow-lg border border-slate-200 p-2 z-50 animate-slide-in-top">
              <div className="px-3 py-2.5 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-900 truncate">
                    {displayUser.full_name || 'Manager Account'}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-semibold text-[10px]">
                    {displayUser.role || 'MANAGER'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 truncate mt-0.5">{displayUser.email}</p>
              </div>

              <div className="py-1">
                <Link
                  to={roleLinks.profile}
                  onClick={() => setUserDropdownOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
                >
                  <User className="w-4 h-4 text-slate-400" />
                  <span>My Profile</span>
                </Link>

                <Link
                  to={roleLinks.settings}
                  onClick={() => setUserDropdownOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
                >
                  <Settings className="w-4 h-4 text-slate-400" />
                  <span>System Settings</span>
                </Link>
              </div>

              <div className="pt-1 border-t border-slate-100">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Log Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}