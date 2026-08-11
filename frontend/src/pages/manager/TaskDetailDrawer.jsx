import React from 'react';
import SideDrawer from '../../components/common/drawer/SideDrawer';
import { useUIStore } from '../../stores/useUIStore';

export default function TaskDetailDrawer() {
  const { taskDrawerOpen, closeTaskDrawer, selectedTaskId } = useUIStore();

  return (
    <SideDrawer
      isOpen={taskDrawerOpen}
      onClose={closeTaskDrawer}
      title={`Chi tiết Task #${selectedTaskId || ''}`}
      subtitle="Quản lý thông tin, work log và thảo luận"
      size="xl"
    >
      <div className="p-4 text-slate-600 text-sm">
        Nội dung chi tiết task đang được tải...
      </div>
    </SideDrawer>
  );
}
