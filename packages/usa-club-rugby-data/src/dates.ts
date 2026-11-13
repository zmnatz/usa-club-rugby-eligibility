// Dates rendered during the static build must read the same after hydration, so
// they use a fixed locale and time zone rather than the visitor's.

/** A day, e.g. "Nov 7, 2026", from a UTC timestamp. */
export function formatDate(dateTime: string): string {
  return new Date(dateTime).toLocaleDateString('en-US', { timeZone: 'UTC' });
}

/** A day and time, e.g. "Nov 7, 2026, 9:56 PM UTC", from a UTC timestamp. */
export function formatDateTime(dateTime: string): string {
  return `${new Date(dateTime).toLocaleString('en-US', {
    timeZone: 'UTC',
    dateStyle: 'medium',
    timeStyle: 'short',
  })} UTC`;
}
