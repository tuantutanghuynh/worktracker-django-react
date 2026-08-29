import React from 'react';

export default function Footer() {
  return (
    <footer className="py-4 px-6 bg-white border-t border-slate-200 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
      <p>© {new Date().getFullYear()} WorkTracker Pro. All rights reserved.</p>
      <div className="flex items-center gap-4 text-slate-400">
        <span className="hover:text-slate-600 transition-colors cursor-pointer">Terms of Service</span>
        <span>•</span>
        <span className="hover:text-slate-600 transition-colors cursor-pointer">Privacy Policy</span>
        <span>•</span>
        <span className="hover:text-slate-600 transition-colors cursor-pointer">Technical Support</span>
      </div>
    </footer>
  );
}
