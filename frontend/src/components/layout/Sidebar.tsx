export function Sidebar() {
  return (
    <aside className="border-r border-slate-200 bg-white p-4">
      <h3 className="mb-4 font-semibold text-slate-900">Navigation</h3>
      <ul className="space-y-2 text-sm text-slate-600">
        <li>Overview</li>
        <li>Applications</li>
        <li>Saved Jobs</li>
        <li>Skills</li>
      </ul>
    </aside>
  );
}
