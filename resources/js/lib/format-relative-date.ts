import type { Locale } from '@/lib/translate';

const units: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31536000],
  ['month', 2592000],
  ['day', 86400],
  ['hour', 3600],
  ['minute', 60],
  ['second', 1],
];

export function formatRelativeDate(timestamp: number, locale: Locale, now = Date.now()): string {
  if (!Number.isFinite(timestamp) || !Number.isFinite(now)) return '—';
  const seconds = (timestamp - now) / 1000;
  const [unit, divisor] = units.find(([, length]) => Math.abs(seconds) >= length) ?? units[units.length - 1];
  return new Intl.RelativeTimeFormat(locale, { numeric: 'always' }).format(Math.round(seconds / divisor), unit);
}
