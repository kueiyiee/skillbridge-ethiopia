export function LoadingState({ message = 'Loading...' }: { message?: string }) {
  return <div className="rounded-lg bg-slate-100 px-4 py-6 text-sm text-slate-600">{message}</div>;
}
