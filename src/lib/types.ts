/* ============================================================
   Domain types. Mirrors docs/ARCHITECTURE.md §D one-to-one.
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

export interface User {
  id: string;
  gymId: string | null;          // null ⇒ platform_admin
  role: Role;
  name: string;
  phone: string;
  email: string;
  memberId?: string;             // set when role = 'member'
}

export type Gender = 'male' | 'female' | 'other';
export type MemberLifecycle = 'active' | 'inactive' | 'frozen';

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
  trainerId?: string | null;     // reserved for the trainer role
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
  planNameSnapshot: string;      // frozen at point of sale — see §D.3
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

/** Append-only event log. Occupancy & attendance % are derived from it. */
export interface AttendanceEvent {
  id: string;
  gymId: string;
  memberId: string;
  type: AttendanceType;
  at: ISODateTime;
  source: AttendanceSource;
  deviceId?: string | null;
}

export type ExerciseKind = 'strength' | 'cardio' | 'bodyweight';

export interface Exercise {
  id: string;
  gymId: string | null;          // null ⇒ global catalogue
  name: string;
  muscleGroup: string;
  kind: ExerciseKind;
}

export interface WorkoutPlanExercise {
  id: string;
  exerciseId: string;
  dayOfWeek: number;             // 0 = Sunday
  sets: number;
  reps: number;
  targetWeight: number;          // kg; 0 for bodyweight/cardio
  restSec: number;
  instructions: string;
  order: number;
}

export interface WorkoutPlan {
  id: string;
  gymId: string;
  name: string;
  memberId: string | null;       // null ⇒ reusable template
  isTemplate: boolean;
  exercises: WorkoutPlanExercise[];
}

export interface WorkoutLogSet {
  id: string;
  exerciseId: string;
  setNo: number;
  reps: number;
  weightKg: number;
  durationSec: number;
  distanceKm: number;
}

export interface WorkoutLog {
  id: string;
  gymId: string;
  memberId: string;
  date: ISODate;
  planId: string | null;
  durationMin: number;
  notes: string;
  sets: WorkoutLogSet[];
  createdAt: ISODateTime;
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
  workoutPlans: WorkoutPlan[];
  workoutLogs: WorkoutLog[];
  measurements: BodyMeasurement[];
  dietPlans: DietPlan[];
  expenses: Expense[];
  notes: Note[];
  audit: AuditLog[];
}

/** What auth will hand us later; the landing screen fabricates it today. */
export interface Session {
  gymId: string;
  role: Role;
  userId: string;
  memberId: string | null;
  name: string;
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
