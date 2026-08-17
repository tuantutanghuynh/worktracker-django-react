import { Bell, Search } from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import RoleBadge from '../badges/RoleBadge';

export default function Header() {
  const { user } = useAuth();

  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
      <div className="relative w-72">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search... (Ctrl + K)"
          className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          className="relative text-slate-500 transition hover:text-slate-700"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
        </button>

        {user && (
          <div className="flex items-center gap-2.5 border-l border-slate-200 pl-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
              {user.email.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-xs font-semibold leading-tight text-slate-900">{user.email}</p>
              <RoleBadge role={user.role} />
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
