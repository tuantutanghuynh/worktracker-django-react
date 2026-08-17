import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * 🚀 Zustand Store: Recently Viewed Jobs with localStorage Persistence
 * Automatically tracks up to 5 recently visited jobs by the Manager.
 */
export const useRecentJobsStore = create(
  persist(
    (set) => ({
      recentJobs: [],

      // Thêm một Job vào đầu danh sách (Lọc trùng và giữ tối đa 5 items)
      addRecentJob: (job) => {
        if (!job || !job.id) return;
        set((state) => {
          const filtered = state.recentJobs.filter((j) => String(j.id) !== String(job.id));
          const formattedJob = {
            id: job.id,
            job_code: job.job_code || `JOB-${job.id}`,
            job_name: job.job_name || job.title || `Job #${job.id}`,
            status: job.status || 'ACTIVE',
          };
          return { recentJobs: [formattedJob, ...filtered].slice(0, 5) };
        });
      },

      // Xóa sạch lịch sử vừa xem
      clearRecentJobs: () => set({ recentJobs: [] }),
    }),
    {
      name: 'worktracker-recent-jobs', // Unique key in localStorage
    }
  )
);
