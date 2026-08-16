import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import Sidebar from '../components/common/layout/Sidebar';
import Header from '../components/common/layout/Header';
import { Search, X, CornerDownLeft, Sparkles } from 'lucide-react';
import { useNotificationStore } from '../stores/useNotificationStore';

export default function ManagerLayout() {
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();
  const fetchNotifications = useNotificationStore((state) => state.fetchNotifications);

  // 1. Nạp danh sách thông báo ban đầu khi Mount Layout
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // 2. Lắng nghe phím tắt toàn cục: Ctrl + K (hoặc Cmd + K) để Mở Search và ESC để Đóng Search
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchModalOpen((prev) => !prev);
      }
      if (e.key === 'Escape' && searchModalOpen) {
        setSearchModalOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchModalOpen]);

  // 3. Xử lý khi người dùng ấn Enter hoặc click nút Search để gửi từ khóa tìm kiếm
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    // Điều hướng sang trang Jobs kèm tham số tìm kiếm (search query)
    navigate(`/manager/jobs?search=${encodeURIComponent(searchQuery.trim())}`);
    setSearchModalOpen(false);
    setSearchQuery('');
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 font-sans text-slate-800 antialiased">
      {/* Sidebar Cố định Bên Trái (#0A1128) */}
      <Sidebar />

      {/* Container Nội dung Chính */}
      <div className="flex-1 flex flex-col h-screen min-w-0 overflow-hidden">
        {/* Header Cố định Phía Trên */}
        <Header onOpenSearchModal={() => setSearchModalOpen(true)} />

        {/* Vùng Cuộn Nội dung Trang Động */}
        <main className="flex-1 bg-slate-50 overflow-y-auto p-4 sm:p-6 space-y-6 custom-scrollbar">
          <Outlet />
        </main>
      </div>

      {/* Global Command Search Modal (Ctrl + K) */}
      {searchModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-start justify-center pt-20 px-4 animate-slide-in-top"
          onClick={() => setSearchModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Thanh Input Tìm kiếm */}
            <form onSubmit={handleSearchSubmit} className="p-4 border-b border-slate-100 flex items-center gap-3">
              <Search className="w-5 h-5 text-blue-600 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search (Jobs, Tasks, Team Members)..."
                autoFocus
                className="w-full text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <button
                type="submit"
                className="hidden sm:flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-semibold transition-colors"
              >
                <span>Search</span>
                <CornerDownLeft className="w-3 h-3" />
              </button>
            </form>

            {/* Thân Modal: Gợi ý Tìm kiếm Thông minh */}
            <div className="p-5 max-h-80 overflow-y-auto custom-scrollbar">
              {searchQuery.trim() ? (
                <div className="py-6 text-center">
                  <p className="text-sm font-medium text-slate-600">
                    Press <span className="font-bold text-blue-600">Enter</span> or click <span className="font-bold text-blue-600">Search</span> to query:
                  </p>
                  <p className="mt-1 text-base font-semibold text-slate-900 bg-slate-100 inline-block px-3 py-1 rounded-lg border border-slate-200">
                    "{searchQuery}"
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>Quick Search Tips</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                    <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                      <p className="font-semibold text-slate-700">Job / Project Code</p>
                      <p className="text-slate-400 mt-0.5">Example: <code className="text-blue-600">JOB-01</code></p>
                    </div>
                    <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                      <p className="font-semibold text-slate-700">Task Code / Title</p>
                      <p className="text-slate-400 mt-0.5">Example: <code className="text-blue-600">TSK-102</code></p>
                    </div>
                    <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                      <p className="font-semibold text-slate-700">Team Member Name</p>
                      <p className="text-slate-400 mt-0.5">Example: <code className="text-blue-600">Minh Anh</code></p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Modal: Hướng dẫn phím tắt */}
            <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                Press <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-semibold text-slate-500 shadow-2xs">Ctrl + K</kbd> to toggle
              </span>
              <span className="flex items-center gap-1.5">
                Press <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-semibold text-slate-500 shadow-2xs">ESC</kbd> to close
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}