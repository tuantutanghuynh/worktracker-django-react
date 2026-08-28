import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Cùng pattern useRecentJobsStore.js (Manager) nhưng theo dõi Task
// Employee vừa xem, không phải Job.
export const useRecentTasksStore = create(
  persist(
    (set) => ({
      recentTasks: [],

      addRecentTask: (task) => {
        if (!task || !task.id) return;
        set((state) => {
          const filtered = state.recentTasks.filter((t) => String(t.id) !== String(task.id));
          const formattedTask = {
            id: task.id,
            title: task.title || `Task #${task.id}`,
            job_name: task.job_name || '',
            status: task.status || 'TODO',
          };
          return { recentTasks: [formattedTask, ...filtered].slice(0, 5) };
        });
      },

      clearRecentTasks: () => set({ recentTasks: [] }),
    }),
    {
      name: 'worktracker-recent-tasks',
    }
  )
);
