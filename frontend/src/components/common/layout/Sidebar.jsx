import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  Briefcase,
  UserPlus,
  Search,
  ScrollText,
  Users,
  Clock,
  FileBarChart,
  ChevronsLeft,
  LogOut,
} from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../../../hooks/useAuth';
import RoleBadge from '../badges/RoleBadge';

const MENU_BY_ROLE = {
  ADMIN: [
    { label: 'Dashboard', to: '/admin', icon: LayoutDashboard },
    { label: 'Clients', to: '/admin/clients', icon: Building2 },
    { label: 'Jobs', to: '/admin/jobs', icon: Briefcase },
    { label: 'Create User', to: '/admin/users/create', icon: UserPlus },
    { label: 'Search Users', to: '/admin/users/search', icon: Search },
    { label: 'Departments', to: '/admin/departments', icon: Users },
    { label: 'Audit Logs', to: '/admin/audit-logs', icon: ScrollText },
  ],
  MANAGER: [
    { label: 'Dashboard', to: '/', icon: LayoutDashboard },
    { label: 'My Jobs', to: '/manager/jobs', icon: Briefcase },
    { label: 'Team Members', to: '/manager/team', icon: Users },
    { label: 'Timesheets', to: '/manager/timesheets', icon: Clock },
    { label: 'Reports', to: '/manager/reports', icon: FileBarChart },
  ],
  EMPLOYEE: [
    { label: 'Dashboard', to: '/', icon: LayoutDashboard },
    { label: 'My Tasks', to: '/emp/tasks', icon: Briefcase },
    { label: 'Timesheet', to: '/emp/timesheet', icon: Clock },
  ],
};

export default function Sidebar({ open, onToggle }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const menuItems = MENU_BY_ROLE[user?.role] ?? [];

  return (
    <aside
      className={clsx(
        'flex h-screen shrink-0 flex-col justify-between border-r border-slate-800 bg-[#0A1128] p-4 text-slate-100 transition-all duration-200',
        open ? 'w-64' : 'w-16'
      )}
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2 px-1">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">
            W
          </div>
          {open && (
            <span className="truncate text-sm font-bold text-white">
              WorkTracker <span className="text-blue-400">Pro</span>
            </span>
          )}
        </div>

        <nav className="space-y-1">
          {menuItems.map(({ label, to, icon: Icon }) => {
            const active = location.pathname === to;
            return (
              <Link
                key={to}
                to={to}
                title={open ? undefined : label}
                className={clsx(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
                  active
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {open && <span className="truncate">{label}</span>}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="space-y-2 border-t border-slate-800/80 pt-3">
        {open && user && (
          <div className="space-y-1.5 px-1 pb-1">
            <p className="truncate text-xs font-semibold text-white">{user.email}</p>
            <RoleBadge role={user.role} />
          </div>
        )}

        <button
          type="button"
          onClick={logout}
          title={open ? undefined : 'Logout'}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-400 transition hover:bg-slate-800/60 hover:text-white"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {open && <span>Logout</span>}
        </button>

        <button
          type="button"
          onClick={onToggle}
          title={open ? 'Collapse sidebar' : 'Expand sidebar'}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-400 transition hover:bg-slate-800/60 hover:text-white"
        >
          <ChevronsLeft
            className={clsx('h-4 w-4 shrink-0 transition-transform', !open && 'rotate-180')}
          />
          {open && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
