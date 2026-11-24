/**
 * Universal UTC Date & Time Utility for Mobile
 * Fixes the 5:30 hr IST timezone shift by safely normalizing naive ISO strings from MongoDB
 * into full UTC-aware Date objects.
 */

export function parseUtcDate(dateInput: string | Date | number | null | undefined): Date {
  if (!dateInput) return new Date();
  if (dateInput instanceof Date) return dateInput;
  if (typeof dateInput === 'number') return new Date(dateInput);

  let str = String(dateInput).trim();
  if (!str) return new Date();

  // If string contains a time component (has 'T' or ':') but lacks timezone indicator ('Z' or '+/-HH:mm')
  if ((str.includes('T') || str.includes(':')) && !str.endsWith('Z') && !/[+-]\d{2}(:\d{2})?$/.test(str)) {
    str = str.replace(' ', 'T') + 'Z';
  }

  const d = new Date(str);
  return isNaN(d.getTime()) ? new Date() : d;
}

export function formatDateTime(
  dateInput: string | Date | number | null | undefined,
  locale = 'en-IN'
): string {
  if (!dateInput) return '—';
  const d = parseUtcDate(dateInput);
  return d.toLocaleString(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatDate(
  dateInput: string | Date | number | null | undefined,
  locale = 'en-IN'
): string {
  if (!dateInput) return '—';
  const d = parseUtcDate(dateInput);
  return d.toLocaleDateString(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatTime(
  dateInput: string | Date | number | null | undefined,
  locale = 'en-IN'
): string {
  if (!dateInput) return '—';
  const d = parseUtcDate(dateInput);
  return d.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}
