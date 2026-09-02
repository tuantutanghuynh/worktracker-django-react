import React from 'react';
import { UserCheck, UserMinus } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { cn } from '../../../utils/cn';

function formatDateSafe(dateStr) {
  if (!dateStr) return 'No date';
  try {
    return format(parseISO(dateStr), 'dd/MM/yyyy');
  } catch {
    return dateStr;
  }
}

export default function TaskFollowersTab({
  followers = [],
  isFollowing = false,
  onFollowToggle,
  isPending = false,
}) {
  return (
    <div className="space-y-4 text-xs">
      <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
        <div>
          <h4 className="font-bold text-slate-900 text-xs">Task Subscriptions</h4>
          <p className="text-[10px] text-slate-500">Receive notifications on updates and comments</p>
        </div>

        <button
          onClick={onFollowToggle}
          disabled={isPending}
          className={cn(
            'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs shadow-2xs transition cursor-pointer',
            isFollowing
              ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          )}
        >
          {isFollowing ? (
            <>
              <UserMinus className="w-3.5 h-3.5" />
              <span>Unfollow</span>
            </>
          ) : (
            <>
              <UserCheck className="w-3.5 h-3.5" />
              <span>Follow Updates</span>
            </>
          )}
        </button>
      </div>

      <div className="space-y-2">
        {followers.map((f) => (
          <div
            key={f.id}
            className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center">
                {(f.full_name || f.email || 'U')[0].toUpperCase()}
              </div>
              <div>
                <p className="font-bold text-xs text-slate-900">{f.full_name}</p>
                <p className="text-[10px] text-slate-400">{f.email}</p>
              </div>
            </div>
            <span className="text-[10px] text-slate-400">
              Joined {formatDateSafe(f.joined_at)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
