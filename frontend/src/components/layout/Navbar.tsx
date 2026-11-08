export function Navbar() {
  return (
    <header className="border-b border-slate-200 bg-white px-6 py-4">
      <nav className="flex items-center justify-between">
        <div className="font-bold text-slate-900">SkillBridge</div>
        <div className="flex gap-4 text-sm text-slate-600">
          <span>Jobs</span>
          <span>Employers</span>
          <span>AI</span>
        </div>
      </nav>
    </header>
  );
}
