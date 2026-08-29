/* ============================================================
   Fitness Manager — domain types.
   Mirrors docs/ARCHITECTURE.md §D one-to-one.
   Every gym-owned row carries gymId — the tenant key.
   ============================================================ */

export type Role = 'platform_admin' | 'owner' | 'trainer' | 'member';

export type ISODate = string;      // 'YYYY-MM-DD'
export type ISODateTime = string;  // full ISO 8601

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
  title: string;
  durationSec: number;
  notes: string;
  status: SessionStatus;
  sets: SessionSet[];
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
  item: string;
  qty: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface DietPlan {
  id: string;
  gymId: string;
  memberId: string | null;
  name: string;
  waterTargetL: number;
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
  expenses: Expense[];
  notes: Note[];
  messages: Message[];
  announcements: Announcement[];
  audit: AuditLog[];
}

/** What the verified token will carry; the demo adapter produces the same shape. */
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
