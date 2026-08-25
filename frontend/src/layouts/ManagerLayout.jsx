import React, { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/common/layout/Sidebar';
import Header from '../components/common/layout/Header';
import { useNotificationStore } from '../stores/useNotificationStore';

export default function ManagerLayout() {
  const fetchNotifications = useNotificationStore((state) => state.fetchNotifications);

  // Nạp danh sách thông báo ban đầu khi Mount Layout
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 font-sans text-slate-800 antialiased">
      {/* Sidebar Cố định Bên Trái (#0A1128) */}
      <Sidebar />

      {/* Container Nội dung Chính */}
      <div className="flex-1 flex flex-col h-screen min-w-0 overflow-hidden">
        {/* Header Cố định Phía Trên */}
        <Header />

        {/* Vùng Cuộn Nội dung Trang Động */}
        <main className="flex-1 bg-slate-50 overflow-y-auto p-4 sm:p-6 space-y-6 custom-scrollbar">
          <Outlet />
        </main>
      </div>
    </div>
  );
}