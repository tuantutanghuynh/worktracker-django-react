import { create } from 'zustand';

export const useUIStore = create((set) => ({
  // Sidebar collapsed state (supports both isSidebarCollapsed and sidebarCollapsed keys for full component compatibility)
  isSidebarCollapsed: false,
  sidebarCollapsed: false,
  toggleSidebar: () =>
    set((state) => {
      const nextState = !state.isSidebarCollapsed;
      return {
        isSidebarCollapsed: nextState,
        sidebarCollapsed: nextState,
      };
    }),
  setSidebarCollapsed: (collapsed) =>
    set({
      isSidebarCollapsed: Boolean(collapsed),
      sidebarCollapsed: Boolean(collapsed),
    }),

  // Active Modal state management ('CREATE_JOB', 'CREATE_TASK', 'REJECT_LOGWORK', 'CORRECT_LOGWORK', 'TIME_LOCK', etc.)
  activeModal: null,
  modalData: null,
  openModal: (modalName, data = null) =>
    set({
      activeModal: modalName,
      modalData: data,
    }),
  closeModal: () =>
    set({
      activeModal: null,
      modalData: null,
    }),

  // Report Detail Drawer state
  reportDrawerOpen: false,
  selectedReportData: null,
  openReportDrawer: (data = null) =>
    set({
      reportDrawerOpen: true,
      selectedReportData: data,
    }),
  closeReportDrawer: () =>
    set({
      reportDrawerOpen: false,
      selectedReportData: null,
    }),

  // Task Detail SideDrawer state
  taskDrawerOpen: false,
  selectedTaskId: null,
  openTaskDrawer: (taskId) =>
    set({
      taskDrawerOpen: true,
      selectedTaskId: taskId,
    }),
  closeTaskDrawer: () =>
    set({
      taskDrawerOpen: false,
      selectedTaskId: null,
    }),
}));

export default useUIStore;
