import type { ISODate, ISODateTime } from './types';
import { diffDays, parseISO, todayISO } from './date';

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 0,
});
const inrDec = new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2,
});
const num = new Intl.NumberFormat('en-IN');

export function money(n: number, opts?: { decimals?: boolean }): string {
  if (!Number.isFinite(n)) return '₹0';
  return opts?.decimals ? inrDec.format(n) : inr.format(Math.round(n));
}

/** Indian-convention compact form for stat tiles: ₹3.6L, ₹1.24Cr. */
export function moneyCompact(n: number): string {
  const s = n < 0 ? '-' : '';
  const a = Math.abs(n);
  if (a >= 1_00_00_000) return `${s}₹${trim(a / 1_00_00_000)}Cr`;
  if (a >= 1_00_000) return `${s}₹${trim(a / 1_00_000)}L`;
  if (a >= 1_000) return `${s}₹${trim(a / 1_000)}K`;
  return `${s}₹${Math.round(a)}`;
}

function trim(v: number): string {
  return (v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2)).replace(/\.?0+$/, '');
}

export function count(n: number): string {
  return num.format(n);
}

export function pct(n: number, digits = 0): string {
  if (!Number.isFinite(n)) return '—';
  return `${n.toFixed(digits)}%`;
}

export function signed(n: number, fmt: (v: number) => string = count): string {
  return `${n > 0 ? '+' : n < 0 ? '−' : ''}${fmt(Math.abs(n))}`;
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

export function dateShort(s: ISODate | ISODateTime): string {
  if (!s) return '—';
  const d = parseISO(s.slice(0, 10));
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
}

export function dateLong(s: ISODate | ISODateTime): string {
  if (!s) return '—';
  const d = parseISO(s.slice(0, 10));
  return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function dayLabel(s: ISODate): string {
  const d = parseISO(s);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function weekdayShort(s: ISODate): string {
  return DAYS[parseISO(s).getDay()];
}

export function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return `${MONTHS[m - 1]} ${String(y).slice(2)}`;
}

export function time(s: ISODateTime): string {
  if (!s) return '—';
  const d = new Date(s);
  let h = d.getHours();
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${String(d.getMinutes()).padStart(2, '0')} ${ap}`;
}

export function relativeDay(s: ISODate): string {
  const d = diffDays(todayISO(), s);
  if (d === 0) return 'Today';
  if (d === 1) return 'Tomorrow';
  if (d === -1) return 'Yesterday';
  if (d < 0 && d > -7) return `${-d} days ago`;
  if (d > 0 && d < 7) return `in ${d} days`;
  return dateShort(s);
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export function titleCase(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function phoneMask(p: string): string {
  const d = p.replace(/\D/g, '').slice(-10);
  return d.length === 10 ? `${d.slice(0, 5)} ${d.slice(5)}` : p;
}
