export function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat('en-ET', { dateStyle: 'medium' }).format(new Date(date));
}
