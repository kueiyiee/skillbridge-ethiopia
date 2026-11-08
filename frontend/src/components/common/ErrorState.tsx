export function ErrorState({ message = 'Something went wrong.' }: { message?: string }) {
  return <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-6 text-sm text-red-700">{message}</div>;
}
