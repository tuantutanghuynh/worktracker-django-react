import { Outlet } from 'react-router-dom';
import Sidebar from '../components/common/layout/Sidebar';
import Header from '../components/common/layout/Header';

// Sidebar/Header now read collapsed state from useUIStore themselves
// (shared with Manager/Employee layouts), so this layout no longer owns
// that state locally.
export default function AdminLayout(){
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