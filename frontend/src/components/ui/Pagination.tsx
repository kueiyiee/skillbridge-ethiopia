export function Pagination({ page, totalPages }: { page: number; totalPages: number }) {
  return (
    <div className="flex items-center gap-2 text-sm text-slate-600">
      <button className="rounded border px-2 py-1">Prev</button>
      <span>
        Page {page} of {totalPages}
      </span>
      <button className="rounded border px-2 py-1">Next</button>
    </div>
  );
}
