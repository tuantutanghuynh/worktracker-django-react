import React from 'react';
import { Edit3, Trash2, Save } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import InputField from '../../common/forms/InputField';
import SelectDropdown from '../../common/forms/SelectDropdown';

function formatDateSafe(dateStr, formatPattern = 'dd/MM/yyyy') {
  if (!dateStr) return 'No date';
  try {
    return format(parseISO(dateStr), formatPattern);
  } catch {
    return dateStr;
  }
}

export default function TaskOverviewTab({
  task,
  isEditing,
  setIsEditing,
  editFormData,
  setEditFormData,
  employeeOptions = [],
  totalLoggedHours = 0,
  onUpdateTask,
  isUpdating = false,
  onOpenDeleteModal,
  onOpenCancelModal,
}) {
  if (!task) return null;

  if (!isEditing) {
    return (
      <div className="space-y-4 text-xs">
        {/* Header Row: Title & Edit CTA */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Task Scope & Description
            </h4>
          </div>
          {task.status !== 'COMPLETED' && task.status !== 'CANCELLED' && (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5 text-blue-600" />
              <span>Edit Task</span>
            </button>
          )}
        </div>

        {/* Task Description Body */}
        <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 text-slate-800 leading-relaxed text-xs sm:text-sm min-h-[100px] font-normal">
          {task.description || (
            <span className="italic text-slate-400">No detailed description provided for this deliverable.</span>
          )}
        </div>

        {/* Audit & Effort Metadata Card */}
        <div className="p-4 bg-slate-50/60 border border-slate-200/80 rounded-2xl space-y-2.5 text-xs text-slate-600">
          <div className="flex items-center justify-between">
            <span className="font-medium text-slate-500">Total Logged Effort:</span>
            <span className="font-extrabold text-blue-700 text-xs bg-blue-50 px-2.5 py-0.5 rounded-md border border-blue-100">
              {totalLoggedHours.toFixed(1)} hrs
            </span>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
            <span className="font-medium text-slate-500">Created By:</span>
            <span className="font-bold text-slate-800">
              {task.creator?.full_name || task.creator?.email || 'Alexander Wright (Manager)'}
            </span>
          </div>

          {task.start_date && (
            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-500">Planned Start:</span>
              <span className="font-mono font-semibold text-blue-700">
                {formatDateSafe(task.start_date, 'dd/MM/yyyy')}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="font-medium text-slate-500">Deadline:</span>
            <span className="font-mono font-semibold text-rose-700">
              {formatDateSafe(task.deadline, 'dd/MM/yyyy')}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="font-medium text-slate-500">Created At:</span>
            <span className="font-mono font-semibold text-slate-700">
              {formatDateSafe(task.created_at, 'HH:mm - dd/MM/yyyy')}
            </span>
          </div>

          {task.completed_at && (
            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-500">Completed At:</span>
              <span className="font-mono font-bold text-emerald-700">
                {formatDateSafe(task.completed_at, 'HH:mm - dd/MM/yyyy')}
              </span>
            </div>
          )}
        </div>

        {/* Cancel or Delete Task Links */}
        {task.status !== 'COMPLETED' && (
          <div className="pt-2 flex items-center justify-end gap-3">
            {/* Nút Xóa vĩnh viễn (nếu task ở TODO hoặc chưa có logwork) */}
            {(task.status === 'TODO' || totalLoggedHours === 0) && (
              <button
                type="button"
                onClick={onOpenDeleteModal}
                className="inline-flex items-center gap-1 text-xs text-rose-500 hover:text-rose-700 font-bold transition hover:underline cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete task</span>
              </button>
            )}

            {/* Nút Cancel task */}
            {task.status !== 'CANCELLED' && (
              <button
                type="button"
                onClick={onOpenCancelModal}
                className="text-xs text-slate-400 hover:text-slate-600 font-bold transition hover:underline cursor-pointer"
              >
                Cancel task
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={onUpdateTask} className="space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
        <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
          <Edit3 className="w-3.5 h-3.5 text-blue-600" />
          <span>Editing Task Details</span>
        </span>
        <button
          type="button"
          onClick={() => setIsEditing(false)}
          className="text-xs text-slate-500 hover:text-slate-800 font-bold hover:underline cursor-pointer"
        >
          Cancel
        </button>
      </div>

      <InputField
        label="Task Title"
        value={editFormData.title}
        onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
        placeholder="Task title..."
        required
      />

      <div>
        <SelectDropdown
          label="Assign to Employee"
          value={editFormData.assignee_id}
          onChange={(val) => setEditFormData({ ...editFormData, assignee_id: val })}
          options={employeeOptions}
          placeholder="-- Search and select an employee * --"
          searchable={true}
          required={true}
          theme="light"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SelectDropdown
          label="Priority"
          value={editFormData.priority}
          onChange={(val) => setEditFormData({ ...editFormData, priority: val })}
          options={[
            { value: 'HIGH', label: 'High Priority' },
            { value: 'MEDIUM', label: 'Medium Priority' },
            { value: 'LOW', label: 'Low Priority' },
          ]}
        />

        <InputField
          label="Start Date"
          type="date"
          min={task?.job?.start_date || undefined}
          max={editFormData.deadline || task?.job?.deadline || undefined}
          value={editFormData.start_date || ''}
          onChange={(e) => setEditFormData({ ...editFormData, start_date: e.target.value })}
          disabled={task.status === 'IN_PROGRESS' || task.status === 'REVIEWING'}
          helperText={
            task.status === 'IN_PROGRESS' || task.status === 'REVIEWING'
              ? 'Locked once task is started.'
              : undefined
          }
        />

        <InputField
          label="Deadline"
          type="date"
          min={editFormData.start_date || task?.job?.start_date || undefined}
          max={task?.job?.deadline || undefined}
          value={editFormData.deadline || ''}
          onChange={(e) => setEditFormData({ ...editFormData, deadline: e.target.value })}
          required
        />
      </div>

      <div>
        <label className="block font-semibold text-slate-700 mb-1">Description & Acceptance Criteria</label>
        <textarea
          rows={5}
          value={editFormData.description}
          onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
          placeholder="Detailed task instructions..."
          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed"
        />
      </div>

      <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
        <button
          type="button"
          onClick={() => setIsEditing(false)}
          className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 cursor-pointer font-bold text-xs"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isUpdating}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs cursor-pointer disabled:opacity-50 transition text-xs"
        >
          <Save className="w-3.5 h-3.5" />
          <span>{isUpdating ? 'Saving...' : 'Save Changes'}</span>
        </button>
      </div>
    </form>
  );
}
