import React, { useState } from 'react';
import { 
  Clock, 
  Plus, 
  Send, 
  AlertTriangle, 
  Calendar as CalendarIcon, 
  FileText, 
  CheckCircle2, 
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

  const MAX_DAILY_LIMIT = 24.0;
  const currentTotal = Number(dailyHoursLogged) + (Number(hoursSpent) || 0);
  const isOverLimit = currentTotal > MAX_DAILY_LIMIT;

  const taskOptions = tasks.map(t => ({
    value: String(t.id),
    label: t.title,
    badge: t.job_name || 'Dự án',
    description: `Hạn: ${t.deadline || 'Chưa có'}`
  }));

  const handleQuickAddHours = (addedHours) => {
    const val = (Number(hoursSpent) || 0) + addedHours;
    setHoursSpent(val.toFixed(2));
  };

  const validate = () => {
    const newErrors = {};
    if (!taskId) newErrors.taskId = 'Vui lòng chọn công việc';
    if (!workDate) newErrors.workDate = 'Vui lòng chọn ngày làm việc';
    
    const h = Number(hoursSpent);
    if (isNaN(h) || h <= 0) {
      newErrors.hoursSpent = 'Số giờ làm phải lớn hơn 0';
    } else if (h > 24) {
      newErrors.hoursSpent = 'Số giờ trong 1 lần khai không quá 24h';
    } else if (isOverLimit) {
      newErrors.hoursSpent = `Tổng giờ trong ngày không được vượt quá 24h (Hiện tại: ${currentTotal.toFixed(2)}h)`;
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
    <div className={cn("bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-5 text-slate-100", className)}>
      {/* Form Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-400">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100">Khai báo Giờ làm nhanh</h3>
            <p className="text-xs text-slate-400">Ghi nhận nhật ký công việc theo ngày</p>
          </div>
        </div>

        {/* Daily Total Progress Pill */}
        <div className={cn(
          "px-3 py-1 rounded-full text-xs font-semibold border flex items-center gap-1.5",
          isOverLimit
            ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
            : "bg-slate-800 text-slate-300 border-slate-700"
        )}>
          <span>Đã ghi hôm nay:</span>
          <strong className={isOverLimit ? "text-rose-400" : "text-emerald-400"}>
            {dailyHoursLogged}h / 24h
          </strong>
        </div>
      </div>

      {/* Form Body */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Task Selection Dropdown */}
        <SelectDropdown
          label="Chọn Công việc (Task)"
          options={taskOptions}
          value={taskId}
          onChange={(val) => {
            setTaskId(val);
            setErrors(prev => ({ ...prev, taskId: null }));
          }}
          placeholder="-- Chọn task cần báo cáo --"
          error={errors.taskId}
          leftIcon={Briefcase}
          required
          searchable
        />

        {/* Date and Hours Input Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InputField
            label="Ngày thực hiện"
            type="date"
            value={workDate}
            onChange={(e) => setWorkDate(e.target.value)}
            error={errors.workDate}
            leftIcon={CalendarIcon}
            required
          />

          <div className="space-y-1.5">
            <InputField
              label="Số giờ làm (Hours)"
              type="number"
              step="0.25"
              min="0.25"
              max="24"
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
              <span className="text-[11px] text-slate-400 mr-1">Cộng nhanh:</span>
              {[1, 2, 4, 8].map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => handleQuickAddHours(h)}
                  className="px-2 py-0.5 text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition"
                >
                  +{h}h
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Work Description Textarea */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-300">
            Mô tả chi tiết công việc
          </label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Mô tả công việc đã hoàn thành trong khoảng thời gian này..."
            className="w-full bg-slate-900 border border-slate-700/80 rounded-lg p-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
          />
        </div>

        {/* Overlimit Warning Alert */}
        {isOverLimit && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-400 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              Cảnh báo: Tổng số giờ trong ngày sẽ vượt quá 24h ({currentTotal.toFixed(2)}h)!
            </span>
          </div>
        )}

        {/* Submit Action */}
        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            disabled={isLoading || isOverLimit}
            className={cn(
              "px-5 py-2.5 text-xs font-bold rounded-lg transition-all shadow-md flex items-center gap-2",
              isLoading || isOverLimit
                ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"
                : "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/30 active:scale-[0.98]"
            )}
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Đang lưu...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Gửi nhật ký công việc
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
