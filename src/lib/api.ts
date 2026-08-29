/* ============================================================
   THE SEAM (docs/ARCHITECTURE.md §A.2 / §F).
   Every screen calls this module; no screen touches db.ts or
   localStorage directly. Signatures, filters, pagination and
   errors already match the REST contract — migrating means
   replacing these bodies with fetch().

   Reads are synchronous (the data is local). Writes are async so
   every mutation exercises a real pending state.
   ============================================================ */
import type {
  Announcement, AttendanceEvent, BodyMeasurement, DietPlan, Difficulty, Exercise,
  ExerciseKind, ExerciseScope, Expense, ExpenseCategory, FitnessProfile, Gender,
  Goal, GoalKind, ISODate, Member, Membership, MembershipPlan, MembershipStatus,
  Message, MessageChannel, MessageKind, Note, Page, Payment, PaymentMethod,
  Program, ProgramDay, RevenueSource, SessionSet, SetKind, Session,
  WorkoutSession,
} from './types';
import {
  audit, commit, getDb, memo, newId, NotFound, requireOwner, requireOwnership, tenant,
} from './db';
import {
  adherence, attendanceStats, checkInDays, currentMembership, dashboardKpis, dailySeries,
  duesFor, engagementFor, goalProgress, groupBy, lastPerformance, latestMeasurement,
  membershipNet, membershipStatus, monthlySeries, newRecordsIn, outstanding, profitLoss,
  programDayFor, recordsByExercise, sessionsOn, sessionVolume, statsFromDays, strengthSeries,
  streakSummary, summarise, sum, trainingStreak, waterSeries, waterTotal, weeklyConsistency,
  type DashboardKpis, type Engagement, type ExerciseRecord, type GoalProgress,
  type MemberSummary, type PRAchievement, type Point, type ProfitLoss, type StreakSummary,
} from './derive';
import { addDays, addMonths, dayOf, monthKey, startOfMonth, todayISO } from './date';
import { compose, providerFor, type TemplateContext } from './integrations/messaging';

const WRITE_LATENCY = 140;

export class ValidationError extends Error {
  code = 'validation_error' as const;
  fields: Record<string, string>;
  constructor(fields: Record<string, string>, message = 'Please correct the highlighted fields.') {
    super(message);
    this.fields = fields;
  }
}

function write<T>(fn: () => T): Promise<T> {
  return new Promise((resolve, reject) => {
    window.setTimeout(() => {
      try { resolve(fn()); } catch (e) { reject(e); }
    }, WRITE_LATENCY);
  });
}

function paginate<T>(rows: T[], page = 1, limit = 25): Page<T> {
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const p = Math.min(Math.max(1, page), totalPages);
  return { data: rows.slice((p - 1) * limit, p * limit), meta: { page: p, limit, total, totalPages } };
}

const norm = (s: string) => s.toLowerCase().trim();
const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}`;

/* ============================================================
   Gym
   ============================================================ */
export const gyms = {
  current(session: Session) {
    const gym = getDb().gyms.find((g) => g.id === session.gymId);
    if (!gym) throw new NotFound('Gym not found.');
    return gym;
  },
};

export const announcements = {
  list(session: Session): Announcement[] {
    return tenant(getDb().announcements, session)
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  },
};

/* ============================================================
   Membership plans
   ============================================================ */
export const plans = {
  list(session: Session): MembershipPlan[] {
    return tenant(getDb().plans, session).sort((a, b) => a.durationDays - b.durationDays);
  },
  get(session: Session, id: string): MembershipPlan {
    const p = plans.list(session).find((x) => x.id === id);
    if (!p) throw new NotFound('Plan not found.');
    return p;
  },
  create(session: Session, input: { name: string; durationDays: number; price: number; description?: string }) {
    requireOwner(session);
    const fields: Record<string, string> = {};
    if (!input.name?.trim()) fields.name = 'Give the plan a name.';
    if (!(input.durationDays > 0)) fields.durationDays = 'Duration must be at least 1 day.';
    if (!(input.price >= 0)) fields.price = 'Price cannot be negative.';
    if (Object.keys(fields).length) throw new ValidationError(fields);

    return write(() => {
      const plan: MembershipPlan = {
        id: newId('plan'), gymId: session.gymId, name: input.name.trim(),
        durationDays: Math.round(input.durationDays), price: Math.round(input.price),
        isActive: true, description: input.description?.trim() ?? '',
      };
      commit((db) => { db.plans.push(plan); audit(db, session, 'create', 'MembershipPlan', plan.id); });
      return plan;
    });
  },
  update(session: Session, id: string, patch: Partial<MembershipPlan>) {
    requireOwner(session);
    return write(() => {
      let updated!: MembershipPlan;
      commit((db) => {
        const p = db.plans.find((x) => x.id === id && x.gymId === session.gymId);
        if (!p) throw new NotFound('Plan not found.');
        Object.assign(p, {
          name: patch.name ?? p.name,
          durationDays: patch.durationDays ?? p.durationDays,
          price: patch.price ?? p.price,
          description: patch.description ?? p.description,
          isActive: patch.isActive ?? p.isActive,
        });
        audit(db, session, 'update', 'MembershipPlan', p.id);
        updated = p;
      });
      return updated;
    });
  },
};

/* ============================================================
   Members
   ============================================================ */
export type MemberSort = 'name' | 'joinedAt' | 'expiry' | 'due' | 'engagement';

export interface MemberListParams {
  q?: string;
  status?: MembershipStatus | 'all';
  planId?: string;
  hasDue?: boolean;
  attention?: boolean;
  sort?: MemberSort;
  order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface MemberInput {
  name: string; phone: string; email?: string; dob?: string; gender?: Gender;
  address?: string; photoUrl?: string;
  emergencyName?: string; emergencyPhone?: string; emergencyRelation?: string;
}

export interface MemberRow extends MemberSummary {
  engagement: Engagement;
}

function validateMember(input: MemberInput, existing: Member[], selfId?: string): void {
  const fields: Record<string, string> = {};
  if (!input.name?.trim()) fields.name = 'Full name is required.';
  else if (input.name.trim().length < 2) fields.name = 'Name looks too short.';

  const digits = (input.phone ?? '').replace(/\D/g, '');
  if (!digits) fields.phone = 'Phone number is required.';
  else if (digits.length < 10) fields.phone = 'Enter a 10-digit phone number.';
  else if (existing.some((m) => m.id !== selfId && m.phone.replace(/\D/g, '').slice(-10) === digits.slice(-10))) {
    fields.phone = 'Another member already uses this number.';
  }
  if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) fields.email = 'That email address is not valid.';
  if (input.dob && input.dob > todayISO()) fields.dob = 'Date of birth cannot be in the future.';
  if (Object.keys(fields).length) throw new ValidationError(fields);
}

function nextMemberCode(rows: Member[]): string {
  const nums = rows.map((m) => Number(m.memberCode.split('-')[1])).filter((n) => Number.isFinite(n));
  return `ATL-${(nums.length ? Math.max(...nums) : 1000) + 1}`;
}

const defaultFitness = (): FitnessProfile => ({
  goal: 'general_fitness', experience: 'beginner', preferredDays: [1, 3, 5],
  waterTargetMl: 3000, weeklySessionTarget: 3, notes: '',
});

export const members = {
  /** Every member row, joined with its engagement score. Cached per revision. */
  rows(session: Session): MemberRow[] {
    requireOwner(session);
    return memo(`members.rows:${session.gymId}`, () => {
      const db = getDb();
      const today = todayISO();
      const roster = tenant(db.members, session);
      const msh = groupBy(tenant(db.memberships, session), (m) => m.memberId);
      const pays = groupBy(tenant(db.payments, session), (p) => p.memberId ?? '');
      const checkIns = groupBy(
        tenant(db.attendance, session).filter((a) => a.type === 'check_in'),
        (a) => a.memberId);
      const sessionsBy = groupBy(
        tenant(db.sessions, session).filter((s) => s.status === 'completed'),
        (s) => s.memberId);
      const programBy = new Map(
        tenant(db.programs, session).filter((p) => p.memberId).map((p) => [p.memberId!, p]));

      return roster.map((member) => {
        const summary = summarise(member, msh.get(member.id) ?? [], pays.get(member.id) ?? [], today);
        const inDays = new Set((checkIns.get(member.id) ?? []).map((a) => dayOf(a.at)));
        const sessionDays = new Set((sessionsBy.get(member.id) ?? []).map((s) => s.date));
        const engagement = engagementFor({
          member,
          checkIns: inDays,
          sessionDays,
          program: programBy.get(member.id) ?? null,
          membership: summary.membership,
          daysLeft: summary.daysLeft,
          due: summary.dues.due,
        }, today);
        return { ...summary, engagement };
      });
    });
  },

  list(session: Session, params: MemberListParams = {}): Page<MemberRow> {
    let rows = members.rows(session);

    const q = norm(params.q ?? '');
    if (q) {
      const qDigits = q.replace(/\D/g, '');
      rows = rows.filter((r) =>
        norm(r.member.name).includes(q) ||
        norm(r.member.memberCode).includes(q) ||
        norm(r.member.email).includes(q) ||
        (qDigits.length >= 3 && r.member.phone.replace(/\D/g, '').includes(qDigits)));
    }
    if (params.status && params.status !== 'all') {
      rows = params.status === 'expired'
        ? rows.filter((r) => r.status === 'expired' || r.status === 'none')
        : rows.filter((r) => r.status === params.status);
    }
    if (params.planId) rows = rows.filter((r) => r.membership?.planId === params.planId);
    if (params.hasDue) rows = rows.filter((r) => r.dues.due > 0);
    if (params.attention) rows = rows.filter((r) => r.engagement.level !== 'healthy');

    const dir = params.order === 'desc' ? -1 : 1;
    const sort = params.sort ?? 'name';
    rows = [...rows].sort((a, b) => {
      switch (sort) {
        case 'joinedAt': return dir * a.member.joinedAt.localeCompare(b.member.joinedAt);
        case 'expiry': return dir * (a.membership?.endDate ?? '').localeCompare(b.membership?.endDate ?? '');
        case 'due': return dir * (a.dues.due - b.dues.due);
        case 'engagement': return dir * (a.engagement.score - b.engagement.score);
        default: return dir * a.member.name.localeCompare(b.member.name);
      }
    });
    return paginate(rows, params.page, params.limit);
  },

  counts(session: Session) {
    const rows = members.rows(session);
    return {
      all: rows.length,
      active: rows.filter((r) => r.status === 'active').length,
      expiring: rows.filter((r) => r.status === 'expiring').length,
      expired: rows.filter((r) => r.status === 'expired' || r.status === 'none').length,
      withDues: rows.filter((r) => r.dues.due > 0).length,
      attention: rows.filter((r) => r.engagement.level === 'attention').length,
      watch: rows.filter((r) => r.engagement.level === 'watch').length,
    };
  },

  get(session: Session, id: string): MemberSummary {
    requireOwnership(session, id);
    const db = getDb();
    const member = tenant(db.members, session).find((m) => m.id === id);
    if (!member) throw new NotFound('Member not found.');
    return summarise(
      member,
      tenant(db.memberships, session).filter((m) => m.memberId === id),
      tenant(db.payments, session).filter((p) => p.memberId === id),
    );
  },

  register(session: Session, input: MemberInput & {
    planId: string; startDate: ISODate; discount: number;
    amountPaid: number; method: PaymentMethod;
  }) {
    requireOwner(session);
    const db = getDb();
    validateMember(input, tenant(db.members, session));

    const plan = plans.get(session, input.planId);
    const fields: Record<string, string> = {};
    if (!input.startDate) fields.startDate = 'Choose a start date.';
    const net = Math.max(0, plan.price - (input.discount || 0));
    if (input.discount < 0) fields.discount = 'Discount cannot be negative.';
    if (input.discount > plan.price) fields.discount = 'Discount cannot exceed the plan price.';
    if (input.amountPaid < 0) fields.amountPaid = 'Amount cannot be negative.';
    if (input.amountPaid > net) fields.amountPaid = `Amount cannot exceed the payable ${rupees(net)}.`;
    if (Object.keys(fields).length) throw new ValidationError(fields);

    return write(() => {
      const now = new Date().toISOString();
      const member: Member = {
        id: newId('mem'), gymId: session.gymId,
        memberCode: nextMemberCode(tenant(db.members, session)),
        name: input.name.trim(), phone: input.phone.trim(), email: input.email?.trim() ?? '',
        dob: input.dob ?? '', gender: input.gender ?? 'male', address: input.address?.trim() ?? '',
        emergencyContact: {
          name: input.emergencyName?.trim() ?? '',
          phone: input.emergencyPhone?.trim() ?? '',
          relation: input.emergencyRelation ?? '',
        },
        photoUrl: input.photoUrl ?? '', joinedAt: todayISO(), lifecycle: 'active',
        fitness: defaultFitness(),
      };
      const membership: Membership = {
        id: newId('msh'), gymId: session.gymId, memberId: member.id, planId: plan.id,
        planNameSnapshot: plan.name, priceSnapshot: plan.price, discount: input.discount || 0,
        startDate: input.startDate, endDate: addDays(input.startDate, plan.durationDays - 1),
        kind: 'new', createdAt: now, cancelledAt: null,
      };
      commit((db2) => {
        db2.members.push(member);
        db2.memberships.push(membership);
        if (input.amountPaid > 0) {
          db2.payments.push({
            id: newId('pay'), gymId: session.gymId, memberId: member.id, membershipId: membership.id,
            amount: Math.round(input.amountPaid), method: input.method, source: 'membership',
            paidAt: now, receiptNo: `FM-${db2.payments.length + 1001}`,
            note: input.amountPaid < net ? 'Part payment at joining' : '',
          });
        }
        audit(db2, session, 'create', 'Member', member.id, { plan: plan.name });
      });
      return member;
    });
  },

  update(session: Session, id: string, patch: MemberInput) {
    requireOwner(session);
    const db = getDb();
    validateMember(patch, tenant(db.members, session), id);
    return write(() => {
      let updated!: Member;
      commit((db2) => {
        const m = db2.members.find((x) => x.id === id && x.gymId === session.gymId);
        if (!m) throw new NotFound('Member not found.');
        m.name = patch.name.trim();
        m.phone = patch.phone.trim();
        m.email = patch.email?.trim() ?? m.email;
        m.dob = patch.dob ?? m.dob;
        m.gender = patch.gender ?? m.gender;
        m.address = patch.address?.trim() ?? m.address;
        m.emergencyContact = {
          name: patch.emergencyName?.trim() ?? m.emergencyContact.name,
          phone: patch.emergencyPhone?.trim() ?? m.emergencyContact.phone,
          relation: patch.emergencyRelation ?? m.emergencyContact.relation,
        };
        audit(db2, session, 'update', 'Member', m.id);
        updated = m;
      });
      return updated;
    });
  },

  /** Member-editable. Membership and money remain owner-controlled. */
  updateFitness(session: Session, memberId: string, patch: Partial<FitnessProfile>) {
    requireOwnership(session, memberId);
    const fields: Record<string, string> = {};
    if (patch.heightCm != null && (patch.heightCm < 90 || patch.heightCm > 250)) {
      fields.heightCm = 'Enter a height between 90 and 250 cm.';
    }
    if (patch.targetWeightKg != null && (patch.targetWeightKg < 25 || patch.targetWeightKg > 300)) {
      fields.targetWeightKg = 'Enter a target between 25 and 300 kg.';
    }
    if (patch.waterTargetMl != null && (patch.waterTargetMl < 500 || patch.waterTargetMl > 8000)) {
      fields.waterTargetMl = 'Enter a target between 500 and 8000 ml.';
    }
    if (patch.weeklySessionTarget != null && (patch.weeklySessionTarget < 1 || patch.weeklySessionTarget > 14)) {
      fields.weeklySessionTarget = 'Enter between 1 and 14 sessions a week.';
    }
    if (Object.keys(fields).length) throw new ValidationError(fields);

    return write(() => {
      let updated!: FitnessProfile;
      commit((db) => {
        const m = db.members.find((x) => x.id === memberId && x.gymId === session.gymId);
        if (!m) throw new NotFound('Member not found.');
        m.fitness = { ...m.fitness, ...patch };
        audit(db, session, 'update', 'FitnessProfile', m.id);
        updated = m.fitness;
      });
      return updated;
    });
  },

  remove(session: Session, id: string) {
    requireOwner(session);
    return write(() => {
      commit((db) => {
        const m = db.members.find((x) => x.id === id && x.gymId === session.gymId);
        if (!m) throw new NotFound('Member not found.');
        db.members = db.members.filter((x) => x.id !== id);
        db.memberships = db.memberships.filter((x) => x.memberId !== id);
        db.attendance = db.attendance.filter((x) => x.memberId !== id);
        db.sessions = db.sessions.filter((x) => x.memberId !== id);
        db.measurements = db.measurements.filter((x) => x.memberId !== id);
        db.goals = db.goals.filter((x) => x.memberId !== id);
        db.water = db.water.filter((x) => x.memberId !== id);
        db.mealCompletions = db.mealCompletions.filter((x) => x.memberId !== id);
        db.notes = db.notes.filter((x) => x.memberId !== id);
        db.messages = db.messages.filter((x) => x.memberId !== id);
        db.programs = db.programs.filter((x) => x.memberId !== id);
        db.dietPlans = db.dietPlans.filter((x) => x.memberId !== id);
        db.exercises = db.exercises.filter((x) => !(x.scope === 'member' && x.ownerId === id));
        // Payments are NOT deleted: the money moved. They are detached instead,
        // so historical revenue and every past report stay reproducible.
        db.payments.forEach((p) => { if (p.memberId === id) p.memberId = null; });
        audit(db, session, 'delete', 'Member', id, { name: m.name });
      });
    });
  },

  notes(session: Session, memberId: string): Note[] {
    requireOwner(session);
    return tenant(getDb().notes, session)
      .filter((n) => n.memberId === memberId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  addNote(session: Session, memberId: string, body: string) {
    requireOwner(session);
    if (!body.trim()) throw new ValidationError({ body: 'Write something first.' });
    return write(() => {
      const note: Note = {
        id: newId('note'), gymId: session.gymId, memberId, authorRole: session.role,
        authorName: session.name, body: body.trim(), createdAt: new Date().toISOString(),
      };
      commit((db) => { db.notes.push(note); audit(db, session, 'create', 'Note', note.id); });
      return note;
    });
  },
};

/* ============================================================
   Engagement (owner only)
   ============================================================ */
export const engagement = {
  queue(session: Session): MemberRow[] {
    requireOwner(session);
    return members.rows(session)
      .filter((r) => r.engagement.level !== 'healthy')
      .sort((a, b) => b.engagement.score - a.engagement.score);
  },
  forMember(session: Session, memberId: string): Engagement | null {
    requireOwner(session);
    return members.rows(session).find((r) => r.member.id === memberId)?.engagement ?? null;
  },
  /** Positive signals worth telling the owner about. */
  highlights(session: Session, limit = 4) {
    requireOwner(session);
    return memo(`engagement.highlights:${session.gymId}`, () => {
      const db = getDb();
      const today = todayISO();
      const exercises = db.exercises;
      const out: Array<{ memberId: string; memberName: string; text: string; kind: 'streak' | 'pr' | 'consistency' }> = [];
      const sessionsBy = groupBy(
        tenant(db.sessions, session).filter((s) => s.status === 'completed'), (s) => s.memberId);

      for (const member of tenant(db.members, session)) {
        const mine = sessionsBy.get(member.id) ?? [];
        if (!mine.length) continue;
        const days = new Set(mine.map((s) => s.date));
        const program = tenant(db.programs, session).find((p) => p.memberId === member.id) ?? null;
        const streak = trainingStreak(days, program, today);
        if (streak.current >= 10) {
          out.push({
            memberId: member.id, memberName: member.name, kind: 'streak',
            text: `${streak.current}-day training streak`,
          });
        }
        const recent = mine.filter((s) => s.date >= addDays(today, -30));
        if (recent.length) {
          const latest = recent.reduce((a, b) => (b.date > a.date ? b : a));
          const prs = newRecordsIn(latest, mine);
          const best = prs.find((p) => p.type === 'heaviest' && p.previous > 0);
          if (best) {
            const name = exercises.find((e) => e.id === best.exerciseId)?.name ?? 'a lift';
            out.push({
              memberId: member.id, memberName: member.name, kind: 'pr',
              text: `New ${name} record — ${best.value} kg (up ${(best.value - best.previous).toFixed(1)} kg)`,
            });
          }
        }
      }
      return out.slice(0, limit);
    }).slice(0, limit);
  },
};

/* ============================================================
   Memberships
   ============================================================ */
export const memberships = {
  forMember(session: Session, memberId: string): Membership[] {
    requireOwnership(session, memberId);
    return tenant(getDb().memberships, session)
      .filter((m) => m.memberId === memberId)
      .sort((a, b) => b.startDate.localeCompare(a.startDate));
  },

  current(session: Session, memberId: string): Membership | null {
    requireOwnership(session, memberId);
    return currentMembership(tenant(getDb().memberships, session), memberId);
  },

  list(session: Session, filter: { status?: MembershipStatus | 'all'; days?: number } = {}) {
    requireOwner(session);
    const rows = members.rows(session).filter((r) => r.membership !== null);
    if (!filter.status || filter.status === 'all') return rows;
    if (filter.status === 'expiring' && filter.days) {
      return rows.filter((r) => r.daysLeft >= 0 && r.daysLeft <= filter.days!);
    }
    return rows.filter((r) => r.status === filter.status);
  },

  create(session: Session, memberId: string, input: {
    planId: string; startDate?: ISODate; discount?: number;
    amountPaid?: number; method?: PaymentMethod; kind?: 'new' | 'renewal';
  }) {
    requireOwner(session);
    const db = getDb();
    const member = tenant(db.members, session).find((m) => m.id === memberId);
    if (!member) throw new NotFound('Member not found.');
    const plan = plans.get(session, input.planId);

    const existing = currentMembership(tenant(db.memberships, session), memberId);
    const kind = input.kind ?? (existing ? 'renewal' : 'new');
    const start = input.startDate
      ?? (existing && existing.endDate >= todayISO() ? addDays(existing.endDate, 1) : todayISO());

    const discount = input.discount ?? 0;
    const net = Math.max(0, plan.price - discount);
    const paid = input.amountPaid ?? net;
    const fields: Record<string, string> = {};
    if (discount < 0 || discount > plan.price) fields.discount = 'Discount must be between 0 and the plan price.';
    if (paid < 0 || paid > net) fields.amountPaid = `Amount must be between 0 and ${rupees(net)}.`;
    if (Object.keys(fields).length) throw new ValidationError(fields);

    return write(() => {
      const now = new Date().toISOString();
      const membership: Membership = {
        id: newId('msh'), gymId: session.gymId, memberId, planId: plan.id,
        planNameSnapshot: plan.name, priceSnapshot: plan.price, discount,
        startDate: start, endDate: addDays(start, plan.durationDays - 1),
        kind, createdAt: now, cancelledAt: null,
      };
      commit((db2) => {
        db2.memberships.push(membership);
        if (paid > 0) {
          db2.payments.push({
            id: newId('pay'), gymId: session.gymId, memberId, membershipId: membership.id,
            amount: Math.round(paid), method: input.method ?? 'upi',
            source: kind === 'renewal' ? 'renewal' : 'membership',
            paidAt: now, receiptNo: `FM-${db2.payments.length + 1001}`,
            note: paid < net ? 'Part payment' : '',
          });
        }
        audit(db2, session, kind === 'renewal' ? 'renew' : 'create', 'Membership', membership.id);
      });
      return membership;
    });
  },
};

/* ============================================================
   Payments
   ============================================================ */
export interface PaymentFilter {
  from?: ISODate; to?: ISODate; method?: PaymentMethod | 'all';
  source?: RevenueSource | 'all'; memberId?: string; q?: string;
  page?: number; limit?: number;
}

export const payments = {
  list(session: Session, f: PaymentFilter = {}): Page<Payment & { memberName: string }> {
    requireOwner(session);
    const db = getDb();
    const names = new Map(tenant(db.members, session).map((m) => [m.id, m.name]));
    let rows = tenant(db.payments, session);
    if (f.from) rows = rows.filter((p) => dayOf(p.paidAt) >= f.from!);
    if (f.to) rows = rows.filter((p) => dayOf(p.paidAt) <= f.to!);
    if (f.method && f.method !== 'all') rows = rows.filter((p) => p.method === f.method);
    if (f.source && f.source !== 'all') rows = rows.filter((p) => p.source === f.source);
    if (f.memberId) rows = rows.filter((p) => p.memberId === f.memberId);
    const q = norm(f.q ?? '');
    if (q) {
      rows = rows.filter((p) =>
        norm(names.get(p.memberId ?? '') ?? '').includes(q) || norm(p.receiptNo).includes(q));
    }
    const decorated = rows.slice()
      .sort((a, b) => b.paidAt.localeCompare(a.paidAt))
      .map((p) => ({ ...p, memberName: names.get(p.memberId ?? '') ?? 'Removed member' }));
    return paginate(decorated, f.page, f.limit);
  },

  forMember(session: Session, memberId: string): Payment[] {
    requireOwnership(session, memberId);
    return tenant(getDb().payments, session)
      .filter((p) => p.memberId === memberId)
      .sort((a, b) => b.paidAt.localeCompare(a.paidAt));
  },

  outstanding(session: Session) {
    requireOwner(session);
    const db = getDb();
    return outstanding(tenant(db.members, session), tenant(db.memberships, session), tenant(db.payments, session));
  },

  create(session: Session, input: {
    memberId: string | null; membershipId?: string | null; amount: number;
    method: PaymentMethod; source?: RevenueSource; note?: string;
  }) {
    requireOwner(session);
    const db = getDb();
    const fields: Record<string, string> = {};
    if (!(input.amount > 0)) fields.amount = 'Enter an amount greater than zero.';

    let membershipId = input.membershipId ?? null;
    let source: RevenueSource = input.source ?? 'other';

    if (input.memberId) {
      const member = tenant(db.members, session).find((m) => m.id === input.memberId);
      if (!member) throw new NotFound('Member not found.');
      if (!membershipId && !input.source) {
        const cur = currentMembership(tenant(db.memberships, session), input.memberId);
        if (cur) {
          const d = duesFor(cur, tenant(db.payments, session).filter((p) => p.memberId === input.memberId));
          if (d.due > 0) {
            membershipId = cur.id;
            source = cur.kind === 'renewal' ? 'renewal' : 'membership';
            if (input.amount > d.due) {
              fields.amount = `Balance due is ${rupees(d.due)}. Record anything extra as a separate service payment.`;
            }
          }
        }
      }
    }
    if (Object.keys(fields).length) throw new ValidationError(fields);

    return write(() => {
      const payment: Payment = {
        id: newId('pay'), gymId: session.gymId, memberId: input.memberId,
        membershipId, amount: Math.round(input.amount), method: input.method,
        source, paidAt: new Date().toISOString(),
        receiptNo: `FM-${getDb().payments.length + 1001}`, note: input.note?.trim() ?? '',
      };
      commit((db2) => { db2.payments.push(payment); audit(db2, session, 'create', 'Payment', payment.id); });
      return payment;
    });
  },
};

/* ============================================================
   Attendance
   ============================================================ */
export const attendance = {
  onDate(session: Session, date: ISODate) {
    requireOwner(session);
    const db = getDb();
    const byId = new Map(tenant(db.members, session).map((m) => [m.id, m]));
    return sessionsOn(tenant(db.attendance, session), date)
      .map((s) => ({ ...s, member: byId.get(s.memberId) }))
      .filter((s): s is typeof s & { member: Member } => Boolean(s.member));
  },

  forMember(session: Session, memberId: string): AttendanceEvent[] {
    requireOwnership(session, memberId);
    return tenant(getDb().attendance, session)
      .filter((a) => a.memberId === memberId)
      .sort((a, b) => b.at.localeCompare(a.at));
  },

  stats(session: Session, memberId: string, windowDays = 30) {
    requireOwnership(session, memberId);
    return attendanceStats(tenant(getDb().attendance, session), memberId, windowDays);
  },

  days(session: Session, memberId: string): Set<ISODate> {
    requireOwnership(session, memberId);
    return checkInDays(tenant(getDb().attendance, session), memberId);
  },

  trend(session: Session, from: ISODate, to: ISODate): Point[] {
    const db = getDb();
    const events = tenant(db.attendance, session).filter((e) => e.type === 'check_in');
    const seen = new Set<string>();
    const rows: Array<{ date: ISODate; value: number }> = [];
    for (const e of events) {
      const d = dayOf(e.at);
      const key = `${d}|${e.memberId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({ date: d, value: 1 });
    }
    return dailySeries(from, to, rows);
  },

  mark(session: Session, memberId: string, type: 'check_in' | 'check_out') {
    const db = getDb();
    const member = tenant(db.members, session).find((m) => m.id === memberId);
    if (!member) throw new NotFound('Member not found.');
    requireOwnership(session, memberId);
    return write(() => {
      const event: AttendanceEvent = {
        id: newId('att'), gymId: session.gymId, memberId, type,
        at: new Date().toISOString(), source: 'manual',
      };
      commit((db2) => { db2.attendance.push(event); audit(db2, session, type, 'AttendanceEvent', event.id); });
      return event;
    });
  },

  /** Device integration is architected, not implemented — see §L. */
  devices() {
    return [{
      id: 'dev_primary', label: 'Main entrance reader', kind: 'biometric' as const,
      status: 'not_connected' as const, lastSeen: null as string | null,
    }];
  },
};

/* ============================================================
   Exercise library — global + gym + own custom
   ============================================================ */
export interface ExerciseFilter {
  q?: string; muscleGroup?: string; equipment?: string;
  scope?: ExerciseScope | 'all'; kind?: ExerciseKind | 'all';
}

export const exercises = {
  /** What this session is allowed to see, merged and de-duplicated. */
  visible(session: Session): Exercise[] {
    const db = getDb();
    return db.exercises.filter((e) =>
      e.scope === 'global'
      || (e.scope === 'gym' && e.ownerId === session.gymId)
      || (e.scope === 'member' && (
        session.role === 'member' ? e.ownerId === session.memberId : isGymMember(session, e.ownerId)
      )));
  },

  list(session: Session, f: ExerciseFilter = {}): Exercise[] {
    let rows = exercises.visible(session);
    const q = norm(f.q ?? '');
    if (q) {
      rows = rows.filter((e) =>
        norm(e.name).includes(q) || norm(e.muscleGroup).includes(q)
        || norm(e.equipment).includes(q) || e.tags.some((t) => norm(t).includes(q)));
    }
    if (f.muscleGroup && f.muscleGroup !== 'all') rows = rows.filter((e) => e.muscleGroup === f.muscleGroup);
    if (f.equipment && f.equipment !== 'all') rows = rows.filter((e) => e.equipment === f.equipment);
    if (f.scope && f.scope !== 'all') rows = rows.filter((e) => e.scope === f.scope);
    if (f.kind && f.kind !== 'all') rows = rows.filter((e) => e.kind === f.kind);
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  },

  get(session: Session, id: string): Exercise {
    const e = exercises.visible(session).find((x) => x.id === id);
    if (!e) throw new NotFound('Exercise not found.');
    return e;
  },

  facets(session: Session) {
    const rows = exercises.visible(session);
    return {
      muscleGroups: [...new Set(rows.map((e) => e.muscleGroup))].sort(),
      equipment: [...new Set(rows.map((e) => e.equipment))].sort(),
    };
  },

  /**
   * Scope is DERIVED FROM THE SESSION, never taken from the request body —
   * a member cannot write into the gym or global library.
   */
  create(session: Session, input: {
    name: string; muscleGroup: string; equipment: string;
    kind?: ExerciseKind; difficulty?: Difficulty; instructions?: string;
  }) {
    const fields: Record<string, string> = {};
    if (!input.name?.trim()) fields.name = 'Give the exercise a name.';
    if (!input.muscleGroup?.trim()) fields.muscleGroup = 'Choose a muscle group.';
    const existing = exercises.visible(session)
      .some((e) => norm(e.name) === norm(input.name ?? ''));
    if (existing) fields.name = 'You already have an exercise with that name.';
    if (Object.keys(fields).length) throw new ValidationError(fields);

    const scope: ExerciseScope = session.role === 'member' ? 'member' : 'gym';
    const ownerId = session.role === 'member' ? session.memberId : session.gymId;
    if (!ownerId) throw new NotFound('Not found.');

    return write(() => {
      const kind = input.kind ?? 'strength';
      const equipment = input.equipment?.trim() || 'Other';
      const exercise: Exercise = {
        id: newId('ex'), scope, ownerId,
        name: input.name.trim(), muscleGroup: input.muscleGroup.trim(),
        secondaryMuscles: [], equipment, kind,
        difficulty: input.difficulty ?? 'intermediate',
        instructions: input.instructions?.trim() ?? '',
        tags: ['custom'],
        tracks: kind === 'cardio' ? ['duration', 'distance']
          : equipment === 'Bodyweight' ? ['reps'] : ['weight', 'reps'],
      };
      commit((db) => { db.exercises.push(exercise); audit(db, session, 'create', 'Exercise', exercise.id); });
      return exercise;
    });
  },

  remove(session: Session, id: string) {
    return write(() => {
      commit((db) => {
        const e = db.exercises.find((x) => x.id === id);
        if (!e) throw new NotFound('Exercise not found.');
        const ownsIt = session.role === 'member'
          ? e.scope === 'member' && e.ownerId === session.memberId
          : e.scope === 'gym' && e.ownerId === session.gymId;
        if (!ownsIt) throw new NotFound('Exercise not found.');
        db.exercises = db.exercises.filter((x) => x.id !== id);
        audit(db, session, 'delete', 'Exercise', id);
      });
    });
  },

  name(id: string): string {
    return getDb().exercises.find((e) => e.id === id)?.name ?? 'Exercise';
  },
};

function isGymMember(session: Session, memberId: string | null): boolean {
  if (!memberId) return false;
  return getDb().members.some((m) => m.id === memberId && m.gymId === session.gymId);
}

/* ============================================================
   Programs
   ============================================================ */
export const programs = {
  templates(session: Session): Program[] {
    return tenant(getDb().programs, session).filter((p) => p.isTemplate);
  },

  forMember(session: Session, memberId: string): Program | null {
    requireOwnership(session, memberId);
    return tenant(getDb().programs, session).find((p) => p.memberId === memberId) ?? null;
  },

  today(session: Session, memberId: string, date: ISODate = todayISO()): ProgramDay | null {
    return programDayFor(programs.forMember(session, memberId), date);
  },

  assign(session: Session, memberId: string, templateId: string) {
    requireOwner(session);
    return write(() => {
      let assigned!: Program;
      commit((db) => {
        const tpl = db.programs.find((p) => p.id === templateId && p.gymId === session.gymId);
        if (!tpl) throw new NotFound('Program not found.');
        db.programs = db.programs.filter((p) => p.memberId !== memberId);
        const programId = newId('prg');
        assigned = {
          ...tpl, id: programId, isTemplate: false, memberId,
          startedAt: todayISO(), createdAt: new Date().toISOString(),
          days: tpl.days.map((d) => {
            const dayId = newId('pday');
            return { ...d, id: dayId, programId, exercises: d.exercises.map((e) => ({ ...e, id: newId('pex'), dayId })) };
          }),
        };
        db.programs.push(assigned);
        audit(db, session, 'assign', 'Program', assigned.id, { memberId });
      });
      return assigned;
    });
  },

  unassign(session: Session, memberId: string) {
    requireOwner(session);
    return write(() => {
      commit((db) => {
        db.programs = db.programs.filter((p) => !(p.memberId === memberId && p.gymId === session.gymId));
        audit(db, session, 'unassign', 'Program', memberId);
      });
    });
  },

  /** Members may reorder / retarget their own assigned program day. */
  updateDay(session: Session, dayId: string, patch: {
    exercises?: Array<{ exerciseId: string; sets: number; reps: number; targetWeightKg: number; restSec: number; notes?: string }>;
    title?: string;
  }) {
    return write(() => {
      let updated!: ProgramDay;
      commit((db) => {
        const program = db.programs.find((p) => p.days.some((d) => d.id === dayId));
        if (!program || program.gymId !== session.gymId) throw new NotFound('Workout not found.');
        if (session.role === 'member' && program.memberId !== session.memberId) {
          throw new NotFound('Workout not found.');
        }
        const day = program.days.find((d) => d.id === dayId)!;
        if (patch.title) day.title = patch.title;
        if (patch.exercises) {
          day.exercises = patch.exercises.map((e, i) => ({
            id: newId('pex'), dayId, exerciseId: e.exerciseId, order: i,
            sets: e.sets, reps: e.reps, targetWeightKg: e.targetWeightKg,
            restSec: e.restSec, notes: e.notes ?? '',
          }));
          day.isRest = day.exercises.length === 0;
        }
        audit(db, session, 'update', 'ProgramDay', dayId);
        updated = day;
      });
      return updated;
    });
  },
};

/* ============================================================
   Workout sessions — the live training loop
   ============================================================ */
export interface SessionSummary {
  session: WorkoutSession;
  volume: number;
  exercises: number;
  workingSets: number;
  records: PRAchievement[];
  previousVolume: number | null;
}

export const sessions = {
  forMember(session: Session, memberId: string, limit?: number): WorkoutSession[] {
    requireOwnership(session, memberId);
    const rows = tenant(getDb().sessions, session)
      .filter((s) => s.memberId === memberId)
      .sort((a, b) => b.date.localeCompare(a.date) || b.startedAt.localeCompare(a.startedAt));
    return limit ? rows.slice(0, limit) : rows;
  },

  completed(session: Session, memberId: string): WorkoutSession[] {
    return sessions.forMember(session, memberId).filter((s) => s.status === 'completed');
  },

  get(session: Session, id: string): WorkoutSession {
    const row = tenant(getDb().sessions, session).find((s) => s.id === id);
    if (!row) throw new NotFound('Session not found.');
    requireOwnership(session, row.memberId);
    return row;
  },

  /** An in-progress session survives a refresh — that is why status is stored. */
  active(session: Session, memberId: string): WorkoutSession | null {
    requireOwnership(session, memberId);
    return tenant(getDb().sessions, session)
      .find((s) => s.memberId === memberId && s.status === 'active') ?? null;
  },

  onDate(session: Session, memberId: string, date: ISODate): WorkoutSession | null {
    requireOwnership(session, memberId);
    return tenant(getDb().sessions, session)
      .find((s) => s.memberId === memberId && s.date === date && s.status === 'completed') ?? null;
  },

  start(session: Session, memberId: string, input: { programDayId?: string | null; title?: string } = {}) {
    requireOwnership(session, memberId);
    return write(() => {
      let started!: WorkoutSession;
      commit((db) => {
        const existing = db.sessions.find(
          (s) => s.memberId === memberId && s.status === 'active' && s.gymId === session.gymId);
        if (existing) { started = existing; return; }

        const program = db.programs.find((p) => p.memberId === memberId && p.gymId === session.gymId);
        const day = input.programDayId
          ? program?.days.find((d) => d.id === input.programDayId)
          : programDayFor(program ?? null, todayISO());

        const sessionId = newId('ses');
        const now = new Date().toISOString();
        const sets: SessionSet[] = (day?.exercises ?? []).flatMap((pe, order) =>
          Array.from({ length: Math.max(1, pe.sets) }, (_, i) => ({
            id: newId('sst'), sessionId, exerciseId: pe.exerciseId, order,
            setNo: i + 1, kind: 'normal' as SetKind,
            reps: pe.reps, weightKg: pe.targetWeightKg,
            durationSec: 0, distanceKm: 0, rpe: null,
            completed: false,
          })));

        started = {
          id: sessionId, gymId: session.gymId, memberId, date: todayISO(),
          startedAt: now, finishedAt: null,
          programDayId: day?.id ?? null,
          title: input.title ?? day?.title ?? 'Training session',
          durationSec: 0, notes: '', status: 'active', sets,
        };
        db.sessions.unshift(started);
        audit(db, session, 'start', 'WorkoutSession', started.id);
      });
      return started;
    });
  },

  /** Pre-fill: what this member last did on this exercise. */
  lastPerformance(session: Session, memberId: string, exerciseId: string, excludeSessionId?: string) {
    requireOwnership(session, memberId);
    return lastPerformance(sessions.completed(session, memberId), exerciseId, excludeSessionId);
  },

  addSet(session: Session, sessionId: string, input: {
    exerciseId: string; reps?: number; weightKg?: number;
    durationSec?: number; distanceKm?: number; kind?: SetKind; rpe?: number | null;
  }) {
    return write(() => {
      let created!: SessionSet;
      commit((db) => {
        const row = db.sessions.find((s) => s.id === sessionId && s.gymId === session.gymId);
        if (!row) throw new NotFound('Session not found.');
        if (session.role === 'member' && row.memberId !== session.memberId) throw new NotFound('Session not found.');

        const sameExercise = row.sets.filter((s) => s.exerciseId === input.exerciseId);
        const order = sameExercise.length
          ? sameExercise[0].order
          : (row.sets.reduce((m, s) => Math.max(m, s.order), -1) + 1);

        created = {
          id: newId('sst'), sessionId, exerciseId: input.exerciseId, order,
          setNo: sameExercise.filter((s) => s.kind !== 'warmup').length + 1,
          kind: input.kind ?? 'normal',
          reps: Math.max(0, input.reps ?? 0),
          weightKg: Math.max(0, input.weightKg ?? 0),
          durationSec: Math.max(0, input.durationSec ?? 0),
          distanceKm: Math.max(0, input.distanceKm ?? 0),
          rpe: input.rpe ?? null,
          completed: true,
        };
        row.sets.push(created);
        audit(db, session, 'log_set', 'WorkoutSession', sessionId);
      });
      return created;
    });
  },

  updateSet(session: Session, sessionId: string, setId: string, patch: Partial<SessionSet>) {
    return write(() => {
      commit((db) => {
        const row = db.sessions.find((s) => s.id === sessionId && s.gymId === session.gymId);
        if (!row) throw new NotFound('Session not found.');
        if (session.role === 'member' && row.memberId !== session.memberId) throw new NotFound('Session not found.');
        const set = row.sets.find((s) => s.id === setId);
        if (!set) throw new NotFound('Set not found.');
        if (patch.reps != null) set.reps = Math.max(0, patch.reps);
        if (patch.weightKg != null) set.weightKg = Math.max(0, patch.weightKg);
        if (patch.durationSec != null) set.durationSec = Math.max(0, patch.durationSec);
        if (patch.distanceKm != null) set.distanceKm = Math.max(0, patch.distanceKm);
        if (patch.kind != null) set.kind = patch.kind;
        if (patch.rpe !== undefined) set.rpe = patch.rpe;
        if (patch.completed != null) set.completed = patch.completed;
      });
    });
  },

  removeSet(session: Session, sessionId: string, setId: string) {
    return write(() => {
      commit((db) => {
        const row = db.sessions.find((s) => s.id === sessionId && s.gymId === session.gymId);
        if (!row) throw new NotFound('Session not found.');
        if (session.role === 'member' && row.memberId !== session.memberId) throw new NotFound('Session not found.');
        row.sets = row.sets.filter((s) => s.id !== setId);
      });
    });
  },

  addExercise(session: Session, sessionId: string, exerciseId: string, plan: { sets: number; reps: number; weightKg: number }) {
    return write(() => {
      commit((db) => {
        const row = db.sessions.find((s) => s.id === sessionId && s.gymId === session.gymId);
        if (!row) throw new NotFound('Session not found.');
        if (session.role === 'member' && row.memberId !== session.memberId) throw new NotFound('Session not found.');
        if (row.sets.some((s) => s.exerciseId === exerciseId)) return;
        const order = row.sets.reduce((m, s) => Math.max(m, s.order), -1) + 1;
        for (let i = 0; i < Math.max(1, plan.sets); i++) {
          row.sets.push({
            id: newId('sst'), sessionId, exerciseId, order, setNo: i + 1, kind: 'normal',
            reps: plan.reps, weightKg: plan.weightKg, durationSec: 0, distanceKm: 0,
            rpe: null, completed: false,
          });
        }
      });
    });
  },

  finish(session: Session, sessionId: string, input: { durationSec?: number; notes?: string } = {}) {
    return write(() => {
      let summary!: SessionSummary;
      commit((db) => {
        const row = db.sessions.find((s) => s.id === sessionId && s.gymId === session.gymId);
        if (!row) throw new NotFound('Session not found.');
        if (session.role === 'member' && row.memberId !== session.memberId) throw new NotFound('Session not found.');

        row.sets = row.sets.filter((s) => s.completed);
        row.status = 'completed';
        row.finishedAt = new Date().toISOString();
        row.durationSec = input.durationSec
          ?? Math.max(60, Math.round((Date.now() - new Date(row.startedAt).getTime()) / 1000));
        if (input.notes != null) row.notes = input.notes;

        const history = db.sessions.filter(
          (s) => s.memberId === row.memberId && s.gymId === session.gymId && s.status === 'completed');
        const previous = history
          .filter((s) => s.id !== row.id)
          .sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;

        summary = {
          session: row,
          volume: sessionVolume(row),
          exercises: new Set(row.sets.map((s) => s.exerciseId)).size,
          workingSets: row.sets.filter((s) => s.kind !== 'warmup').length,
          records: newRecordsIn(row, history),
          previousVolume: previous ? sessionVolume(previous) : null,
        };
        audit(db, session, 'finish', 'WorkoutSession', row.id, { volume: summary.volume });
      });
      return summary;
    });
  },

  discard(session: Session, sessionId: string) {
    return write(() => {
      commit((db) => {
        const row = db.sessions.find((s) => s.id === sessionId && s.gymId === session.gymId);
        if (!row) throw new NotFound('Session not found.');
        if (session.role === 'member' && row.memberId !== session.memberId) throw new NotFound('Session not found.');
        db.sessions = db.sessions.filter((s) => s.id !== sessionId);
        audit(db, session, 'discard', 'WorkoutSession', sessionId);
      });
    });
  },

  /** Quick log — the fast path when someone did not use the live player. */
  quickLog(session: Session, memberId: string, input: {
    date: ISODate; title?: string; durationMin?: number; notes?: string;
    sets: Array<{ exerciseId: string; reps: number; weightKg: number; durationSec?: number; distanceKm?: number }>;
  }) {
    requireOwnership(session, memberId);
    if (!input.sets.length) throw new ValidationError({ sets: 'Add at least one set.' });
    if (input.sets.some((s) => s.reps < 0 || s.weightKg < 0)) {
      throw new ValidationError({ sets: 'Reps and weight cannot be negative.' });
    }
    return write(() => {
      let saved!: WorkoutSession;
      commit((db) => {
        let row = db.sessions.find(
          (s) => s.memberId === memberId && s.date === input.date
            && s.gymId === session.gymId && s.status === 'completed');
        if (!row) {
          const now = new Date().toISOString();
          row = {
            id: newId('ses'), gymId: session.gymId, memberId, date: input.date,
            startedAt: now, finishedAt: now, programDayId: null,
            title: input.title ?? 'Training session',
            durationSec: (input.durationMin ?? 0) * 60, notes: input.notes ?? '',
            status: 'completed', sets: [],
          };
          db.sessions.unshift(row);
        }
        const baseOrder = row.sets.reduce((m, s) => Math.max(m, s.order), -1) + 1;
        input.sets.forEach((s, i) => {
          row!.sets.push({
            id: newId('sst'), sessionId: row!.id, exerciseId: s.exerciseId,
            order: baseOrder + i, setNo: row!.sets.filter((x) => x.exerciseId === s.exerciseId).length + 1,
            kind: 'normal', reps: s.reps, weightKg: s.weightKg,
            durationSec: s.durationSec ?? 0, distanceKm: s.distanceKm ?? 0,
            rpe: null, completed: true,
          });
        });
        if (input.durationMin) row.durationSec = input.durationMin * 60;
        if (input.notes) row.notes = input.notes;
        audit(db, session, 'log', 'WorkoutSession', row.id);
        saved = row;
      });
      return saved;
    });
  },
};

/* ============================================================
   Records, streaks, progression
   ============================================================ */
export interface RecordRow extends ExerciseRecord {
  exerciseName: string;
  muscleGroup: string;
}

export const records = {
  forMember(session: Session, memberId: string): RecordRow[] {
    requireOwnership(session, memberId);
    return memo(`records:${session.gymId}:${memberId}`, () => {
      const db = getDb();
      const map = recordsByExercise(sessions.completed(session, memberId));
      const rows: RecordRow[] = [];
      map.forEach((rec, exerciseId) => {
        const ex = db.exercises.find((e) => e.id === exerciseId);
        if (!ex || rec.heaviestKg <= 0) return;
        rows.push({ ...rec, exerciseName: ex.name, muscleGroup: ex.muscleGroup });
      });
      return rows.sort((a, b) => b.best1RM - a.best1RM);
    });
  },

  map(session: Session, memberId: string): Map<string, ExerciseRecord> {
    requireOwnership(session, memberId);
    return recordsByExercise(sessions.completed(session, memberId));
  },

  progression(session: Session, memberId: string, exerciseId: string): Point[] {
    requireOwnership(session, memberId);
    return strengthSeries(sessions.completed(session, memberId), exerciseId);
  },
};

export interface StreakBundle {
  /** Program-aware: scheduled rest days keep the streak alive (§D.4). */
  training: ReturnType<typeof trainingStreak>;
  /** Raw consecutive days physically in the gym. */
  attendance: StreakSummary;
  weekly: ReturnType<typeof weeklyConsistency>;
  sessionsThisMonth: number;
  totalSessions: number;
  visitStats: ReturnType<typeof statsFromDays>;
  weeklyTarget: number;
}

export const streaks = {
  forMember(session: Session, memberId: string): StreakBundle {
    requireOwnership(session, memberId);
    const db = getDb();
    const today = todayISO();
    const completed = sessions.completed(session, memberId);
    const sessionDays = new Set(completed.map((s) => s.date));
    const visitDays = checkInDays(tenant(db.attendance, session), memberId);
    const member = tenant(db.members, session).find((m) => m.id === memberId);
    const target = member?.fitness.weeklySessionTarget ?? 3;
    const program = tenant(db.programs, session).find((p) => p.memberId === memberId) ?? null;

    return {
      training: trainingStreak(sessionDays, program, today),
      attendance: streakSummary(visitDays, today),
      weekly: weeklyConsistency(sessionDays, 8, target, today),
      sessionsThisMonth: completed.filter((s) => s.date >= startOfMonth(today)).length,
      totalSessions: completed.length,
      visitStats: statsFromDays(visitDays, 30, today),
      weeklyTarget: target,
    };
  },
};

/* ============================================================
   Body measurements
   ============================================================ */
export const measurements = {
  list(session: Session, memberId: string): BodyMeasurement[] {
    requireOwnership(session, memberId);
    return tenant(getDb().measurements, session)
      .filter((m) => m.memberId === memberId)
      .sort((a, b) => a.takenAt.localeCompare(b.takenAt));
  },
  latest(session: Session, memberId: string): BodyMeasurement | null {
    requireOwnership(session, memberId);
    return latestMeasurement(tenant(getDb().measurements, session), memberId);
  },
  create(session: Session, memberId: string, input: Omit<BodyMeasurement, 'id' | 'gymId' | 'memberId'>) {
    requireOwnership(session, memberId);
    const fields: Record<string, string> = {};
    if (!(input.weightKg > 0)) fields.weightKg = 'Enter your weight.';
    else if (input.weightKg > 400) fields.weightKg = 'That weight looks incorrect.';
    if (input.takenAt > todayISO()) fields.takenAt = 'Date cannot be in the future.';
    if (Object.keys(fields).length) throw new ValidationError(fields);

    return write(() => {
      const row: BodyMeasurement = { ...input, id: newId('bm'), gymId: session.gymId, memberId };
      commit((db) => {
        db.measurements = db.measurements.filter(
          (m) => !(m.memberId === memberId && m.takenAt === input.takenAt));
        db.measurements.push(row);
        db.measurements.sort((a, b) => a.takenAt.localeCompare(b.takenAt));
        // Height belongs on the fitness profile — keep the two in step.
        if (input.heightCm) {
          const m = db.members.find((x) => x.id === memberId);
          if (m) m.fitness.heightCm = input.heightCm;
        }
        audit(db, session, 'create', 'BodyMeasurement', row.id);
      });
      return row;
    });
  },
};

/* ============================================================
   Hydration
   ============================================================ */
export const water = {
  today(session: Session, memberId: string, date: ISODate = todayISO()): number {
    requireOwnership(session, memberId);
    return waterTotal(tenant(getDb().water, session).filter((w) => w.memberId === memberId), date);
  },
  series(session: Session, memberId: string, from: ISODate, to: ISODate): Point[] {
    requireOwnership(session, memberId);
    return waterSeries(tenant(getDb().water, session).filter((w) => w.memberId === memberId), from, to);
  },
  add(session: Session, memberId: string, ml: number, date: ISODate = todayISO()) {
    requireOwnership(session, memberId);
    if (!(ml !== 0)) throw new ValidationError({ ml: 'Choose an amount.' });
    return write(() => {
      let total = 0;
      commit((db) => {
        if (ml < 0) {
          // Undo removes what the member just added, so it follows insertion order.
          // Sorting by timestamp would pick whichever entry happens to carry the
          // latest clock time, which is not the one they are trying to take back.
          let lastIndex = -1;
          for (let i = db.water.length - 1; i >= 0; i--) {
            const w = db.water[i];
            if (w.memberId === memberId && w.date === date && w.gymId === session.gymId) {
              lastIndex = i;
              break;
            }
          }
          if (lastIndex >= 0) db.water.splice(lastIndex, 1);
        } else {
          db.water.push({
            id: newId('wat'), gymId: session.gymId, memberId, date,
            ml: Math.round(ml), at: new Date().toISOString(),
          });
        }
        total = db.water
          .filter((w) => w.memberId === memberId && w.date === date)
          .reduce((s, w) => s + w.ml, 0);
      });
      return total;
    });
  },
};

/* ============================================================
   Goals
   ============================================================ */
export const goals = {
  list(session: Session, memberId: string): Goal[] {
    requireOwnership(session, memberId);
    return tenant(getDb().goals, session)
      .filter((g) => g.memberId === memberId)
      .sort((a, b) => Number(Boolean(a.achievedAt)) - Number(Boolean(b.achievedAt)));
  },

  progress(session: Session, memberId: string): GoalProgress[] {
    requireOwnership(session, memberId);
    const rows = measurements.list(session, memberId);
    const completed = sessions.completed(session, memberId);
    const monthSessions = completed.filter((s) => s.date >= startOfMonth(todayISO())).length;
    const recs = recordsByExercise(completed);
    return goals.list(session, memberId).map((g) => goalProgress(g, {
      latestWeight: rows.length ? rows[rows.length - 1].weightKg : undefined,
      startWeight: rows.length ? rows[0].weightKg : undefined,
      records: recs,
      monthSessions,
    }));
  },

  create(session: Session, memberId: string, input: {
    kind: GoalKind; label: string; targetValue: number; unit: string;
    exerciseId?: string | null; targetDate?: ISODate | null;
  }) {
    requireOwnership(session, memberId);
    const fields: Record<string, string> = {};
    if (!input.label?.trim()) fields.label = 'Describe the goal.';
    if (!(input.targetValue > 0)) fields.targetValue = 'Enter a target greater than zero.';
    if (Object.keys(fields).length) throw new ValidationError(fields);

    return write(() => {
      const goal: Goal = {
        id: newId('goal'), gymId: session.gymId, memberId,
        kind: input.kind, label: input.label.trim(),
        exerciseId: input.exerciseId ?? null,
        targetValue: input.targetValue, unit: input.unit,
        targetDate: input.targetDate ?? null,
        createdAt: new Date().toISOString(), achievedAt: null,
      };
      commit((db) => { db.goals.push(goal); audit(db, session, 'create', 'Goal', goal.id); });
      return goal;
    });
  },

  remove(session: Session, memberId: string, goalId: string) {
    requireOwnership(session, memberId);
    return write(() => {
      commit((db) => {
        db.goals = db.goals.filter((g) => !(g.id === goalId && g.memberId === memberId));
        audit(db, session, 'delete', 'Goal', goalId);
      });
    });
  },
};

/* ============================================================
   Diet
   ============================================================ */
export const diet = {
  planFor(session: Session, memberId: string): DietPlan | null {
    requireOwnership(session, memberId);
    return tenant(getDb().dietPlans, session).find((p) => p.memberId === memberId) ?? null;
  },
  templates(session: Session): DietPlan[] {
    return tenant(getDb().dietPlans, session).filter((p) => p.memberId === null);
  },
  assignTemplate(session: Session, memberId: string, templateId: string) {
    requireOwner(session);
    return write(() => {
      let assigned!: DietPlan;
      commit((db) => {
        const tpl = db.dietPlans.find((p) => p.id === templateId && p.gymId === session.gymId);
        if (!tpl) throw new NotFound('Diet plan not found.');
        db.dietPlans = db.dietPlans.filter((p) => p.memberId !== memberId);
        assigned = { ...tpl, id: newId('dpl'), memberId };
        db.dietPlans.push(assigned);
        audit(db, session, 'assign', 'DietPlan', assigned.id, { memberId });
      });
      return assigned;
    });
  },
  /** Meal ticking is stored, so "today's intake" is real data. */
  completions(session: Session, memberId: string, date: ISODate = todayISO()): Set<string> {
    requireOwnership(session, memberId);
    return new Set(
      tenant(getDb().mealCompletions, session)
        .filter((c) => c.memberId === memberId && c.date === date)
        .map((c) => c.dietItemId));
  },
  toggleMeal(session: Session, memberId: string, dietItemId: string, date: ISODate = todayISO()) {
    requireOwnership(session, memberId);
    return write(() => {
      let done = false;
      commit((db) => {
        const existing = db.mealCompletions.find(
          (c) => c.memberId === memberId && c.date === date && c.dietItemId === dietItemId);
        if (existing) {
          db.mealCompletions = db.mealCompletions.filter((c) => c.id !== existing.id);
        } else {
          db.mealCompletions.push({
            id: newId('mc'), gymId: session.gymId, memberId, date, dietItemId,
          });
          done = true;
        }
      });
      return done;
    });
  },
};

/* ============================================================
   Communication (§J)
   ============================================================ */
export const messages = {
  list(session: Session, memberId?: string): Message[] {
    const rows = tenant(getDb().messages, session)
      .filter((m) => (memberId ? m.memberId === memberId : true));
    if (session.role === 'member') {
      return rows.filter((m) => m.memberId === session.memberId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
    requireOwner(session);
    return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  /** Builds the message body from a template plus this member's real data. */
  preview(session: Session, memberId: string, kind: MessageKind) {
    requireOwner(session);
    const summary = members.get(session, memberId);
    const gym = gyms.current(session);
    const lastPayment = payments.forMember(session, memberId)[0] ?? null;
    const streak = streaks.forMember(session, memberId);
    const ctx: TemplateContext = {
      gymName: gym.name,
      member: summary.member,
      membership: summary.membership,
      payment: lastPayment,
      daysLeft: summary.daysLeft,
      amountDue: summary.dues.due,
      streak: streak.training.current,
    };
    return compose(kind, ctx);
  },

  send(session: Session, input: {
    memberId: string; channel: MessageChannel; kind: MessageKind;
    subject: string; body: string;
  }) {
    requireOwner(session);
    const fields: Record<string, string> = {};
    if (!input.body?.trim()) fields.body = 'The message is empty.';
    if (Object.keys(fields).length) throw new ValidationError(fields);

    const provider = providerFor(input.channel);
    return write(async () => {
      const result = await provider.send({
        channel: input.channel, to: '', subject: input.subject, body: input.body,
      });
      const message: Message = {
        id: newId('msg'), gymId: session.gymId, memberId: input.memberId,
        channel: input.channel, kind: input.kind,
        subject: input.subject.trim(), body: input.body.trim(),
        status: result.status, createdAt: new Date().toISOString(),
        sentAt: result.status === 'sent' ? result.at : null,
        createdByRole: session.role, readAt: null,
      };
      commit((db) => { db.messages.push(message); audit(db, session, 'send', 'Message', message.id); });
      return { message, result };
    }).then((p) => p);
  },
};

/* ============================================================
   Expenses
   ============================================================ */
export interface ExpenseFilter {
  from?: ISODate; to?: ISODate; category?: ExpenseCategory | 'all';
  min?: number; max?: number; q?: string; page?: number; limit?: number;
}

export const expenses = {
  list(session: Session, f: ExpenseFilter = {}): Page<Expense> {
    requireOwner(session);
    let rows = tenant(getDb().expenses, session);
    if (f.from) rows = rows.filter((e) => e.spentAt >= f.from!);
    if (f.to) rows = rows.filter((e) => e.spentAt <= f.to!);
    if (f.category && f.category !== 'all') rows = rows.filter((e) => e.category === f.category);
    if (f.min != null) rows = rows.filter((e) => e.amount >= f.min!);
    if (f.max != null) rows = rows.filter((e) => e.amount <= f.max!);
    const q = norm(f.q ?? '');
    if (q) rows = rows.filter((e) => norm(e.description).includes(q) || norm(e.vendor).includes(q));
    return paginate(rows.slice().sort((a, b) => b.spentAt.localeCompare(a.spentAt)), f.page, f.limit);
  },

  create(session: Session, input: {
    category: ExpenseCategory; amount: number; spentAt: ISODate;
    description: string; vendor?: string; method: PaymentMethod; isRecurring?: boolean;
  }) {
    requireOwner(session);
    const fields: Record<string, string> = {};
    if (!(input.amount > 0)) fields.amount = 'Enter an amount greater than zero.';
    if (!input.spentAt) fields.spentAt = 'Choose a date.';
    else if (input.spentAt > todayISO()) fields.spentAt = 'Expense date cannot be in the future.';
    if (!input.description?.trim()) fields.description = 'Describe what this was for.';
    if (Object.keys(fields).length) throw new ValidationError(fields);

    return write(() => {
      const expense: Expense = {
        id: newId('exp'), gymId: session.gymId, category: input.category,
        amount: Math.round(input.amount), spentAt: input.spentAt,
        description: input.description.trim(), vendor: input.vendor?.trim() ?? '',
        method: input.method, isRecurring: input.isRecurring ?? false, receiptUrl: null,
      };
      commit((db) => { db.expenses.push(expense); audit(db, session, 'create', 'Expense', expense.id); });
      return expense;
    });
  },

  remove(session: Session, id: string) {
    requireOwner(session);
    return write(() => {
      commit((db) => {
        const e = db.expenses.find((x) => x.id === id && x.gymId === session.gymId);
        if (!e) throw new NotFound('Expense not found.');
        db.expenses = db.expenses.filter((x) => x.id !== id);
        audit(db, session, 'delete', 'Expense', id, { amount: e.amount });
      });
    });
  },
};

/* ============================================================
   Dashboard & analytics
   ============================================================ */
export const dashboard = {
  get(session: Session): DashboardKpis {
    requireOwner(session);
    return memo(`dashboard:${session.gymId}`, () => {
      const db = getDb();
      const rows = members.rows(session);
      return dashboardKpis({
        members: tenant(db.members, session),
        memberships: tenant(db.memberships, session),
        payments: tenant(db.payments, session),
        expenses: tenant(db.expenses, session),
        attendance: tenant(db.attendance, session),
        sessions: tenant(db.sessions, session),
        engagement: rows.map((r) => r.engagement),
      });
    });
  },

  revenueTrend(session: Session, months = 6): Point[] {
    requireOwner(session);
    const today = todayISO();
    const from = startOfMonth(addMonths(startOfMonth(today), -(months - 1)));
    return monthlySeries(from, today,
      tenant(getDb().payments, session).map((p) => ({ date: dayOf(p.paidAt), value: p.amount })));
  },

  expenseTrend(session: Session, months = 6): Point[] {
    requireOwner(session);
    const today = todayISO();
    const from = startOfMonth(addMonths(startOfMonth(today), -(months - 1)));
    return monthlySeries(from, today,
      tenant(getDb().expenses, session).map((e) => ({ date: e.spentAt, value: e.amount })));
  },

  registrationTrend(session: Session, months = 6): { fresh: Point[]; renewals: Point[] } {
    requireOwner(session);
    const today = todayISO();
    const from = startOfMonth(addMonths(startOfMonth(today), -(months - 1)));
    const rows = tenant(getDb().memberships, session);
    return {
      fresh: monthlySeries(from, today,
        rows.filter((m) => m.kind === 'new').map((m) => ({ date: dayOf(m.createdAt), value: 1 }))),
      renewals: monthlySeries(from, today,
        rows.filter((m) => m.kind === 'renewal').map((m) => ({ date: dayOf(m.createdAt), value: 1 }))),
    };
  },

  memberGrowth(session: Session, months = 6): Point[] {
    requireOwner(session);
    const today = todayISO();
    const rows = tenant(getDb().members, session);
    const keys: string[] = [];
    for (let i = months - 1; i >= 0; i--) keys.push(monthKey(addMonths(startOfMonth(today), -i)));
    return keys.map((k) => ({ x: k, label: k, y: rows.filter((m) => monthKey(m.joinedAt) <= k).length }));
  },

  /** Completed sessions per day — the engagement heartbeat. */
  sessionTrend(session: Session, from: ISODate, to: ISODate): Point[] {
    requireOwner(session);
    return dailySeries(from, to,
      tenant(getDb().sessions, session)
        .filter((s) => s.status === 'completed')
        .map((s) => ({ date: s.date, value: 1 })));
  },

  profitLoss(session: Session, from: ISODate, to: ISODate): ProfitLoss {
    requireOwner(session);
    const db = getDb();
    return profitLoss(tenant(db.payments, session), tenant(db.expenses, session), from, to);
  },

  expiring(session: Session, days = 14): MemberRow[] {
    requireOwner(session);
    return memberships.list(session, { status: 'expiring', days })
      .filter((r) => r.daysLeft >= 0 && r.daysLeft <= days)
      .sort((a, b) => a.daysLeft - b.daysLeft);
  },
};

export const reports = {
  revenueByMonth(session: Session, from: ISODate, to: ISODate) {
    requireOwner(session);
    return monthlySeries(from, to,
      tenant(getDb().payments, session).map((p) => ({ date: dayOf(p.paidAt), value: p.amount })));
  },
  expenseByMonth(session: Session, from: ISODate, to: ISODate) {
    requireOwner(session);
    return monthlySeries(from, to,
      tenant(getDb().expenses, session).map((e) => ({ date: e.spentAt, value: e.amount })));
  },
  totals(session: Session, from: ISODate, to: ISODate) {
    requireOwner(session);
    const db = getDb();
    const pays = tenant(db.payments, session).filter((p) => dayOf(p.paidAt) >= from && dayOf(p.paidAt) <= to);
    const exps = tenant(db.expenses, session).filter((e) => e.spentAt >= from && e.spentAt <= to);
    const sold = tenant(db.memberships, session)
      .filter((m) => dayOf(m.createdAt) >= from && dayOf(m.createdAt) <= to);
    const revenue = sum(pays, (p) => p.amount);
    const spend = sum(exps, (e) => e.amount);
    return {
      revenue, expenses: spend, profit: revenue - spend,
      newMembers: sold.filter((m) => m.kind === 'new').length,
      renewals: sold.filter((m) => m.kind === 'renewal').length,
      payments: pays.length,
      sessions: tenant(db.sessions, session)
        .filter((s) => s.status === 'completed' && s.date >= from && s.date <= to).length,
    };
  },
};

/* Re-exported so screens import derivations from one place. */
export { membershipStatus, membershipNet, duesFor, summarise, adherence };
export type {
  MemberSummary, DashboardKpis, ProfitLoss, Point, Engagement, ExerciseRecord,
  StreakSummary, GoalProgress, PRAchievement,
};
