/* ============================================================
   Fitness Manager — deterministic demo dataset.

   Modelled on a PREMIUM PRIVATE GYM: ~50 high-value members,
   premium pricing, deep per-member history. Two gyms are seeded
   on purpose — the UI only ever shows the session's gym, which
   proves the tenant scoping in db.ts is doing real work.

   Sessions are generated with genuine progressive overload so
   personal records, strength trends and streaks are real
   derivations rather than decoration.
   ============================================================ */
import type {
  Database, DietPlan, Exercise, ExpenseCategory, FeaturePackage, FitnessProfile,
  Gym, GymSetup, ISODate, Member, Membership, MembershipPlan, OperatingHours,
  PaymentMethod, PaymentSettings, PlatformFeature, PlatformSettings, Program,
  ProgramDay, ProgramExercise, SessionSet, Subscription, WorkoutSession,
} from './types';
import { FEATURE_CATALOG } from './platform/catalog';
import { DEFAULT_PACKAGE_KEY, PACKAGE_SEEDS } from './platform/packages';
import { addDays, addMonths, dayOf, diffDays, monthKey, rangeDays, todayISO, toISO, parseISO, startOfMonth } from './date';

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
const rnd = mulberry32(20260830);
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)];
const int = (min: number, max: number) => Math.floor(rnd() * (max - min + 1)) + min;
const chance = (p: number) => rnd() < p;
let seq = 0;
const id = (p: string) => `${p}_${(++seq).toString(36).padStart(4, '0')}`;

const FIRST_M = ['Aarav','Vikram','Rohan','Karthik','Siddharth','Aditya','Nikhil','Rahul','Manish','Devansh','Arjun','Yash','Imran','Pranav','Harsh','Kabir','Sagar','Tarun','Vivek','Anand','Rajat','Farhan','Gaurav','Naveen','Sameer','Abhishek','Varun','Nitin','Kunal','Ashwin'] as const;
const FIRST_F = ['Ananya','Priya','Meera','Divya','Sneha','Kavya','Ritika','Pooja','Shreya','Nandini','Aisha','Tanvi','Neha','Ishita','Swati','Radhika','Anjali','Rhea','Sanjana','Aditi','Lavanya','Simran','Vaishnavi','Mitali'] as const;
const LAST = ['Sharma','Verma','Iyer','Nair','Reddy','Patel','Khan','Mehta','Joshi','Kulkarni','Bose','Chatterjee','Rao','Kapoor','Singh','Malhotra','Desai','Gupta','Bhatt','Menon','Pillai','Shetty','Dutta','Saxena','Chauhan','Thakur','Naidu','Ghosh','Agarwal','Bansal'] as const;
const AREAS = ['Indiranagar','Koramangala','HSR Layout','Jayanagar','Whitefield','Sadashivanagar','Richmond Town','Domlur','Frazer Town','Cooke Town'] as const;
const STREETS = ['4th Cross','12th Main','7th Sector','2nd Stage','Palm Grove Rd','Lake View St','Ashwath Nagar','Benson Cross Rd'] as const;
const RELATIONS = ['Spouse','Father','Mother','Brother','Sister','Partner'] as const;
const METHODS: readonly PaymentMethod[] = ['upi', 'upi', 'card', 'bank_transfer', 'cash'];
const GOALS = ['lose_fat', 'build_muscle', 'gain_strength', 'endurance', 'general_fitness'] as const;
const EXPERIENCE = ['beginner', 'intermediate', 'advanced'] as const;

/* ============================================================
   Exercise library
   ============================================================ */
type ExDef = [name: string, muscle: string, secondary: string[], equipment: string, kind: Exercise['kind'], difficulty: Exercise['difficulty'], instructions: string, tags: string[]];

const GLOBAL_EXERCISES: ExDef[] = [
  ['Barbell Bench Press', 'Chest', ['Triceps', 'Shoulders'], 'Barbell', 'strength', 'intermediate', 'Retract the shoulder blades, lower to mid-chest under control, press without flaring the elbows.', ['push', 'compound']],
  ['Incline Dumbbell Press', 'Chest', ['Shoulders', 'Triceps'], 'Dumbbell', 'strength', 'beginner', 'Bench at 30°. Press up and slightly together without locking harshly.', ['push', 'compound']],
  ['Cable Fly', 'Chest', ['Shoulders'], 'Cable', 'strength', 'beginner', 'Soft elbows throughout. Squeeze at the midline, resist on the way back.', ['push', 'isolation']],
  ['Dumbbell Pullover', 'Chest', ['Back'], 'Dumbbell', 'strength', 'intermediate', 'Keep the ribs down; move only at the shoulder.', ['push', 'isolation']],
  ['Overhead Press', 'Shoulders', ['Triceps', 'Core'], 'Barbell', 'strength', 'intermediate', 'Brace the midsection, press in a straight line, finish with the bar over the ears.', ['push', 'compound']],
  ['Dumbbell Shoulder Press', 'Shoulders', ['Triceps'], 'Dumbbell', 'strength', 'beginner', 'Seated with back support. Press without shrugging.', ['push', 'compound']],
  ['Lateral Raise', 'Shoulders', [], 'Dumbbell', 'strength', 'beginner', 'Light weight, lead with the elbows, stop at shoulder height.', ['push', 'isolation']],
  ['Face Pull', 'Shoulders', ['Back'], 'Cable', 'strength', 'beginner', 'Pull to the forehead, externally rotate at the end.', ['pull', 'isolation']],
  ['Lat Pulldown', 'Back', ['Biceps'], 'Cable', 'strength', 'beginner', 'Drive the elbows down and back; avoid leaning too far.', ['pull', 'compound']],
  ['Barbell Row', 'Back', ['Biceps', 'Hamstrings'], 'Barbell', 'strength', 'intermediate', 'Hinge to roughly 45°, pull to the lower ribs, keep a neutral spine.', ['pull', 'compound']],
  ['Seated Cable Row', 'Back', ['Biceps'], 'Cable', 'strength', 'beginner', 'Chest tall, pull to the navel, control the return.', ['pull', 'compound']],
  ['Deadlift', 'Back', ['Hamstrings', 'Glutes', 'Core'], 'Barbell', 'strength', 'advanced', 'Brace hard before the pull. Stop the set if the back rounds.', ['pull', 'compound']],
  ['Pull-ups', 'Back', ['Biceps', 'Core'], 'Bodyweight', 'bodyweight', 'intermediate', 'Full hang to chin over the bar. Use assistance if needed.', ['pull', 'compound']],
  ['Chest Supported Row', 'Back', ['Biceps'], 'Machine', 'strength', 'beginner', 'Removes the lower back from the equation. Squeeze at the top.', ['pull', 'compound']],
  ['Back Squat', 'Legs', ['Glutes', 'Core'], 'Barbell', 'strength', 'advanced', 'Depth to at least parallel, knees tracking over the toes.', ['legs', 'compound']],
  ['Front Squat', 'Legs', ['Core'], 'Barbell', 'strength', 'advanced', 'Elbows high, torso upright.', ['legs', 'compound']],
  ['Leg Press', 'Legs', ['Glutes'], 'Machine', 'strength', 'beginner', 'Do not let the lower back round at the bottom.', ['legs', 'compound']],
  ['Romanian Deadlift', 'Legs', ['Hamstrings', 'Glutes'], 'Barbell', 'strength', 'intermediate', 'Push the hips back, feel the hamstrings, stop before the back rounds.', ['legs', 'compound']],
  ['Leg Curl', 'Legs', ['Hamstrings'], 'Machine', 'strength', 'beginner', 'Control the eccentric; do not swing.', ['legs', 'isolation']],
  ['Leg Extension', 'Legs', [], 'Machine', 'strength', 'beginner', 'Pause briefly at the top.', ['legs', 'isolation']],
  ['Walking Lunge', 'Legs', ['Glutes'], 'Dumbbell', 'strength', 'intermediate', 'Long step, torso tall, knee tracking straight.', ['legs', 'compound']],
  ['Bulgarian Split Squat', 'Legs', ['Glutes'], 'Dumbbell', 'strength', 'advanced', 'Rear foot elevated. Weight through the front heel.', ['legs', 'compound']],
  ['Hip Thrust', 'Glutes', ['Hamstrings'], 'Barbell', 'strength', 'intermediate', 'Ribs down, chin tucked, full lockout at the top.', ['legs', 'compound']],
  ['Calf Raise', 'Legs', [], 'Machine', 'strength', 'beginner', 'Full stretch at the bottom, pause at the top.', ['legs', 'isolation']],
  ['Barbell Curl', 'Arms', ['Biceps'], 'Barbell', 'strength', 'beginner', 'Elbows pinned to the sides.', ['pull', 'isolation']],
  ['Hammer Curl', 'Arms', ['Biceps', 'Forearms'], 'Dumbbell', 'strength', 'beginner', 'Neutral grip throughout.', ['pull', 'isolation']],
  ['Triceps Pushdown', 'Arms', ['Triceps'], 'Cable', 'strength', 'beginner', 'Upper arms still; extend fully.', ['push', 'isolation']],
  ['Overhead Triceps Extension', 'Arms', ['Triceps'], 'Dumbbell', 'strength', 'beginner', 'Keep the elbows narrow.', ['push', 'isolation']],
  ['Push-ups', 'Chest', ['Triceps', 'Core'], 'Bodyweight', 'bodyweight', 'beginner', 'Straight line from head to heels.', ['push', 'compound']],
  ['Dips', 'Chest', ['Triceps'], 'Bodyweight', 'bodyweight', 'intermediate', 'Lean forward slightly for chest emphasis.', ['push', 'compound']],
  ['Bodyweight Squat', 'Legs', ['Glutes'], 'Bodyweight', 'bodyweight', 'beginner', 'Controlled tempo, full range.', ['legs', 'compound']],
  ['Plank', 'Core', ['Shoulders'], 'Bodyweight', 'bodyweight', 'beginner', 'Ribs down, glutes tight. Quality over duration.', ['core']],
  ['Hanging Leg Raise', 'Core', [], 'Bodyweight', 'bodyweight', 'advanced', 'Control the descent; avoid swinging.', ['core']],
  ['Cable Woodchop', 'Core', ['Shoulders'], 'Cable', 'strength', 'intermediate', 'Rotate from the trunk, not the arms.', ['core']],
  ['Treadmill Run', 'Cardio', [], 'Machine', 'cardio', 'beginner', 'Steady conversational pace unless intervals are prescribed.', ['cardio']],
  ['Assault Bike', 'Cardio', [], 'Machine', 'cardio', 'intermediate', 'Drive with the legs; keep the cadence honest.', ['cardio', 'conditioning']],
  ['Rowing Machine', 'Cardio', ['Back'], 'Machine', 'cardio', 'beginner', 'Legs, then hips, then arms. Reverse on the return.', ['cardio', 'conditioning']],
  ['Incline Walk', 'Cardio', [], 'Machine', 'cardio', 'beginner', 'Low impact steady-state work.', ['cardio']],
  ['Jump Rope', 'Cardio', ['Calves'], 'Other', 'cardio', 'intermediate', 'Stay on the balls of the feet.', ['cardio', 'conditioning']],
  ['Hip Flexor Stretch', 'Mobility', [], 'Bodyweight', 'mobility', 'beginner', 'Squeeze the glute of the trailing leg. Hold 45 seconds per side.', ['mobility', 'recovery']],
  ['Thoracic Rotation', 'Mobility', ['Back'], 'Bodyweight', 'mobility', 'beginner', 'Slow, controlled rotations. Breathe out at end range.', ['mobility', 'recovery']],
  ['Foam Roll — Quads', 'Mobility', ['Legs'], 'Other', 'mobility', 'beginner', 'Slow passes; pause on tight spots.', ['mobility', 'recovery']],
];

function tracksFor(kind: Exercise['kind'], equipment: string): Exercise['tracks'] {
  if (kind === 'cardio') return ['duration', 'distance'];
  if (kind === 'mobility') return ['duration'];
  if (equipment === 'Bodyweight') return ['reps'];
  return ['weight', 'reps'];
}

function buildExercises(): Exercise[] {
  return GLOBAL_EXERCISES.map(([name, muscleGroup, secondaryMuscles, equipment, kind, difficulty, instructions, tags]) => ({
    id: id('ex'),
    scope: 'global' as const,
    ownerId: null,
    name, muscleGroup, secondaryMuscles, equipment, kind, difficulty, instructions, tags,
    tracks: tracksFor(kind, equipment),
  }));
}

/* ============================================================
   Expenses — sized for a premium boutique studio
   ============================================================ */
const FIXED_EXPENSES: Array<{ category: ExpenseCategory; description: string; vendor: string; base: number; jitter: number }> = [
  { category: 'rent',        description: 'Studio rent',                vendor: 'Prestige Estates',   base: 95000,  jitter: 0 },
  { category: 'salaries',    description: 'Coaching & floor staff',     vendor: 'Payroll',            base: 128000, jitter: 6000 },
  { category: 'electricity', description: 'Electricity',                vendor: 'BESCOM',             base: 26000,  jitter: 5000 },
  { category: 'internet',    description: 'Broadband & audio system',   vendor: 'ACT Fibernet',       base: 4500,   jitter: 0 },
  { category: 'software',    description: 'Fitness Manager subscription', vendor: 'Fitness Manager',  base: 4999,   jitter: 0 },
  { category: 'cleaning',    description: 'Housekeeping & laundry',     vendor: 'SparkClean',         base: 13000,  jitter: 2000 },
];
const VARIABLE_EXPENSES: Array<{ category: ExpenseCategory; description: string; vendor: string; min: number; max: number }> = [
  { category: 'equipment',   description: 'Calibrated plate set',       vendor: 'Rogue India',     min: 22000, max: 48000 },
  { category: 'equipment',   description: 'Adjustable dumbbell pair',   vendor: 'Kobo Fitness',    min: 12000, max: 26000 },
  { category: 'repairs',     description: 'Treadmill belt service',     vendor: 'FitServe',        min: 5000,  max: 14000 },
  { category: 'maintenance', description: 'Rubber flooring repair',     vendor: 'BuildRight',      min: 7000,  max: 19000 },
  { category: 'maintenance', description: 'Shower & plumbing',          vendor: 'BuildRight',      min: 4000,  max: 11000 },
  { category: 'marketing',   description: 'Referral programme credits', vendor: 'In-house',        min: 6000,  max: 18000 },
  { category: 'other',       description: 'Towels, water & pantry',     vendor: 'AquaFresh',       min: 4000,  max: 9000 },
];

/** Six days open, Sunday short — a sensible default the owner can edit. */
export function defaultHours(): OperatingHours[] {
  return [
    { open: '07:00', close: '13:00', closed: false },   // Sunday
    { open: '05:30', close: '22:00', closed: false },
    { open: '05:30', close: '22:00', closed: false },
    { open: '05:30', close: '22:00', closed: false },
    { open: '05:30', close: '22:00', closed: false },
    { open: '05:30', close: '22:00', closed: false },
    { open: '06:00', close: '20:00', closed: false },
  ];
}

/**
 * Configuration only — `gatewayConnected` is false and stays false
 * until a real integration phase. Nothing in the app pretends a
 * gateway exists.
 */
export function defaultPaymentSettings(): PaymentSettings {
  return {
    methods: ['cash', 'upi', 'card', 'bank_transfer'],
    upiId: '', bankAccountName: '', bankAccountNumber: '', bankIfsc: '',
    gatewayProvider: 'none', gatewayConnected: false,
    invoicePrefix: 'INV', taxNote: '',
  };
}

export function freshSetup(now = new Date().toISOString()): GymSetup {
  return {
    steps: {
      profile: 'pending', plans: 'pending', payments: 'pending',
      features: 'pending', first_member: 'pending',
    },
    startedAt: now, completedAt: null, dismissed: false,
  };
}

export function completedSetup(now = new Date().toISOString()): GymSetup {
  return {
    steps: {
      profile: 'done', plans: 'done', payments: 'done',
      features: 'done', first_member: 'done',
    },
    startedAt: now, completedAt: now, dismissed: true,
  };
}

function makeGym(name: string, slug: string, area: string, n: number): Gym {
  return {
    id: `gym_${slug}`, name, slug,
    phone: `+91 98${int(10, 99)}0 ${int(10000, 99999)}`,
    email: `hello@${slug}.fit`,
    address: `${int(1, 60)}, ${pick(STREETS)}, ${area}, Bengaluru 560${String(n).padStart(3, '0')}`,
    currency: 'INR', timezone: 'Asia/Kolkata',
    createdAt: new Date(2023, 4, 12).toISOString(),
    status: 'active', dataMode: 'demo', kind: 'studio',
    logoUrl: '', hours: defaultHours(), payment: defaultPaymentSettings(),
    setup: completedSetup(new Date(2023, 4, 12).toISOString()),
  };
}

/** Premium pricing — a private studio, not a commercial chain. */
function makePlans(gymId: string): MembershipPlan[] {
  const rows: Array<[string, number, number, string]> = [
    ['Monthly', 30, 8500, 'Full studio access with coached floor hours.'],
    ['Quarterly', 90, 23000, 'Three months, includes a quarterly assessment.'],
    ['Half-Yearly', 180, 42000, 'Six months, includes body composition tracking.'],
    ['Annual', 365, 78000, 'Twelve months, includes four personal training sessions.'],
  ];
  return rows.map(([name, durationDays, price, description]) => ({
    id: id('plan'), gymId, name, durationDays, price, isActive: true, description,
  }));
}

/** Premium rosters skew to longer commitments — that is what the price buys. */
const PLAN_WEIGHTS = [0.30, 0.34, 0.20, 0.16];
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

function makeFitnessProfile(): FitnessProfile {
  return {
    heightCm: 152 + int(0, 36),
    targetWeightKg: 0,               // filled after the first measurement
    goal: pick(GOALS),
    experience: pick(EXPERIENCE),
    preferredDays: chance(0.5) ? [1, 3, 5] : [1, 2, 4, 6],
    waterTargetMl: pick([2500, 3000, 3500]),
    weeklySessionTarget: pick([3, 4, 4, 5]),
    notes: '',
  };
}

/* ============================================================
   Programs
   ============================================================ */
interface DayTemplate {
  dayIndex: number;
  title: string;
  focus: string;
  isRest?: boolean;
  warmup?: string;
  cooldown?: string;
  notes?: string;
  items?: Array<[exercise: string, sets: number, reps: number, weight: number, rest: number, notes?: string]>;
}

const PPL_DAYS: DayTemplate[] = [
  {
    dayIndex: 1, title: 'Push A', focus: 'Chest · Shoulders · Triceps',
    warmup: '5 min incline walk, band pull-aparts, 2 ramp-up sets on the first lift.',
    cooldown: 'Chest doorway stretch, 90 seconds per side.',
    items: [
      ['Barbell Bench Press', 4, 8, 60, 120, 'Leave one rep in reserve on the first three sets.'],
      ['Incline Dumbbell Press', 3, 10, 22, 90],
      ['Overhead Press', 3, 8, 35, 90],
      ['Lateral Raise', 3, 15, 8, 60, 'Strict form, light weight.'],
      ['Triceps Pushdown', 3, 12, 25, 60],
    ],
  },
  {
    dayIndex: 2, title: 'Pull A', focus: 'Back · Biceps',
    warmup: '5 min rowing machine, scapular hangs.',
    cooldown: 'Lat stretch and thoracic rotations.',
    items: [
      ['Deadlift', 4, 5, 100, 180, 'Stop the set the moment the back rounds.'],
      ['Pull-ups', 4, 8, 0, 120, 'Assisted if needed.'],
      ['Barbell Row', 3, 10, 45, 90],
      ['Face Pull', 3, 15, 20, 60],
      ['Barbell Curl', 3, 12, 25, 60],
    ],
  },
  {
    dayIndex: 3, title: 'Legs A', focus: 'Quads · Glutes · Hamstrings',
    warmup: '5 min bike, bodyweight squats, hip flexor stretch.',
    cooldown: 'Quad foam roll, 2 minutes per side.',
    items: [
      ['Back Squat', 4, 8, 80, 150, 'Full depth. Belt optional above 80%.'],
      ['Romanian Deadlift', 3, 10, 60, 120],
      ['Leg Press', 3, 12, 140, 90],
      ['Leg Curl', 3, 12, 35, 60],
      ['Calf Raise', 4, 15, 40, 45],
    ],
  },
  { dayIndex: 4, title: 'Recovery', focus: 'Mobility & easy cardio', isRest: true, notes: 'Optional 20–30 minute walk plus the mobility circuit. Rest is training.' },
  {
    dayIndex: 5, title: 'Push B', focus: 'Shoulders · Chest',
    warmup: 'Band work and two ramp-up sets.',
    items: [
      ['Dumbbell Shoulder Press', 4, 10, 20, 90],
      ['Dips', 3, 10, 0, 90],
      ['Cable Fly', 3, 12, 15, 60],
      ['Overhead Triceps Extension', 3, 12, 15, 60],
      ['Plank', 3, 1, 0, 45, 'Hold 45–60 seconds.'],
    ],
  },
  {
    dayIndex: 6, title: 'Pull B + Conditioning', focus: 'Back · Arms · Engine',
    warmup: '5 min rowing machine.',
    cooldown: '5 minutes easy walking.',
    items: [
      ['Lat Pulldown', 4, 10, 50, 90],
      ['Seated Cable Row', 3, 12, 45, 90],
      ['Hammer Curl', 3, 12, 12, 60],
      ['Hanging Leg Raise', 3, 10, 0, 60],
      ['Assault Bike', 1, 1, 0, 0, '10 rounds: 20 seconds hard, 40 seconds easy.'],
    ],
  },
  { dayIndex: 0, title: 'Rest', focus: 'Full rest', isRest: true, notes: 'Sleep, food, and stay off the floor.' },
];

const ONBOARDING_DAYS: DayTemplate[] = [
  {
    dayIndex: 1, title: 'Day 1 — Assessment & introduction', focus: 'Movement screen · baselines',
    notes: 'Coach-led. Record starting measurements and establish baseline loads. Nothing near failure today.',
    warmup: 'Guided by your coach.',
    items: [
      ['Bodyweight Squat', 3, 10, 0, 60, 'Coach assesses depth and control.'],
      ['Push-ups', 3, 8, 0, 60, 'Elevate the hands if needed.'],
      ['Lat Pulldown', 3, 10, 25, 60, 'Find a comfortable working load.'],
      ['Plank', 3, 1, 0, 45, 'Hold 30 seconds.'],
      ['Incline Walk', 1, 1, 0, 0, '10 minutes, easy.'],
    ],
  },
  {
    dayIndex: 2, title: 'Day 2 — Upper body fundamentals', focus: 'Pressing & pulling patterns',
    warmup: '5 min rowing machine, band pull-aparts.',
    items: [
      ['Dumbbell Shoulder Press', 3, 10, 10, 90, 'Technique before load.'],
      ['Chest Supported Row', 3, 12, 25, 90],
      ['Incline Dumbbell Press', 3, 10, 12, 90],
      ['Face Pull', 3, 15, 15, 60],
    ],
  },
  {
    dayIndex: 3, title: 'Day 3 — Lower body fundamentals', focus: 'Squat & hinge patterns',
    warmup: '5 min bike, hip flexor stretch.',
    items: [
      ['Leg Press', 3, 12, 60, 90, 'Learn the range before adding load.'],
      ['Romanian Deadlift', 3, 10, 30, 90, 'Light. The pattern is the point.'],
      ['Walking Lunge', 3, 10, 8, 60],
      ['Calf Raise', 3, 15, 20, 45],
    ],
  },
  {
    dayIndex: 4, title: 'Day 4 — Recovery & mobility', focus: 'Move well, recover',
    isRest: true,
    notes: 'Expect to be sore. This day is deliberate — the mobility circuit plus an easy walk.',
    items: [
      ['Hip Flexor Stretch', 2, 1, 0, 30, '45 seconds per side.'],
      ['Thoracic Rotation', 2, 8, 0, 30],
      ['Foam Roll — Quads', 2, 1, 0, 30, '90 seconds per leg.'],
      ['Incline Walk', 1, 1, 0, 0, '20 minutes, conversational pace.'],
    ],
  },
  {
    dayIndex: 5, title: 'Day 5 — Push training', focus: 'Chest · Shoulders · Triceps',
    warmup: 'Band work plus two ramp-up sets.',
    items: [
      ['Barbell Bench Press', 3, 8, 30, 120, 'Coach spots the first working set.'],
      ['Dumbbell Shoulder Press', 3, 10, 12, 90],
      ['Cable Fly', 3, 12, 10, 60],
      ['Triceps Pushdown', 3, 12, 15, 60],
    ],
  },
  {
    dayIndex: 6, title: 'Day 6 — Pull training', focus: 'Back · Biceps',
    warmup: '5 min rowing machine.',
    items: [
      ['Lat Pulldown', 3, 10, 30, 90],
      ['Seated Cable Row', 3, 12, 30, 90],
      ['Barbell Curl', 3, 12, 15, 60],
      ['Hanging Leg Raise', 3, 8, 0, 60, 'Bent knees are fine to start.'],
    ],
  },
  {
    dayIndex: 0, title: 'Day 7 — Review & plan', focus: 'Re-assess · set goals',
    isRest: true,
    notes: 'Sit down with your coach: review week one, agree your goals, and move onto a full program.',
  },
];

function buildProgram(
  gymId: string, name: string, description: string, kind: Program['kind'],
  templates: DayTemplate[], exercises: Exercise[],
): Program {
  const byName = (n: string) => exercises.find((e) => e.name === n);
  const programId = id('prg');
  const days: ProgramDay[] = templates.map((t) => {
    const dayId = id('pday');
    const items: ProgramExercise[] = (t.items ?? []).flatMap((row, i) => {
      const ex = byName(row[0]);
      if (!ex) return [];
      return [{
        id: id('pex'), dayId, exerciseId: ex.id, order: i,
        sets: row[1], reps: row[2], targetWeightKg: row[3], restSec: row[4],
        notes: row[5] ?? '',
      }];
    });
    return {
      id: dayId, programId, weekNo: 1, dayIndex: t.dayIndex,
      title: t.title, focus: t.focus, isRest: Boolean(t.isRest),
      warmup: t.warmup ?? '', cooldown: t.cooldown ?? '', notes: t.notes ?? '',
      exercises: items,
    };
  });
  return {
    id: programId, gymId, name, description, kind,
    durationWeeks: 1, isTemplate: true, memberId: null, startedAt: null,
    createdAt: new Date().toISOString(), days,
  };
}

/** Assigning a program clones the template onto the member. */
function assignProgram(template: Program, memberId: string, startedAt: ISODate): Program {
  const programId = id('prg');
  return {
    ...template,
    id: programId,
    isTemplate: false,
    memberId,
    startedAt,
    days: template.days.map((d) => {
      const dayId = id('pday');
      return {
        ...d, id: dayId, programId,
        exercises: d.exercises.map((e) => ({ ...e, id: id('pex'), dayId })),
      };
    }),
  };
}

/* ============================================================
   Diet
   ============================================================ */
function seedDietPlan(gymId: string, db: Database): DietPlan {
  const rows: Array<[DietPlan['items'][number]['meal'], string, string, number, number, number, number]> = [
    ['breakfast', 'Oats with milk, banana & almonds', '1 bowl', 380, 16, 54, 10],
    ['breakfast', 'Egg white omelette', '4 whites + 1 whole', 190, 22, 2, 10],
    ['breakfast', 'Black coffee', '1 cup', 5, 0, 1, 0],
    ['lunch', 'Brown rice', '1.5 cup', 320, 7, 68, 3],
    ['lunch', 'Grilled chicken breast', '180 g', 300, 56, 0, 7],
    ['lunch', 'Mixed vegetable sabzi', '1 bowl', 140, 4, 16, 6],
    ['lunch', 'Curd', '1 cup', 100, 8, 8, 4],
    ['snack', 'Whey protein shake', '1 scoop', 130, 25, 3, 2],
    ['snack', 'Roasted chana & walnuts', '40 g', 190, 9, 20, 8],
    ['dinner', 'Roti (whole wheat)', '3 pieces', 300, 9, 60, 4],
    ['dinner', 'Paneer bhurji', '150 g', 280, 20, 8, 19],
    ['dinner', 'Garden salad, olive oil', '1 plate', 120, 3, 9, 8],
  ];
  const plan: DietPlan = {
    id: id('dpl'), gymId, memberId: null, name: 'Lean gain — 2,450 kcal', waterTargetL: 3.5,
    source: 'assigned', notes: 'Built for members in a lean-gain block. Adjust portions with your coach.',
    updatedAt: new Date().toISOString(),
    items: rows.map(([meal, item, qty, calories, protein, carbs, fat], i) => ({
      id: id('ditm'), meal, order: i, item, qty, calories, protein, carbs, fat,
    })),
  };
  db.dietPlans.push(plan);
  return plan;
}

/* ============================================================
   Build
   ============================================================ */
interface BuildOpts { memberCount: number; attendanceDays: number; rich: boolean }

function buildGym(gym: Gym, db: Database, opts: BuildOpts, today: ISODate): void {
  db.gyms.push(gym);
  const plans = makePlans(gym.id);
  db.plans.push(...plans);

  const ownerName = gym.slug === 'atlas' ? 'Nikhil Raghavan' : 'Sunita Rao';
  db.users.push({
    id: id('user'), gymId: gym.id, role: 'owner', name: ownerName,
    phone: gym.phone,
    email: gym.slug === 'atlas' ? 'owner@fitnessmanager.demo' : `owner@${gym.slug}.fit`,
    authProvider: 'demo',
    authUid: gym.slug === 'atlas' ? 'demo-owner' : `demo-owner-${gym.slug}`,
  });

  const ppl = opts.rich ? buildProgram(gym.id, 'Push / Pull / Legs — 5 day',
    'Our standard intermediate split. Five training days, one recovery day, one full rest day.',
    'standard', PPL_DAYS, db.exercises) : null;
  const onboarding = opts.rich ? buildProgram(gym.id, '7-Day Onboarding',
    'The first week for every new member: assessment, fundamentals, recovery, then the full patterns.',
    'onboarding', ONBOARDING_DAYS, db.exercises) : null;
  if (ppl) db.programs.push(ppl);
  if (onboarding) db.programs.push(onboarding);

  const dietTemplate = opts.rich ? seedDietPlan(gym.id, db) : null;
  const codePrefix = gym.slug === 'atlas' ? 'ATL' : 'PF';

  for (let i = 0; i < opts.memberCount; i++) {
    const isMale = chance(0.58);
    const first = isMale ? pick(FIRST_M) : pick(FIRST_F);
    const name = `${first} ${pick(LAST)}`;
    const joinedAgo = i === 0 && opts.rich ? 380 : int(5, 400);
    const joinedAt = addDays(today, -joinedAgo);

    const member: Member = {
      id: id('mem'), gymId: gym.id,
      memberCode: `${codePrefix}-${String(1000 + i)}`,
      name,
      phone: `+91 ${int(70, 99)}${int(100, 999)} ${int(10000, 99999)}`,
      email: `${first.toLowerCase()}.${int(10, 99)}@${pick(['gmail.com', 'outlook.com', 'proton.me'])}`,
      dob: toISO(new Date(int(1976, 2005), int(0, 11), int(1, 28))),
      gender: isMale ? 'male' : 'female',
      address: `${int(1, 120)}, ${pick(STREETS)}, ${pick(AREAS)}, Bengaluru`,
      emergencyContact: {
        name: `${chance(0.5) ? pick(FIRST_M) : pick(FIRST_F)} ${pick(LAST)}`,
        phone: `+91 ${int(70, 99)}${int(100, 999)} ${int(10000, 99999)}`,
        relation: pick(RELATIONS),
      },
      photoUrl: '', joinedAt, lifecycle: 'active',
      fitness: makeFitnessProfile(),
      onboardedAt: timeAt(joinedAt, 11, 15),
    };
    db.members.push(member);

    /* ---- membership chain ---- */
    const loyalty = 0.35 + rnd() * 0.6;      // premium members renew more reliably
    let cursor = joinedAt;
    let isFirst = true;
    let guard = 0;
    while (guard++ < 24) {
      const plan = pickPlan(plans);
      const start = cursor;
      const end = addDays(start, plan.durationDays - 1);
      const discount = chance(0.14) ? Math.round((plan.price * pick([0.05, 0.1])) / 100) * 100 : 0;

      const membership: Membership = {
        id: id('msh'), gymId: gym.id, memberId: member.id, planId: plan.id,
        planNameSnapshot: plan.name, priceSnapshot: plan.price, discount,
        startDate: start, endDate: end,
        kind: isFirst ? 'new' : 'renewal',
        createdAt: timeAt(start, int(9, 20), int(0, 59)),
        cancelledAt: null,
      };
      db.memberships.push(membership);

      const net = plan.price - discount;
      const partial = chance(0.12);
      const paid = partial ? Math.round((net * pick([0.4, 0.5, 0.6])) / 100) * 100 : net;
      db.payments.push({
        id: id('pay'), gymId: gym.id, memberId: member.id, membershipId: membership.id,
        amount: paid, method: pick(METHODS),
        source: isFirst ? 'membership' : 'renewal',
        paidAt: membership.createdAt,
        receiptNo: `FM-${String(db.payments.length + 1001)}`,
        note: partial ? 'Part payment at joining' : '',
      });
      if (partial && chance(0.55)) {
        const settleOn = addDays(start, int(3, 18));
        if (settleOn <= today) {
          db.payments.push({
            id: id('pay'), gymId: gym.id, memberId: member.id, membershipId: membership.id,
            amount: net - paid, method: pick(METHODS),
            source: isFirst ? 'membership' : 'renewal',
            paidAt: timeAt(settleOn, int(10, 20), int(0, 59)),
            receiptNo: `FM-${String(db.payments.length + 1001)}`,
            note: 'Balance settled',
          });
        }
      }

      isFirst = false;
      cursor = addDays(end, chance(0.82) ? 1 : int(2, 10));
      if (cursor > today) break;
      if (rnd() > loyalty * 0.9 + 0.2) break;
    }

    /* ---- personal training is a real premium revenue line ---- */
    if (chance(0.34)) {
      const when = addDays(today, -int(0, 75));
      db.payments.push({
        id: id('pay'), gymId: gym.id, memberId: member.id, membershipId: null,
        amount: pick([8000, 12000, 15000, 22000, 30000]), method: pick(METHODS),
        source: 'personal_training', paidAt: timeAt(when, int(8, 20), int(0, 59)),
        receiptNo: `FM-${String(db.payments.length + 1001)}`, note: 'Personal training package',
      });
    }
  }

  if (!opts.rich || !ppl || !onboarding) return;

  /* ---- the demo member gets a complete, rich history ---- */
  const demo = db.members.find((m) => m.gymId === gym.id)!;
  demo.name = 'Aarav Menon';
  demo.email = 'member@fitnessmanager.demo';
  demo.phone = '+91 98450 21174';
  demo.dob = '1994-03-18';
  demo.gender = 'male';
  demo.fitness = {
    heightCm: 176, targetWeightKg: 76, goal: 'lose_fat', experience: 'intermediate',
    preferredDays: [1, 2, 3, 5, 6], waterTargetMl: 3500, weeklySessionTarget: 5,
    notes: 'Prefers early mornings. Right shoulder gets cranky on heavy overhead work.',
  };
  db.users.push({
    id: id('user'), gymId: gym.id, role: 'member', name: demo.name,
    phone: demo.phone, email: demo.email, memberId: demo.id,
    authProvider: 'demo', authUid: 'demo-member',
  });

  const roster = db.members.filter((m) => m.gymId === gym.id);
  roster.forEach((m, i) => {
    if (i % 10 < 7) ensureCurrentMembership(db, gym.id, m, plans, today);
  });

  /* ---- programs: everyone current gets one; the newest get onboarding ---- */
  roster.forEach((m, i) => {
    const tenure = diffDays(m.joinedAt, today);
    if (tenure <= 21 && chance(0.9)) {
      db.programs.push(assignProgram(onboarding, m.id, m.joinedAt));
    } else if (i % 10 < 8) {
      db.programs.push(assignProgram(ppl, m.id, addDays(today, -int(20, 120))));
    }
  });
  if (!db.programs.some((p) => p.memberId === demo.id)) {
    db.programs.push(assignProgram(ppl, demo.id, addDays(today, -96)));
  }

  if (dietTemplate) {
    roster.forEach((m, i) => {
      if (i % 3 === 0) db.dietPlans.push({ ...dietTemplate, id: id('dpl'), memberId: m.id });
    });
    if (!db.dietPlans.some((p) => p.memberId === demo.id)) {
      db.dietPlans.push({ ...dietTemplate, id: id('dpl'), memberId: demo.id });
    }
  }

  seedAttendance(db, gym.id, roster, opts.attendanceDays, today, demo.id);
  seedExpenses(db, gym.id, today);
  seedTraining(db, gym.id, roster, demo, today);
  seedWater(db, gym.id, roster, demo, today);
  seedGoals(db, gym.id, roster, demo, today);
  seedNotes(db, gym.id, roster);
  seedMessages(db, gym.id, roster, today);
  seedAnnouncements(db, gym.id);
}

function ensureCurrentMembership(
  db: Database, gymId: string, member: Member, plans: MembershipPlan[], today: ISODate,
): void {
  const mine = db.memberships.filter((m) => m.memberId === member.id);
  if (!mine.length) return;
  const last = mine.reduce((a, b) => (b.endDate > a.endDate ? b : a));
  if (last.endDate >= today) return;

  const plan = pickPlan(plans);
  const daysLeft = pick([3, 5, 8, 11, 13, 19, 27, 41, 58, 84, 119, 168, 240]);
  const end = addDays(today, daysLeft);
  const start = addDays(end, -(plan.durationDays - 1));
  const discount = chance(0.12) ? Math.round((plan.price * 0.1) / 100) * 100 : 0;
  const createdAt = timeAt(start > today ? today : start, int(9, 20), int(0, 59));

  const membership: Membership = {
    id: id('msh'), gymId, memberId: member.id, planId: plan.id,
    planNameSnapshot: plan.name, priceSnapshot: plan.price, discount,
    startDate: start, endDate: end, kind: 'renewal', createdAt, cancelledAt: null,
  };
  db.memberships.push(membership);

  const net = plan.price - discount;
  const partial = chance(0.16);
  db.payments.push({
    id: id('pay'), gymId, memberId: member.id, membershipId: membership.id,
    amount: partial ? Math.round((net * pick([0.4, 0.5, 0.6])) / 100) * 100 : net,
    method: pick(METHODS), source: 'renewal', paidAt: createdAt,
    receiptNo: `FM-${String(db.payments.length + 1001)}`,
    note: partial ? 'Part payment — balance pending' : '',
  });
}

/**
 * Attendance drives everything downstream (streaks, engagement, sessions), so
 * members get a stable personal habit plus a recent trend. A few members
 * deliberately taper off — that is what makes the owner's attention queue real.
 */
function seedAttendance(
  db: Database, gymId: string, roster: Member[], days: number, today: ISODate, demoId: string,
): void {
  const window = rangeDays(addDays(today, -(days - 1)), today);
  const nowHour = new Date().getHours();

  roster.forEach((m, idx) => {
    const mine = db.memberships.filter((x) => x.memberId === m.id);
    if (!mine.length) return;

    // People turn up on their program days — attendance follows the plan.
    const program = db.programs.find((p) => p.memberId === m.id) ?? null;
    const isDemo = m.id === demoId;
    const baseHabit = 0.28 + rnd() * 0.52;
    const morningPerson = isDemo ? true : chance(0.62);
    // ~12% of the roster is drifting away; a couple have stopped entirely.
    const drifting = !isDemo && idx % 9 === 4;
    const stopped = !isDemo && idx % 17 === 6;

    for (const d of window) {
      const covered = mine.some((x) => d >= x.startDate && d <= x.endDate);
      if (!covered) continue;

      const daysAgo = diffDays(d, today);
      let habit = baseHabit;
      if (stopped && daysAgo <= 16) continue;                 // silent for 16 days
      if (drifting && daysAgo <= 28) habit *= 0.28;           // sharp recent drop

      const dow = parseISO(d).getDay();
      const dayFactor = dow === 0 ? 0.3 : dow === 6 ? 0.75 : 1;
      const programDay = program?.days.find((x) => x.dayIndex === dow) ?? null;

      // The demo member is a model member: near-perfect program adherence, so
      // the showcase has a real streak and a real progression curve behind it.
      const probability = isDemo
        ? (programDay?.isRest === false ? 0.94 : 0.06)
        : programDay
          ? (programDay.isRest ? 0.07 : Math.min(0.95, habit * 1.35))
          : habit * dayFactor;

      if (!chance(probability)) continue;

      const hour = morningPerson ? int(6, 9) : int(17, 21);
      if (d === today && hour > nowHour) continue;

      const minute = int(0, 59);
      db.attendance.push({
        id: id('att'), gymId, memberId: m.id, type: 'check_in',
        at: timeAt(d, hour, minute), source: 'manual',
      });

      const stayMin = int(50, 105);
      const outHour = hour + Math.floor((minute + stayMin) / 60);
      const outMin = (minute + stayMin) % 60;
      const stillInside = d === today && outHour >= nowHour;
      if (!stillInside && chance(0.92) && outHour < 24) {
        db.attendance.push({
          id: id('att'), gymId, memberId: m.id, type: 'check_out',
          at: timeAt(d, outHour, outMin), source: 'manual',
        });
      }
    }
  });
  db.attendance.sort((a, b) => a.at.localeCompare(b.at));
}

function seedExpenses(db: Database, gymId: string, today: ISODate): void {
  const anchorMonth = startOfMonth(today);
  for (let back = 11; back >= 0; back--) {
    const mk = monthKey(addMonths(anchorMonth, -back));

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

/**
 * Sessions with genuine progressive overload: each member holds a per-exercise
 * working weight that creeps upward, so estimated 1RM trends and personal
 * records emerge from the data instead of being decorated on top of it.
 */
function seedTraining(
  db: Database, gymId: string, roster: Member[], demo: Member, today: ISODate,
): void {
  const strength = db.exercises.filter((e) => e.kind === 'strength');
  const cardio = db.exercises.filter((e) => e.kind === 'cardio');

  for (const m of roster) {
    const isDemo = m.id === demo.id;
    const program = db.programs.find((p) => p.memberId === m.id) ?? null;
    const attended = [...new Set(
      db.attendance.filter((a) => a.memberId === m.id && a.type === 'check_in').map((a) => dayOf(a.at)),
    )].sort();
    if (!attended.length) continue;

    // Starting loads scale with experience and body size.
    const strengthFactor = (m.fitness.experience === 'advanced' ? 1.35
      : m.fitness.experience === 'intermediate' ? 1.0 : 0.68)
      * (m.gender === 'male' ? 1 : 0.66);
    const working = new Map<string, number>();
    const baseFor = (exId: string, target: number) => {
      if (!working.has(exId)) {
        working.set(exId, Math.max(5, Math.round(((target || 20) * strengthFactor * (0.82 + rnd() * 0.2)) / 2.5) * 2.5));
      }
      return working.get(exId)!;
    };

    const logRate = isDemo ? 1 : 0.45 + rnd() * 0.35;

    attended.forEach((date, i) => {
      if (!isDemo && !chance(logRate)) return;

      const dow = parseISO(date).getDay();
      const day = program?.days.find((d) => d.dayIndex === dow && !d.isRest) ?? null;
      const sessionId = id('ses');
      const startHour = int(6, 20);
      const startedAt = timeAt(date, startHour, int(0, 55));
      const sets: SessionSet[] = [];

      const planned = day && day.exercises.length
        ? day.exercises.map((pe) => ({
          exerciseId: pe.exerciseId, sets: pe.sets, reps: pe.reps, target: pe.targetWeightKg,
        }))
        : Array.from({ length: int(3, 4) }, () => {
          const ex = pick(strength);
          return { exerciseId: ex.id, sets: int(3, 4), reps: int(8, 12), target: 30 };
        });

      planned.forEach((pl, order) => {
        const ex = db.exercises.find((e) => e.id === pl.exerciseId);
        if (!ex) return;

        if (ex.kind === 'cardio' || ex.kind === 'mobility') {
          sets.push({
            id: id('sst'), sessionId, exerciseId: ex.id, order, setNo: 1, kind: 'normal',
            reps: 0, weightKg: 0, durationSec: int(10, 30) * 60,
            distanceKm: ex.kind === 'cardio' ? Math.round(rnd() * 60) / 10 : 0,
            rpe: null, completed: true,
          });
          return;
        }

        const isBodyweight = ex.equipment === 'Bodyweight';
        // A slow upward creep across the training history.
        const progression = 1 + (i / Math.max(1, attended.length)) * (isDemo ? 0.26 : 0.16);
        const base = baseFor(ex.id, pl.target);
        const load = isBodyweight ? 0 : Math.max(5, Math.round((base * progression) / 2.5) * 2.5);

        // Warm-ups are excluded from records and volume, so they are only worth
        // storing where they are actually read: the demo member and recent history.
        const keepWarmups = isDemo || i >= attended.length - 8;
        if (!isBodyweight && load > 20 && keepWarmups) {
          sets.push({
            id: id('sst'), sessionId, exerciseId: ex.id, order, setNo: 0, kind: 'warmup',
            reps: 10, weightKg: Math.round((load * 0.5) / 2.5) * 2.5,
            durationSec: 0, distanceKm: 0, rpe: null, completed: true,
          });
        }
        for (let s = 1; s <= pl.sets; s++) {
          sets.push({
            id: id('sst'), sessionId, exerciseId: ex.id, order, setNo: s, kind: 'normal',
            reps: Math.max(1, pl.reps + int(-2, 2)),
            weightKg: isBodyweight ? 0 : load + (s > 2 && chance(0.3) ? -2.5 : 0),
            durationSec: 0, distanceKm: 0,
            rpe: chance(0.4) ? int(7, 10) : null,
            completed: true,
          });
        }
      });

      if (chance(0.25) && cardio.length) {
        const c = pick(cardio);
        sets.push({
          id: id('sst'), sessionId, exerciseId: c.id, order: planned.length, setNo: 1, kind: 'normal',
          reps: 0, weightKg: 0, durationSec: int(10, 25) * 60,
          distanceKm: Math.round(rnd() * 50) / 10, rpe: null, completed: true,
        });
      }

      if (!sets.length) return;
      const durationSec = int(45, 95) * 60;
      const session: WorkoutSession = {
        id: sessionId, gymId, memberId: m.id, date, memberWorkoutId: null,
        startedAt,
        finishedAt: new Date(new Date(startedAt).getTime() + durationSec * 1000).toISOString(),
        programDayId: day?.id ?? null,
        title: day?.title ?? 'Training session',
        durationSec, notes: i % 11 === 0 ? 'Felt strong today.' : '',
        status: 'completed', sets,
      };
      db.sessions.push(session);
    });

    /* ---- measurements roughly every three weeks ---- */
    const spanDays = Math.min(300, Math.max(60, diffDays(m.joinedAt, today)));
    const startWeight = isDemo ? 84.6 : (m.gender === 'male' ? 66 : 52) + rnd() * 28;
    const trend = isDemo ? -0.03 : (chance(0.62) ? -1 : 1) * (0.006 + rnd() * 0.03);
    const height = m.fitness.heightCm ?? 170;
    for (let back = spanDays; back >= 0; back -= 21) {
      const d = addDays(today, -back);
      const elapsed = spanDays - back;
      const w = startWeight + trend * elapsed + (rnd() - 0.5) * 0.6;
      db.measurements.push({
        id: id('bm'), gymId, memberId: m.id, takenAt: d,
        weightKg: Math.round(w * 10) / 10,
        heightCm: height,
        chestCm: Math.round((94 + (w - startWeight) * 0.5 + rnd() * 2) * 10) / 10,
        waistCm: Math.round((86 + (w - startWeight) * 0.9 + rnd() * 1.5) * 10) / 10,
        armsCm: Math.round((33 - (w - startWeight) * 0.12 + rnd()) * 10) / 10,
        thighsCm: Math.round((55 + (w - startWeight) * 0.35 + rnd()) * 10) / 10,
        bodyFatPct: Math.round((21 + (w - startWeight) * 0.55 + rnd()) * 10) / 10,
      });
    }
    const latest = db.measurements.filter((x) => x.memberId === m.id).at(-1);
    if (latest && !m.fitness.targetWeightKg) {
      m.fitness.targetWeightKg = Math.round(
        (m.fitness.goal === 'build_muscle' ? latest.weightKg + int(3, 6) : latest.weightKg - int(3, 8)) * 10,
      ) / 10;
    }
  }

  db.sessions.sort((a, b) => b.date.localeCompare(a.date));
  db.measurements.sort((a, b) => a.takenAt.localeCompare(b.takenAt));

  /* A member's own custom exercise — scoped to them, never the gym library. */
  db.exercises.push({
    id: id('ex'), scope: 'member', ownerId: demo.id,
    name: 'Landmine Press (single arm)', muscleGroup: 'Shoulders',
    secondaryMuscles: ['Chest', 'Core'], equipment: 'Barbell', kind: 'strength',
    difficulty: 'intermediate',
    instructions: 'Shoulder-friendly pressing angle. Keep the ribs down and press across the body.',
    tags: ['push', 'custom'], tracks: ['weight', 'reps'],
  });
}

function seedWater(db: Database, gymId: string, roster: Member[], demo: Member, today: ISODate): void {
  for (const m of roster) {
    const isDemo = m.id === demo.id;
    if (!isDemo && !chance(0.45)) continue;
    const days = isDemo ? 30 : int(6, 18);
    for (let back = days; back >= 0; back--) {
      const date = addDays(today, -back);
      if (!isDemo && !chance(0.6)) continue;
      const target = m.fitness.waterTargetMl;
      // today is partial — the ring should not already be full when you open the app
      const fraction = back === 0 ? 0.35 + rnd() * 0.3 : 0.55 + rnd() * 0.6;
      let poured = 0;
      const goal = Math.min(target * 1.15, target * fraction);
      while (poured < goal) {
        const ml = pick([250, 250, 500, 500, 750]);
        poured += ml;
        db.water.push({
          id: id('wat'), gymId, memberId: m.id, date, ml,
          at: timeAt(date, int(7, 21), int(0, 59)),
        });
      }
    }
  }
}

function seedGoals(db: Database, gymId: string, roster: Member[], demo: Member, today: ISODate): void {
  const bench = db.exercises.find((e) => e.name === 'Barbell Bench Press');
  for (const m of roster) {
    const isDemo = m.id === demo.id;
    if (!isDemo && !chance(0.5)) continue;
    const latest = db.measurements.filter((x) => x.memberId === m.id).at(-1);
    if (latest && m.fitness.targetWeightKg) {
      db.goals.push({
        id: id('goal'), gymId, memberId: m.id, kind: 'weight',
        label: m.fitness.targetWeightKg < latest.weightKg ? 'Reach target weight' : 'Build to target weight',
        exerciseId: null, targetValue: m.fitness.targetWeightKg, unit: 'kg',
        targetDate: addDays(today, int(45, 150)),
        createdAt: timeAt(addDays(today, -int(30, 120)), 10, 0), achievedAt: null,
      });
    }
    if (isDemo && bench) {
      db.goals.push({
        id: id('goal'), gymId, memberId: m.id, kind: 'strength',
        label: 'Bench press 90 kg for a single', exerciseId: bench.id,
        targetValue: 90, unit: 'kg', targetDate: addDays(today, 90),
        createdAt: timeAt(addDays(today, -60), 10, 0), achievedAt: null,
      });
    }
    if (isDemo) {
      db.goals.push({
        id: id('goal'), gymId, memberId: m.id, kind: 'attendance',
        label: 'Train 20 times this month', exerciseId: null,
        targetValue: 20, unit: 'sessions', targetDate: null,
        createdAt: timeAt(addDays(today, -25), 10, 0), achievedAt: null,
      });
    }
  }
}

function seedNotes(db: Database, gymId: string, roster: Member[]): void {
  const bodies = [
    'Recovering from a shoulder niggle — avoid heavy overhead work for two weeks.',
    'Asked about additional personal training hours. Follow up this week.',
    'Prefers the 6 AM slot. Rarely trains after 9 AM.',
    'Wants a vegetarian diet plan — coach to review at the next assessment.',
    'Referred two friends this quarter. Worth a renewal courtesy.',
    'Travelling for work through most of next month; expect a gap in attendance.',
    'Making excellent progress on the squat. Ready to move to the intermediate block.',
  ];
  roster.slice(0, 18).forEach((m, i) => {
    if (i % 2) return;
    db.notes.push({
      id: id('note'), gymId, memberId: m.id, authorRole: 'owner', authorName: 'Nikhil Raghavan',
      body: bodies[i % bodies.length],
      createdAt: new Date(Date.now() - int(1, 40) * 86400000).toISOString(),
    });
  });
}

function seedMessages(db: Database, gymId: string, roster: Member[], today: ISODate): void {
  roster.slice(0, 12).forEach((m, i) => {
    if (i % 3) return;
    db.messages.push({
      id: id('msg'), gymId, memberId: m.id, channel: 'whatsapp', kind: 'welcome',
      subject: 'Welcome', body: `Hi ${m.name.split(' ')[0]}, welcome to Atlas Performance Club.`,
      status: 'simulated',
      createdAt: timeAt(addDays(today, -int(5, 90)), int(9, 18), int(0, 59)),
      sentAt: null, createdByRole: 'owner', readAt: null,
    });
  });
}

function seedAnnouncements(db: Database, gymId: string): void {
  db.announcements.push({
    id: id('ann'), gymId,
    title: 'New calibrated plates on the platform',
    body: 'The competition plates arrived this week. The platform is now fully calibrated for anyone training toward a meet.',
    publishedAt: new Date(Date.now() - 4 * 86400000).toISOString(),
  });
  db.announcements.push({
    id: id('ann'), gymId,
    title: 'Assessment week — book your slot',
    body: 'Quarterly assessments run all next week. Speak to your coach to reserve a time.',
    publishedAt: new Date(Date.now() - 11 * 86400000).toISOString(),
  });
}

/* ============================================================
   Platform bootstrap — what exists before any customer does
   ============================================================ */

function platformFeatures(): PlatformFeature[] {
  return FEATURE_CATALOG.map((f) => ({
    key: f.key, name: f.name, category: f.category, description: f.description,
    delivery: f.delivery, requires: f.requires ?? [], foundational: Boolean(f.foundational),
    archived: false,
  }));
}

function platformPackages(now: string): FeaturePackage[] {
  return PACKAGE_SEEDS.map((pkg) => ({
    id: `pkg_${pkg.key}`, key: pkg.key, name: pkg.name, description: pkg.description,
    features: [...pkg.features], isDefault: pkg.isDefault, isSystem: Boolean(pkg.isSystem),
    order: pkg.order, createdAt: now,
  }));
}

function platformSettings(): PlatformSettings {
  return {
    platformName: 'Fitness Manager',
    supportEmail: 'support@fitnessmanager.app',
    defaultPackageKey: DEFAULT_PACKAGE_KEY,
    demoModeEnabled: true,
    selfServeSignupEnabled: true,
    newGymStatus: 'active',
  };
}

function emptyDatabase(): Database {
  const now = new Date().toISOString();
  return {
    version: 3,
    features: platformFeatures(),
    packages: platformPackages(now),
    subscriptions: [], overrides: [], platformAudit: [], platformUpdates: [],
    settings: platformSettings(),
    gyms: [], users: [], members: [], plans: [], memberships: [], payments: [],
    attendance: [], exercises: [], programs: [], sessions: [], measurements: [], goals: [],
    water: [], dietPlans: [], mealCompletions: [], workouts: [], expenses: [], notes: [],
    messages: [], announcements: [], audit: [],
  };
}

/**
 * First boot. The platform exists; NO CUSTOMER DOES.
 *
 * The global exercise library ships with the platform because it is
 * platform-owned content (scope `global`) — a brand-new gym with an
 * empty exercise list would be a worse product, and none of it is
 * pretend business data.
 */
export function buildPlatform(): Database {
  const db = emptyDatabase();
  db.exercises = buildExercises();

  db.users.push({
    id: 'user_platform_admin', gymId: null, role: 'platform_admin',
    name: 'Platform Admin', phone: '', email: ADMIN_EMAIL,
    authProvider: 'demo', authUid: 'demo-admin',
  });

  db.platformUpdates.push({
    id: 'pupd_0001', kind: 'product',
    title: 'Feature entitlements are live',
    body: 'Packages now carry a default set of features, and any customer can be overridden feature by feature from the platform console.',
    createdAt: new Date().toISOString(), publishedAt: new Date().toISOString(),
    audience: 'owners',
  });

  return db;
}

export const ADMIN_EMAIL = 'admin@fitnessmanager.demo';
export const DEMO_GYM_ID = 'gym_atlas';
export const DEMO_GYM_SLUG = 'atlas';

/* ============================================================
   Demo workspace — built ON DEMAND, never on first boot
   ============================================================ */

/**
 * Materialises the demonstration studios. Called only when somebody
 * explicitly chooses "Explore with demo data", which is what keeps a
 * real customer's first sign-in genuinely empty.
 *
 * Demo data is isolated by the SAME tenant gate that separates two
 * real customers — there is no second isolation mechanism that could
 * disagree with the first. The gyms are additionally flagged
 * `dataMode: 'demo'` so every surface can label them honestly.
 */
export function buildDemoWorkspace(db: Database): void {
  if (db.gyms.some((g) => g.id === DEMO_GYM_ID)) return;   // already built
  const today = todayISO();

  if (!db.exercises.length) db.exercises = buildExercises();

  buildGym(makeGym('Atlas Performance Club', 'atlas', 'Indiranagar', 38), db,
    { memberCount: 52, attendanceDays: 63, rich: true }, today);

  // A second tenant. Never rendered in the gym app — its existence is
  // the isolation test, and the platform console is the one place it
  // legitimately shows up.
  buildGym(makeGym('Meridian Strength Studio', 'meridian', 'Sadashivanagar', 80), db,
    { memberCount: 11, attendanceDays: 0, rich: false }, today);

  // Demo customers are on real packages, so entitlement behaviour is
  // demonstrable: Atlas is Premium, Meridian is Basic.
  subscribe(db, 'gym_atlas', 'pkg_premium', 'active');
  subscribe(db, 'gym_meridian', 'pkg_basic', 'active');
}

function subscribe(db: Database, gymId: string, packageId: string, status: Subscription['status']): void {
  if (db.subscriptions.some((x) => x.gymId === gymId)) return;
  const now = new Date().toISOString();
  db.subscriptions.push({
    id: id('sub'), gymId, packageId, status,
    startedAt: todayISO(), renewsAt: null, notes: '', updatedAt: now,
  });
}

/** Removes the demo workspace and every row that belongs to it. */
export function clearDemoWorkspace(db: Database): void {
  const demoIds = new Set(db.gyms.filter((g) => g.dataMode === 'demo').map((g) => g.id));
  if (!demoIds.size) return;
  const keep = <T extends { gymId: string }>(rows: T[]) => rows.filter((r) => !demoIds.has(r.gymId));

  // Collected BEFORE the member rows are dropped — member-scoped
  // exercises are keyed by memberId, not gymId.
  const demoMemberIds = new Set(db.members.filter((m) => demoIds.has(m.gymId)).map((m) => m.id));

  db.gyms = db.gyms.filter((g) => !demoIds.has(g.id));
  db.users = db.users.filter((u) => !u.gymId || !demoIds.has(u.gymId));
  db.members = keep(db.members);
  db.plans = keep(db.plans);
  db.memberships = keep(db.memberships);
  db.payments = keep(db.payments);
  db.attendance = keep(db.attendance);
  db.programs = keep(db.programs);
  db.sessions = keep(db.sessions);
  db.measurements = keep(db.measurements);
  db.goals = keep(db.goals);
  db.water = keep(db.water);
  db.dietPlans = keep(db.dietPlans);
  db.mealCompletions = keep(db.mealCompletions);
  db.workouts = keep(db.workouts);
  db.expenses = keep(db.expenses);
  db.notes = keep(db.notes);
  db.messages = keep(db.messages);
  db.announcements = keep(db.announcements);
  db.audit = keep(db.audit);
  db.subscriptions = db.subscriptions.filter((x) => !demoIds.has(x.gymId));
  db.overrides = db.overrides.filter((x) => !demoIds.has(x.gymId));
  // Member-scoped exercises created inside the demo tenant.
  db.exercises = db.exercises.filter(
    (e) => e.scope !== 'member' || !e.ownerId || !demoMemberIds.has(e.ownerId));
}

/* ============================================================
   A brand-new, EMPTY customer
   ============================================================ */

let freshSeq = 0;

function slugify(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return base || 'studio';
}

/**
 * An empty gym. No members, no payments, no attendance, no revenue —
 * the onboarding wizard, not a seeded dataset, is what fills it.
 */
export function blankGym(input: {
  name: string; email?: string; phone?: string; address?: string;
  kind?: Gym['kind'];
}): Gym {
  const now = new Date().toISOString();
  const slug = `${slugify(input.name)}-${(Date.now().toString(36) + (++freshSeq)).slice(-5)}`;
  return {
    id: `gym_${slug}`,
    name: input.name.trim(),
    slug,
    phone: input.phone?.trim() ?? '',
    email: input.email?.trim() ?? '',
    address: input.address?.trim() ?? '',
    currency: 'INR',
    timezone: 'Asia/Kolkata',
    createdAt: now,
    status: 'active',
    dataMode: 'live',
    kind: input.kind ?? 'studio',
    logoUrl: '',
    hours: defaultHours(),
    payment: defaultPaymentSettings(),
    setup: freshSetup(now),
  };
}
