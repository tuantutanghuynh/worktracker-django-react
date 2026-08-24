import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutGrid,
  Briefcase,
  Users,
  Clock,
  TrendingUp,
  Bell,
  User,
  ListChecks,
  Building2,
  UserPlus,
  Network,
  ScrollText,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useUIStore } from '../../../stores/useUIStore';
import { useAuth } from '../../../hooks/useAuth';
import { useNotificationStore } from '../../../stores/useNotificationStore';
import { useAdminDataQualityAlerts } from '../../../hooks/queries/admin/useAdminNotifications';
import { cn } from '../../../utils/cn';

// BẢNG CẤU HÌNH MENU DÙNG CHUNG CHO TẤT CẢ CÁC VAI TRÒ (ROLE)
// Manager portal tạm bỏ khỏi file này — sẽ lấy nguyên bản từ nhánh Long
// lúc merge thật, tránh 2 bản Manager khác nhau đá nhau.
//
// Menu gom theo nhóm (sections): mỗi nhóm có `label` làm tiêu đề và
// `items` là các mục bên trong. Nhóm không có label thì render liền,
// không kèm tiêu đề.
const MENU_CONFIG = {
  // Cấu hình Menu dành cho EMPLOYEE
  EMPLOYEE: {
    portalLabel: 'Employee Portal',
    sections: [
      {
        label: 'Overview',
        items: [{ path: '/employee/dashboard', label: 'Dashboard', icon: LayoutGrid }],
      },
      {
        label: 'My Work',
        items: [
          { path: '/employee/my-tasks', label: 'My Tasks', icon: ListChecks },
          { path: '/employee/timesheet', label: 'Timesheet', icon: Clock },
          { path: '/employee/my-performance', label: 'My Performance', icon: TrendingUp },
        ],
      },
      {
        label: 'Account',
        items: [
          { path: '/employee/notifications', label: 'Notifications', icon: Bell, hasBadge: true },
          { path: '/employee/profile', label: 'Profile', icon: User },
        ],
      },
    ],
  },

  // Cấu hình Menu dành cho ADMIN
  ADMIN: {
    portalLabel: 'Admin Portal',
    sections: [
      {
        label: 'Overview',
        items: [{ path: '/admin', label: 'Dashboard', icon: LayoutGrid }],
      },
      {
        label: 'Business',
        items: [
          { path: '/admin/clients', label: 'Clients', icon: Building2 },
          { path: '/admin/jobs', label: 'Jobs', icon: Briefcase },
        ],
      },
      {
        label: 'People',
        items: [
          { path: '/admin/users/search', label: 'User List', icon: Users },
          { path: '/admin/users/create', label: 'Create User', icon: UserPlus },
          { path: '/admin/departments', label: 'Departments', icon: Network },
        ],
      },
      {
        label: 'Operations',
        items: [{ path: '/admin/timesheets', label: 'Timesheet Control', icon: Clock }],
      },
      {
        label: 'System',
        items: [
          { path: '/admin/audit-logs', label: 'Audit Logs', icon: ScrollText },
          { path: '/admin/notifications', label: 'Notification Center', icon: Bell, hasBadge: true },
          { path: '/admin/profile', label: 'Profile', icon: User },
        ],
      },
    ],
  },
};

export default function Sidebar() {
  const location = useLocation();
  const { isSidebarCollapsed, toggleSidebar } = useUIStore();
  const { unreadCount, seenAlertIds } = useNotificationStore();

  const { user } = useAuth();
  const displayUser = user || { full_name: 'User', role: 'EMPLOYEE' };

  const userRole = (displayUser.role || 'EMPLOYEE').toUpperCase();
  const currentConfig = MENU_CONFIG[userRole] || MENU_CONFIG.EMPLOYEE;

  // Same badge total as the Header bell — real unread notifications plus
  // not-yet-seen data-quality alerts (Department without manager, etc.).
  const { data: dataQualityAlerts = [] } = useAdminDataQualityAlerts({ enabled: userRole === 'ADMIN' });
  const unseenDataQualityCount = dataQualityAlerts.filter((a) => !seenAlertIds.includes(a.id)).length;
  const notificationBadgeCount = unreadCount + unseenDataQualityCount;

  return (
    <aside
      className={cn(
        'bg-[#0A1128] border-r border-slate-800 flex flex-col justify-between p-3 h-screen shrink-0 transition-all duration-300 ease-in-out z-20 shadow-xl select-none',
        isSidebarCollapsed ? 'w-20' : 'w-60'
      )}
    >
      <div className="space-y-1.5 flex-1 overflow-y-auto custom-scrollbar pr-1">

        {/* LOGO */}
        <div className={cn('flex items-center space-x-2.5 px-2', isSidebarCollapsed && 'justify-center space-x-0')}>
          <svg className="w-8 h-8 drop-shadow-md shrink-0" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="wBlueGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#60A5FA" />
                <stop offset="40%" stopColor="#3B82F6" />
                <stop offset="80%" stopColor="#2563EB" />
                <stop offset="100%" stopColor="#1D4ED8" />
              </linearGradient>
            </defs>
            <path
              d="M 22 55 Q 32 88 46 88 Q 58 88 66 50 Q 76 88 88 88 Q 98 88 108 26"
              stroke="url(#wBlueGradient)"
              strokeWidth="13"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>

          {!isSidebarCollapsed && (
            <span className="text-base font-bold tracking-tight text-white leading-none">
              WorkTracker <span className="text-[10px] font-semibold text-blue-400">Pro</span>
            </span>
          )}
        </div>

        {/* MENU NHÓM THEO ROLE — chia thành các section có tiêu đề.
            Cỡ chữ/padding để nhỏ vừa đủ cho toàn bộ 10 mục + 5 tiêu đề nhóm
            lọt 1 màn hình 768px, không phải cuộn. */}
        <div className="space-y-0.5">
          {!isSidebarCollapsed && (
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider px-2.5">
              {currentConfig.portalLabel}
            </p>
          )}

          {currentConfig.sections.map((section, sectionIdx) => (
            <div key={section.label || sectionIdx}>
              {/* Lúc thu gọn sidebar thì thay tiêu đề bằng đường kẻ phân cách,
                  vì chữ tiêu đề không còn chỗ hiển thị. */}
              {section.label &&
                (isSidebarCollapsed ? (
                  sectionIdx > 0 && <div className="mx-2 my-1 border-t border-slate-800/80" />
                ) : (
                  <p className="px-2.5 pt-1.5 pb-0.5 text-[9px] font-semibold uppercase tracking-wider text-slate-600">
                    {section.label}
                  </p>
                ))}

              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive =
                  location.pathname === item.path ||
                  (item.altPath && location.pathname.startsWith(item.altPath));

                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={cn(
                      'flex items-center space-x-2.5 px-2.5 py-1 rounded-lg text-[13px] transition font-medium',
                      isActive
                        ? 'font-semibold text-white bg-blue-600 shadow-md shadow-blue-600/30'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/60',
                      isSidebarCollapsed && 'justify-center space-x-0'
                    )}
                    title={isSidebarCollapsed ? item.label : undefined}
                  >
                    <Icon className="w-4 h-4 text-center shrink-0" />
                    {!isSidebarCollapsed && <span className="flex-1 truncate">{item.label}</span>}

                    {item.hasBadge && notificationBadgeCount > 0 && (
                      <span className="bg-rose-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0">
                        {notificationBadgeCount > 99 ? '99+' : notificationBadgeCount}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* USER PROFILE FOOTER */}
      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-2.5 min-w-0">
          <div className="relative shrink-0">
            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-[10px] shadow-xs border border-slate-700">
              {displayUser.full_name ? displayUser.full_name.substring(0, 2).toUpperCase() : (displayUser.email ? displayUser.email.substring(0, 2).toUpperCase() : 'US')}
            </div>
            <span className="w-2 h-2 rounded-full bg-emerald-500 border-2 border-[#0A1128] absolute bottom-0 right-0"></span>
          </div>

          {!isSidebarCollapsed && (
            <div className="truncate">
              <p className="text-[11px] font-bold text-white leading-tight truncate">
                {displayUser.full_name || displayUser.email || 'User'}
              </p>
              <p className="text-[9px] text-slate-400 truncate">
                {displayUser.role || 'EMPLOYEE'}
              </p>
            </div>
          )}
        </div>

        <button
          onClick={toggleSidebar}
          className="p-1 rounded text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
        >
          {isSidebarCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>
    </aside>
  );
}
