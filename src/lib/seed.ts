/* ============================================================
   Deterministic demo dataset. Two gyms are seeded on purpose:
   the UI only ever shows the session's gym, which proves the
   tenant scoping in db.ts is doing real work.
   ============================================================ */
import type {
  Database, DietPlan, Exercise, ExpenseCategory, Gym, ISODate, Member,
  Membership, MembershipPlan, PaymentMethod, WorkoutPlan,
} from './types';
import { addDays, addMonths, dayOf, diffDays, monthKey, rangeDays, todayISO, toISO, parseISO } from './date';

/* ---- deterministic PRNG ---- */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20260829);
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)];
const int = (min: number, max: number) => Math.floor(rnd() * (max - min + 1)) + min;
const chance = (p: number) => rnd() < p;
let seq = 0;
const id = (p: string) => `${p}_${(++seq).toString(36).padStart(4, '0')}`;

const FIRST_M = ['Aarav','Vikram','Rohan','Karthik','Siddharth','Aditya','Nikhil','Rahul','Manish','Devansh','Arjun','Yash','Imran','Pranav','Harsh','Kabir','Sagar','Tarun','Vivek','Anand','Rajat','Farhan','Gaurav','Naveen','Sameer','Abhishek','Varun','Nitin','Kunal','Ashwin','Jatin','Sandeep','Amit','Ravi','Sohail','Dev','Om','Ishaan'] as const;
const FIRST_F = ['Ananya','Priya','Meera','Divya','Sneha','Kavya','Ritika','Pooja','Shreya','Nandini','Aisha','Tanvi','Neha','Ishita','Swati','Radhika','Anjali','Rhea','Sanjana','Payal','Aditi','Bhavna','Charu','Mitali','Lavanya','Simran','Vaishnavi','Preeti'] as const;
const LAST = ['Sharma','Verma','Iyer','Nair','Reddy','Patel','Khan','Mehta','Joshi','Kulkarni','Bose','Chatterjee','Rao','Kapoor','Singh','Malhotra','Desai','Gupta','Bhatt','Menon','Pillai','Shetty','Dutta','Saxena','Chauhan','Thakur','Naidu','Ghosh','Agarwal','Bansal','Sethi','Chopra','Grover','Kaur','Trivedi','Deshpande'] as const;
const AREAS = ['Indiranagar','Koramangala','HSR Layout','Jayanagar','Whitefield','Rajajinagar','Banashankari','Hebbal','Marathahalli','BTM Layout','Yelahanka','JP Nagar'] as const;
const STREETS = ['4th Cross','12th Main','7th Sector','2nd Stage','Palm Grove Rd','MG Link Rd','Lake View St','Ashwath Nagar'] as const;
const RELATIONS = ['Spouse','Father','Mother','Brother','Sister','Friend'] as const;
const METHODS: readonly PaymentMethod[] = ['upi', 'upi', 'upi', 'cash', 'card', 'bank_transfer'];

const EXERCISES: Array<Omit<Exercise, 'id'>> = [
  { gymId: null, name: 'Barbell Bench Press', muscleGroup: 'Chest', kind: 'strength' },
  { gymId: null, name: 'Incline Dumbbell Press', muscleGroup: 'Chest', kind: 'strength' },
  { gymId: null, name: 'Cable Fly', muscleGroup: 'Chest', kind: 'strength' },
  { gymId: null, name: 'Overhead Press', muscleGroup: 'Shoulders', kind: 'strength' },
  { gymId: null, name: 'Lateral Raise', muscleGroup: 'Shoulders', kind: 'strength' },
  { gymId: null, name: 'Lat Pulldown', muscleGroup: 'Back', kind: 'strength' },
  { gymId: null, name: 'Barbell Row', muscleGroup: 'Back', kind: 'strength' },
  { gymId: null, name: 'Deadlift', muscleGroup: 'Back', kind: 'strength' },
  { gymId: null, name: 'Back Squat', muscleGroup: 'Legs', kind: 'strength' },
  { gymId: null, name: 'Leg Press', muscleGroup: 'Legs', kind: 'strength' },
  { gymId: null, name: 'Romanian Deadlift', muscleGroup: 'Legs', kind: 'strength' },
  { gymId: null, name: 'Leg Curl', muscleGroup: 'Legs', kind: 'strength' },
  { gymId: null, name: 'Barbell Curl', muscleGroup: 'Arms', kind: 'strength' },
  { gymId: null, name: 'Triceps Pushdown', muscleGroup: 'Arms', kind: 'strength' },
  { gymId: null, name: 'Push-ups', muscleGroup: 'Chest', kind: 'bodyweight' },
  { gymId: null, name: 'Pull-ups', muscleGroup: 'Back', kind: 'bodyweight' },
  { gymId: null, name: 'Bodyweight Squats', muscleGroup: 'Legs', kind: 'bodyweight' },
  { gymId: null, name: 'Plank', muscleGroup: 'Core', kind: 'bodyweight' },
  { gymId: null, name: 'Treadmill Run', muscleGroup: 'Cardio', kind: 'cardio' },
  { gymId: null, name: 'Cycling', muscleGroup: 'Cardio', kind: 'cardio' },
  { gymId: null, name: 'Rowing Machine', muscleGroup: 'Cardio', kind: 'cardio' },
  { gymId: null, name: 'Brisk Walk', muscleGroup: 'Cardio', kind: 'cardio' },
];

const FIXED_EXPENSES: Array<{ category: ExpenseCategory; description: string; vendor: string; base: number; jitter: number }> = [
  { category: 'rent',        description: 'Premises rent',            vendor: 'Nandi Properties',   base: 62000, jitter: 0 },
  { category: 'salaries',    description: 'Staff & trainer salaries', vendor: 'Payroll',            base: 74000, jitter: 5000 },
  { category: 'electricity', description: 'Electricity bill',         vendor: 'BESCOM',             base: 21000, jitter: 5000 },
  { category: 'internet',    description: 'Broadband + music system', vendor: 'ACT Fibernet',       base: 3400,  jitter: 0 },
  { category: 'software',    description: 'Gym software subscription',vendor: 'Gym Software Setup', base: 2999,  jitter: 0 },
  { category: 'cleaning',    description: 'Housekeeping & supplies',  vendor: 'SparkClean',         base: 6000,  jitter: 1500 },
];
const VARIABLE_EXPENSES: Array<{ category: ExpenseCategory; description: string; vendor: string; min: number; max: number }> = [
  { category: 'equipment',   description: 'Olympic plates (set)',      vendor: 'Kobo Fitness',     min: 18000, max: 46000 },
  { category: 'equipment',   description: 'Adjustable dumbbell pair',  vendor: 'Kobo Fitness',     min: 9000,  max: 22000 },
  { category: 'repairs',     description: 'Treadmill belt replacement',vendor: 'FitServe',         min: 4500,  max: 14000 },
  { category: 'repairs',     description: 'AC servicing',              vendor: 'CoolCare',         min: 2500,  max: 6500 },
  { category: 'maintenance', description: 'Flooring repair',           vendor: 'BuildRight',       min: 6000,  max: 18000 },
  { category: 'maintenance', description: 'Plumbing & shower fittings',vendor: 'BuildRight',       min: 3000,  max: 9000 },
  { category: 'marketing',   description: 'Instagram ad campaign',     vendor: 'Meta Ads',         min: 5000,  max: 20000 },
  { category: 'marketing',   description: 'Flyers & local promo',      vendor: 'PrintHub',         min: 2000,  max: 7000 },
  { category: 'other',       description: 'Water cans & pantry',       vendor: 'AquaFresh',        min: 1800,  max: 4200 },
];

function makeGym(name: string, slug: string, area: string, n: number): Gym {
  return {
    id: `gym_${slug}`, name, slug,
    phone: `+91 98${int(10, 99)}0 ${int(10000, 99999)}`,
    email: `hello@${slug}.fit`,
    address: `${int(1, 120)}, ${pick(STREETS)}, ${area}, Bengaluru 560${String(n).padStart(3, '0')}`,
    currency: 'INR', timezone: 'Asia/Kolkata',
    createdAt: new Date(2023, 4, 12).toISOString(),
  };
}

function makePlans(gymId: string): MembershipPlan[] {
  const rows: Array<[string, number, number, string]> = [
    ['Monthly', 30, 2900, 'Full floor access, one month.'],
    ['Quarterly', 90, 7900, 'Three months. Most popular starter plan.'],
    ['Half-Yearly', 180, 14500, 'Six months, includes one body composition check.'],
    ['Annual', 365, 26000, 'Twelve months, best value, includes 2 PT sessions.'],
    ['Student Monthly', 30, 1900, 'Discounted monthly plan, valid student ID required.'],
  ];
  return rows.map(([name, durationDays, price, description]) => ({
    id: id('plan'), gymId, name, durationDays, price, isActive: true, description,
  }));
}

/**
 * Real rosters skew heavily to short plans. Uniform picking would put 40% of
 * members on half-yearly/annual terms, which starves cash-basis monthly revenue
 * and makes a healthy gym look loss-making.
 * Order matches makePlans: Monthly, Quarterly, Half-Yearly, Annual, Student.
 */
const PLAN_WEIGHTS = [0.42, 0.28, 0.11, 0.07, 0.12];

function pickPlan(plans: MembershipPlan[]): MembershipPlan {
  let r = rnd();
  for (let i = 0; i < plans.length; i++) {
    r -= PLAN_WEIGHTS[i] ?? 0;
    if (r <= 0) return plans[i];
  }
  return plans[0];
}

function timeAt(date: ISODate, hour: number, minute: number): string {
  const d = parseISO(date);
  d.setHours(hour, minute, int(0, 59), 0);
  return d.toISOString();
}

interface BuildOpts { memberCount: number; attendanceDays: number; rich: boolean }

function buildGym(gym: Gym, db: Database, opts: BuildOpts, today: ISODate): void {
  db.gyms.push(gym);
  const plans = makePlans(gym.id);
  db.plans.push(...plans);

  db.users.push({
    id: id('user'), gymId: gym.id, role: 'owner',
    name: gym.slug === 'ironhaus' ? 'Nikhil Raghavan' : 'Sunita Rao',
    phone: gym.phone, email: `owner@${gym.slug}.fit`,
  });

  const gymExercises = db.exercises;
  const planSplit = opts.rich ? seedWorkoutPlans(gym.id, gymExercises, db) : null;
  const dietPlan = opts.rich ? seedDietPlan(gym.id, db) : null;

  const codePrefix = gym.slug === 'ironhaus' ? 'IH' : 'PF';

  for (let i = 0; i < opts.memberCount; i++) {
    const isMale = chance(0.62);
    const first = isMale ? pick(FIRST_M) : pick(FIRST_F);
    const name = `${first} ${pick(LAST)}`;
    const joinedAgo = i === 0 && opts.rich ? 400 : int(6, 430);
    const joinedAt = addDays(today, -joinedAgo);

    const member: Member = {
      id: id('mem'), gymId: gym.id,
      memberCode: `${codePrefix}-${String(1000 + i)}`,
      name,
      phone: `+91 ${int(70, 99)}${int(100, 999)} ${int(10000, 99999)}`,
      email: `${first.toLowerCase()}.${int(10, 99)}@${pick(['gmail.com', 'outlook.com', 'yahoo.in'])}`,
      dob: toISO(new Date(int(1975, 2006), int(0, 11), int(1, 28))),
      gender: isMale ? 'male' : 'female',
      address: `${int(1, 300)}, ${pick(STREETS)}, ${pick(AREAS)}, Bengaluru`,
      emergencyContact: {
        name: `${chance(0.5) ? pick(FIRST_M) : pick(FIRST_F)} ${pick(LAST)}`,
        phone: `+91 ${int(70, 99)}${int(100, 999)} ${int(10000, 99999)}`,
        relation: pick(RELATIONS),
      },
      photoUrl: '', joinedAt, lifecycle: 'active',
    };
    db.members.push(member);

    /* ---- membership chain: initial sale + renewals until they lapse or reach today ---- */
    // Some members churn: they stop renewing at some point in the past.
    const loyalty = rnd();
    let cursor = joinedAt;
    let first_ = true;
    let guard = 0;
    while (guard++ < 24) {
      const plan = pickPlan(plans);
      const start = cursor;
      const end = addDays(start, plan.durationDays - 1);
      const discount = chance(0.18) ? Math.round((plan.price * pick([0.05, 0.1, 0.15])) / 10) * 10 : 0;

      const membership: Membership = {
        id: id('msh'), gymId: gym.id, memberId: member.id, planId: plan.id,
        planNameSnapshot: plan.name, priceSnapshot: plan.price, discount,
        startDate: start, endDate: end,
        kind: first_ ? 'new' : 'renewal',
        createdAt: timeAt(start, int(9, 20), int(0, 59)),
        cancelledAt: null,
      };
      db.memberships.push(membership);

      /* ---- payment(s) against it ---- */
      const net = plan.price - discount;
      const partial = chance(0.16);
      const paid = partial ? Math.round((net * pick([0.4, 0.5, 0.6, 0.7])) / 50) * 50 : net;
      db.payments.push({
        id: id('pay'), gymId: gym.id, memberId: member.id, membershipId: membership.id,
        amount: paid, method: pick(METHODS),
        source: first_ ? 'membership' : 'renewal',
        paidAt: membership.createdAt,
        receiptNo: `RCPT-${String(db.payments.length + 1001)}`,
        note: partial ? 'Part payment at joining' : '',
      });
      // Some part-payers settle the balance a few days later.
      if (partial && chance(0.45)) {
        const settleOn = addDays(start, int(3, 20));
        if (settleOn <= today) {
          db.payments.push({
            id: id('pay'), gymId: gym.id, memberId: member.id, membershipId: membership.id,
            amount: net - paid, method: pick(METHODS),
            source: first_ ? 'membership' : 'renewal',
            paidAt: timeAt(settleOn, int(10, 20), int(0, 59)),
            receiptNo: `RCPT-${String(db.payments.length + 1001)}`,
            note: 'Balance settled',
          });
        }
      }

      first_ = false;
      cursor = addDays(end, chance(0.75) ? 1 : int(2, 12)); // small renewal gaps are realistic
      if (cursor > today) break;
      // churn: the longer they have been around, the more chances to stop
      if (rnd() > loyalty * 0.86 + 0.24) break;
    }

    /* ---- occasional personal-training income ---- */
    if (chance(0.14)) {
      const when = addDays(today, -int(0, 60));
      db.payments.push({
        id: id('pay'), gymId: gym.id, memberId: member.id, membershipId: null,
        amount: pick([1500, 2500, 3000, 4000, 6000]), method: pick(METHODS),
        source: 'personal_training', paidAt: timeAt(when, int(8, 20), int(0, 59)),
        receiptNo: `RCPT-${String(db.payments.length + 1001)}`, note: 'Personal training package',
      });
    }

    /* ---- assign plans ---- */
    if (planSplit && chance(0.35)) {
      db.workoutPlans.push({ ...planSplit, id: id('wpl'), memberId: member.id, isTemplate: false });
    }
    if (dietPlan && chance(0.3)) {
      db.dietPlans.push({ ...dietPlan, id: id('dpl'), memberId: member.id });
    }
  }

  if (!opts.rich) return;

  /* ---- the demo member gets a complete, rich history ---- */
  const demo = db.members.find((m) => m.gymId === gym.id)!;
  demo.name = 'Aarav Menon';
  demo.email = 'aarav.menon@gmail.com';
  demo.phone = '+91 98450 21174';
  demo.dob = '1994-03-18';
  demo.gender = 'male';
  ensureCurrentMembership(db, gym.id, demo, plans, today);
  if (!db.workoutPlans.some((p) => p.memberId === demo.id) && planSplit) {
    db.workoutPlans.push({ ...planSplit, id: id('wpl'), memberId: demo.id, isTemplate: false });
  }
  if (!db.dietPlans.some((p) => p.memberId === demo.id) && dietPlan) {
    db.dietPlans.push({ ...dietPlan, id: id('dpl'), memberId: demo.id });
  }
  db.users.push({
    id: id('user'), gymId: gym.id, role: 'member', name: demo.name,
    phone: demo.phone, email: demo.email, memberId: demo.id,
  });

  /* Keep a healthy share of the roster current so the dashboard reads like a live gym. */
  const roster = db.members.filter((m) => m.gymId === gym.id);
  roster.forEach((m, i) => {
    if (i % 10 < 6) ensureCurrentMembership(db, gym.id, m, plans, today);
  });

  seedAttendance(db, gym.id, roster, opts.attendanceDays, today);
  seedExpenses(db, gym.id, today);
  seedFitness(db, gym.id, roster, demo, today);
  seedNotes(db, gym.id, roster);
}

/** Give a member a membership that covers today, extending their last one. */
function ensureCurrentMembership(
  db: Database, gymId: string, member: Member, plans: MembershipPlan[], today: ISODate,
): void {
  const mine = db.memberships.filter((m) => m.memberId === member.id);
  if (!mine.length) return;
  const last = mine.reduce((a, b) => (b.endDate > a.endDate ? b : a));
  if (last.endDate >= today) return;

  const plan = pickPlan(plans);
  // land the expiry anywhere from "already tight" to "months away"
  const daysLeft = pick([2, 3, 5, 6, 9, 14, 21, 34, 52, 71, 96, 140, 210]);
  const end = addDays(today, daysLeft);
  const start = addDays(end, -(plan.durationDays - 1));
  const discount = chance(0.15) ? Math.round((plan.price * 0.1) / 10) * 10 : 0;
  const createdAt = timeAt(start > today ? today : start, int(9, 20), int(0, 59));

  const membership: Membership = {
    id: id('msh'), gymId, memberId: member.id, planId: plan.id,
    planNameSnapshot: plan.name, priceSnapshot: plan.price, discount,
    startDate: start, endDate: end, kind: 'renewal', createdAt, cancelledAt: null,
  };
  db.memberships.push(membership);

  const net = plan.price - discount;
  const partial = chance(0.22);
  db.payments.push({
    id: id('pay'), gymId, memberId: member.id, membershipId: membership.id,
    amount: partial ? Math.round((net * pick([0.4, 0.5, 0.6])) / 50) * 50 : net,
    method: pick(METHODS), source: 'renewal', paidAt: createdAt,
    receiptNo: `RCPT-${String(db.payments.length + 1001)}`,
    note: partial ? 'Part payment — balance pending' : '',
  });
}

function seedWorkoutPlans(gymId: string, exercises: Exercise[], db: Database): WorkoutPlan {
  const byName = (n: string) => exercises.find((e) => e.name === n)!.id;
  const split: Array<[number, Array<[string, number, number, number, number, string]>]> = [
    [1, [ // Monday — Push
      ['Barbell Bench Press', 4, 8, 60, 120, 'Control the descent, pause at the chest.'],
      ['Incline Dumbbell Press', 3, 10, 22, 90, ''],
      ['Overhead Press', 3, 10, 35, 90, ''],
      ['Lateral Raise', 3, 15, 8, 60, 'Light weight, strict form.'],
      ['Triceps Pushdown', 3, 12, 25, 60, ''],
    ]],
    [2, [ // Tuesday — Pull
      ['Deadlift', 4, 5, 100, 180, 'Brace hard. Stop the set if the back rounds.'],
      ['Lat Pulldown', 4, 10, 50, 90, ''],
      ['Barbell Row', 3, 10, 45, 90, ''],
      ['Barbell Curl', 3, 12, 25, 60, ''],
    ]],
    [3, [ // Wednesday — Legs
      ['Back Squat', 4, 8, 80, 150, 'Full depth, knees tracking over toes.'],
      ['Leg Press', 3, 12, 140, 90, ''],
      ['Romanian Deadlift', 3, 10, 60, 90, ''],
      ['Leg Curl', 3, 12, 35, 60, ''],
      ['Plank', 3, 1, 0, 45, 'Hold 60 seconds.'],
    ]],
    [5, [ // Friday — Upper + conditioning
      ['Pull-ups', 4, 8, 0, 90, 'Assisted if needed.'],
      ['Barbell Bench Press', 3, 10, 55, 90, ''],
      ['Cable Fly', 3, 12, 15, 60, ''],
      ['Treadmill Run', 1, 1, 0, 0, '20 minutes, steady pace.'],
    ]],
    [6, [ // Saturday — Conditioning
      ['Rowing Machine', 1, 1, 0, 0, '15 minutes.'],
      ['Push-ups', 4, 20, 0, 60, ''],
      ['Bodyweight Squats', 4, 25, 0, 60, ''],
      ['Cycling', 1, 1, 0, 0, '15 minutes cool-down.'],
    ]],
  ];

  const template: WorkoutPlan = {
    id: id('wpl'), gymId, name: 'Push / Pull / Legs — 5 day', memberId: null, isTemplate: true,
    exercises: split.flatMap(([day, rows]) =>
      rows.map((r, i) => ({
        id: id('wpe'), exerciseId: byName(r[0]), dayOfWeek: day,
        sets: r[1], reps: r[2], targetWeight: r[3], restSec: r[4], instructions: r[5], order: i,
      })),
    ),
  };
  db.workoutPlans.push(template);
  return template;
}

function seedDietPlan(gymId: string, db: Database): DietPlan {
  const rows: Array<[DietPlan['items'][number]['meal'], string, string, number, number, number, number]> = [
    ['breakfast', 'Oats with milk & banana', '1 bowl', 340, 14, 52, 7],
    ['breakfast', 'Boiled eggs', '3 whole', 210, 18, 2, 15],
    ['breakfast', 'Black coffee', '1 cup', 5, 0, 1, 0],
    ['lunch', 'Brown rice', '1.5 cup', 320, 7, 68, 3],
    ['lunch', 'Grilled chicken breast', '180 g', 300, 56, 0, 7],
    ['lunch', 'Mixed vegetable sabzi', '1 bowl', 140, 4, 16, 6],
    ['lunch', 'Curd', '1 cup', 100, 8, 8, 4],
    ['snack', 'Whey protein shake', '1 scoop', 130, 25, 3, 2],
    ['snack', 'Roasted chana', '40 g', 150, 8, 22, 3],
    ['dinner', 'Roti (whole wheat)', '3 pieces', 300, 9, 60, 4],
    ['dinner', 'Paneer bhurji', '150 g', 280, 20, 8, 19],
    ['dinner', 'Salad with olive oil', '1 plate', 120, 3, 9, 8],
  ];
  const plan: DietPlan = {
    id: id('dpl'), gymId, memberId: null, name: 'Lean gain — 2,400 kcal', waterTargetL: 3.5,
    items: rows.map(([meal, item, qty, calories, protein, carbs, fat]) => ({
      id: id('ditm'), meal, item, qty, calories, protein, carbs, fat,
    })),
  };
  db.dietPlans.push(plan);
  return plan;
}

function seedAttendance(db: Database, gymId: string, roster: Member[], days: number, today: ISODate): void {
  const window = rangeDays(addDays(today, -(days - 1)), today);
  const nowHour = new Date().getHours();

  for (const m of roster) {
    const mine = db.memberships.filter((x) => x.memberId === m.id);
    if (!mine.length) continue;
    const consistency = 0.12 + rnd() * 0.68;         // per-member habit strength
    const morningPerson = chance(0.55);

    for (const d of window) {
      const covered = mine.some((x) => d >= x.startDate && d <= x.endDate);
      if (!covered) continue;
      const dow = parseISO(d).getDay();
      const dayFactor = dow === 0 ? 0.35 : dow === 6 ? 0.72 : 1;
      if (!chance(consistency * dayFactor)) continue;

      const hour = morningPerson ? int(6, 9) : int(17, 21);
      if (d === today && hour > nowHour) continue;   // no future check-ins today

      const minute = int(0, 59);
      db.attendance.push({
        id: id('att'), gymId, memberId: m.id, type: 'check_in',
        at: timeAt(d, hour, minute), source: 'manual',
      });

      const stayMin = int(45, 105);
      const outHour = hour + Math.floor((minute + stayMin) / 60);
      const outMin = (minute + stayMin) % 60;
      // Today's still-training members have no check-out yet — that is what makes occupancy real.
      const stillInside = d === today && outHour >= nowHour;
      if (!stillInside && chance(0.9) && outHour < 24) {
        db.attendance.push({
          id: id('att'), gymId, memberId: m.id, type: 'check_out',
          at: timeAt(d, outHour, outMin), source: 'manual',
        });
      }
    }
  }
  db.attendance.sort((a, b) => a.at.localeCompare(b.at));
}

function seedExpenses(db: Database, gymId: string, today: ISODate): void {
  for (let back = 11; back >= 0; back--) {
    const anchor = addMonths(today, -back);
    const mk = monthKey(anchor);

    for (const f of FIXED_EXPENSES) {
      const day = `${mk}-${String(f.category === 'salaries' ? 1 : int(2, 8)).padStart(2, '0')}`;
      if (day > today) continue;
      db.expenses.push({
        id: id('exp'), gymId, category: f.category,
        amount: f.base + (f.jitter ? int(-f.jitter, f.jitter) : 0),
        spentAt: day, description: f.description, vendor: f.vendor,
        method: f.category === 'salaries' ? 'bank_transfer' : pick(METHODS),
        isRecurring: true, receiptUrl: null,
      });
    }
    for (let k = 0, n = int(1, 3); k < n; k++) {
      const v = pick(VARIABLE_EXPENSES);
      const day = `${mk}-${String(int(3, 27)).padStart(2, '0')}`;
      if (day > today) continue;
      db.expenses.push({
        id: id('exp'), gymId, category: v.category, amount: int(v.min, v.max),
        spentAt: day, description: v.description, vendor: v.vendor,
        method: pick(METHODS), isRecurring: false, receiptUrl: null,
      });
    }
  }
  db.expenses.sort((a, b) => b.spentAt.localeCompare(a.spentAt));
}

function seedFitness(db: Database, gymId: string, roster: Member[], demo: Member, today: ISODate): void {
  const strength = db.exercises.filter((e) => e.kind === 'strength');
  const cardio = db.exercises.filter((e) => e.kind === 'cardio');
  const loggers = [demo, ...roster.slice(1, 16)];

  for (const m of loggers) {
    const isDemo = m.id === demo.id;
    const attended = new Set(
      db.attendance.filter((a) => a.memberId === m.id && a.type === 'check_in').map((a) => dayOf(a.at)),
    );
    const startWeight = isDemo ? 84.6 : 58 + rnd() * 32;
    const trend = isDemo ? -0.055 : (chance(0.6) ? -1 : 1) * (0.01 + rnd() * 0.05);
    let strengthBase = isDemo ? 52 : 25 + rnd() * 45;

    const days = [...attended].sort();
    days.forEach((d, i) => {
      if (!isDemo && !chance(0.55)) return;
      strengthBase += 0.22;
      const picks = [pick(strength), pick(strength), pick(strength)];
      const sets = picks.flatMap((ex, ei) =>
        Array.from({ length: int(3, 4) }, (_, s) => ({
          id: id('wls'), exerciseId: ex.id, setNo: s + 1,
          reps: int(6, 12),
          weightKg: Math.round((strengthBase * (0.7 + ei * 0.18) + int(-4, 4)) / 2.5) * 2.5,
          durationSec: 0, distanceKm: 0,
        })),
      );
      if (chance(0.4)) {
        const c = pick(cardio);
        sets.push({
          id: id('wls'), exerciseId: c.id, setNo: 1, reps: 0, weightKg: 0,
          durationSec: int(10, 30) * 60, distanceKm: Math.round(rnd() * 60) / 10,
        });
      }
      db.workoutLogs.push({
        id: id('wlg'), gymId, memberId: m.id, date: d, planId: null,
        durationMin: int(45, 95), notes: i % 9 === 0 ? 'Felt strong today.' : '',
        sets, createdAt: timeAt(d, int(7, 21), int(0, 59)),
      });
    });

    /* measurements roughly every 3 weeks */
    const spanDays = Math.min(260, Math.max(60, diffDays(m.joinedAt, today)));
    for (let back = spanDays; back >= 0; back -= 21) {
      const d = addDays(today, -back);
      const elapsed = spanDays - back;
      const w = startWeight + trend * elapsed + (rnd() - 0.5) * 0.7;
      db.measurements.push({
        id: id('bm'), gymId, memberId: m.id, takenAt: d,
        weightKg: Math.round(w * 10) / 10,
        heightCm: isDemo ? 176 : 155 + Math.round(rnd() * 30),
        chestCm: Math.round((96 + (w - startWeight) * 0.5 + rnd() * 2) * 10) / 10,
        waistCm: Math.round((88 + (w - startWeight) * 0.9 + rnd() * 1.5) * 10) / 10,
        armsCm: Math.round((34 - (w - startWeight) * 0.12 + rnd()) * 10) / 10,
        thighsCm: Math.round((56 + (w - startWeight) * 0.35 + rnd()) * 10) / 10,
        bodyFatPct: Math.round((22 + (w - startWeight) * 0.55 + rnd()) * 10) / 10,
      });
    }
  }
  db.workoutLogs.sort((a, b) => b.date.localeCompare(a.date));
  db.measurements.sort((a, b) => a.takenAt.localeCompare(b.takenAt));
}

function seedNotes(db: Database, gymId: string, roster: Member[]): void {
  const bodies = [
    'Recovering from a shoulder niggle — avoid heavy overhead work for two weeks.',
    'Asked about personal training. Follow up next week.',
    'Prefers early morning slot. Rarely comes after 9 AM.',
    'Paid balance in cash at the desk. Receipt handed over.',
    'Wants a vegetarian diet plan — assigned trainer to review.',
    'Referred two friends this month. Consider a referral discount on renewal.',
  ];
  roster.slice(0, 22).forEach((m, i) => {
    if (i % 3) return;
    db.notes.push({
      id: id('note'), gymId, memberId: m.id, authorRole: 'owner', authorName: 'Nikhil Raghavan',
      body: bodies[i % bodies.length],
      createdAt: new Date(Date.now() - int(1, 40) * 86400000).toISOString(),
    });
  });
}

export function buildSeed(): Database {
  const today = todayISO();
  const db: Database = {
    version: 1, gyms: [], users: [], members: [], plans: [], memberships: [], payments: [],
    attendance: [], exercises: [], workoutPlans: [], workoutLogs: [], measurements: [],
    dietPlans: [], expenses: [], notes: [], audit: [],
  };
  db.exercises = EXERCISES.map((e) => ({ ...e, id: id('ex') }));

  buildGym(makeGym('Ironhaus Strength Club', 'ironhaus', 'Indiranagar', 38), db,
    { memberCount: 128, attendanceDays: 75, rich: true }, today);

  // A second tenant. Never rendered — its existence is the isolation test.
  buildGym(makeGym('PulseFit Studio', 'pulsefit', 'Whitefield', 66), db,
    { memberCount: 14, attendanceDays: 0, rich: false }, today);

  return db;
}

export const DEMO_GYM_SLUG = 'ironhaus';
