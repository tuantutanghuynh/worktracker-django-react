import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import {
  Bell,
  User,
  Settings,
  LogOut,
  ChevronRight,
  Menu,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useUIStore } from '../../../stores/useUIStore';
import { useAuth } from '../../../hooks/useAuth';
import { useNotificationStore } from '../../../stores/useNotificationStore';

// Bản ánh xạ Nhãn đường dẫn Breadcrumbs sang Tiếng Anh
// Manager portal tạm bỏ khỏi file này — sẽ lấy nguyên bản từ nhánh Long
// lúc merge thật, tránh 2 bản Manager khác nhau đá nhau.
const ROUTE_LABELS = {
  admin: 'Admin',
  dashboard: 'Dashboard',
  jobs: 'Jobs',
  clients: 'Clients',
  departments: 'Departments',
  users: 'Users',
  create: 'Create',
  search: 'Search',
  'audit-logs': 'Audit Logs',
  notifications: 'Notification Center',
  profile: 'My Profile',
  settings: 'System Settings',
};

// Mỗi role có Home/Notifications/Profile/Settings khác nhau — Header dùng
// chung cho cả 3 role nên không được hardcode 1 path cố định, phải tra
// theo role hiện tại.
const ROLE_LINKS = {
  ADMIN: { home: '/admin', notifications: '/admin/notifications', profile: '/admin', settings: '/admin' },
  EMPLOYEE: { home: '/employee/dashboard', notifications: '/employee/notifications', profile: '/employee/profile', settings: '/employee/profile' },
};

export default function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const { toggleSidebar } = useUIStore();
  const { notifications, unreadCount, markAsRead } = useNotificationStore();

  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const notifDropdownRef = useRef(null);

  // Lấy thông tin user đăng nhập từ useAuth (Zustand Store)
  const { user, logout } = useAuth();
  const displayUser = user || { email: 'user@worktracker.vn', role: 'EMPLOYEE' };
  const roleLinks = ROLE_LINKS[displayUser.role] || ROLE_LINKS.EMPLOYEE;

  // Đóng Dropdown khi click ra ngoài vùng menu
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setUserDropdownOpen(false);
      }
      if (notifDropdownRef.current && !notifDropdownRef.current.contains(event.target)) {
        setNotifDropdownOpen(false);
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
          <Link to={roleLinks.home} className="hover:text-blue-600 transition-colors shrink-0">
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

      {/* Bên Phải: Chuông thông báo & Avatar User */}
      <div className="flex items-center gap-2 sm:gap-4">
        {/* Biểu tượng Chuông Thông báo + Dropdown xem nhanh */}
        <div className="relative" ref={notifDropdownRef}>
          <button
            onClick={() => setNotifDropdownOpen(!notifDropdownOpen)}
            className="relative p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            title="Notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-xs">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {notifDropdownOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-slate-200 z-50 animate-slide-in-top overflow-hidden">
              <div className="px-3.5 py-2.5 border-b border-slate-100">
                <span className="text-sm font-bold text-slate-900">Notifications</span>
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-slate-50">
                {notifications.length === 0 && (
                  <p className="px-3.5 py-6 text-center text-xs text-slate-400">No notifications yet.</p>
                )}
                {notifications.slice(0, 8).map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => !n.is_read && markAsRead(n.id)}
                    className={`w-full text-left px-3.5 py-2.5 hover:bg-slate-50 transition-colors ${n.is_read ? '' : 'bg-blue-50/60'}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-800 truncate">{n.title}</span>
                      {!n.is_read && <span className="mt-1 h-1.5 w-1.5 rounded-full bg-blue-600 shrink-0" />}
                    </div>
                    {n.content && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.content}</p>}
                    <p className="text-[10px] text-slate-400 mt-1">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                    </p>
                  </button>
                ))}
              </div>

              <Link
                to={roleLinks.notifications}
                onClick={() => setNotifDropdownOpen(false)}
                className="block px-3.5 py-2.5 text-center text-xs font-semibold text-blue-600 hover:bg-slate-50 border-t border-slate-100"
              >
                View all notifications
              </Link>
            </div>
          )}
        </div>

        {/* Avatar Người dùng & Dropdown Menu */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setUserDropdownOpen(!userDropdownOpen)}
            className="flex items-center gap-2 p-1 rounded-full hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-xs shadow-xs border border-white">
              {displayUser.email ? displayUser.email.substring(0, 2).toUpperCase() : 'MP'}
            </div>
          </button>

          {/* Menu Dropdown Tài khoản */}
          {userDropdownOpen && (
            <div className="absolute right-0 mt-2 w-60 bg-white rounded-xl shadow-lg border border-slate-200 p-2 z-50 animate-slide-in-top">
              <div className="px-3 py-2.5 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-900 truncate">
                    {displayUser.full_name || 'My Account'}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-semibold text-[10px]">
                    {displayUser.role || 'EMPLOYEE'}
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