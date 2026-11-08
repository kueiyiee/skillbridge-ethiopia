export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function formatCurrency(value: number, currency = 'ETB') {
  return `${new Intl.NumberFormat('en-ET', { style: 'currency', currency }).format(value)}`;
}
