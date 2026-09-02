import React from "react";
import { Clock, CheckCircle2, XCircle, AlertTriangle, Paperclip, RotateCcw } from "lucide-react";
import { cn } from "../../../utils/cn";

export default function TaskReviewHeader({
  reviewTab = "REVIEWING",
  onTabChange,
  tabCounts = { active: 0, frozen: 0 },
  onRefresh,
}) {
  return (
    <header className="bg-white border-b border-slate-200 px-5 py-2.5 flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0 shadow-2xs z-20">
      <div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 font-mono text-[10px] font-bold border border-purple-200">
            TASK DELIVERABLES QA COCKPIT
          </span>
        </div>
        <h1 className="text-lg font-extrabold text-slate-900 mt-0.5">Task Acceptance &amp; Deliverables Review</h1>
      </div>

      {/* 🗂️ REVIEW STAGE FILTER TABS */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center p-1 bg-slate-100 rounded-xl text-xs font-bold text-slate-600">
          <button
            onClick={() => onTabChange("REVIEWING")}
            className={cn(
              "px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5",
              reviewTab === "REVIEWING" ? "bg-white text-purple-700 shadow-xs" : "hover:text-slate-900",
            )}
          >
            <Clock className="w-3.5 h-3.5 text-purple-600" />
            <span>Pending QA {tabCounts.active > 0 && `(${tabCounts.active})`}</span>
          </button>
          <button
            onClick={() => onTabChange("COMPLETED")}
            className={cn(
              "px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5",
              reviewTab === "COMPLETED" ? "bg-white text-emerald-700 shadow-xs" : "hover:text-slate-900",
            )}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Approved History</span>
          </button>
          <button
            onClick={() => onTabChange("REJECTED")}
            className={cn(
              "px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5",
              reviewTab === "REJECTED" ? "bg-white text-rose-700 shadow-xs" : "hover:text-slate-900",
            )}
          >
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
            <span>Rejected / Rework</span>
          </button>
          <button
            onClick={() => onTabChange("FROZEN")}
            className={cn(
              "px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5",
              reviewTab === "FROZEN" ? "bg-white text-amber-700 shadow-xs" : "hover:text-slate-900",
            )}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            <span>Frozen / On-Hold {tabCounts.frozen > 0 && `(${tabCounts.frozen})`}</span>
          </button>
          <button
            onClick={() => onTabChange("ALL")}
            className={cn(
              "px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5",
              reviewTab === "ALL" ? "bg-white text-blue-700 shadow-xs" : "hover:text-slate-900",
            )}
          >
            <Paperclip className="w-3.5 h-3.5 text-blue-600" />
            <span>All History</span>
          </button>
        </div>

        <button
          onClick={onRefresh}
          className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition cursor-pointer shrink-0"
          title="Refresh Data"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
