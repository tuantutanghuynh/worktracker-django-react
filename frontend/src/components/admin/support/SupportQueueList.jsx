import React from 'react';
import { Search, X, RefreshCw, CheckCircle2 } from 'lucide-react';
import { cn } from '../../../utils/cn';

export default function SupportQueueList({
  rooms = [],
  loading = false,
  searchQuery = '',
  setSearchQuery,
  filterTab = 'PENDING',
  setFilterTab,
  tabCounts = { all: 0, pending: 0, manager: 0, employee: 0 },
  activeRoom = null,
  onSelectRoom,
}) {
  return (
    <div
      className={cn(
        'w-full md:w-80 lg:w-96 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col overflow-hidden shrink-0 transition-all',
        activeRoom ? 'hidden md:flex' : 'flex'
      )}
    >
      {/* Search & Tabs Header */}
      <div className="p-3.5 border-b border-slate-100 bg-slate-50/50 space-y-2.5">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search inquiries, staff, department..."
            className="w-full pl-9 pr-3 py-1.5 bg-white text-xs rounded-xl border border-slate-200 focus:border-purple-400 focus:outline-none transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1 p-0.5 bg-slate-200/70 rounded-lg text-[11px] font-semibold text-slate-600">
          <button
            onClick={() => setFilterTab('PENDING')}
            className={cn(
              'flex-1 py-1 rounded-md text-center transition flex items-center justify-center gap-1',
              filterTab === 'PENDING'
                ? 'bg-white text-purple-700 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            )}
          >
            <span>Pending</span>
            {tabCounts.pending > 0 && (
              <span className="px-1.5 py-0.2 bg-rose-500 text-white rounded-full text-[9px] font-bold">
                {tabCounts.pending}
              </span>
            )}
          </button>

          <button
            onClick={() => setFilterTab('MANAGER')}
            className={cn(
              'flex-1 py-1 rounded-md text-center transition',
              filterTab === 'MANAGER'
                ? 'bg-white text-purple-700 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            )}
          >
            Manager ({tabCounts.manager})
          </button>

          <button
            onClick={() => setFilterTab('EMPLOYEE')}
            className={cn(
              'flex-1 py-1 rounded-md text-center transition',
              filterTab === 'EMPLOYEE'
                ? 'bg-white text-purple-700 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            )}
          >
            Staff ({tabCounts.employee})
          </button>

          <button
            onClick={() => setFilterTab('ALL')}
            className={cn(
              'flex-1 py-1 rounded-md text-center transition',
              filterTab === 'ALL'
                ? 'bg-white text-purple-700 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            )}
          >
            All ({tabCounts.all})
          </button>
        </div>
      </div>

      {/* Queue List Scrollable */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
        {loading ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-purple-500" />
            <span>Loading support queue...</span>
          </div>
        ) : rooms.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs space-y-2">
            <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500/70" />
            <p className="font-semibold text-slate-600">No support requests in this tab</p>
            <p className="text-[11px] text-slate-400">All user messages are up to date!</p>
          </div>
        ) : (
          rooms.map((room) => {
            const isSelected = activeRoom?.id === room.id;
            const user = room.other_participant || {};
            const displayName = user.full_name || user.email || 'User';
            const isManager = user.role_code === 'MANAGER' || user.role === 'MANAGER' || user.role === 2;

            return (
              <button
                key={`room-${room.id}`}
                onClick={() => onSelectRoom(room)}
                className={cn(
                  'w-full text-left p-3 rounded-xl border transition-all cursor-pointer relative',
                  isSelected
                    ? 'border-purple-300 bg-purple-50/70 shadow-2xs'
                    : 'border-transparent hover:border-slate-200 hover:bg-slate-50'
                )}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={cn(
                        'w-8 h-8 rounded-full font-bold text-xs flex items-center justify-center text-white shrink-0 shadow-2xs',
                        isManager ? 'bg-blue-600' : 'bg-slate-700'
                      )}
                    >
                      {(displayName[0] || 'U').toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-900 truncate">{displayName}</span>
                        <span
                          className={cn(
                            'text-[9px] px-1.5 py-0.2 rounded font-extrabold border',
                            isManager
                              ? 'bg-blue-100 text-blue-800 border-blue-200'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          )}
                        >
                          {isManager ? 'MANAGER' : 'STAFF'}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 truncate">
                        {user.department_name || 'General Operations'}
                      </p>
                    </div>
                  </div>

                  {room.last_message?.created_at && (
                    <span className="text-[10px] font-mono text-slate-400 shrink-0">
                      {new Date(room.last_message.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between text-[11px] mt-1">
                  <p className="text-slate-600 truncate max-w-[220px]">
                    {room.last_message?.content || 'Started inquiry'}
                  </p>
                  {room.unread_count > 0 && (
                    <span className="px-1.5 py-0.5 bg-rose-500 text-white text-[9px] font-bold rounded-full shrink-0">
                      {room.unread_count}
                    </span>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
