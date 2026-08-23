import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/common/layout/Sidebar';
import Header from '../components/common/layout/Header';
import { useNotificationStore } from '../stores/useNotificationStore';

// Sidebar/Header now read collapsed state from useUIStore themselves
// (shared with Manager/Employee layouts), so this layout no longer owns
// that state locally.
export default function AdminLayout(){
    const { fetchNotifications, connectWebSocket, disconnectWebSocket } = useNotificationStore();

    // Load the bell's initial unread count once, then keep it live over the
    // shared ws/notifications/ channel (backend/system/routing.py) for as
    // long as the Admin is inside this layout.
    useEffect(() => {
        fetchNotifications();
        connectWebSocket();
        return () => disconnectWebSocket();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return(
        <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-800">

            <Sidebar />

            <div className="flex flex-1 flex-col overflow-hidden">
                <Header />
                <main className="flex-1 overflow-y-auto p-6">
                    <Outlet />
                </main>
            </div>

        </div>
    )
}