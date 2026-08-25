import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';

// Clickable <th> bound to a DRF-style ordering string (e.g. "email" /
// "-email") sent straight to the API — sortKey must match one of the
// ViewSet's ordering_fields exactly (including __ lookups like
// "client__client_name" for a related field).
export default function SortableHeader({ label, sortKey, ordering, onSort, className = '' }) {
  const isActive = ordering === sortKey || ordering === `-${sortKey}`;
  const isDesc = ordering === `-${sortKey}`;
  const Icon = isActive ? (isDesc ? ChevronDown : ChevronUp) : ChevronsUpDown;

  return (
    <th className={`px-3 py-2.5 ${className}`}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="flex w-full items-center gap-1 whitespace-nowrap text-[11px] font-semibold uppercase text-slate-500 hover:text-slate-700"
      >
        <span className="truncate">{label}</span>
        <Icon className={`h-3 w-3 shrink-0 ${isActive ? 'text-slate-700' : 'text-slate-400'}`} />
      </button>
    </th>
  );
}
