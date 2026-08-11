import React, { useState } from 'react';
import {
  Layers,
  FileText,
  Sliders,
  Bell,
  Clock,
  Eye,
  CheckCircle2,
  AlertCircle,
  X,
} from 'lucide-react';
import InputField from '../../components/common/forms/InputField';
import SelectDropdown from '../../components/common/forms/SelectDropdown';
import QuickLogWorkFormCard from '../../components/common/forms/QuickLogWorkFormCard';
import ActivityFeedTimeline from '../../components/common/feeds/ActivityFeedTimeline';
import NotificationListTable from '../../components/common/feeds/NotificationListTable';
import SideDrawer from '../../components/common/drawer/SideDrawer';
import ReportDetailDrawer from '../../components/common/drawer/ReportDetailDrawer';
import AuditDiffViewer from '../../components/common/drawer/AuditDiffViewer';

export default function ComponentShowcasePage() {
  const [activeTab, setActiveTab] = useState('FORMS'); // 'FORMS' | 'FEEDS' | 'DRAWERS'

  // Input States for Testing
  const [testText, setTestText] = useState('Sample Work Title');
  const [testSelect, setTestSelect] = useState('ACTIVE');

  // Drawer Open States
  const [isSideDrawerOpen, setIsSideDrawerOpen] = useState(false);
  const [isReportDrawerOpen, setIsReportDrawerOpen] = useState(false);
  const [isAuditDrawerOpen, setIsAuditDrawerOpen] = useState(false);

  // Sample Audit Log Data for AuditDiffViewer
  const sampleAuditLog = {
    id: 101,
    action: 'UPDATE_TASK',
    user: { full_name: 'Nguyen Van A', email: 'manager@worktracker.vn' },
    tableName: 'tasks',
    recordId: 45,
    timestamp: new Date().toISOString(),
    ipAddress: '14.161.22.84',
    summary: 'Task status updated from PLANNING to COMPLETED',
    oldValues: {
      status: 'PLANNING',
      assignee: 'Le Van Dung',
      priority: 'MEDIUM',
    },
    newValues: {
      status: 'COMPLETED',
      assignee: 'Le Van Dung',
      priority: 'HIGH',
    },
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase rounded-full bg-blue-50 text-blue-600 border border-blue-200/60 inline-block mb-2">
            DEV TEST &amp; SHOWCASE GALLERY
          </span>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Layers className="w-6 h-6 text-blue-600" />
            <span>Shared Components Preview Gallery</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Test and preview UI components from <code className="bg-slate-100 px-1 rounded text-slate-700">forms</code>, <code className="bg-slate-100 px-1 rounded text-slate-700">feeds</code>, and <code className="bg-slate-100 px-1 rounded text-slate-700">drawer</code> subdirectories.
          </p>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <span className="text-xs font-semibold bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-xl border border-emerald-200 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>8 Components Loaded</span>
          </span>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex items-center space-x-2 border-b border-slate-200 bg-white px-4 pt-2 rounded-t-2xl border border-b-0 border-slate-200">
        {[
          { key: 'FORMS', label: '1. Forms Components (3)', icon: FileText },
          { key: 'FEEDS', label: '2. Feeds & Timelines (2)', icon: Bell },
          { key: 'DRAWERS', label: '3. Slide-over Drawers (3)', icon: Eye },
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

      {/* Showcase Content Area */}
      <div className="bg-white border border-slate-200/80 rounded-b-2xl p-6 shadow-2xs space-y-6">
        {/* SECTION 1: FORMS */}
        {activeTab === 'FORMS' && (
          <div className="space-y-6">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Forms Components (`src/components/common/forms/`)
              </h2>
              <p className="text-xs text-slate-500">
                Used across Admin, Manager, and Employee portals for data entry and log submission.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Box 1: InputField & SelectDropdown */}
              <div className="p-5 bg-slate-50/70 border border-slate-200/80 rounded-xl space-y-4">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  InputField &amp; SelectDropdown Examples
                </h3>

                <InputField
                  label="Task Title"
                  placeholder="Enter task name..."
                  value={testText}
                  onChange={(e) => setTestText(e.target.value)}
                  helperText="Standard text input field with helper text"
                />

                <SelectDropdown
                  label="Status Dropdown"
                  value={testSelect}
                  onChange={(val) => setTestSelect(val)}
                  options={[
                    { value: 'ACTIVE', label: 'Active Status' },
                    { value: 'PENDING', label: 'Pending Status' },
                    { value: 'CLOSED', label: 'Closed Status' },
                  ]}
                />
              </div>

              {/* Box 2: QuickLogWorkFormCard */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  QuickLogWorkFormCard (Employee &amp; Manager)
                </h3>
                <QuickLogWorkFormCard
                  onSuccess={() => alert('LogWork Submitted Successfully!')}
                />
              </div>
            </div>
          </div>
        )}

        {/* SECTION 2: FEEDS */}
        {activeTab === 'FEEDS' && (
          <div className="space-y-6">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Feeds &amp; Timeline Components (`src/components/common/feeds/`)
              </h2>
              <p className="text-xs text-slate-500">
                Used for notification tables and real-time activity timelines.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* ActivityFeedTimeline */}
              <div className="p-5 bg-slate-50/70 border border-slate-200/80 rounded-xl space-y-3">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  ActivityFeedTimeline Preview
                </h3>
                <ActivityFeedTimeline taskId="9" />
              </div>

              {/* NotificationListTable */}
              <div className="p-5 bg-slate-50/70 border border-slate-200/80 rounded-xl space-y-3">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  NotificationListTable Preview
                </h3>
                <NotificationListTable />
              </div>
            </div>
          </div>
        )}

        {/* SECTION 3: DRAWERS */}
        {activeTab === 'DRAWERS' && (
          <div className="space-y-6">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Slide-over Drawer Components (`src/components/common/drawer/`)
              </h2>
              <p className="text-xs text-slate-500">
                Click the buttons below to trigger the right slide-over drawers on screen.
              </p>
            </div>

            <div className="flex flex-wrap gap-4">
              {/* Trigger 1: SideDrawer */}
              <button
                type="button"
                onClick={() => setIsSideDrawerOpen(true)}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
              >
                Open Base SideDrawer
              </button>

              {/* Trigger 2: ReportDetailDrawer */}
              <button
                type="button"
                onClick={() => setIsReportDrawerOpen(true)}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
              >
                Open ReportDetailDrawer
              </button>

              {/* Trigger 3: AuditDiffViewer */}
              <button
                type="button"
                onClick={() => setIsAuditDrawerOpen(true)}
                className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
              >
                Open AuditDiffViewer
              </button>
            </div>

            {/* Embedded AuditDiffViewer Preview directly on tab */}
            <div className="pt-4 border-t border-slate-100 space-y-3">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                AuditDiffViewer Inline Preview
              </h3>
              <AuditDiffViewer
                action={sampleAuditLog.action}
                user={sampleAuditLog.user}
                tableName={sampleAuditLog.tableName}
                recordId={sampleAuditLog.recordId}
                timestamp={sampleAuditLog.timestamp}
                ipAddress={sampleAuditLog.ipAddress}
                summary={sampleAuditLog.summary}
                oldValues={sampleAuditLog.oldValues}
                newValues={sampleAuditLog.newValues}
              />
            </div>
          </div>
        )}
      </div>

      {/* Render Drawers */}
      <SideDrawer
        isOpen={isSideDrawerOpen}
        onClose={() => setIsSideDrawerOpen(false)}
        title="Base SideDrawer Component"
      >
        <div className="p-4 space-y-3 text-xs text-slate-600">
          <p className="font-semibold text-slate-800">
            This is the standard slide-over drawer component.
          </p>
          <p>It slides smoothly from the right side of the screen with backdrop overlay.</p>
        </div>
      </SideDrawer>

      <ReportDetailDrawer
        reportId="1"
        isOpen={isReportDrawerOpen}
        onClose={() => setIsReportDrawerOpen(false)}
      />

      <SideDrawer
        isOpen={isAuditDrawerOpen}
        onClose={() => setIsAuditDrawerOpen(false)}
        title="Audit Log Snapshot Diff"
        size="xl"
      >
        <AuditDiffViewer
          action={sampleAuditLog.action}
          user={sampleAuditLog.user}
          tableName={sampleAuditLog.tableName}
          recordId={sampleAuditLog.recordId}
          timestamp={sampleAuditLog.timestamp}
          ipAddress={sampleAuditLog.ipAddress}
          summary={sampleAuditLog.summary}
          oldValues={sampleAuditLog.oldValues}
          newValues={sampleAuditLog.newValues}
        />
      </SideDrawer>
    </div>
  );
}
