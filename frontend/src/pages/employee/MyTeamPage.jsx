import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNowStrict, parseISO, format } from 'date-fns';
import {
  Users, Search, Mail, MessageSquare, Briefcase,
  FolderKanban, PlayCircle, CalendarClock, CheckCircle2, ChevronDown,
} from 'lucide-react';

import UserAvatar from '../../components/common/avatar/UserAvatar';
import StatusBadge from '../../components/common/badges/StatusBadge';
import PriorityBadge from '../../components/common/badges/PriorityBadge';
import SelectDropdown from '../../components/common/forms/SelectDropdown';
import { getErrorMessage } from '../../utils/errorMessages';
import { cn } from '../../utils/cn';

import { useMyTeam } from '../../hooks/queries/employee/useMyTeam';

// Job.status / Job.priority choices, đúng thứ tự với backend (projects/models.py).
const STATUS_OPTIONS = [
  { value: 'PLANNING', label: 'Planning' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'ON_HOLD', label: 'On Hold' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const PRIORITY_OPTIONS = [
  { value: 'HIGH', label: 'High' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'LOW', label: 'Low' },
];

const PRIORITY_RANK = { HIGH: 3, MEDIUM: 2, LOW: 1 };

const SORT_OPTIONS = [
  { value: 'updated', label: 'Recently updated' },
  { value: 'priority', label: 'Priority' },
  { value: 'team_size', label: 'Team size' },
];

export default function MyTeamPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [managerFilter, setManagerFilter] = useState('');
  const [sortBy, setSortBy] = useState('updated');

  const { data: jobs = [], isLoading, error } = useMyTeam();

  // KPI nhanh: tổng dự án + theo từng status — tính từ dữ liệu đã tải,
  // không gọi thêm API nào.
  const stats = useMemo(() => {
    const byStatus = { ACTIVE: 0, PLANNING: 0, COMPLETED: 0 };
    for (const job of jobs) {
      if (job.status in byStatus) byStatus[job.status] += 1;
    }
    return { total: jobs.length, ...byStatus };
  }, [jobs]);

  // Danh sách Manager duy nhất xuất hiện trong các dự án — dùng cho dropdown lọc,
  // suy ra từ dữ liệu đã có, không cần gọi API riêng.
  const managerOptions = useMemo(() => {
    const seen = new Map();
    for (const job of jobs) {
      if (job.manager && !seen.has(job.manager.id)) {
        seen.set(job.manager.id, job.manager.full_name || job.manager.email);
      }
    }
    return Array.from(seen, ([value, label]) => ({ value: String(value), label }));
  }, [jobs]);

  const filteredJobs = useMemo(() => {
    let result = jobs;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (job) =>
          job.job_name?.toLowerCase().includes(q) ||
          job.job_code?.toLowerCase().includes(q)
      );
    }
    if (statusFilter) result = result.filter((job) => job.status === statusFilter);
    if (priorityFilter) result = result.filter((job) => job.priority === priorityFilter);
    if (managerFilter) result = result.filter((job) => String(job.manager?.id) === managerFilter);

    result = [...result].sort((a, b) => {
      if (sortBy === 'priority') return PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
      if (sortBy === 'team_size') return b.teammates.length - a.teammates.length;
      // 'updated' (mặc định): dự án cập nhật gần đây nhất lên trước
      return new Date(b.updated_at) - new Date(a.updated_at);
    });

    return result;
  }, [jobs, searchQuery, statusFilter, priorityFilter, managerFilter, sortBy]);

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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={FolderKanban} label="Projects" value={stats.total} accent="text-slate-700" />
        <StatCard icon={PlayCircle} label="Active" value={stats.ACTIVE} accent="text-emerald-600" />
        <StatCard icon={CalendarClock} label="Planning" value={stats.PLANNING} accent="text-amber-600" />
        <StatCard icon={CheckCircle2} label="Completed" value={stats.COMPLETED} accent="text-blue-600" />
      </div>

      <div className="flex flex-col md:flex-row gap-3 md:items-end">
        <div className="relative flex-1 md:max-w-xs">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 z-10" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search projects..."
            className="w-full pl-9 pr-3 py-2.5 bg-slate-100 hover:bg-slate-100/80 focus:bg-white text-xs rounded-xl border border-transparent focus:border-blue-400 focus:outline-none transition"
          />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 md:w-auto md:flex">
          <SelectDropdown
            theme="light"
            placeholder="Status"
            options={STATUS_OPTIONS}
            value={statusFilter}
            onChange={setStatusFilter}
            containerClassName="w-full md:w-36"
          />
          <SelectDropdown
            theme="light"
            placeholder="Priority"
            options={PRIORITY_OPTIONS}
            value={priorityFilter}
            onChange={setPriorityFilter}
            containerClassName="w-full md:w-36"
          />
          <SelectDropdown
            theme="light"
            placeholder="Manager"
            options={managerOptions}
            value={managerFilter}
            onChange={setManagerFilter}
            containerClassName="w-full md:w-40"
          />
          <SelectDropdown
            theme="light"
            options={SORT_OPTIONS}
            value={sortBy}
            onChange={setSortBy}
            containerClassName="w-full md:w-44"
          />
        </div>
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
            {jobs.length === 0 ? "You're not part of any project yet." : 'No projects match these filters.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredJobs.map((job) => (
            <JobCard key={job.id} job={job} onMessage={openDirectChat} />
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent }) {
  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
        <Icon className={cn('w-4 h-4', accent)} />
      </div>
      <span className="text-2xl font-extrabold text-slate-900">{value}</span>
    </div>
  );
}

function JobCard({ job, onMessage }) {
  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs hover:shadow-md hover:border-blue-200 transition-all space-y-4">
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

      <ProgressSection progress={job.task_progress} />

      <div className="pt-3 border-t border-slate-100 space-y-2">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          Managed by
        </p>
        <PersonRow person={job.manager} onMessage={onMessage} showActions compact />
      </div>

      <TeamSection teammates={job.teammates} onMessage={onMessage} />

      <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-medium">
        <span>Updated {formatUpdatedAt(job.updated_at)}</span>
        {job.deadline && <span>Due {formatDeadline(job.deadline)}</span>}
      </div>
    </div>
  );
}

// Tiến độ toàn bộ dự án (mọi task của cả team, không chỉ của riêng
// Employee đang xem) — bấm "View breakdown" để giãn thẻ ra xem chi
// tiết theo từng trạng thái, không điều hướng sang trang khác.
function ProgressSection({ progress }) {
  const [showBreakdown, setShowBreakdown] = useState(false);
  if (!progress || progress.total === 0) return null;

  const barColor =
    progress.pct >= 80 ? 'bg-emerald-500' : progress.pct >= 40 ? 'bg-blue-500' : 'bg-amber-500';

  return (
    <div className="pt-3 border-t border-slate-100 space-y-1.5">
      <div className="flex items-center justify-between text-xs font-bold">
        <span className="text-slate-500">Progress</span>
        <span className="text-slate-900">{progress.pct}%</span>
      </div>
      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', barColor)}
          style={{ width: `${progress.pct}%` }}
        />
      </div>
      <button
        type="button"
        onClick={() => setShowBreakdown((v) => !v)}
        className="text-[11px] text-slate-400 hover:text-blue-600 flex items-center gap-1 cursor-pointer"
      >
        {progress.completed} / {progress.total} tasks completed
        <ChevronDown className={cn('w-3 h-3 transition-transform', showBreakdown && 'rotate-180')} />
      </button>

      {showBreakdown && (
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 pt-1 text-[11px] text-slate-500">
          <BreakdownRow label="To Do" value={progress.todo} />
          <BreakdownRow label="In Progress" value={progress.in_progress} />
          <BreakdownRow label="Reviewing" value={progress.reviewing} />
          <BreakdownRow label="Completed" value={progress.completed} />
          {progress.cancelled > 0 && <BreakdownRow label="Cancelled" value={progress.cancelled} />}
        </div>
      )}
    </div>
  );
}

function BreakdownRow({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span>{label}</span>
      <span className="font-mono font-bold text-slate-700">{value}</span>
    </div>
  );
}

// Team đông (>4) mặc định chỉ hiện avatar chồng lên nhau + vài tên đầu, tránh
// card kéo dài quá mức — bấm "Show all" để xem đủ danh sách.
function TeamSection({ teammates, onMessage }) {
  const [expanded, setExpanded] = useState(false);
  const VISIBLE_STACK = 5;
  const VISIBLE_ROWS = 3;
  const overflowCount = Math.max(teammates.length - VISIBLE_STACK, 0);
  const rowsToShow = expanded ? teammates : teammates.slice(0, VISIBLE_ROWS);
  const hiddenRowsCount = teammates.length - rowsToShow.length;

  return (
    <div className="pt-3 border-t border-slate-100 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
          <Briefcase className="w-3 h-3" />
          Team &middot; {teammates.length}
        </p>
        <div className="flex -space-x-2">
          {teammates.slice(0, VISIBLE_STACK).map((person) => (
            <div key={person.id} className="ring-2 ring-white rounded-full">
              <UserAvatar user={person} size="xs" />
            </div>
          ))}
          {overflowCount > 0 && (
            <div className="w-5 h-5 rounded-full bg-slate-100 ring-2 ring-white flex items-center justify-center text-[9px] font-bold text-slate-500">
              +{overflowCount}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {rowsToShow.map((person) => (
          <PersonRow
            key={person.id}
            person={person}
            onMessage={onMessage}
            showActions={!person.is_me && person.is_active}
          />
        ))}
      </div>

      {hiddenRowsCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="text-[11px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-0.5 cursor-pointer"
        >
          +{hiddenRowsCount} other member{hiddenRowsCount !== 1 ? 's' : ''}
          <ChevronDown className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

function PersonRow({ person, onMessage, showActions, compact = false }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <UserAvatar user={person} size={compact ? 'sm' : 'sm'} />
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

function formatUpdatedAt(value) {
  if (!value) return 'recently';
  return formatDistanceToNowStrict(parseISO(value), { addSuffix: true });
}

function formatDeadline(value) {
  return format(parseISO(value), 'MMM d, yyyy');
}
