/** Formatting for display only: the services send exact values (seconds, meters, "9.99"). */

const LOCALE = 'en-GB';

const integer = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });
const kilometers = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateTime = new Intl.DateTimeFormat(LOCALE, { dateStyle: 'medium', timeStyle: 'short' });
const utcDay = new Intl.DateTimeFormat(LOCALE, { dateStyle: 'medium', timeZone: 'UTC' });

/** `45 s`, `32 min 05 s`, `1 h 02 min`. */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = Math.round(seconds % 60);
  if (hours > 0) {
    return `${hours} h ${pad(minutes)} min`;
  }
  if (minutes > 0) {
    return `${minutes} min ${pad(rest)} s`;
  }
  return `${rest} s`;
}

/** `850 m`, `12.35 km`. */
export function formatDistance(meters: number): string {
  return meters < 1000 ? `${integer.format(meters)} m` : `${kilometers.format(meters / 1000)} km`;
}

export function formatCalories(kilocalories: number): string {
  return `${integer.format(kilocalories)} kcal`;
}

export function formatCount(count: number, one: string, many: string): string {
  return `${integer.format(count)} ${count === 1 ? one : many}`;
}

/** Money as Billing sends it: an exact decimal in text, never a float. */
export function formatMoney(amount: string, currency: string): string {
  return new Intl.NumberFormat(LOCALE, { style: 'currency', currency }).format(amount as `${number}`);
}

/** A moment, in the member's time zone. */
export function formatDateTime(iso: string): string {
  return dateTime.format(new Date(iso));
}

/** A UTC calendar day: training periods, goal periods, paid through. */
export function formatUtcDay(iso: string | Date): string {
  return utcDay.format(typeof iso === 'string' ? new Date(iso) : iso);
}

/** `LONGEST_DISTANCE` → `Longest distance`. */
export function humanize(constant: string): string {
  const words = constant.toLowerCase().replaceAll('_', ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}
