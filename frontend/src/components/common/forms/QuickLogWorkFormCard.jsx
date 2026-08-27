import { useState } from 'react';
import {
  Clock,
  Send,
  AlertTriangle,
  Calendar as CalendarIcon,
  Briefcase
} from 'lucide-react';
import InputField from './InputField';
import SelectDropdown from './SelectDropdown';
import { cn } from '../../../utils/cn';

/**
 * QuickLogWorkFormCard - Quick Worklog Entry Form Component
 * 
 * Props:
 * - tasks (Array): [{ id, title, job_name, priority }]
 * - defaultTaskId (string | number): Pre-selected task ID
 * - dailyHoursLogged (number): Hours logged today so far (e.g., 6.5)
 * - onSubmit (function): async (data) => Promise<void>
 * - isLoading (boolean): Form submission spinner state
 */
export default function QuickLogWorkFormCard({
  tasks = [],
  defaultTaskId = '',
  dailyHoursLogged = 0,
  onSubmit,
  isLoading = false,
  className
}) {
  const [taskId, setTaskId] = useState(defaultTaskId);
  const [workDate, setWorkDate] = useState(new Date().toISOString().split('T')[0]);
  const [hoursSpent, setHoursSpent] = useState('2.00');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState({});

  const MAX_DAILY_LIMIT = 8.0;
  const currentTotal = Number(dailyHoursLogged) + (Number(hoursSpent) || 0);
  const isOverLimit = currentTotal > MAX_DAILY_LIMIT;

  const taskOptions = tasks.map(t => ({
    value: String(t.id),
    label: t.title,
    badge: t.job_name || 'Project',
    description: `Deadline: ${t.deadline || 'None'}`
  }));

  const handleQuickAddHours = (addedHours) => {
    const val = (Number(hoursSpent) || 0) + addedHours;
    setHoursSpent(val.toFixed(2));
  };

  const validate = () => {
    const newErrors = {};
    if (!taskId) newErrors.taskId = 'Please select a task';
    if (!workDate) newErrors.workDate = 'Please select a work date';
    
    const h = Number(hoursSpent);
    if (isNaN(h) || h <= 0) {
      newErrors.hoursSpent = 'Hours spent must be greater than 0';
    } else if (h > 8.0) {
      newErrors.hoursSpent = 'Single log entry cannot exceed standard 8.0 hours';
    } else if (isOverLimit) {
      newErrors.hoursSpent = `Total daily hours cannot exceed standard 8.0h limit (Current: ${currentTotal.toFixed(2)}h / 8.0h)`;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    if (onSubmit) {
      await onSubmit({
        task_id: taskId,
        work_date: workDate,
        hours_spent: parseFloat(hoursSpent),
        description: description.trim(),
      });
      // Reset description on success
      setDescription('');
    }
  };

  return (
    <div className={cn("bg-white border border-slate-200/80 rounded-xl p-5 shadow-sm space-y-5 text-slate-800", className)}>
      {/* Form Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-blue-50 border border-blue-100 rounded-lg text-blue-600">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Quick Log Work Entry</h3>
            <p className="text-xs text-slate-500">Record daily work log entries</p>
          </div>
        </div>

        {/* Daily Total Progress Pill */}
        <div className={cn(
          "px-3 py-1 rounded-full text-xs font-semibold border flex items-center gap-1.5",
          isOverLimit
            ? "bg-rose-50 text-rose-600 border-rose-200"
            : "bg-slate-50 text-slate-600 border-slate-200"
        )}>
          <span>Logged Today:</span>
          <strong className={isOverLimit ? "text-rose-600" : "text-emerald-600"}>
            {dailyHoursLogged}h / 8.0h
          </strong>
        </div>
      </div>

      {/* Form Body */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Task Selection Dropdown */}
        <SelectDropdown
          label="Select Task"
          options={taskOptions}
          value={taskId}
          onChange={(val) => {
            setTaskId(val);
            setErrors(prev => ({ ...prev, taskId: null }));
          }}
          placeholder="-- Select task to report --"
          error={errors.taskId}
          leftIcon={Briefcase}
          required
          searchable
          theme="light"
        />

        {/* Date and Hours Input Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InputField
            label="Work Date"
            type="date"
            value={workDate}
            onChange={(e) => setWorkDate(e.target.value)}
            error={errors.workDate}
            leftIcon={CalendarIcon}
            required
          />

          <div className="space-y-1.5">
            <InputField
              label="Hours Spent"
              type="number"
              step="0.25"
              min="0.25"
              max="8"
              value={hoursSpent}
              onChange={(e) => {
                setHoursSpent(e.target.value);
                setErrors(prev => ({ ...prev, hoursSpent: null }));
              }}
              error={errors.hoursSpent}
              leftIcon={Clock}
              required
            />

            {/* Quick Add Presets Buttons */}
            <div className="flex items-center gap-1.5 pt-1">
              <span className="text-[11px] text-slate-500 mr-1">Quick Add:</span>
              {[1, 2, 4, 8].map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => handleQuickAddHours(h)}
                  className="px-2 py-0.5 text-[11px] font-semibold bg-slate-50 hover:bg-slate-100 text-slate-600 rounded border border-slate-200 transition cursor-pointer"
                >
                  +{h}h
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Work Description Textarea */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-600">
            Work Log Description
          </label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe work completed during this period..."
            className="w-full bg-white border border-slate-200 rounded-lg p-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
          />
        </div>

        {/* Overlimit Warning Alert */}
        {isOverLimit && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-600 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              Warning: Total daily hours will exceed 8 hours ({currentTotal.toFixed(2)}h)!
            </span>
          </div>
        )}

        {/* Submit Action */}
        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            disabled={isLoading || isOverLimit}
            className={cn(
              "px-5 py-2.5 text-xs font-bold rounded-lg transition-all shadow-md flex items-center gap-2 cursor-pointer",
              isLoading || isOverLimit
                ? "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
                : "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/30 active:scale-[0.98]"
            )}
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Submit Work Log
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
