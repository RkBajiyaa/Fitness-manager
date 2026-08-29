/* ============================================================
   Pure derivations. No I/O, no storage, no React.
   These are the same functions a Postgres-backed API would run
   server-side — §D.4 "if it can drift, derive it".
   ============================================================ */
import type {
  AttendanceEvent, Expense, ExpenseCategory, ISODate, Member, Membership,
  MembershipStatus, Payment, RevenueSource, WorkoutLog, BodyMeasurement,
} from './types';
import { addDays, dayOf, diffDays, monthKey, rangeDays, rangeMonths, todayISO } from './date';

export const EXPIRING_WINDOW_DAYS = 7;

/* ---------------- Membership ---------------- */

export function membershipStatus(
  m: Membership | null | undefined,
  today: ISODate = todayISO(),
  window = EXPIRING_WINDOW_DAYS,
): MembershipStatus {
  if (!m || m.cancelledAt) return 'none';
  const left = diffDays(today, m.endDate);
  if (left < 0) return 'expired';
  if (left <= window) return 'expiring';
  return 'active';
}

export function daysRemaining(m: Membership | null | undefined, today: ISODate = todayISO()): number {
  if (!m) return 0;
  return diffDays(today, m.endDate);
}

/** The membership that governs a member today: latest end date wins. */
export function currentMembership(memberships: Membership[], memberId: string): Membership | null {
  const mine = memberships.filter((m) => m.memberId === memberId && !m.cancelledAt);
  if (!mine.length) return null;
  return mine.reduce((a, b) => (b.endDate > a.endDate ? b : a));
}

export function membershipNet(m: Membership): number {
  return Math.max(0, m.priceSnapshot - m.discount);
}

export interface Dues { billed: number; paid: number; due: number }

export function duesFor(m: Membership | null, payments: Payment[]): Dues {
  if (!m) return { billed: 0, paid: 0, due: 0 };
  const billed = membershipNet(m);
  const paid = payments
    .filter((p) => p.membershipId === m.id)
    .reduce((s, p) => s + p.amount, 0);
  return { billed, paid, due: Math.max(0, billed - paid) };
}

export interface MemberSummary {
  member: Member;
  membership: Membership | null;
  status: MembershipStatus;
  daysLeft: number;
  dues: Dues;
}

export function summarise(
  member: Member,
  memberships: Membership[],
  payments: Payment[],
  today: ISODate = todayISO(),
): MemberSummary {
  const membership = currentMembership(memberships, member.id);
  const mine = payments.filter((p) => p.memberId === member.id);
  return {
    member,
    membership,
    status: membershipStatus(membership, today),
    daysLeft: daysRemaining(membership, today),
    dues: duesFor(membership, mine),
  };
}

/** Every unpaid balance across the gym, largest first. */
export function outstanding(
  members: Member[], memberships: Membership[], payments: Payment[],
): Array<MemberSummary & { overdueDays: number }> {
  const today = todayISO();
  return members
    .map((m) => summarise(m, memberships, payments, today))
    .filter((s) => s.dues.due > 0)
    .map((s) => ({ ...s, overdueDays: s.membership ? Math.max(0, diffDays(s.membership.startDate, today)) : 0 }))
    .sort((a, b) => b.dues.due - a.dues.due);
}

/* ---------------- Attendance ---------------- */

export interface AttendanceSession {
  memberId: string;
  date: ISODate;
  firstIn: string;              // ISODateTime
  lastOut: string | null;       // null ⇒ no check-out recorded
}

/** Collapses the event log into one session per member per day. */
export function sessionsOn(events: AttendanceEvent[], date: ISODate): AttendanceSession[] {
  const byMember = new Map<string, AttendanceEvent[]>();
  for (const e of events) {
    if (dayOf(e.at) !== date) continue;
    const list = byMember.get(e.memberId) ?? [];
    list.push(e);
    byMember.set(e.memberId, list);
  }
  const out: AttendanceSession[] = [];
  byMember.forEach((list, memberId) => {
    const ins = list.filter((e) => e.type === 'check_in').sort((a, b) => a.at.localeCompare(b.at));
    const outs = list.filter((e) => e.type === 'check_out').sort((a, b) => a.at.localeCompare(b.at));
    if (!ins.length) return;
    out.push({
      memberId,
      date,
      firstIn: ins[0].at,
      lastOut: outs.length ? outs[outs.length - 1].at : null,
    });
  });
  return out.sort((a, b) => b.firstIn.localeCompare(a.firstIn));
}

export function attendanceCount(events: AttendanceEvent[], date: ISODate): number {
  return sessionsOn(events, date).length;
}

/**
 * Occupancy ≠ attendance. Only members with a check-in and no later check-out
 * are inside. Returns null when the day has no check-out data at all, so the UI
 * can say "unknown" instead of inventing a number.
 */
export function currentlyInside(events: AttendanceEvent[], date: ISODate): number | null {
  const sessions = sessionsOn(events, date);
  if (!sessions.length) return 0;
  const anyCheckouts = sessions.some((s) => s.lastOut !== null);
  if (!anyCheckouts) return null;
  return sessions.filter((s) => s.lastOut === null).length;
}

export function memberAttendedDays(events: AttendanceEvent[], memberId: string): Set<ISODate> {
  const days = new Set<ISODate>();
  for (const e of events) if (e.memberId === memberId && e.type === 'check_in') days.add(dayOf(e.at));
  return days;
}

export interface AttendanceStats { visits: number; percentage: number; streak: number; best: number }

export function attendanceStats(
  events: AttendanceEvent[], memberId: string, windowDays = 30, today: ISODate = todayISO(),
): AttendanceStats {
  const days = memberAttendedDays(events, memberId);
  const window = rangeDays(addDays(today, -(windowDays - 1)), today);
  const visits = window.filter((d) => days.has(d)).length;

  let streak = 0;
  for (let i = 0; ; i++) {
    const d = addDays(today, -i);
    if (days.has(d)) streak++;
    else if (i > 0 || !days.has(today)) break;
    if (i > 400) break;
  }

  let best = 0, run = 0;
  const sorted = [...days].sort();
  let prev: ISODate | null = null;
  for (const d of sorted) {
    run = prev && diffDays(prev, d) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return { visits, percentage: (visits / windowDays) * 100, streak, best };
}

/* ---------------- Money ---------------- */

export function paymentsBetween(payments: Payment[], from: ISODate, to: ISODate): Payment[] {
  return payments.filter((p) => { const d = dayOf(p.paidAt); return d >= from && d <= to; });
}

export function expensesBetween(expenses: Expense[], from: ISODate, to: ISODate): Expense[] {
  return expenses.filter((e) => e.spentAt >= from && e.spentAt <= to);
}

export function sum<T>(rows: T[], pick: (r: T) => number): number {
  return rows.reduce((s, r) => s + pick(r), 0);
}

export interface ProfitLoss {
  from: ISODate;
  to: ISODate;
  revenueBySource: Array<{ key: RevenueSource; label: string; amount: number }>;
  expenseByCategory: Array<{ key: ExpenseCategory; label: string; amount: number }>;
  totalRevenue: number;
  totalExpenses: number;
  operatingProfit: number;
  margin: number;
}

const SOURCE_LABEL: Record<RevenueSource, string> = {
  membership: 'New memberships',
  renewal: 'Renewals',
  personal_training: 'Personal training',
  other: 'Other services',
};

export const CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  rent: 'Rent', electricity: 'Electricity', internet: 'Internet', salaries: 'Salaries',
  software: 'Software', maintenance: 'Maintenance', equipment: 'Equipment',
  repairs: 'Repairs', cleaning: 'Cleaning', marketing: 'Marketing', other: 'Other',
};

export function profitLoss(
  payments: Payment[], expenses: Expense[], from: ISODate, to: ISODate,
): ProfitLoss {
  const p = paymentsBetween(payments, from, to);
  const e = expensesBetween(expenses, from, to);

  const revenueBySource = (Object.keys(SOURCE_LABEL) as RevenueSource[])
    .map((key) => ({ key, label: SOURCE_LABEL[key], amount: sum(p.filter((x) => x.source === key), (x) => x.amount) }))
    .filter((r) => r.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  const expenseByCategory = (Object.keys(CATEGORY_LABEL) as ExpenseCategory[])
    .map((key) => ({ key, label: CATEGORY_LABEL[key], amount: sum(e.filter((x) => x.category === key), (x) => x.amount) }))
    .filter((r) => r.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  const totalRevenue = sum(p, (x) => x.amount);
  const totalExpenses = sum(e, (x) => x.amount);
  const operatingProfit = totalRevenue - totalExpenses;

  return {
    from, to, revenueBySource, expenseByCategory, totalRevenue, totalExpenses, operatingProfit,
    margin: totalRevenue > 0 ? (operatingProfit / totalRevenue) * 100 : 0,
  };
}

/* ---------------- Series builders ---------------- */

export interface Point { x: string; label: string; y: number }

export function dailySeries(
  from: ISODate, to: ISODate, rows: Array<{ date: ISODate; value: number }>,
): Point[] {
  const acc = new Map<string, number>();
  for (const r of rows) if (r.date >= from && r.date <= to) acc.set(r.date, (acc.get(r.date) ?? 0) + r.value);
  return rangeDays(from, to).map((d) => ({ x: d, label: d, y: acc.get(d) ?? 0 }));
}

export function monthlySeries(
  from: ISODate, to: ISODate, rows: Array<{ date: ISODate; value: number }>,
): Point[] {
  const acc = new Map<string, number>();
  for (const r of rows) {
    if (r.date < from || r.date > to) continue;
    const k = monthKey(r.date);
    acc.set(k, (acc.get(k) ?? 0) + r.value);
  }
  return rangeMonths(from, to).map((k) => ({ x: k, label: k, y: acc.get(k) ?? 0 }));
}

/** Cumulative active-member count at the end of each month. */
export function membershipGrowth(members: Member[], from: ISODate, to: ISODate): Point[] {
  return rangeMonths(from, to).map((k) => ({
    x: k, label: k,
    y: members.filter((m) => monthKey(m.joinedAt) <= k).length,
  }));
}

/* ---------------- Fitness ---------------- */

export function volumeOf(log: WorkoutLog): number {
  return log.sets.reduce((s, x) => s + x.reps * (x.weightKg || 0), 0);
}

export function latestMeasurement(rows: BodyMeasurement[], memberId: string): BodyMeasurement | null {
  const mine = rows.filter((r) => r.memberId === memberId).sort((a, b) => a.takenAt.localeCompare(b.takenAt));
  return mine.length ? mine[mine.length - 1] : null;
}

export function bmi(weightKg?: number, heightCm?: number): number | null {
  if (!weightKg || !heightCm) return null;
  const m = heightCm / 100;
  return weightKg / (m * m);
}

/* ---------------- Dashboard ---------------- */

export interface DashboardKpis {
  totalMembers: number;
  activeMembers: number;
  expiringSoon: number;
  expiredMembers: number;
  attendanceToday: number;
  insideNow: number | null;
  newToday: number;
  renewalsToday: number;
  revenueToday: number;
  expensesToday: number;
  pendingTotal: number;
  pendingCount: number;
  revenueMonth: number;
  expensesMonth: number;
  profitMonth: number;
}

export function dashboardKpis(
  members: Member[], memberships: Membership[], payments: Payment[],
  expenses: Expense[], attendance: AttendanceEvent[], today: ISODate = todayISO(),
): DashboardKpis {
  const summaries = members.map((m) => summarise(m, memberships, payments, today));
  const monthFrom = `${today.slice(0, 7)}-01`;

  const dues = summaries.filter((s) => s.dues.due > 0);
  const createdToday = memberships.filter((m) => dayOf(m.createdAt) === today);
  const revenueMonth = sum(paymentsBetween(payments, monthFrom, today), (p) => p.amount);
  const expensesMonth = sum(expensesBetween(expenses, monthFrom, today), (e) => e.amount);

  return {
    totalMembers: members.length,
    activeMembers: summaries.filter((s) => s.status === 'active' || s.status === 'expiring').length,
    expiringSoon: summaries.filter((s) => s.status === 'expiring').length,
    expiredMembers: summaries.filter((s) => s.status === 'expired' || s.status === 'none').length,
    attendanceToday: attendanceCount(attendance, today),
    insideNow: currentlyInside(attendance, today),
    newToday: createdToday.filter((m) => m.kind === 'new').length,
    renewalsToday: createdToday.filter((m) => m.kind === 'renewal').length,
    revenueToday: sum(paymentsBetween(payments, today, today), (p) => p.amount),
    expensesToday: sum(expensesBetween(expenses, today, today), (e) => e.amount),
    pendingTotal: sum(dues, (s) => s.dues.due),
    pendingCount: dues.length,
    revenueMonth,
    expensesMonth,
    profitMonth: revenueMonth - expensesMonth,
  };
}
