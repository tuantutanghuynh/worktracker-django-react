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
    <th className={`px-4 py-3 ${className}`}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="flex items-center gap-1 text-xs font-semibold uppercase text-slate-500 hover:text-slate-700"
      >
        {label}
        <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-slate-700' : 'text-slate-400'}`} />
      </button>
    </th>
  );
}
