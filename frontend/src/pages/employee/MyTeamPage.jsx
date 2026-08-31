import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Search, Mail, MessageSquare, Briefcase } from 'lucide-react';

import UserAvatar from '../../components/common/avatar/UserAvatar';
import StatusBadge from '../../components/common/badges/StatusBadge';
import PriorityBadge from '../../components/common/badges/PriorityBadge';
import { getErrorMessage } from '../../utils/errorMessages';

import { useMyTeam } from '../../hooks/queries/employee/useMyTeam';

export default function MyTeamPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const { data: jobs = [], isLoading, error } = useMyTeam();

  const filteredJobs = useMemo(() => {
    if (!searchQuery.trim()) return jobs;
    const q = searchQuery.toLowerCase();
    return jobs.filter(
      (job) =>
        job.job_name?.toLowerCase().includes(q) ||
        job.job_code?.toLowerCase().includes(q)
    );
  }, [jobs, searchQuery]);

  const openDirectChat = (userId) => navigate(`/employee/chat?userId=${userId}`);

  return (
    <div className="space-y-6 antialiased">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
          My Team
        </h1>
        <p className="text-slate-500 text-xs mt-0.5">
          Projects you're part of, and who else is working on them.
        </p>
      </div>

      <div className="relative w-full md:w-72">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search projects..."
          className="w-full pl-9 pr-3 py-2 bg-slate-100 hover:bg-slate-100/80 focus:bg-white text-xs rounded-xl border border-transparent focus:border-blue-400 focus:outline-none transition"
        />
      </div>

      {isLoading ? (
        <div className="py-12 flex justify-center">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <p className="text-xs text-rose-500">{getErrorMessage(error, "Failed to load your team")}</p>
      ) : filteredJobs.length === 0 ? (
        <div className="p-8 rounded-2xl bg-slate-50 border border-slate-200/80 text-center space-y-1">
          <Users className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-xs font-bold text-slate-700">
            {jobs.length === 0 ? "You're not part of any project yet." : 'No projects match your search.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredJobs.map((job) => (
            <div
              key={job.id}
              className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-4"
            >
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-bold text-blue-700 truncate">
                    {job.job_code}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <StatusBadge status={job.status} />
                    <PriorityBadge priority={job.priority} />
                  </div>
                </div>
                <h3 className="font-bold text-sm text-slate-900 truncate">{job.job_name}</h3>
                {job.client_name && (
                  <p className="text-xs text-slate-400 truncate">Client: {job.client_name}</p>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 space-y-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Manager
                </p>
                <PersonRow person={job.manager} onMessage={openDirectChat} showActions />
              </div>

              <div className="pt-3 border-t border-slate-100 space-y-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Briefcase className="w-3 h-3" />
                  Team ({job.teammates.length})
                </p>
                <div className="space-y-2">
                  {job.teammates.map((person) => (
                    <PersonRow
                      key={person.id}
                      person={person}
                      onMessage={openDirectChat}
                      showActions={!person.is_me && person.is_active}
                    />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PersonRow({ person, onMessage, showActions }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <UserAvatar user={person} size="sm" />
        <div className="min-w-0">
          <p className="text-xs font-bold text-slate-800 truncate">
            {person.full_name || person.email}
            {person.is_me && <span className="text-slate-400 font-normal"> (You)</span>}
            {person.is_active === false && (
              <span className="text-slate-400 font-normal"> (inactive)</span>
            )}
          </p>
          <p className="text-[10px] text-slate-400 truncate">{person.email}</p>
        </div>
      </div>
      {showActions && (
        <div className="flex items-center gap-1 shrink-0">
          <a
            href={`mailto:${person.email}`}
            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
            title="Email"
          >
            <Mail className="w-3.5 h-3.5" />
          </a>
          <button
            type="button"
            onClick={() => onMessage(person.id)}
            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
            title="Message"
          >
            <MessageSquare className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
