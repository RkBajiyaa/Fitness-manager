/* ============================================================
   THE FEATURE CATALOG (docs/ARCHITECTURE.md §M.1).

   A FEATURE is a capability that EXISTS in the product. It is
   not a plan, not a permission, and not a subscription:

     Feature      "what capability exists?"        ← this file
     Package      "what does a customer buy?"      ← packages.ts
     Entitlement  "is it available to THIS gym?"   ← entitlements.ts
     Permission   "may THIS role use it?"          ← permissions.ts

   Adding a capability means adding ONE row here. No screen ever
   writes `if (plan === 'premium')`; screens ask
   `has('workout_logging')` and the four concepts stay separate.

   `delivery` is the honesty field. `designed` means the seam
   exists and the UI is built around it, but nothing is wired to
   a real provider yet — the Super Admin sees that plainly rather
   than selling a customer something that cannot run.
   ============================================================ */

export type FeatureCategory =
  | 'core' | 'attendance' | 'fitness' | 'communication' | 'business' | 'payments';

export const CATEGORY_LABEL: Record<FeatureCategory, string> = {
  core: 'Core',
  attendance: 'Attendance',
  fitness: 'Fitness',
  communication: 'Communication',
  business: 'Business',
  payments: 'Payments',
};

export const CATEGORY_ORDER: FeatureCategory[] = [
  'core', 'attendance', 'fitness', 'communication', 'business', 'payments',
];

export type FeatureKey =
  /* core */
  | 'member_management' | 'memberships' | 'member_profiles' | 'membership_plans'
  | 'payments' | 'receipts' | 'expenses' | 'revenue' | 'reports'
  /* attendance */
  | 'attendance' | 'qr_attendance' | 'biometric_attendance'
  /* fitness */
  | 'exercise_library' | 'workout_builder' | 'workout_logging' | 'workout_programs'
  | 'progress_tracking' | 'body_measurements' | 'personal_records' | 'goals'
  | 'diet_plans' | 'hydration_tracking'
  /* communication */
  | 'whatsapp' | 'email' | 'notifications'
  /* business */
  | 'advanced_reports' | 'advanced_analytics' | 'trainer_management'
  | 'lead_management' | 'multi_branch'
  /* payments */
  | 'payment_gateway' | 'online_payments' | 'invoice_generation' | 'receipt_generation';

export interface FeatureDef {
  key: FeatureKey;
  name: string;
  category: FeatureCategory;
  /** One line the Super Admin reads while deciding. */
  description: string;
  /**
   * `live`     — implemented and working in this build.
   * `designed` — the architecture and seam exist; no provider / hardware
   *              is connected. Entitling it does not make it work.
   */
  delivery: 'live' | 'designed';
  /** Turning this on is meaningless unless these are on too. */
  requires?: FeatureKey[];
  /** Features the owner cannot lose — the product stops making sense. */
  foundational?: boolean;
}

export const FEATURE_CATALOG: FeatureDef[] = [
  /* ---------------- Core ---------------- */
  { key: 'member_management', name: 'Member Management', category: 'core', foundational: true, delivery: 'live',
    description: 'The member roster, profiles, search and the needs-attention queue.' },
  { key: 'memberships', name: 'Memberships', category: 'core', delivery: 'live', requires: ['member_management'],
    description: 'Sell, renew and track membership terms against a plan.' },
  { key: 'member_profiles', name: 'Member Profiles', category: 'core', delivery: 'live', requires: ['member_management'],
    description: 'Per-member overview: contact, membership, activity and notes.' },
  { key: 'membership_plans', name: 'Membership Plans', category: 'core', delivery: 'live',
    description: 'Priced plans — monthly, quarterly, half-yearly, yearly, custom.' },
  { key: 'payments', name: 'Payments', category: 'core', delivery: 'live', requires: ['member_management'],
    description: 'The append-only payment ledger, dues and outstanding balances.' },
  { key: 'receipts', name: 'Receipts', category: 'core', delivery: 'live', requires: ['payments'],
    description: 'Receipt numbers recorded against every payment taken.' },
  { key: 'expenses', name: 'Expenses', category: 'core', delivery: 'live',
    description: 'Categorised operating spend, recurring and one-off.' },
  { key: 'revenue', name: 'Revenue', category: 'core', delivery: 'live', requires: ['payments'],
    description: 'Revenue by source and month, and operating profit against expenses.' },
  { key: 'reports', name: 'Reports', category: 'core', delivery: 'live',
    description: 'The standard business reporting pack for a chosen period.' },

  /* ---------------- Attendance ---------------- */
  { key: 'attendance', name: 'Attendance', category: 'attendance', delivery: 'live', requires: ['member_management'],
    description: 'Check-in / check-out events, daily roll and per-member history.' },
  { key: 'qr_attendance', name: 'QR Attendance', category: 'attendance', delivery: 'designed', requires: ['attendance'],
    description: 'Self check-in from a scanned code. Event source is modelled; no scanner app yet.' },
  { key: 'biometric_attendance', name: 'Biometric / Fingerprint', category: 'attendance', delivery: 'designed', requires: ['attendance'],
    description: 'External fingerprint device feeding the same event log. No hardware integration in this build.' },

  /* ---------------- Fitness ---------------- */
  { key: 'exercise_library', name: 'Exercise Library', category: 'fitness', delivery: 'live',
    description: 'Searchable exercise catalogue — platform, gym and member-created.' },
  { key: 'workout_logging', name: 'Workout Logging', category: 'fitness', delivery: 'live', requires: ['exercise_library'],
    description: 'The live session player: sets, reps, load, rest timer, session summary.' },
  { key: 'workout_builder', name: 'Workout Builder', category: 'fitness', delivery: 'live', requires: ['exercise_library'],
    description: 'Members build and save their own workouts, separate from assigned programs.' },
  { key: 'workout_programs', name: 'Workout Programs', category: 'fitness', delivery: 'live', requires: ['exercise_library'],
    description: 'Gym-built multi-day programs, including new-member onboarding programs.' },
  { key: 'progress_tracking', name: 'Progress Tracking', category: 'fitness', delivery: 'live',
    description: 'Weight trend, training volume, consistency and goal progress.' },
  { key: 'body_measurements', name: 'Body Measurements', category: 'fitness', delivery: 'live', requires: ['progress_tracking'],
    description: 'Weight, body fat and tape measurements over time.' },
  { key: 'personal_records', name: 'Personal Records', category: 'fitness', delivery: 'live', requires: ['workout_logging'],
    description: 'Records derived from logged history — never stored, never faked.' },
  { key: 'goals', name: 'Goals', category: 'fitness', delivery: 'live',
    description: 'Member goals with progress measured against their own data.' },
  { key: 'diet_plans', name: 'Diet Plans', category: 'fitness', delivery: 'live',
    description: 'Assigned diet plans plus the member’s own editable plan and meal ticking.' },
  { key: 'hydration_tracking', name: 'Hydration Tracking', category: 'fitness', delivery: 'live',
    description: 'Daily water target and a stored log — real history, not UI state.' },

  /* ---------------- Communication ---------------- */
  { key: 'whatsapp', name: 'WhatsApp', category: 'communication', delivery: 'designed', requires: ['member_management'],
    description: 'Message composer and log. No provider is connected: sends are recorded, never delivered.' },
  { key: 'email', name: 'Email', category: 'communication', delivery: 'designed', requires: ['member_management'],
    description: 'Same seam as WhatsApp for email templates. No provider connected.' },
  { key: 'notifications', name: 'Notifications', category: 'communication', delivery: 'live',
    description: 'In-app studio announcements and platform updates shown to members.' },

  /* ---------------- Business ---------------- */
  { key: 'advanced_reports', name: 'Advanced Reports', category: 'business', delivery: 'live', requires: ['reports'],
    description: 'Revenue mix, retention, expense breakdown and profit & loss detail.' },
  { key: 'advanced_analytics', name: 'Advanced Analytics', category: 'business', delivery: 'designed', requires: ['reports'],
    description: 'Cohort and forecasting work. Not built — no predictive claims are made anywhere.' },
  { key: 'trainer_management', name: 'Trainer Management', category: 'business', delivery: 'designed', requires: ['member_management'],
    description: 'Trainer accounts with assigned members. The role exists in the matrix; no screens yet.' },
  { key: 'lead_management', name: 'Lead Management', category: 'business', delivery: 'designed',
    description: 'Enquiries and trials before they become members. Not built.' },
  { key: 'multi_branch', name: 'Multi-Branch', category: 'business', delivery: 'designed',
    description: 'More than one location under one customer. Not built.' },

  /* ---------------- Payments ---------------- */
  { key: 'payment_gateway', name: 'Payment Gateway', category: 'payments', delivery: 'designed', requires: ['payments'],
    description: 'Gateway configuration only. Nothing is connected and no card is ever charged.' },
  { key: 'online_payments', name: 'Online Payments', category: 'payments', delivery: 'designed', requires: ['payment_gateway'],
    description: 'Member-initiated renewal payment. Needs a live gateway first.' },
  { key: 'invoice_generation', name: 'Invoice Generation', category: 'payments', delivery: 'designed', requires: ['payments'],
    description: 'Printable tax invoices. Not built.' },
  { key: 'receipt_generation', name: 'Receipt Generation', category: 'payments', delivery: 'designed', requires: ['receipts'],
    description: 'A shareable receipt document, distinct from the receipt number we already store.' },
];

const BY_KEY = new Map(FEATURE_CATALOG.map((f) => [f.key, f]));

export function featureDef(key: FeatureKey): FeatureDef | undefined {
  return BY_KEY.get(key);
}

export function featureName(key: FeatureKey): string {
  return BY_KEY.get(key)?.name ?? key;
}

export const ALL_FEATURE_KEYS: FeatureKey[] = FEATURE_CATALOG.map((f) => f.key);

/** Only these can actually do something today — the rest are seams. */
export const LIVE_FEATURE_KEYS: FeatureKey[] =
  FEATURE_CATALOG.filter((f) => f.delivery === 'live').map((f) => f.key);

export function isFeatureKey(value: string): value is FeatureKey {
  return BY_KEY.has(value as FeatureKey);
}
