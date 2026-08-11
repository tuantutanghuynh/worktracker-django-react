import React, { useState } from 'react';
import {
  Settings,
  Clock,
  Bell,
  Globe,
  Sliders,
  ShieldCheck,
  Save,
  RotateCcw,
  CheckCircle2,
  Calendar,
  Layers,
  Sparkles,
  Info,
  RefreshCw,
  Search,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import InputField from '../../components/common/forms/InputField';
import SelectDropdown from '../../components/common/forms/SelectDropdown';

export default function ManagerSettingsPage() {
  const [activeTab, setActiveTab] = useState('GENERAL'); // 'GENERAL' | 'TIMESHEET' | 'NOTIFICATIONS'
  const [saving, setSaving] = useState(false);

  // Settings State
  const [settings, setSettings] = useState({
    // General & Regional Preferences
    systemLanguage: 'en-us',
    timeZone: 'Asia/Ho_Chi_Minh',
    dateFormat: 'YYYY-MM-DD',
    pageSize: '20',
    defaultJobView: 'KANBAN',

    // Working Hours & Timesheet Rules
    workStartTime: '08:00',
    workEndTime: '17:30',
    dailyTargetHours: '8.0',
    workingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
    requireUnlockReason: true,

    // Notification Triggers
    timesheetSubmittedAlert: true,
    taskStatusChangedAlert: true,
    timeLockAlert: true,
    realtimePushNotifs: true,
  });

  const handleSaveSettings = (e) => {
    if (e) e.preventDefault();
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      toast.success('System preferences and settings saved successfully!');
    }, 500);
  };

  const handleResetDefaults = () => {
    setSettings({
      systemLanguage: 'en-us',
      timeZone: 'Asia/Ho_Chi_Minh',
      dateFormat: 'YYYY-MM-DD',
      pageSize: '20',
      defaultJobView: 'KANBAN',
      workStartTime: '08:00',
      workEndTime: '17:30',
      dailyTargetHours: '8.0',
      workingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
      requireUnlockReason: true,
      timesheetSubmittedAlert: true,
      taskStatusChangedAlert: true,
      timeLockAlert: true,
      realtimePushNotifs: true,
    });
    toast.info('Preferences restored to default values.');
  };

  const toggleWorkingDay = (day) => {
    setSettings((prev) => {
      const exists = prev.workingDays.includes(day);
      const updated = exists
        ? prev.workingDays.filter((d) => d !== day)
        : [...prev.workingDays, day];
      return { ...prev, workingDays: updated };
    });
  };

  const handleClearCache = () => {
    localStorage.clear();
    toast.success('Local browser cache cleared successfully!');
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto text-slate-800">
      {/* Breadcrumb & Top Bar Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
        <div className="flex items-center space-x-2 text-slate-400 font-medium">
          <span className="hover:text-blue-600 cursor-pointer">Dashboard</span>
          <ChevronRight className="w-3 h-3 text-slate-300" />
          <span className="text-slate-800 font-semibold">Settings &amp; Preferences</span>
        </div>

        <div className="flex items-center space-x-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search settings..."
              className="w-56 pl-9 pr-12 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-2xs"
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-semibold text-slate-400 bg-slate-100 border border-slate-200 px-1 py-0.5 rounded">
              Ctrl K
            </span>
          </div>
        </div>
      </div>

      {/* Page Title & Header Action Buttons */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-5 rounded-xl border border-slate-200/80 shadow-2xs">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Settings className="w-6 h-6 text-blue-600" />
            <span>System Settings &amp; Preferences</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Customize localization, notification triggers, manager timesheet defaults, and security policies.
          </p>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="flex items-center space-x-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-3.5 py-2 rounded-lg text-xs font-semibold transition shadow-2xs cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
            <span>Reset Defaults</span>
          </button>
          <button
            type="button"
            onClick={handleSaveSettings}
            disabled={saving}
            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition shadow-md shadow-blue-500/20 disabled:opacity-50 cursor-pointer"
          >
            {saving ? (
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>Save Preferences</span>
          </button>
        </div>
      </div>

      {/* Tabs Navigation Header */}
      <div className="flex items-center space-x-1 border-b border-slate-200 bg-white px-4 pt-2 rounded-t-xl">
        {[
          { key: 'GENERAL', label: 'General & Regional', icon: Globe },
          { key: 'TIMESHEET', label: 'Timesheet Rules', icon: Sliders },
          { key: 'NOTIFICATIONS', label: 'Notifications & Alerts', icon: Bell },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center space-x-2 px-4 py-2.5 text-xs transition border-b-2 font-semibold cursor-pointer ${
                isActive
                  ? 'border-blue-600 text-blue-600 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Section: 3:1 Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Left 3 Columns: Main Settings Forms */}
        <div className="lg:col-span-3 space-y-4">
          <form onSubmit={handleSaveSettings} className="space-y-4">
            {/* Tab 1: General & Regional Preferences */}
            {activeTab === 'GENERAL' && (
              <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
                  General &amp; Regional Preferences
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <SelectDropdown
                    label="System Language"
                    value={settings.systemLanguage}
                    onChange={(val) => setSettings({ ...settings, systemLanguage: val })}
                    options={[
                      { value: 'en-us', label: 'English (US)' },
                      { value: 'vi-vn', label: 'Tiếng Việt (Vietnam)' },
                    ]}
                  />

                  <SelectDropdown
                    label="Time Zone"
                    value={settings.timeZone}
                    onChange={(val) => setSettings({ ...settings, timeZone: val })}
                    options={[
                      { value: 'Asia/Ho_Chi_Minh', label: 'Asia/Ho_Chi_Minh (UTC+07:00)' },
                      { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
                      { value: 'America/New_York', label: 'America/New_York (EST)' },
                    ]}
                  />

                  <SelectDropdown
                    label="Date Format"
                    value={settings.dateFormat}
                    onChange={(val) => setSettings({ ...settings, dateFormat: val })}
                    options={[
                      { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (e.g. 2026-08-11)' },
                      { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY (e.g. 11/08/2026)' },
                      { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY (e.g. 08/11/2026)' },
                    ]}
                  />

                  <SelectDropdown
                    label="Default Pagination Limit"
                    value={settings.pageSize}
                    onChange={(val) => setSettings({ ...settings, pageSize: val })}
                    options={[
                      { value: '10', label: '10 items per page' },
                      { value: '20', label: '20 items per page' },
                      { value: '50', label: '50 items per page' },
                    ]}
                  />

                  <SelectDropdown
                    label="Default Project View"
                    value={settings.defaultJobView}
                    onChange={(val) => setSettings({ ...settings, defaultJobView: val })}
                    options={[
                      { value: 'KANBAN', label: 'Kanban Board View' },
                      { value: 'LIST', label: 'Task List View' },
                      { value: 'TABLE', label: 'Detailed Data Table' },
                    ]}
                  />
                </div>
              </div>
            )}

            {/* Tab 2: Timesheet Rules & Working Hours */}
            {activeTab === 'TIMESHEET' && (
              <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs space-y-5">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
                  Timesheet Rules &amp; Working Hours Capacity
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <InputField
                    label="Work Shift Start Time"
                    type="time"
                    value={settings.workStartTime}
                    onChange={(e) => setSettings({ ...settings, workStartTime: e.target.value })}
                  />
                  <InputField
                    label="Work Shift End Time"
                    type="time"
                    value={settings.workEndTime}
                    onChange={(e) => setSettings({ ...settings, workEndTime: e.target.value })}
                  />
                  <InputField
                    label="Daily Target Hours (hrs/day)"
                    type="number"
                    step="0.5"
                    value={settings.dailyTargetHours}
                    onChange={(e) => setSettings({ ...settings, dailyTargetHours: e.target.value })}
                  />
                </div>

                {/* Working Days */}
                <div className="space-y-2 pt-2">
                  <label className="block text-xs font-semibold text-slate-700">
                    Active Working Days in Week
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    {[
                      { id: 'MON', label: 'Monday' },
                      { id: 'TUE', label: 'Tuesday' },
                      { id: 'WED', label: 'Wednesday' },
                      { id: 'THU', label: 'Thursday' },
                      { id: 'FRI', label: 'Friday' },
                      { id: 'SAT', label: 'Saturday' },
                      { id: 'SUN', label: 'Sunday' },
                    ].map((d) => {
                      const isChecked = settings.workingDays.includes(d.id);
                      return (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => toggleWorkingDay(d.id)}
                          className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                            isChecked
                              ? 'bg-blue-50 text-blue-700 border-blue-300 font-bold'
                              : 'bg-slate-50 text-slate-500 border-slate-200 hover:text-slate-800'
                          }`}
                        >
                          {d.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* TimeLock Policy Option */}
                <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-slate-800 block">
                      Require Reason Statement on TimeLock Unlock
                    </span>
                    <span className="text-[11px] text-slate-500 block">
                      Mandate Manager explanation before unlocking closed monthly timesheet periods.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.requireUnlockReason}
                    onChange={(e) =>
                      setSettings({ ...settings, requireUnlockReason: e.target.checked })
                    }
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                  />
                </div>
              </div>
            )}

            {/* Tab 3: Notification Event Triggers */}
            {activeTab === 'NOTIFICATIONS' && (
              <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
                  Notification Event Triggers &amp; Channels
                </h3>

                <div className="space-y-3 text-xs">
                  {[
                    {
                      key: 'timesheetSubmittedAlert',
                      title: 'Timesheet Log Submissions',
                      code: 'TIMESHEET_SUBMITTED',
                      desc: 'Receive notification when team members submit daily hours for manager review.',
                    },
                    {
                      key: 'taskStatusChangedAlert',
                      title: 'Task Status Transitions',
                      code: 'TASK_STATUS_CHANGED',
                      desc: 'Notify when task status transitions between Todo, In Progress, Reviewing, Completed.',
                    },
                    {
                      key: 'timeLockAlert',
                      title: 'Time Lock Period Notifications',
                      code: 'TIMESHEET_LOCK',
                      desc: 'Notify project team when a monthly period is locked or unlocked by Manager/Admin.',
                    },
                    {
                      key: 'realtimePushNotifs',
                      title: 'Real-time WebSocket Notifications',
                      code: 'WEBSOCKET_PUSH',
                      desc: 'Display instant header badge update via real-time WebSocket channel.',
                    },
                  ].map((item) => (
                    <div
                      key={item.key}
                      className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200/80"
                    >
                      <div className="space-y-0.5">
                        <p className="font-bold text-slate-800">{item.title}</p>
                        <p className="text-[11px] text-slate-500">
                          {item.desc}{' '}
                          <code className="bg-slate-200/70 text-slate-700 px-1 rounded text-[10px]">
                            {item.code}
                          </code>
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings[item.key]}
                        onChange={(e) =>
                          setSettings({ ...settings, [item.key]: e.target.checked })
                        }
                        className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer shrink-0"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </form>
        </div>

        {/* Right 1 Column: Sidebar Widgets */}
        <div className="space-y-4">
          {/* Widget 1: System Info */}
          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs space-y-3">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
              System Info
            </h4>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Backend Framework</span>
                <span className="font-bold text-slate-800">Django 5.0 REST</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">JWT Token Expiry</span>
                <span className="font-bold text-slate-800">30 minutes</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Standard Work Hours</span>
                <span className="font-bold text-slate-800">8.0 hrs/day</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Max Daily Limit</span>
                <span className="font-bold text-slate-800">24.0 hrs/day</span>
              </div>
            </div>
          </div>

          {/* Widget 2: Audit Log Status */}
          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs space-y-2.5">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
              Audit Log Status
            </h4>
            <div className="p-3 bg-blue-50/60 border border-blue-100 rounded-lg space-y-1 text-xs">
              <div className="flex items-center space-x-1.5 text-blue-800 font-bold">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                <span>Audit Log Enabled</span>
              </div>
              <p className="text-[11px] text-blue-700 leading-normal">
                All preference changes trigger automatic audit log entries in Django{' '}
                <code className="bg-blue-100 px-1 rounded font-mono">AuditLog</code> table.
              </p>
            </div>
          </div>

          {/* Widget 3: Quick Actions */}
          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs space-y-2">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
              Quick Actions
            </h4>
            <button
              type="button"
              onClick={handleClearCache}
              className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs transition flex items-center justify-center space-x-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
              <span>Clear Local Cache</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
