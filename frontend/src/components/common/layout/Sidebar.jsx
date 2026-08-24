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
  Search,
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
const MENU_CONFIG = {
  // Cấu hình Menu dành cho EMPLOYEE
  EMPLOYEE: {
    portalLabel: 'Employee Portal',
    navItems: [
      { path: '/employee/dashboard', label: 'Dashboard', icon: LayoutGrid },
      { path: '/employee/my-tasks', label: 'My Tasks', icon: ListChecks },
      { path: '/employee/timesheet', label: 'Timesheet', icon: Clock },
      { path: '/employee/my-performance', label: 'My Performance', icon: TrendingUp },
      { path: '/employee/notifications', label: 'Notifications', icon: Bell, hasBadge: true },
      { path: '/employee/profile', label: 'Profile', icon: User },
    ],
  },

  // Cấu hình Menu dành cho ADMIN
  ADMIN: {
    portalLabel: 'Admin Portal',
    navItems: [
      { path: '/admin', label: 'Dashboard', icon: LayoutGrid },
      { path: '/admin/clients', label: 'Clients', icon: Building2 },
      { path: '/admin/jobs', label: 'Jobs', icon: Briefcase },
      { path: '/admin/users/create', label: 'Create User', icon: UserPlus },
      { path: '/admin/users/search', label: 'Search Users', icon: Search },
      { path: '/admin/departments', label: 'Departments', icon: Users },
      { path: '/admin/timesheets', label: 'Timesheet Control', icon: Clock },
      { path: '/admin/audit-logs', label: 'Audit Logs', icon: ScrollText },
      { path: '/admin/notifications', label: 'Notification Center', icon: Bell, hasBadge: true },
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
        'bg-[#0A1128] border-r border-slate-800 flex flex-col justify-between p-4 h-screen shrink-0 transition-all duration-300 ease-in-out z-20 shadow-xl select-none',
        isSidebarCollapsed ? 'w-20' : 'w-64'
      )}
    >
      <div className="space-y-3.5 flex-1 overflow-y-auto custom-scrollbar pr-1">

        {/* LOGO */}
        <div className={cn('flex items-center space-x-3 px-2 py-0.5', isSidebarCollapsed && 'justify-center space-x-0')}>
          <svg className="w-10 h-10 drop-shadow-md shrink-0" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
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
            <span className="text-xl font-bold tracking-tight text-white leading-none">
              WorkTracker <span className="text-xs font-semibold text-blue-400">Pro</span>
            </span>
          )}
        </div>

        {/* MENU NHÓM THEO ROLE */}
        <div className="space-y-1">
          {!isSidebarCollapsed && (
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-3 mb-1">
              {currentConfig.portalLabel}
            </p>
          )}

          {currentConfig.navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              location.pathname === item.path ||
              (item.altPath && location.pathname.startsWith(item.altPath));

            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={cn(
                  'flex items-center space-x-3 px-3 py-2 rounded-lg text-sm transition font-medium',
                  isActive
                    ? 'font-semibold text-white bg-blue-600 shadow-md shadow-blue-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60',
                  isSidebarCollapsed && 'justify-center space-x-0'
                )}
                title={isSidebarCollapsed ? item.label : undefined}
              >
                <Icon className="w-5 h-5 text-center shrink-0" />
                {!isSidebarCollapsed && <span className="flex-1">{item.label}</span>}

                {item.hasBadge && notificationBadgeCount > 0 && (
                  <span className="bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0">
                    {notificationBadgeCount > 99 ? '99+' : notificationBadgeCount}
                  </span>
                )}
              </NavLink>
            );
          })}
        </div>
      </div>

      {/* USER PROFILE FOOTER */}
      <div className="pt-2.5 border-t border-slate-800/80 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-3 min-w-0">
          <div className="relative shrink-0">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-xs shadow-xs border border-slate-700">
              {displayUser.full_name ? displayUser.full_name.substring(0, 2).toUpperCase() : (displayUser.email ? displayUser.email.substring(0, 2).toUpperCase() : 'US')}
            </div>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[#0A1128] absolute bottom-0 right-0"></span>
          </div>

          {!isSidebarCollapsed && (
            <div className="truncate">
              <p className="text-xs font-bold text-white leading-tight truncate">
                {displayUser.full_name || displayUser.email || 'User'}
              </p>
              <p className="text-[10px] text-slate-400 truncate">
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
