/* ============================================================
   Fitness Manager — domain types.
   Mirrors docs/ARCHITECTURE.md §D one-to-one.
   Every gym-owned row carries gymId — the tenant key.
   ============================================================ */

/**
 * All six roles exist in the model from day one — see
 * lib/platform/permissions.ts for what each may do. Only
 * platform_admin, owner and member are exposed as sign-in
 * destinations in this build; the rest are routing work, not a
 * security redesign.
 */
export type Role = 'platform_admin' | 'owner' | 'manager' | 'trainer' | 'reception' | 'member';

export type ISODate = string;      // 'YYYY-MM-DD'
export type ISODateTime = string;  // full ISO 8601

/** How a gym's weekly hours are stored. Index 0 = Sunday. */
export interface OperatingHours {
  /** 'HH:MM' local. */
  open: string;
  close: string;
  closed: boolean;
}

export type GatewayProvider = 'none' | 'razorpay' | 'stripe' | 'payu' | 'other';

/**
 * Configuration only. NOTHING here connects to a real gateway in
 * this build — `gatewayProvider` records an intention so the
 * migration has somewhere to land, and the UI says so plainly.
 */
export interface PaymentSettings {
  methods: PaymentMethod[];
  upiId: string;
  bankAccountName: string;
  bankAccountNumber: string;
  bankIfsc: string;
  gatewayProvider: GatewayProvider;
  /** Always false here. A future phase is the only thing that flips it. */
  gatewayConnected: boolean;
  invoicePrefix: string;
  taxNote: string;
}

export type SetupStep = 'profile' | 'plans' | 'payments' | 'features' | 'first_member';
export type SetupStepState = 'pending' | 'done' | 'skipped';

/** Owner onboarding progress. Every step is skippable by design. */
export interface GymSetup {
  steps: Record<SetupStep, SetupStepState>;
  startedAt: ISODateTime;
  completedAt: ISODateTime | null;
  /** The owner closed the checklist; it stops nagging but stays in Settings. */
  dismissed: boolean;
}

export type GymStatus = 'active' | 'suspended';

/**
 * `dataMode` is the production/demo firewall. A demo workspace is
 * a tenant like any other — the isolation that keeps it away from
 * live data is the same tenant gate that keeps two gyms apart, not
 * a second mechanism that could disagree with the first.
 *
 * `kind: 'personal'` is a single member training on their own, with
 * no business side. It keeps the invariant that every row has a
 * gymId without inventing fake employer data for them.
 */
export interface Gym {
  id: string;
  name: string;
  slug: string;
  phone: string;
  email: string;
  address: string;
  currency: 'INR';
  timezone: string;
  createdAt: ISODateTime;
  status: GymStatus;
  dataMode: 'live' | 'demo';
  kind: 'studio' | 'personal';
  logoUrl: string;
  hours: OperatingHours[];          // 7 entries, index 0 = Sunday
  payment: PaymentSettings;
  setup: GymSetup;
}

/** Identity is separate from the domain user — see §I.2. */
export interface User {
  id: string;
  gymId: string | null;          // null ⇒ platform_admin
  role: Role;
  name: string;
  phone: string;
  email: string;
  memberId?: string;             // set when role = 'member'
  authProvider: 'demo' | 'firebase';
  authUid: string;               // Firebase uid later; the email in demo mode
}

export type Gender = 'male' | 'female' | 'other';
export type MemberLifecycle = 'active' | 'inactive' | 'frozen';
export type FitnessGoal = 'lose_fat' | 'build_muscle' | 'gain_strength' | 'endurance' | 'general_fitness';
export type TrainingExperience = 'beginner' | 'intermediate' | 'advanced';

/** Member-editable fitness profile. Membership and money stay owner-controlled. */
export interface FitnessProfile {
  heightCm?: number;
  targetWeightKg?: number;
  goal: FitnessGoal;
  experience: TrainingExperience;
  preferredDays: number[];       // 0 = Sunday
  waterTargetMl: number;
  weeklySessionTarget: number;
  notes: string;
  /**
   * How-To demonstrations during a workout (§13). Defaults to ON for
   * everyone; once a member turns it off we remember that and never
   * ask again. Optional so a profile written before this existed
   * still reads as "on" rather than as "explicitly disabled".
   */
  showHowTo?: boolean;
}

export interface Member {
  id: string;
  gymId: string;
  memberCode: string;
  name: string;
  phone: string;
  email: string;
  dob: ISODate | '';
  gender: Gender;
  address: string;
  emergencyContact: { name: string; phone: string; relation: string };
  photoUrl: string;
  joinedAt: ISODate;
  lifecycle: MemberLifecycle;    // NOT membership status — that is derived
  trainerId?: string | null;
  fitness: FitnessProfile;
  /** null until the member has been through (or skipped) their welcome flow. */
  onboardedAt: ISODateTime | null;
}

export interface MembershipPlan {
  id: string;
  gymId: string;
  name: string;
  durationDays: number;
  price: number;
  isActive: boolean;
  description: string;
}

export type MembershipKind = 'new' | 'renewal';

export interface Membership {
  id: string;
  gymId: string;
  memberId: string;
  planId: string;
  planNameSnapshot: string;      // frozen at point of sale — §D.6
  priceSnapshot: number;
  discount: number;
  startDate: ISODate;
  endDate: ISODate;
  kind: MembershipKind;
  createdAt: ISODateTime;
  cancelledAt?: ISODateTime | null;
}

/** Derived from endDate — never stored. */
export type MembershipStatus = 'active' | 'expiring' | 'expired' | 'none';

export type PaymentMethod = 'cash' | 'upi' | 'card' | 'bank_transfer';
export type RevenueSource = 'membership' | 'renewal' | 'personal_training' | 'other';

/** Append-only. Corrections are reversing entries, never edits. */
export interface Payment {
  id: string;
  gymId: string;
  memberId: string | null;
  membershipId: string | null;
  amount: number;
  method: PaymentMethod;
  source: RevenueSource;
  paidAt: ISODateTime;
  receiptNo: string;
  note: string;
}

export type AttendanceType = 'check_in' | 'check_out';
export type AttendanceSource = 'manual' | 'device' | 'qr';

/** Append-only event log. Occupancy & streaks are derived from it. */
export interface AttendanceEvent {
  id: string;
  gymId: string;
  memberId: string;
  type: AttendanceType;
  at: ISODateTime;
  source: AttendanceSource;
  deviceId?: string | null;
}

/* ------------------------------------------------------------
   Exercises — one definition, three scopes (§D.2).
   A member's custom exercise can never mutate the gym library.
   ------------------------------------------------------------ */
/**
 * `warmup` is a first-class kind, not a tag. A warm-up must be a
 * structured, reusable, illustrated exercise rather than a line of
 * prose on a program day — see data/warmups.ts. It is a SEPARATE
 * question from `SetKind === 'warmup'`, which classifies one SET of
 * any exercise; both exist because both are real.
 */
export type ExerciseKind = 'strength' | 'cardio' | 'bodyweight' | 'mobility' | 'warmup';
export type ExerciseScope = 'global' | 'gym' | 'member';
export type Difficulty = 'beginner' | 'intermediate' | 'advanced';
export type TrackedField = 'weight' | 'reps' | 'duration' | 'distance';

/**
 * Where a piece of media came from and what we are allowed to do
 * with it. Mandatory on every external asset — an unlicensed clip
 * gets shipped exactly once, by someone who meant to fill this in
 * later.
 */
export interface MediaProvenance {
  source: string;
  creator: string;
  /** SPDX identifier, a vendor licence name, or 'proprietary-owned'. */
  license: string;
  commercialUse: boolean;
  attributionRequired: boolean;
  modificationAllowed: boolean;
  verifiedOn: ISODate;
  url: string;
}

/**
 * The How-To demonstration, behind one abstraction so the UI never
 * branches on format. `pose` is our own drawing system; the other
 * kinds exist so a licensed asset can be dropped in later without
 * touching a single screen.
 */
export interface ExerciseMedia {
  kind: 'pose' | 'lottie' | 'gif' | 'video' | 'image';
  /** A drawing key for `pose`; a URL or asset path for everything else. */
  src: string;
  /** Still frame shown before an animation loads. */
  poster: string | null;
  /** Implement in the hands, overriding the drawing's default. */
  prop: string | null;
  /** Scenery behind the figure, overriding the drawing's default. */
  scene: string | null;
  version: number;
  provenance: MediaProvenance;
}

export interface Exercise {
  id: string;
  scope: ExerciseScope;
  ownerId: string | null;        // null (global) | gymId | memberId
  /** Stable content key for global rows. '' for gym and member rows. */
  slug: string;
  name: string;
  /** A taxonomy key (data/taxonomy.ts), never a display string. */
  muscleGroup: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  /** A taxonomy key. Render through `equipmentLabel()`. */
  equipment: string;
  kind: ExerciseKind;
  /** 'compound' | 'isolation', or null where the distinction is meaningless. */
  mechanic: string | null;
  /** A movement-pattern key. Drives the How-To drawing and future grouping. */
  pattern: string;
  difficulty: Difficulty;
  /** One sentence for the library card. */
  summary: string;
  /**
   * Kept as the single free-text field so anything written before the
   * structured fields existed — and any member-authored exercise —
   * still has somewhere to live.
   */
  instructions: string;
  setup: string[];
  steps: string[];
  breathing: string;
  mistakes: string[];
  /** Only where there is a real risk. A warning on everything is a warning on nothing. */
  safety: string | null;
  tags: string[];
  tracks: TrackedField[];
  media: ExerciseMedia | null;
}

/* ------------------------------------------------------------
   Programs: Program → Week → Day → Exercise
   ------------------------------------------------------------ */
export type ProgramKind = 'onboarding' | 'standard';

/**
 * `weekly` repeats the same seven days forever — the member trains
 * "Monday: Push". `numbered` runs day 1 to day N once and the member
 * sees "Day 7 of 30". Which day is current is DERIVED from
 * `Program.startedAt` in both cases; storing a cursor would drift
 * the first time somebody misses a day.
 */
export type ProgramSchedule = 'weekly' | 'numbered';

export interface ProgramExercise {
  id: string;
  dayId: string;
  exerciseId: string;
  order: number;
  sets: number;
  reps: number;
  /**
   * Upper bound of a prescribed rep range, when the plan gives one.
   * 0 means "no range" — it is what the progression hint reads to
   * decide whether the member has topped out (§18).
   */
  repsMax: number;
  targetWeightKg: number;
  restSec: number;
  notes: string;
}

export interface ProgramDay {
  id: string;
  programId: string;
  weekNo: number;                // 1-based
  dayIndex: number;              // 0 = Sunday. Used by `weekly` schedules.
  /** 1-based day of the programme. Used by `numbered` schedules; 0 otherwise. */
  dayNo: number;
  title: string;
  focus: string;
  isRest: boolean;
  /**
   * Legacy free-text warm-up and cool-down. Still rendered when the
   * structured lists are empty, so programmes written before
   * data/warmups.ts existed keep working.
   */
  warmup: string;
  cooldown: string;
  /** Structured warm-up (§6). Exercise ids, resolved like any other. */
  warmupExerciseIds: string[];
  cooldownExerciseIds: string[];
  /** Honest estimate in minutes, or 0 when we cannot say. */
  estimatedMin: number;
  notes: string;
  exercises: ProgramExercise[];
}

export interface Program {
  id: string;
  gymId: string;
  name: string;
  description: string;
  kind: ProgramKind;
  schedule: ProgramSchedule;
  /** The PlanTemplate this was built from, when it came from the catalogue. */
  templateSlug: string | null;
  durationWeeks: number;
  isTemplate: boolean;
  memberId: string | null;       // null ⇒ reusable template
  startedAt: ISODate | null;
  createdAt: ISODateTime;
  days: ProgramDay[];
}

/* ------------------------------------------------------------
   Plan catalogue (§5, §21)

   PLATFORM-OWNED, like the global exercise library: no gymId, and
   the same content for every customer. A member enrolling clones a
   template into a `Program` of their own — which is what keeps
   switching plans from touching history. Sessions belong to the
   member, not to the plan, so leaving PPL for a body-part split
   deletes nothing.

   Days reference exercises by ID, never by copying them (§20).
   ------------------------------------------------------------ */

export type PlanFamily = 'ppl' | 'body_part_split' | 'beginner' | 'cardio' | 'hybrid';

export interface PlanTemplateExercise {
  exerciseId: string;
  order: number;
  sets: number;
  reps: number;
  repsMax: number;
  targetWeightKg: number;
  restSec: number;
  notes: string;
}

export interface PlanTemplateDay {
  id: string;
  dayIndex: number;
  dayNo: number;
  title: string;
  focus: string;
  isRest: boolean;
  warmupExerciseIds: string[];
  cooldownExerciseIds: string[];
  estimatedMin: number;
  notes: string;
  exercises: PlanTemplateExercise[];
}

export interface PlanTemplate {
  id: string;
  slug: string;
  name: string;
  family: PlanFamily;
  schedule: ProgramSchedule;
  summary: string;
  description: string;
  difficulty: Difficulty;
  daysPerWeek: number;
  durationWeeks: number;
  highlights: string[];
  equipmentNeeded: string[];
  /** Ordering in the catalogue. Lower first. */
  order: number;
  days: PlanTemplateDay[];
}

/* ------------------------------------------------------------
   Sessions — what actually happened
   ------------------------------------------------------------ */
export type SetKind = 'warmup' | 'normal' | 'drop' | 'failure';

export interface SessionSet {
  id: string;
  sessionId: string;
  exerciseId: string;
  order: number;                 // exercise order within the session
  setNo: number;
  kind: SetKind;                 // warm-ups never count toward PRs or volume
  reps: number;
  weightKg: number;
  durationSec: number;
  distanceKm: number;
  rpe: number | null;
  completed: boolean;
}

export type SessionStatus = 'active' | 'completed';

export interface WorkoutSession {
  id: string;
  gymId: string;
  memberId: string;
  date: ISODate;
  startedAt: ISODateTime;
  finishedAt: ISODateTime | null;
  programDayId: string | null;
  /** Set when the session was started from a member-built workout. */
  memberWorkoutId: string | null;
  title: string;
  durationSec: number;
  notes: string;
  status: SessionStatus;
  sets: SessionSet[];
}

/* ------------------------------------------------------------
   Member-built workouts (§M.7)

   Deliberately NOT a Program. A Program is prescribed by the gym
   and assigning one clones a template; a MemberWorkout is the
   member's own saved routine. Keeping them in separate tables is
   what guarantees "member edits never overwrite what the coach
   assigned" — it is structural, not a convention someone has to
   remember.
   ------------------------------------------------------------ */
export interface MemberWorkoutExercise {
  id: string;
  exerciseId: string;
  order: number;
  sets: number;
  reps: number;
  targetWeightKg: number;
  restSec: number;
  notes: string;
}

export interface MemberWorkout {
  id: string;
  gymId: string;
  memberId: string;
  name: string;
  focus: string;
  notes: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  lastUsedAt: ISODateTime | null;
  exercises: MemberWorkoutExercise[];
}

export interface BodyMeasurement {
  id: string;
  gymId: string;
  memberId: string;
  takenAt: ISODate;
  weightKg: number;
  heightCm?: number;
  chestCm?: number;
  waistCm?: number;
  armsCm?: number;
  thighsCm?: number;
  bodyFatPct?: number;
}

export type GoalKind = 'weight' | 'strength' | 'attendance' | 'custom';

export interface Goal {
  id: string;
  gymId: string;
  memberId: string;
  kind: GoalKind;
  label: string;
  exerciseId: string | null;
  targetValue: number;
  unit: string;
  targetDate: ISODate | null;
  createdAt: ISODateTime;
  achievedAt: ISODateTime | null;
}

/** Event log — the daily total is derived. */
export interface WaterLog {
  id: string;
  gymId: string;
  memberId: string;
  date: ISODate;
  ml: number;
  at: ISODateTime;
}

export type MealSlot = 'breakfast' | 'lunch' | 'snack' | 'dinner';

export interface DietItem {
  id: string;
  meal: MealSlot;
  /** Position within the meal — members can reorder their own plan. */
  order: number;
  item: string;
  qty: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

/**
 * `assigned` plans belong to the coach; `personal` plans belong to
 * the member. They are separate rows on purpose — a member editing
 * their own plan must never silently overwrite what the gym
 * prescribed, and the member screen shows both side by side.
 */
export type DietPlanSource = 'assigned' | 'personal';

export interface DietPlan {
  id: string;
  gymId: string;
  memberId: string | null;       // null ⇒ reusable gym template
  name: string;
  waterTargetL: number;
  source: DietPlanSource;
  notes: string;
  updatedAt: ISODateTime;
  items: DietItem[];
}

/** Persisted so meal ticking is real data, not throwaway UI state. */
export interface MealCompletion {
  id: string;
  gymId: string;
  memberId: string;
  date: ISODate;
  dietItemId: string;
}

export type ExpenseCategory =
  | 'rent' | 'electricity' | 'internet' | 'salaries' | 'software' | 'maintenance'
  | 'equipment' | 'repairs' | 'cleaning' | 'marketing' | 'other';

export interface Expense {
  id: string;
  gymId: string;
  category: ExpenseCategory;
  amount: number;
  spentAt: ISODate;
  description: string;
  vendor: string;
  method: PaymentMethod;
  receiptUrl?: string | null;
  isRecurring: boolean;
}

export interface Note {
  id: string;
  gymId: string;
  memberId: string;
  authorRole: Role;
  authorName: string;
  body: string;
  createdAt: ISODateTime;
}

/* ------------------------------------------------------------
   Communication (§J)
   ------------------------------------------------------------ */
export type MessageChannel = 'whatsapp' | 'email' | 'in_app';
export type MessageKind =
  | 'payment_receipt' | 'renewal_reminder' | 'welcome'
  | 'program_assigned' | 'congratulations' | 'custom';
/** `simulated` is the honest state while no provider is configured. */
export type MessageStatus = 'draft' | 'queued' | 'sent' | 'failed' | 'simulated';

export interface Message {
  id: string;
  gymId: string;
  memberId: string;
  channel: MessageChannel;
  kind: MessageKind;
  subject: string;
  body: string;
  status: MessageStatus;
  createdAt: ISODateTime;
  sentAt: ISODateTime | null;
  createdByRole: Role;
  readAt: ISODateTime | null;
}

export interface Announcement {
  id: string;
  gymId: string;
  title: string;
  body: string;
  publishedAt: ISODateTime;
}

/* ------------------------------------------------------------
   PLATFORM-OWNED DATA (§M)

   These rows have NO gymId of their own in the tenant sense —
   they are the platform's, not a customer's, and only a
   platform_admin session may read or write them. The gym-scoped
   tenant() gate is never used on them; they have their own gate.
   ------------------------------------------------------------ */

/** The catalogue row, persisted so the catalog is extensible at runtime. */
export interface PlatformFeature {
  key: string;
  name: string;
  category: string;
  description: string;
  delivery: 'live' | 'designed';
  requires: string[];
  foundational: boolean;
  /** Retired features stay in the table so history still reads correctly. */
  archived: boolean;
}

export interface FeaturePackage {
  id: string;
  key: string;
  name: string;
  description: string;
  features: string[];
  isDefault: boolean;
  isSystem: boolean;
  order: number;
  createdAt: ISODateTime;
}

export type SubscriptionStatus = 'trial' | 'active' | 'suspended' | 'cancelled';

/** What a customer has been assigned. One per gym. */
export interface Subscription {
  id: string;
  gymId: string;
  packageId: string;
  status: SubscriptionStatus;
  startedAt: ISODate;
  renewsAt: ISODate | null;
  notes: string;
  updatedAt: ISODateTime;
}

/**
 * An individual, per-customer decision that beats the package.
 * Absence of a row means "inherit"; removing the row restores
 * the inherited state, which is why `enabled: false` and "no
 * override" are different things and must stay different.
 */
export interface FeatureOverride {
  id: string;
  gymId: string;
  feature: string;
  enabled: boolean;
  reason: string;
  setAt: ISODateTime;
  setByUserId: string;
}

/** Platform configuration changes. Separate log, separate gate. */
export interface PlatformAuditLog {
  id: string;
  at: ISODateTime;
  actorUserId: string;
  actorName: string;
  action: string;
  /** The customer affected, when there is one. */
  gymId: string | null;
  gymName: string;
  entity: string;
  entityId: string;
  summary: string;
  meta?: Record<string, unknown>;
}

export type PlatformUpdateKind = 'feature' | 'maintenance' | 'product' | 'notice';

/** Platform-wide announcements. No delivery channel is wired up. */
export interface PlatformUpdate {
  id: string;
  kind: PlatformUpdateKind;
  title: string;
  body: string;
  publishedAt: ISODateTime | null;
  createdAt: ISODateTime;
  /** Who should see it in-app. */
  audience: 'owners' | 'members' | 'everyone';
}

export interface PlatformSettings {
  platformName: string;
  supportEmail: string;
  defaultPackageKey: string;
  /** Offer "Explore with demo data" on the sign-in screens. */
  demoModeEnabled: boolean;
  /** Let a brand-new owner provision their own gym from sign-up. */
  selfServeSignupEnabled: boolean;
  /** Gyms start here unless changed. */
  newGymStatus: GymStatus;
}

export interface AuditLog {
  id: string;
  gymId: string;
  actorRole: Role;
  action: string;
  entity: string;
  entityId: string;
  at: ISODateTime;
  meta?: Record<string, unknown>;
}

/** The whole tenant-partitioned dataset, as one serialisable document. */
export interface Database {
  version: number;
  /* ---- platform-owned ---- */
  features: PlatformFeature[];
  packages: FeaturePackage[];
  subscriptions: Subscription[];
  overrides: FeatureOverride[];
  platformAudit: PlatformAuditLog[];
  platformUpdates: PlatformUpdate[];
  planTemplates: PlanTemplate[];
  settings: PlatformSettings;
  /* ---- tenant-owned ---- */
  gyms: Gym[];
  users: User[];
  members: Member[];
  plans: MembershipPlan[];
  memberships: Membership[];
  payments: Payment[];
  attendance: AttendanceEvent[];
  exercises: Exercise[];
  programs: Program[];
  sessions: WorkoutSession[];
  measurements: BodyMeasurement[];
  goals: Goal[];
  water: WaterLog[];
  dietPlans: DietPlan[];
  mealCompletions: MealCompletion[];
  workouts: MemberWorkout[];
  expenses: Expense[];
  notes: Note[];
  messages: Message[];
  announcements: Announcement[];
  audit: AuditLog[];
}

/** What the verified token will carry; the demo adapter produces the same shape. */
/**
 * What the verified token will carry; the demo adapter produces
 * the same shape.
 *
 * A platform_admin has no tenant, and carries PLATFORM_TENANT as
 * its gymId rather than null. That is a deliberate trade: a
 * sentinel that can never equal a real `gym_*` id means every
 * tenant filter in the app returns an empty set for an admin
 * automatically, without threading `string | null` through
 * several hundred call sites where it would only ever be a
 * non-null string in practice. `tenant()` rejects it outright.
 */
export interface Session {
  gymId: string;
  role: Role;
  userId: string;
  memberId: string | null;
  name: string;
  email: string;
}

export interface Page<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface ApiError {
  code: 'validation_error' | 'forbidden' | 'not_found' | 'conflict' | 'unprocessable';
  message: string;
  fields?: Record<string, string>;
}
