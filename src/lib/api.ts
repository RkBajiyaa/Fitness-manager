/* ============================================================
   THE SEAM (see docs/ARCHITECTURE.md A.2). Every screen calls
   this module; no screen touches db.ts or localStorage directly.
   Signatures, filters, pagination and errors already match the
   REST contract in section F - migrating means replacing these
   bodies with fetch().

   Reads are synchronous (the data is local - pretending
   otherwise would only make the UI feel slower than it is).
   Writes are async so every mutation exercises a real pending
   state, exactly as it will against a network.
   ============================================================ */
import type {
  AttendanceEvent, BodyMeasurement, DietPlan, Expense, ExpenseCategory, Gender,
  ISODate, Member, Membership, MembershipPlan, MembershipStatus, Note, Page,
  Payment, PaymentMethod, RevenueSource, Session, WorkoutLog, WorkoutLogSet,
  WorkoutPlan,
} from './types';
import {
  audit, commit, getDb, newId, NotFound, requireOwner, requireOwnership, tenant,
} from './db';
import {
  attendanceStats, currentMembership, dashboardKpis, dailySeries, duesFor, membershipNet,
  membershipStatus, monthlySeries, outstanding, profitLoss, sessionsOn, summarise, sum,
  type DashboardKpis, type MemberSummary, type Point, type ProfitLoss,
} from './derive';
import { addDays, addMonths, dayOf, monthKey, startOfMonth, todayISO } from './date';

const WRITE_LATENCY = 160;

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
  return {
    data: rows.slice((p - 1) * limit, p * limit),
    meta: { page: p, limit, total, totalPages },
  };
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

/* ============================================================
   Membership plans   GET/POST /membership-plans
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
   Members   GET/POST /members
   ============================================================ */
export type MemberSort = 'name' | 'joinedAt' | 'expiry' | 'due';

export interface MemberListParams {
  q?: string;
  status?: MembershipStatus | 'all';
  planId?: string;
  hasDue?: boolean;
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
  const nums = rows
    .map((m) => Number(m.memberCode.split('-')[1]))
    .filter((n) => Number.isFinite(n));
  return `IH-${(nums.length ? Math.max(...nums) : 1000) + 1}`;
}

export const members = {
  list(session: Session, params: MemberListParams = {}): Page<MemberSummary> {
    requireOwner(session);
    const db = getDb();
    const today = todayISO();
    const all = tenant(db.members, session);
    const ms = tenant(db.memberships, session);
    const pays = tenant(db.payments, session);

    let rows = all.map((m) => summarise(m, ms, pays, today));

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

    const dir = params.order === 'desc' ? -1 : 1;
    const sort = params.sort ?? 'name';
    rows.sort((a, b) => {
      switch (sort) {
        case 'joinedAt': return dir * a.member.joinedAt.localeCompare(b.member.joinedAt);
        case 'expiry': return dir * (a.membership?.endDate ?? '').localeCompare(b.membership?.endDate ?? '');
        case 'due': return dir * (a.dues.due - b.dues.due);
        default: return dir * a.member.name.localeCompare(b.member.name);
      }
    });
    return paginate(rows, params.page, params.limit);
  },

  counts(session: Session) {
    requireOwner(session);
    const db = getDb();
    const today = todayISO();
    const ms = tenant(db.memberships, session);
    const pays = tenant(db.payments, session);
    const rows = tenant(db.members, session).map((m) => summarise(m, ms, pays, today));
    return {
      all: rows.length,
      active: rows.filter((r) => r.status === 'active').length,
      expiring: rows.filter((r) => r.status === 'expiring').length,
      expired: rows.filter((r) => r.status === 'expired' || r.status === 'none').length,
      withDues: rows.filter((r) => r.dues.due > 0).length,
    };
  },

  get(session: Session, id: string): MemberSummary {
    requireOwnership(session, id);
    const db = getDb();
    const member = tenant(db.members, session).find((m) => m.id === id);
    if (!member) throw new NotFound('Member not found.');
    return summarise(member, tenant(db.memberships, session), tenant(db.payments, session));
  },

  /**
   * POST /members  (+ nested membership & payment).
   * One call because the three writes must succeed or fail together -
   * the server will run them in a single transaction.
   */
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
            paidAt: now, receiptNo: `RCPT-${db2.payments.length + 1001}`,
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

  remove(session: Session, id: string) {
    requireOwner(session);
    return write(() => {
      commit((db) => {
        const m = db.members.find((x) => x.id === id && x.gymId === session.gymId);
        if (!m) throw new NotFound('Member not found.');
        db.members = db.members.filter((x) => x.id !== id);
        db.memberships = db.memberships.filter((x) => x.memberId !== id);
        db.attendance = db.attendance.filter((x) => x.memberId !== id);
        db.workoutLogs = db.workoutLogs.filter((x) => x.memberId !== id);
        db.measurements = db.measurements.filter((x) => x.memberId !== id);
        db.notes = db.notes.filter((x) => x.memberId !== id);
        db.workoutPlans = db.workoutPlans.filter((x) => x.memberId !== id);
        db.dietPlans = db.dietPlans.filter((x) => x.memberId !== id);
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
   Memberships   GET /memberships - POST /members/:id/memberships
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
    const db = getDb();
    const today = todayISO();
    const ms = tenant(db.memberships, session);
    const pays = tenant(db.payments, session);
    const rows = tenant(db.members, session)
      .map((m) => summarise(m, ms, pays, today))
      .filter((r) => r.membership !== null);
    if (!filter.status || filter.status === 'all') return rows;
    if (filter.status === 'expiring' && filter.days) {
      return rows.filter((r) => r.daysLeft >= 0 && r.daysLeft <= filter.days!);
    }
    return rows.filter((r) => r.status === filter.status);
  },

  /** New sale or renewal. A renewal starts the day after the current expiry - no gap. */
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
            paidAt: now, receiptNo: `RCPT-${db2.payments.length + 1001}`,
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
   Payments   GET/POST /payments
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
    const decorated = rows
      .slice()
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

  /** Records money against a member's current membership, or as a standalone service. */
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
        receiptNo: `RCPT-${getDb().payments.length + 1001}`, note: input.note?.trim() ?? '',
      };
      commit((db2) => { db2.payments.push(payment); audit(db2, session, 'create', 'Payment', payment.id); });
      return payment;
    });
  },
};

/* ============================================================
   Attendance   GET /attendance - POST /attendance/events
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

  /** Distinct members checking in per day - the trend chart's source. */
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

  /** Device integration is architected, not implemented - see section I. */
  devices() {
    return [{
      id: 'dev_primary',
      label: 'Main entrance reader',
      kind: 'biometric' as const,
      status: 'not_connected' as const,
      lastSeen: null as string | null,
    }];
  },
};

/* ============================================================
   Expenses   GET/POST /expenses
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
   Fitness - workouts, measurements, diet
   ============================================================ */
export const workouts = {
  catalogue() {
    return getDb().exercises;
  },
  exerciseName(id: string): string {
    return getDb().exercises.find((e) => e.id === id)?.name ?? 'Exercise';
  },
  planFor(session: Session, memberId: string): WorkoutPlan | null {
    requireOwnership(session, memberId);
    return tenant(getDb().workoutPlans, session).find((p) => p.memberId === memberId) ?? null;
  },
  templates(session: Session): WorkoutPlan[] {
    return tenant(getDb().workoutPlans, session).filter((p) => p.isTemplate);
  },
  assignTemplate(session: Session, memberId: string, templateId: string) {
    requireOwner(session);
    return write(() => {
      let assigned!: WorkoutPlan;
      commit((db) => {
        const tpl = db.workoutPlans.find((p) => p.id === templateId && p.gymId === session.gymId);
        if (!tpl) throw new NotFound('Workout plan not found.');
        db.workoutPlans = db.workoutPlans.filter((p) => p.memberId !== memberId);
        assigned = { ...tpl, id: newId('wpl'), memberId, isTemplate: false };
        db.workoutPlans.push(assigned);
        audit(db, session, 'assign', 'WorkoutPlan', assigned.id, { memberId });
      });
      return assigned;
    });
  },
  logs(session: Session, memberId: string, limit?: number): WorkoutLog[] {
    requireOwnership(session, memberId);
    const rows = tenant(getDb().workoutLogs, session)
      .filter((l) => l.memberId === memberId)
      .sort((a, b) => b.date.localeCompare(a.date));
    return limit ? rows.slice(0, limit) : rows;
  },
  logOn(session: Session, memberId: string, date: ISODate): WorkoutLog | null {
    requireOwnership(session, memberId);
    return tenant(getDb().workoutLogs, session).find((l) => l.memberId === memberId && l.date === date) ?? null;
  },
  /** Appends sets to that day's log, creating it if this is the first entry. */
  logSets(session: Session, memberId: string, input: {
    date: ISODate; durationMin?: number; notes?: string;
    sets: Array<Omit<WorkoutLogSet, 'id'>>;
  }) {
    requireOwnership(session, memberId);
    if (!input.sets.length) throw new ValidationError({ sets: 'Add at least one set.' });
    if (input.sets.some((s) => s.reps < 0 || s.weightKg < 0)) {
      throw new ValidationError({ sets: 'Reps and weight cannot be negative.' });
    }
    return write(() => {
      let saved!: WorkoutLog;
      commit((db) => {
        let log = db.workoutLogs.find(
          (l) => l.memberId === memberId && l.date === input.date && l.gymId === session.gymId);
        if (!log) {
          log = {
            id: newId('wlg'), gymId: session.gymId, memberId, date: input.date, planId: null,
            durationMin: input.durationMin ?? 0, notes: input.notes ?? '', sets: [],
            createdAt: new Date().toISOString(),
          };
          db.workoutLogs.unshift(log);
        }
        log.sets.push(...input.sets.map((s) => ({ ...s, id: newId('wls') })));
        if (input.durationMin) log.durationMin = input.durationMin;
        if (input.notes) log.notes = input.notes;
        audit(db, session, 'log', 'WorkoutLog', log.id);
        saved = log;
      });
      return saved;
    });
  },
};

export const measurements = {
  list(session: Session, memberId: string): BodyMeasurement[] {
    requireOwnership(session, memberId);
    return tenant(getDb().measurements, session)
      .filter((m) => m.memberId === memberId)
      .sort((a, b) => a.takenAt.localeCompare(b.takenAt));
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
        audit(db, session, 'create', 'BodyMeasurement', row.id);
      });
      return row;
    });
  },
};

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
};

/* ============================================================
   Dashboard & analytics   GET /dashboard - /revenue - /profit-loss
   ============================================================ */
export const dashboard = {
  get(session: Session): DashboardKpis {
    requireOwner(session);
    const db = getDb();
    return dashboardKpis(
      tenant(db.members, session), tenant(db.memberships, session), tenant(db.payments, session),
      tenant(db.expenses, session), tenant(db.attendance, session),
    );
  },

  revenueTrend(session: Session, months = 6): Point[] {
    requireOwner(session);
    const today = todayISO();
    const from = startOfMonth(addMonths(today, -(months - 1)));
    return monthlySeries(from, today,
      tenant(getDb().payments, session).map((p) => ({ date: dayOf(p.paidAt), value: p.amount })));
  },

  expenseTrend(session: Session, months = 6): Point[] {
    requireOwner(session);
    const today = todayISO();
    const from = startOfMonth(addMonths(today, -(months - 1)));
    return monthlySeries(from, today,
      tenant(getDb().expenses, session).map((e) => ({ date: e.spentAt, value: e.amount })));
  },

  registrationTrend(session: Session, months = 6): { fresh: Point[]; renewals: Point[] } {
    requireOwner(session);
    const today = todayISO();
    const from = startOfMonth(addMonths(today, -(months - 1)));
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
    for (let i = months - 1; i >= 0; i--) keys.push(monthKey(addMonths(today, -i)));
    return keys.map((k) => ({
      x: k, label: k, y: rows.filter((m) => monthKey(m.joinedAt) <= k).length,
    }));
  },

  profitLoss(session: Session, from: ISODate, to: ISODate): ProfitLoss {
    requireOwner(session);
    const db = getDb();
    return profitLoss(tenant(db.payments, session), tenant(db.expenses, session), from, to);
  },

  /** Expiring within `days`, soonest first - the renewal work queue. */
  expiring(session: Session, days = 7): MemberSummary[] {
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
      revenue,
      expenses: spend,
      profit: revenue - spend,
      newMembers: sold.filter((m) => m.kind === 'new').length,
      renewals: sold.filter((m) => m.kind === 'renewal').length,
      payments: pays.length,
    };
  },
};

/* Re-exported so screens import derivations from one place. */
export { membershipStatus, membershipNet, duesFor, summarise };
export type { MemberSummary, DashboardKpis, ProfitLoss, Point };
