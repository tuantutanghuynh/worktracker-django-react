import React from 'react';

export default function ManagerTimesheetReviewPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Duyệt Nhật ký Công việc (Timesheets)</h1>
        <p className="text-xs text-slate-500">Phê duyệt, từ chối hoặc điều chỉnh giờ làm việc của nhân sự</p>
      </div>
      <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-500">
        Bảng duyệt timesheet đang được khởi tạo...
      </div>
    </div>
  );
}
