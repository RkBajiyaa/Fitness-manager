import type { ISODate, ISODateTime } from './types';

/** All date maths runs on local-midnight dates so day boundaries match the gym's day. */
export function todayISO(): ISODate {
  return toISO(new Date());
}

export function toISO(d: Date): ISODate {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseISO(s: ISODate): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function addDays(s: ISODate, n: number): ISODate {
  const d = parseISO(s);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

/**
 * Clamps to the last valid day of the target month.
 * Without this, `setMonth` overflows — 29 Aug minus 6 months lands on 1 Mar in a
 * non-leap year, which makes month-stepping skip February and count March twice.
 * Every trend chart steps months through here.
 */
export function addMonths(s: ISODate, n: number): ISODate {
  const d = parseISO(s);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return toISO(d);
}

export function diffDays(from: ISODate, to: ISODate): number {
  const a = parseISO(from).getTime();
  const b = parseISO(to).getTime();
  return Math.round((b - a) / 86_400_000);
}

export function startOfMonth(s: ISODate): ISODate {
  return `${s.slice(0, 7)}-01`;
}

export function endOfMonth(s: ISODate): ISODate {
  const d = parseISO(s);
  return toISO(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

export function monthKey(s: ISODate | ISODateTime): string {
  return s.slice(0, 7);
}

/**
 * The LOCAL calendar day an instant falls on.
 *
 * Slicing the first ten characters off an ISO string returns the UTC day, which
 * is not the day the gym had. In IST (UTC+5:30) a payment taken at 00:30 local
 * carries a UTC date of the previous day, so it silently dropped out of "today's
 * revenue", today's attendance and the new-registration count. The gym's day is
 * a local day, so convert rather than slice.
 */
export function dayOf(s: ISODateTime): ISODate {
  return toISO(new Date(s));
}

export function isBetween(s: ISODate, from: ISODate, to: ISODate): boolean {
  return s >= from && s <= to;
}

/** Inclusive list of ISO dates. */
export function rangeDays(from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = [];
  let cur = from;
  let guard = 0;
  while (cur <= to && guard++ < 2000) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

/** Inclusive list of month keys ('YYYY-MM'). */
export function rangeMonths(from: ISODate, to: ISODate): string[] {
  const out: string[] = [];
  let cur = startOfMonth(from);
  let guard = 0;
  while (cur <= to && guard++ < 200) {
    out.push(monthKey(cur));
    cur = addMonths(cur, 1);
  }
  return out;
}

export function age(dob: ISODate | ''): number | null {
  if (!dob) return null;
  const d = parseISO(dob);
  const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a--;
  return a >= 0 && a < 130 ? a : null;
}
