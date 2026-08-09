// Prev/next + page number pagination (frontend-design-system.md Mục 3).
export function PaginationBar({ page, totalPages, onPageChange }) {
    const canGoPrev = page > 1
    const canGoNext = page < totalPages

    return (
        <div className="flex items-center space-x-1 text-xs">
            <button
                type="button"
                disabled={!canGoPrev}
                onClick={() => onPageChange(page - 1)}
                className={
                    canGoPrev
                        ? "px-2 py-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-100"
                        : "px-2 py-1 rounded border border-slate-200 text-slate-400 cursor-not-allowed"
                }
            >
                &lt;
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNumber) => (
                <button
                    key={pageNumber}
                    type="button"
                    onClick={() => onPageChange(pageNumber)}
                    className={
                        pageNumber === page
                            ? "px-2.5 py-1 rounded bg-blue-600 text-white font-semibold"
                            : "px-2.5 py-1 rounded border border-slate-200 hover:bg-slate-100"
                    }
                >
                    {pageNumber}
                </button>
            ))}

            <button
                type="button"
                disabled={!canGoNext}
                onClick={() => onPageChange(page + 1)}
                className={
                    canGoNext
                        ? "px-2 py-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-100"
                        : "px-2 py-1 rounded border border-slate-200 text-slate-400 cursor-not-allowed"
                }
            >
                &gt;
            </button>
        </div>
    )
}
