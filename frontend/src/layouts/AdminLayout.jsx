import { useState } from "react";
import {Outlet} from 'react-router-dom';
import Sidebar from '../components/common/layout/Sidebar';
import Header from '../components/common/layout/Header';

export default function AdminLayout(){
    const [sidebarOpen, setSidebarOpen] = useState(true);

    return(
        <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-800">

            <Sidebar open={sidebarOpen} onToggle={()=> setSidebarOpen(p => !p)}/>

            <div className="flex flex-1 flex-col overflow-hidden">
                <Header />
                <main className="flex-1 overflow-y-auto p-6">
                    <Outlet />
                </main>
            </div>

        </div>
    )
}