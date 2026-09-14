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
export type ExerciseKind = 'strength' | 'cardio' | 'bodyweight' | 'mobility';
export type ExerciseScope = 'global' | 'gym' | 'member';
export type Difficulty = 'beginner' | 'intermediate' | 'advanced';
export type TrackedField = 'weight' | 'reps' | 'duration' | 'distance';

export interface Exercise {
  id: string;
  scope: ExerciseScope;
  ownerId: string | null;        // null (global) | gymId | memberId
  name: string;
  muscleGroup: string;
  secondaryMuscles: string[];
  equipment: string;
  kind: ExerciseKind;
  difficulty: Difficulty;
  instructions: string;
  tags: string[];
  tracks: TrackedField[];
}

/* ------------------------------------------------------------
   Programs: Program → Week → Day → Exercise
   ------------------------------------------------------------ */
export type ProgramKind = 'onboarding' | 'standard';

export interface ProgramExercise {
  id: string;
  dayId: string;
  exerciseId: string;
  order: number;
  sets: number;
  reps: number;
  targetWeightKg: number;
  restSec: number;
  notes: string;
}

export interface ProgramDay {
  id: string;
  programId: string;
  weekNo: number;                // 1-based
  dayIndex: number;              // 0 = Sunday
  title: string;
  focus: string;
  isRest: boolean;
  warmup: string;
  cooldown: string;
  notes: string;
  exercises: ProgramExercise[];
}

export interface Program {
  id: string;
  gymId: string;
  name: string;
  description: string;
  kind: ProgramKind;
  durationWeeks: number;
  isTemplate: boolean;
  memberId: string | null;       // null ⇒ reusable template
  startedAt: ISODate | null;
  createdAt: ISODateTime;
  days: ProgramDay[];
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
