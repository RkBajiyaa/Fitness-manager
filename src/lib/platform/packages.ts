/* ============================================================
   FEATURE PACKAGES (docs/ARCHITECTURE.md §M.2).

   A package is a NAMED DEFAULT SET of entitlements — nothing
   more. It is not a permission and it is not the last word:
   every gym can carry per-feature overrides on top of it
   (see entitlements.ts). Packages exist so that assigning a new
   customer is one click, not thirty toggles.

   These are seeded into the store on first boot. The Super Admin
   edits them there; this file only supplies the starting point.
   ============================================================ */
import type { FeatureKey } from './catalog';

const BASIC: FeatureKey[] = [
  'member_management', 'member_profiles', 'memberships', 'membership_plans',
  'payments', 'receipts', 'attendance', 'expenses', 'revenue',
];

const PROFESSIONAL: FeatureKey[] = [
  ...BASIC,
  'reports', 'notifications', 'qr_attendance',
  'exercise_library', 'workout_logging', 'workout_builder', 'workout_programs',
  'progress_tracking', 'body_measurements', 'personal_records', 'goals',
  'hydration_tracking',
];

const PREMIUM: FeatureKey[] = [
  ...PROFESSIONAL,
  'diet_plans', 'advanced_reports', 'advanced_analytics',
  'whatsapp', 'email', 'trainer_management', 'lead_management',
  'payment_gateway', 'online_payments', 'invoice_generation', 'receipt_generation',
  'biometric_attendance',
];

/** A member with no gym behind them. Fitness only — there is no business side. */
const PERSONAL: FeatureKey[] = [
  'member_profiles', 'exercise_library', 'workout_logging', 'workout_builder',
  'progress_tracking', 'body_measurements', 'personal_records', 'goals',
  'diet_plans', 'hydration_tracking', 'notifications',
];

export interface PackageSeed {
  key: string;
  name: string;
  description: string;
  features: FeatureKey[];
  /** Assigned to a brand-new gym unless the Super Admin says otherwise. */
  isDefault: boolean;
  /** Hidden from the customer package picker — provisioned by the platform. */
  isSystem?: boolean;
  order: number;
}

export const PACKAGE_SEEDS: PackageSeed[] = [
  {
    key: 'basic', name: 'Basic', order: 1, isDefault: false,
    description: 'Run the front desk: members, memberships, payments and attendance.',
    features: BASIC,
  },
  {
    key: 'professional', name: 'Professional', order: 2, isDefault: true,
    description: 'Everything in Basic plus coaching — programs, logging, progress and reports.',
    features: PROFESSIONAL,
  },
  {
    key: 'premium', name: 'Premium', order: 3, isDefault: false,
    description: 'Everything in Professional plus diet, communication, advanced reporting and payment seams.',
    features: PREMIUM,
  },
  {
    key: 'personal', name: 'Personal workspace', order: 4, isDefault: false, isSystem: true,
    description: 'A single member training on their own. Fitness features only — no business module.',
    features: PERSONAL,
  },
];

export const DEFAULT_PACKAGE_KEY = 'professional';
export const PERSONAL_PACKAGE_KEY = 'personal';
