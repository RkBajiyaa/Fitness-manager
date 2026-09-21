/* ============================================================
   Pure derivations. No I/O, no storage, no React.
   These are the same functions a Postgres-backed API would run
   server-side — §D.6 "if it can drift, derive it".
   ============================================================ */
import type {
  AttendanceEvent, BodyMeasurement, Exercise, Expense, ExpenseCategory, Goal,
  ISODate, Member, Membership, MembershipStatus, Payment, Program, ProgramDay,
  RevenueSource, SessionSet, WaterLog, WorkoutSession,
} from './types';
import { addDays, dayOf, diffDays, monthKey, rangeDays, rangeMonths, todayISO } from './date';

export const EXPIRING_WINDOW_DAYS = 14;   // premium: a longer, calmer renewal window

/* ============================================================
   Membership
   ============================================================ */

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
  const paid = payments.filter((p) => p.membershipId === m.id).reduce((s, p) => s + p.amount, 0);
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
  return {
    member,
    membership,
    status: membershipStatus(membership, today),
    daysLeft: daysRemaining(membership, today),
    dues: duesFor(membership, payments),
  };
}

export function outstanding(
  members: Member[], memberships: Membership[], payments: Payment[],
): Array<MemberSummary & { overdueDays: number }> {
  const today = todayISO();
  const byMember = groupBy(payments, (p) => p.memberId ?? '');
  const mshByMember = groupBy(memberships, (m) => m.memberId);
  return members
    .map((m) => summarise(m, mshByMember.get(m.id) ?? [], byMember.get(m.id) ?? [], today))
    .filter((s) => s.dues.due > 0)
    .map((s) => ({ ...s, overdueDays: s.membership ? Math.max(0, diffDays(s.membership.startDate, today)) : 0 }))
    .sort((a, b) => b.dues.due - a.dues.due);
}

/* ============================================================
   Attendance
   ============================================================ */

export interface AttendanceSession {
  memberId: string;
  date: ISODate;
  firstIn: string;
  lastOut: string | null;
}

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
      memberId, date, firstIn: ins[0].at,
      lastOut: outs.length ? outs[outs.length - 1].at : null,
    });
  });
  return out.sort((a, b) => b.firstIn.localeCompare(a.firstIn));
}

export function attendanceCount(events: AttendanceEvent[], date: ISODate): number {
  return sessionsOn(events, date).length;
}

/**
 * Occupancy ≠ attendance. Returns null when the day has no check-out data at
 * all, so the UI can say "unknown" instead of inventing a number.
 */
export function currentlyInside(events: AttendanceEvent[], date: ISODate): number | null {
  const sessions = sessionsOn(events, date);
  if (!sessions.length) return 0;
  if (!sessions.some((s) => s.lastOut !== null)) return null;
  return sessions.filter((s) => s.lastOut === null).length;
}

export function checkInDays(events: AttendanceEvent[], memberId?: string): Set<ISODate> {
  const days = new Set<ISODate>();
  for (const e of events) {
    if (e.type !== 'check_in') continue;
    if (memberId && e.memberId !== memberId) continue;
    days.add(dayOf(e.at));
  }
  return days;
}

/* ============================================================
   Streaks — defined explicitly (§D.4)
   ============================================================ */

/**
 * Consecutive days ending today, or ending yesterday so that a rest day taken
 * before you open the app does not appear to wipe the streak.
 */
export function streakFrom(days: Set<ISODate>, today: ISODate = todayISO()): number {
  const start = days.has(today) ? 0 : days.has(addDays(today, -1)) ? 1 : -1;
  if (start === -1) return 0;
  let streak = 0;
  for (let i = start; i < 400; i++) {
    if (!days.has(addDays(today, -i))) break;
    streak++;
  }
  return streak;
}

/**
 * TRAINING STREAK — program-aware (§D.4).
 *
 * Counting only consecutive calendar days with a session would punish the rest
 * days the program itself prescribes, and would cap a five-day-a-week member at
 * a streak of five. That is a worse number AND worse training advice.
 *
 * So a day keeps the streak when the member either trained, or was scheduled to
 * rest. Without a program we tolerate a gap of up to two days, which is what a
 * sane training week looks like. The rule is stated in the UI so the number is
 * never mysterious.
 */
export function trainingStreak(
  sessionDays: Set<ISODate>,
  program: Program | null,
  today: ISODate = todayISO(),
): { current: number; longest: number; trainedToday: boolean; restToday: boolean } {
  const isRestDay = (d: ISODate): boolean => {
    if (program) {
      const day = programDayFor(program, d);
      return day ? day.isRest : false;
    }
    // No program: a day is "kept" if a session happened within the last two days.
    return sessionDays.has(addDays(d, -1)) || sessionDays.has(addDays(d, -2));
  };
  const kept = (d: ISODate) => sessionDays.has(d) || isRestDay(d);

  let current = 0;
  // Today is still open — do not break the streak just because it is 9am.
  const startOffset = kept(today) ? 0 : 1;
  for (let i = startOffset; i < 400; i++) {
    const d = addDays(today, -i);
    if (!kept(d)) break;
    current++;
  }

  // Longest over the recorded history.
  const all = [...sessionDays].sort();
  let longest = 0;
  if (all.length) {
    let run = 0;
    let cursor = all[0];
    const last = all[all.length - 1];
    let guard = 0;
    while (cursor <= last && guard++ < 2000) {
      if (kept(cursor)) { run++; longest = Math.max(longest, run); }
      else run = 0;
      cursor = addDays(cursor, 1);
    }
  }

  return {
    current,
    longest: Math.max(longest, current),
    trainedToday: sessionDays.has(today),
    restToday: !sessionDays.has(today) && isRestDay(today),
  };
}

export function longestStreak(days: Set<ISODate>): number {
  const sorted = [...days].sort();
  let best = 0, run = 0;
  let prev: ISODate | null = null;
  for (const d of sorted) {
    run = prev && diffDays(prev, d) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

export interface StreakSummary {
  current: number;
  longest: number;
  activeToday: boolean;
  /** True when the streak is alive but today has not been logged yet. */
  pendingToday: boolean;
}

export function streakSummary(days: Set<ISODate>, today: ISODate = todayISO()): StreakSummary {
  const current = streakFrom(days, today);
  return {
    current,
    longest: longestStreak(days),
    activeToday: days.has(today),
    pendingToday: current > 0 && !days.has(today),
  };
}

export interface AttendanceStats { visits: number; percentage: number; streak: number; best: number }

export function attendanceStats(
  events: AttendanceEvent[], memberId: string, windowDays = 30, today: ISODate = todayISO(),
): AttendanceStats {
  const days = checkInDays(events, memberId);
  return statsFromDays(days, windowDays, today);
}

export function statsFromDays(
  days: Set<ISODate>, windowDays = 30, today: ISODate = todayISO(),
): AttendanceStats {
  const window = rangeDays(addDays(today, -(windowDays - 1)), today);
  const visits = window.filter((d) => days.has(d)).length;
  return {
    visits,
    percentage: (visits / windowDays) * 100,
    streak: streakFrom(days, today),
    best: longestStreak(days),
  };
}

/** Weeks (Mon–Sun) in which the member hit their session target. */
export function weeklyConsistency(
  sessionDays: Set<ISODate>, weeks: number, target: number, today: ISODate = todayISO(),
): { hit: number; weeks: number; series: Array<{ weekStart: ISODate; count: number; hit: boolean }> } {
  const series: Array<{ weekStart: ISODate; count: number; hit: boolean }> = [];
  const dow = new Date(today + 'T00:00:00').getDay();
  const mondayOffset = (dow + 6) % 7;
  const thisMonday = addDays(today, -mondayOffset);

  for (let w = weeks - 1; w >= 0; w--) {
    const weekStart = addDays(thisMonday, -7 * w);
    const count = rangeDays(weekStart, addDays(weekStart, 6))
      .filter((d) => d <= today && sessionDays.has(d)).length;
    series.push({ weekStart, count, hit: count >= target });
  }
  return { hit: series.filter((s) => s.hit).length, weeks, series };
}

/* ============================================================
   Training — volume, records, progression
   ============================================================ */

/** Warm-ups and incomplete sets never count toward volume or records. */
export function countableSets(sets: SessionSet[]): SessionSet[] {
  return sets.filter((s) => s.completed && s.kind !== 'warmup');
}

export function sessionVolume(session: WorkoutSession): number {
  return countableSets(session.sets).reduce((s, x) => s + x.reps * (x.weightKg || 0), 0);
}

export function sessionExerciseCount(session: WorkoutSession): number {
  return new Set(session.sets.map((s) => s.exerciseId)).size;
}

/** Epley. Only meaningful in the low-rep range, so we cap it. */
export function estimated1RM(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0 || reps > 12) return 0;
  return weightKg * (1 + reps / 30);
}

export interface ExerciseRecord {
  exerciseId: string;
  heaviestKg: number;
  heaviestAt: ISODate | null;
  bestReps: number;
  bestRepsWeightKg: number;
  best1RM: number;
  best1RMAt: ISODate | null;
  bestSessionVolume: number;
  totalSets: number;
  lastPerformedAt: ISODate | null;
}

export function recordsByExercise(sessions: WorkoutSession[]): Map<string, ExerciseRecord> {
  const out = new Map<string, ExerciseRecord>();
  const volumePerSession = new Map<string, number>();   // `${sessionId}|${exerciseId}`

  const ordered = [...sessions].sort((a, b) => a.date.localeCompare(b.date));
  for (const session of ordered) {
    for (const set of countableSets(session.sets)) {
      const rec = out.get(set.exerciseId) ?? {
        exerciseId: set.exerciseId, heaviestKg: 0, heaviestAt: null,
        bestReps: 0, bestRepsWeightKg: 0, best1RM: 0, best1RMAt: null,
        bestSessionVolume: 0, totalSets: 0, lastPerformedAt: null,
      };
      rec.totalSets++;
      rec.lastPerformedAt = session.date;

      if (set.weightKg > rec.heaviestKg) {
        rec.heaviestKg = set.weightKg;
        rec.heaviestAt = session.date;
        rec.bestRepsWeightKg = set.weightKg;
        rec.bestReps = set.reps;
      } else if (set.weightKg === rec.heaviestKg && set.reps > rec.bestReps) {
        rec.bestReps = set.reps;
      }

      const e1rm = estimated1RM(set.weightKg, set.reps);
      if (e1rm > rec.best1RM) {
        rec.best1RM = e1rm;
        rec.best1RMAt = session.date;
      }

      const key = `${session.id}|${set.exerciseId}`;
      volumePerSession.set(key, (volumePerSession.get(key) ?? 0) + set.reps * (set.weightKg || 0));
      rec.bestSessionVolume = Math.max(rec.bestSessionVolume, volumePerSession.get(key)!);

      out.set(set.exerciseId, rec);
    }
  }
  return out;
}

export type PRType = 'heaviest' | 'e1rm' | 'reps' | 'volume';

export interface PRAchievement {
  exerciseId: string;
  type: PRType;
  value: number;
  previous: number;
  unit: string;
}

/**
 * PRs earned by `session`, measured against everything that came before it.
 * This is why records are never stored: edit or delete a session and the
 * answer simply recomputes.
 */
export function newRecordsIn(session: WorkoutSession, history: WorkoutSession[]): PRAchievement[] {
  const earlier = history.filter((s) => s.id !== session.id && s.date <= session.date);
  const before = recordsByExercise(earlier);
  const after = recordsByExercise([...earlier, session]);
  const out: PRAchievement[] = [];

  for (const [exerciseId, now] of after) {
    const prev = before.get(exerciseId);
    const touched = countableSets(session.sets).some((s) => s.exerciseId === exerciseId);
    if (!touched) continue;

    if (!prev) {
      if (now.heaviestKg > 0) {
        out.push({ exerciseId, type: 'heaviest', value: now.heaviestKg, previous: 0, unit: 'kg' });
      }
      continue;
    }
    if (now.heaviestKg > prev.heaviestKg) {
      out.push({ exerciseId, type: 'heaviest', value: now.heaviestKg, previous: prev.heaviestKg, unit: 'kg' });
    } else if (now.best1RM > prev.best1RM + 0.01) {
      out.push({ exerciseId, type: 'e1rm', value: now.best1RM, previous: prev.best1RM, unit: 'kg' });
    } else if (now.bestSessionVolume > prev.bestSessionVolume) {
      out.push({ exerciseId, type: 'volume', value: now.bestSessionVolume, previous: prev.bestSessionVolume, unit: 'kg' });
    }
  }
  return out;
}

/** Best estimated 1RM per session date — the strength progression chart. */
export function strengthSeries(sessions: WorkoutSession[], exerciseId: string): Point[] {
  const byDate = new Map<ISODate, number>();
  for (const session of sessions) {
    let best = 0;
    for (const set of countableSets(session.sets)) {
      if (set.exerciseId !== exerciseId) continue;
      best = Math.max(best, estimated1RM(set.weightKg, set.reps));
    }
    if (best > 0) byDate.set(session.date, Math.max(byDate.get(session.date) ?? 0, best));
  }
  return [...byDate.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, value]) => ({ x: date, label: date, y: Math.round(value * 10) / 10 }));
}

/** The most recent completed performance of an exercise — used to pre-fill sets. */
export function lastPerformance(
  sessions: WorkoutSession[], exerciseId: string, excludeSessionId?: string,
): { weightKg: number; reps: number; date: ISODate } | null {
  const ordered = [...sessions].sort((a, b) => b.date.localeCompare(a.date));
  for (const session of ordered) {
    if (session.id === excludeSessionId) continue;
    const sets = countableSets(session.sets).filter((s) => s.exerciseId === exerciseId);
    if (!sets.length) continue;
    const best = sets.reduce((a, b) => (b.weightKg > a.weightKg ? b : a));
    return { weightKg: best.weightKg, reps: best.reps, date: session.date };
  }
  return null;
}

/**
 * Every countable set of one exercise, from the last session that
 * contained it.
 *
 * `lastPerformance()` above answers "what was the best set?" and is
 * what prefill uses. This answers "what did the whole thing look
 * like?", which is what the member actually wants to see in the
 * player — three sets at 60/60/57.5 tells them something that
 * "60 kg × 8" does not.
 */
export interface PreviousPerformance {
  date: ISODate;
  sets: Array<{ reps: number; weightKg: number }>;
  bestWeightKg: number;
  bestReps: number;
  /** Working volume of that exercise on that day. */
  volume: number;
}

export function lastExercisePerformance(
  sessions: WorkoutSession[], exerciseId: string, excludeSessionId?: string,
): PreviousPerformance | null {
  const ordered = [...sessions].sort((a, b) => b.date.localeCompare(a.date));
  for (const session of ordered) {
    if (session.id === excludeSessionId) continue;
    const sets = countableSets(session.sets)
      .filter((s) => s.exerciseId === exerciseId)
      .sort((a, b) => a.setNo - b.setNo);
    if (!sets.length) continue;
    const best = sets.reduce((a, b) => (b.weightKg > a.weightKg ? b : a));
    return {
      date: session.date,
      sets: sets.map((s) => ({ reps: s.reps, weightKg: s.weightKg })),
      bestWeightKg: best.weightKg,
      bestReps: best.reps,
      volume: sets.reduce((sum, s) => sum + s.reps * (s.weightKg || 0), 0),
    };
  }
  return null;
}

/**
 * A restrained progression nudge (§18).
 *
 * Fires only when the member cleared the TOP of the prescribed rep
 * range on every working set last time, at or above the prescribed
 * load. That is a deliberately high bar: a hint that appears after
 * one good set is noise, and noise gets ignored, and then the one
 * time it matters it gets ignored too.
 *
 * It suggests. It never changes a number, and it makes no claim
 * about what the member's body can do — "consider" is the whole
 * vocabulary.
 */
export interface ProgressionHint {
  tone: 'ready';
  message: string;
}

export function progressionHint(
  prescribed: { reps: number; repsMax: number; targetWeightKg: number },
  previous: PreviousPerformance | null,
): ProgressionHint | null {
  if (!previous || !previous.sets.length) return null;
  // No prescribed range means nothing to top out of.
  if (!prescribed.repsMax || prescribed.repsMax <= prescribed.reps) return null;

  const allTopped = previous.sets.every((s) => s.reps >= prescribed.repsMax);
  if (!allTopped) return null;

  // Bodyweight and machine work where no target was set: still worth
  // saying, but without implying a plate.
  const loaded = prescribed.targetWeightKg > 0 && previous.bestWeightKg > 0;
  if (loaded && previous.bestWeightKg < prescribed.targetWeightKg) return null;

  return {
    tone: 'ready',
    message: loaded
      ? `You hit ${prescribed.repsMax} reps on every set last time. Consider a small increase.`
      : `You hit ${prescribed.repsMax} reps on every set last time. Consider making it harder.`,
  };
}

/* ============================================================
   Programs
   ============================================================ */

/**
 * An honest estimate of how long a planned day takes, in minutes.
 *
 * Uses the plan's own figure when it has one. Otherwise it is
 * COMPUTED — roughly 45 seconds of work per set plus the prescribed
 * rest, plus a minute and a half per warm-up movement — rather than
 * guessed. Returns 0 when there is nothing to estimate, and the UI
 * then says nothing at all instead of printing "0 min", which is the
 * same rule `currentlyInside()` follows for occupancy.
 */
export function estimateDayMinutes(day: ProgramDay): number {
  if (day.estimatedMin > 0) return day.estimatedMin;
  if (!day.exercises.length && !day.warmupExerciseIds.length) return 0;
  const working = day.exercises.reduce(
    (sum, e) => sum + Math.max(1, e.sets) * (45 + (e.restSec || 60)), 0);
  const warmup = day.warmupExerciseIds.length * 90;
  return Math.max(1, Math.round((working + warmup) / 60));
}

/**
 * Which day of the plan today is.
 *
 * A `weekly` plan repeats the same seven days, so the answer is the
 * day of the week. A `numbered` plan (the 30-day beginner
 * foundation) counts forward from `startedAt` — day 1 on the day
 * they enrolled, day 30 twenty-nine days later, and nothing after
 * that. Both are DERIVED; storing "which day am I on" drifts the
 * first time somebody misses a Tuesday.
 *
 * `schedule` is read defensively because programs seeded before it
 * existed do not carry one, and they are all weekly.
 */
export function programDayFor(program: Program | null, date: ISODate): ProgramDay | null {
  if (!program) return null;

  if (program.schedule === 'numbered') {
    if (!program.startedAt) return null;
    const dayNo = diffDays(program.startedAt, date) + 1;
    if (dayNo < 1) return null;
    return program.days.find((d) => d.dayNo === dayNo) ?? null;
  }

  const dow = new Date(date + 'T00:00:00').getDay();
  return program.days.find((d) => d.dayIndex === dow) ?? null;
}

/** Share of assigned (non-rest) program days actually trained in the window. */
export function adherence(
  program: Program | null, sessionDays: Set<ISODate>, windowDays = 14, today: ISODate = todayISO(),
): { expected: number; completed: number; ratio: number } {
  if (!program) return { expected: 0, completed: 0, ratio: 1 };
  const window = rangeDays(addDays(today, -(windowDays - 1)), today);
  let expected = 0, completed = 0;
  for (const d of window) {
    const day = programDayFor(program, d);
    if (!day || day.isRest) continue;
    expected++;
    if (sessionDays.has(d)) completed++;
  }
  return { expected, completed, ratio: expected ? completed / expected : 1 };
}

/* ============================================================
   Hydration
   ============================================================ */

export function waterTotal(logs: WaterLog[], date: ISODate): number {
  return logs.filter((l) => l.date === date).reduce((s, l) => s + l.ml, 0);
}

export function waterSeries(logs: WaterLog[], from: ISODate, to: ISODate): Point[] {
  const acc = new Map<ISODate, number>();
  for (const l of logs) {
    if (l.date < from || l.date > to) continue;
    acc.set(l.date, (acc.get(l.date) ?? 0) + l.ml);
  }
  return rangeDays(from, to).map((d) => ({ x: d, label: d, y: acc.get(d) ?? 0 }));
}

/* ============================================================
   Goals
   ============================================================ */

export interface GoalProgress {
  goal: Goal;
  current: number;
  target: number;
  ratio: number;
  achieved: boolean;
}

export function goalProgress(
  goal: Goal,
  ctx: { latestWeight?: number; startWeight?: number; records: Map<string, ExerciseRecord>; monthSessions: number },
): GoalProgress {
  let current = 0;
  let ratio = 0;

  if (goal.kind === 'weight') {
    const start = ctx.startWeight ?? ctx.latestWeight ?? goal.targetValue;
    current = ctx.latestWeight ?? start;
    const span = Math.abs(start - goal.targetValue);
    const moved = Math.abs(start - current);
    ratio = span === 0 ? 1 : Math.min(1, moved / span);
  } else if (goal.kind === 'strength' && goal.exerciseId) {
    current = ctx.records.get(goal.exerciseId)?.heaviestKg ?? 0;
    ratio = goal.targetValue ? Math.min(1, current / goal.targetValue) : 0;
  } else if (goal.kind === 'attendance') {
    current = ctx.monthSessions;
    ratio = goal.targetValue ? Math.min(1, current / goal.targetValue) : 0;
  }

  return {
    goal, current, target: goal.targetValue,
    ratio,
    achieved: Boolean(goal.achievedAt) || ratio >= 1,
  };
}

/* ============================================================
   Engagement & needs-attention (§D.5) — owner-side only
   ============================================================ */

export type EngagementLevel = 'healthy' | 'watch' | 'attention';

export interface EngagementSignal {
  code: 'lapsed' | 'frequency_drop' | 'new_member_risk' | 'expiring' | 'payment_due' | 'adherence' | 'no_program';
  weight: number;
  reason: string;
}

export interface Engagement {
  memberId: string;
  score: number;
  level: EngagementLevel;
  signals: EngagementSignal[];
  daysSinceVisit: number | null;
  baselinePerWeek: number;
  recentPerWeek: number;
  dropRatio: number;
  visits30: number;
}

export interface EngagementInput {
  member: Member;
  checkIns: Set<ISODate>;
  sessionDays: Set<ISODate>;
  program: Program | null;
  membership: Membership | null;
  daysLeft: number;
  due: number;
}

/**
 * Research is unambiguous: a member's attendance frequency relative to their
 * OWN baseline predicts churn far better than any absolute threshold, and the
 * first ~90 days carry the most risk. So we score relatively.
 */
export function engagementFor(input: EngagementInput, today: ISODate = todayISO()): Engagement {
  const { member, checkIns, sessionDays, program, membership, daysLeft, due } = input;

  let daysSinceVisit: number | null = null;
  for (let i = 0; i <= 120; i++) {
    if (checkIns.has(addDays(today, -i))) { daysSinceVisit = i; break; }
  }

  const countBetween = (fromDaysAgo: number, toDaysAgo: number) =>
    rangeDays(addDays(today, -fromDaysAgo), addDays(today, -toDaysAgo)).filter((d) => checkIns.has(d)).length;

  const baselineDays = 49;                                  // days 8–56 back
  const baselineVisits = countBetween(56, 8);
  const baselinePerWeek = (baselineVisits / baselineDays) * 7;
  const recentVisits = countBetween(13, 0);
  const recentPerWeek = (recentVisits / 14) * 7;
  const dropRatio = baselinePerWeek >= 1 ? Math.max(0, (baselinePerWeek - recentPerWeek) / baselinePerWeek) : 0;

  const tenure = diffDays(member.joinedAt, today);
  const visits30 = countBetween(29, 0);
  const signals: EngagementSignal[] = [];

  if (daysSinceVisit === null || daysSinceVisit >= 10) {
    signals.push({
      code: 'lapsed', weight: 40,
      reason: daysSinceVisit === null
        ? 'No recorded visit in the last four months'
        : `No visit in ${daysSinceVisit} days`,
    });
  }
  if (dropRatio >= 0.5 && baselinePerWeek >= 1.5) {
    signals.push({
      code: 'frequency_drop', weight: 35,
      reason: `Training dropped from ${baselinePerWeek.toFixed(1)} to ${recentPerWeek.toFixed(1)} visits a week`
        + ` (down ${Math.round(dropRatio * 100)}% on their own baseline)`,
    });
  }
  if (tenure < 90 && recentPerWeek < 1) {
    signals.push({
      code: 'new_member_risk', weight: 25,
      reason: `Joined ${tenure} days ago and is training less than once a week`,
    });
  }
  if (membership && daysLeft >= 0 && daysLeft <= EXPIRING_WINDOW_DAYS) {
    signals.push({
      code: 'expiring', weight: 20,
      reason: `Membership ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`,
    });
  }
  if (due > 0) {
    signals.push({ code: 'payment_due', weight: 20, reason: `Outstanding balance of ₹${due.toLocaleString('en-IN')}` });
  }
  const adh = adherence(program, sessionDays, 14, today);
  if (program && adh.expected >= 3 && adh.ratio < 0.5) {
    signals.push({
      code: 'adherence', weight: 15,
      reason: `Completed ${adh.completed} of ${adh.expected} planned sessions in the last two weeks`,
    });
  }
  if (!program && membership && daysLeft >= 0) {
    signals.push({ code: 'no_program', weight: 10, reason: 'No training program assigned' });
  }

  const score = signals.reduce((s, x) => s + x.weight, 0);
  const level: EngagementLevel = score >= 55 ? 'attention' : score >= 30 ? 'watch' : 'healthy';

  return {
    memberId: member.id, score, level, signals, daysSinceVisit,
    baselinePerWeek, recentPerWeek, dropRatio, visits30,
  };
}

/* ============================================================
   Money
   ============================================================ */

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

/* ============================================================
   Series builders
   ============================================================ */

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

/* ============================================================
   Body
   ============================================================ */

export function latestMeasurement(rows: BodyMeasurement[], memberId: string): BodyMeasurement | null {
  const mine = rows.filter((r) => r.memberId === memberId).sort((a, b) => a.takenAt.localeCompare(b.takenAt));
  return mine.length ? mine[mine.length - 1] : null;
}

export function bmi(weightKg?: number, heightCm?: number): number | null {
  if (!weightKg || !heightCm) return null;
  const m = heightCm / 100;
  return weightKg / (m * m);
}

export function bmiBand(value: number): { label: string; tone: 'good' | 'warning' | 'critical' | 'neutral' } {
  if (value < 18.5) return { label: 'Underweight', tone: 'warning' };
  if (value < 25) return { label: 'Healthy range', tone: 'good' };
  if (value < 30) return { label: 'Overweight', tone: 'warning' };
  return { label: 'Obese', tone: 'critical' };
}

/* ============================================================
   Dashboard
   ============================================================ */

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
  sessionsToday: number;
  sessionsWeek: number;
  needsAttention: number;
  watching: number;
}

export function dashboardKpis(args: {
  members: Member[];
  memberships: Membership[];
  payments: Payment[];
  expenses: Expense[];
  attendance: AttendanceEvent[];
  sessions: WorkoutSession[];
  engagement: Engagement[];
  today?: ISODate;
}): DashboardKpis {
  const today = args.today ?? todayISO();
  const monthFrom = `${today.slice(0, 7)}-01`;
  const paysByMember = groupBy(args.payments, (p) => p.memberId ?? '');
  const mshByMember = groupBy(args.memberships, (m) => m.memberId);

  const summaries = args.members.map((m) =>
    summarise(m, mshByMember.get(m.id) ?? [], paysByMember.get(m.id) ?? [], today));

  const dues = summaries.filter((s) => s.dues.due > 0);
  const createdToday = args.memberships.filter((m) => dayOf(m.createdAt) === today);
  const revenueMonth = sum(paymentsBetween(args.payments, monthFrom, today), (p) => p.amount);
  const expensesMonth = sum(expensesBetween(args.expenses, monthFrom, today), (e) => e.amount);
  const weekAgo = addDays(today, -6);

  return {
    totalMembers: args.members.length,
    activeMembers: summaries.filter((s) => s.status === 'active' || s.status === 'expiring').length,
    expiringSoon: summaries.filter((s) => s.status === 'expiring').length,
    expiredMembers: summaries.filter((s) => s.status === 'expired' || s.status === 'none').length,
    attendanceToday: attendanceCount(args.attendance, today),
    insideNow: currentlyInside(args.attendance, today),
    newToday: createdToday.filter((m) => m.kind === 'new').length,
    renewalsToday: createdToday.filter((m) => m.kind === 'renewal').length,
    revenueToday: sum(paymentsBetween(args.payments, today, today), (p) => p.amount),
    expensesToday: sum(expensesBetween(args.expenses, today, today), (e) => e.amount),
    pendingTotal: sum(dues, (s) => s.dues.due),
    pendingCount: dues.length,
    revenueMonth,
    expensesMonth,
    profitMonth: revenueMonth - expensesMonth,
    sessionsToday: args.sessions.filter((s) => s.date === today && s.status === 'completed').length,
    sessionsWeek: args.sessions.filter((s) => s.date >= weekAgo && s.status === 'completed').length,
    needsAttention: args.engagement.filter((e) => e.level === 'attention').length,
    watching: args.engagement.filter((e) => e.level === 'watch').length,
  };
}

/* ============================================================
   Utility
   ============================================================ */

export function groupBy<T, K>(rows: T[], key: (row: T) => K): Map<K, T[]> {
  const out = new Map<K, T[]>();
  for (const row of rows) {
    const k = key(row);
    const list = out.get(k);
    if (list) list.push(row);
    else out.set(k, [row]);
  }
  return out;
}

export function exerciseName(exercises: Exercise[], id: string): string {
  return exercises.find((e) => e.id === id)?.name ?? 'Exercise';
}
