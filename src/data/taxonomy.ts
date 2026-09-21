/* ============================================================
   EXERCISE TAXONOMY — the single vocabulary (§8 of the member
   experience brief).

   Every category the product sorts, filters or labels by is
   declared exactly once, here. Nothing downstream may invent a
   muscle group, an equipment string or a difficulty in passing:
   a typo in a screen used to create a phantom filter option that
   matched zero rows, and no type system caught it because they
   were all plain strings.

   The shape is chosen for the Postgres migration (§30): each list
   becomes a lookup table with `key` as the primary key and
   `label` as the display column. Nothing here is derived, so
   nothing here can drift.
   ============================================================ */

/** A taxonomy row. `key` is stable and machine-facing; `label` is human-facing. */
export interface TaxonomyTerm {
  key: string;
  label: string;
  /** Shown in filter chips and the exercise detail sheet. */
  description?: string;
}

/* ---------------- muscle groups ---------------- */

export const MUSCLE_GROUPS = [
  { key: 'chest', label: 'Chest' },
  { key: 'back', label: 'Back' },
  { key: 'shoulders', label: 'Shoulders' },
  { key: 'arms', label: 'Arms' },
  { key: 'legs', label: 'Legs' },
  { key: 'glutes', label: 'Glutes' },
  { key: 'core', label: 'Core' },
  { key: 'cardio', label: 'Cardio' },
  { key: 'mobility', label: 'Mobility' },
  { key: 'full_body', label: 'Full body' },
] as const satisfies readonly TaxonomyTerm[];

export type MuscleGroupKey = (typeof MUSCLE_GROUPS)[number]['key'];

/* ---------------- individual muscles ----------------
   Finer than a group: a bench press is a `chest` exercise that
   also works triceps and front delts. The group drives navigation;
   the muscles drive the detail sheet and future volume-per-muscle
   reporting.
   ---------------------------------------------------- */

export const MUSCLES = [
  { key: 'pectorals', label: 'Pectorals', description: 'Chest' },
  { key: 'lats', label: 'Lats', description: 'Latissimus dorsi' },
  { key: 'traps', label: 'Traps', description: 'Trapezius' },
  { key: 'rhomboids', label: 'Rhomboids' },
  { key: 'rear_delts', label: 'Rear delts' },
  { key: 'side_delts', label: 'Side delts' },
  { key: 'front_delts', label: 'Front delts' },
  { key: 'rotator_cuff', label: 'Rotator cuff' },
  { key: 'biceps', label: 'Biceps' },
  { key: 'triceps', label: 'Triceps' },
  { key: 'forearms', label: 'Forearms' },
  { key: 'quads', label: 'Quads' },
  { key: 'hamstrings', label: 'Hamstrings' },
  { key: 'glutes', label: 'Glutes' },
  { key: 'adductors', label: 'Adductors' },
  { key: 'calves', label: 'Calves' },
  { key: 'abs', label: 'Abs' },
  { key: 'obliques', label: 'Obliques' },
  { key: 'spinal_erectors', label: 'Spinal erectors' },
  { key: 'hip_flexors', label: 'Hip flexors' },
  { key: 'heart_lungs', label: 'Heart & lungs', description: 'Cardiovascular system' },
] as const satisfies readonly TaxonomyTerm[];

export type MuscleKey = (typeof MUSCLES)[number]['key'];

/* ---------------- equipment ---------------- */

export const EQUIPMENT = [
  { key: 'barbell', label: 'Barbell' },
  { key: 'dumbbell', label: 'Dumbbell' },
  { key: 'machine', label: 'Machine' },
  { key: 'cable', label: 'Cable' },
  { key: 'bodyweight', label: 'Bodyweight' },
  { key: 'kettlebell', label: 'Kettlebell' },
  { key: 'band', label: 'Resistance band' },
  { key: 'bench', label: 'Bench' },
  { key: 'treadmill', label: 'Treadmill' },
  { key: 'bike', label: 'Exercise bike' },
  { key: 'elliptical', label: 'Elliptical' },
  { key: 'rower', label: 'Rowing machine' },
  { key: 'stair_machine', label: 'Stair machine' },
  { key: 'jump_rope', label: 'Jump rope' },
  { key: 'foam_roller', label: 'Foam roller' },
  { key: 'none', label: 'No equipment' },
] as const satisfies readonly TaxonomyTerm[];

export type EquipmentKey = (typeof EQUIPMENT)[number]['key'];

/* ---------------- difficulty ---------------- */

export const DIFFICULTIES = [
  { key: 'beginner', label: 'Beginner', description: 'Safe to learn without supervision.' },
  { key: 'intermediate', label: 'Intermediate', description: 'Assumes the basic pattern is familiar.' },
  { key: 'advanced', label: 'Advanced', description: 'Heavy, technical or high-skill. Get a form check.' },
] as const satisfies readonly TaxonomyTerm[];

export type DifficultyKey = (typeof DIFFICULTIES)[number]['key'];

/* ---------------- exercise type ----------------
   This is the field hard rule 11 leans on. `warmup` and `mobility`
   exercises exist as first-class rows so a warm-up is a structured
   exercise rather than a line of prose in a program day (§6), and
   so nothing logged against them can ever be mistaken for a
   working set.
   ---------------------------------------------------- */

export const EXERCISE_TYPES = [
  { key: 'strength', label: 'Strength', description: 'Loaded resistance work.' },
  { key: 'bodyweight', label: 'Bodyweight', description: 'Resistance work against your own weight.' },
  { key: 'cardio', label: 'Cardio', description: 'Sustained conditioning work.' },
  { key: 'mobility', label: 'Mobility', description: 'Range-of-motion and recovery work.' },
  { key: 'warmup', label: 'Warm-up', description: 'Preparation work. Never counts as a working set.' },
] as const satisfies readonly TaxonomyTerm[];

export type ExerciseTypeKey = (typeof EXERCISE_TYPES)[number]['key'];

/* ---------------- mechanic ---------------- */

export const MECHANICS = [
  { key: 'compound', label: 'Compound', description: 'More than one joint moves.' },
  { key: 'isolation', label: 'Isolation', description: 'One joint does the work.' },
] as const satisfies readonly TaxonomyTerm[];

export type MechanicKey = (typeof MECHANICS)[number]['key'];

/* ---------------- movement pattern ----------------
   Why this exists and `muscleGroup` is not enough: the How-To
   visual is drawn per PATTERN, not per exercise (see
   data/media/patterns.ts). Bench press, dumbbell press and
   machine chest press are one drawing with three labels. That is
   what makes a curated library of sixty exercises affordable to
   illustrate in a single, consistent house style instead of
   sourcing sixty clips of mismatched stock footage.
   ---------------------------------------------------- */

export const MOVEMENT_PATTERNS = [
  { key: 'horizontal_push', label: 'Horizontal push' },
  { key: 'incline_push', label: 'Incline push' },
  { key: 'vertical_push', label: 'Vertical push' },
  { key: 'horizontal_pull', label: 'Horizontal pull' },
  { key: 'vertical_pull', label: 'Vertical pull' },
  { key: 'squat', label: 'Squat' },
  { key: 'hinge', label: 'Hinge' },
  { key: 'lunge', label: 'Lunge' },
  { key: 'carry', label: 'Carry' },
  { key: 'rotation', label: 'Rotation' },
  { key: 'isolation_curl', label: 'Curl' },
  { key: 'isolation_extension', label: 'Extension' },
  { key: 'isolation_raise', label: 'Raise' },
  { key: 'brace', label: 'Brace' },
  { key: 'gait', label: 'Gait', description: 'Walking, running, cycling and other cyclic work.' },
  { key: 'stretch', label: 'Stretch' },
] as const satisfies readonly TaxonomyTerm[];

export type MovementPatternKey = (typeof MOVEMENT_PATTERNS)[number]['key'];

/* ---------------- lookup helpers ----------------
   Screens call these instead of holding their own label maps.
   An unknown key returns a readable fallback rather than throwing:
   a member-created exercise carrying a legacy free-text equipment
   value must still render.
   ---------------------------------------------------- */

function index<T extends TaxonomyTerm>(terms: readonly T[]): ReadonlyMap<string, T> {
  return new Map(terms.map((t) => [t.key, t]));
}

const MUSCLE_GROUP_INDEX = index(MUSCLE_GROUPS);
const MUSCLE_INDEX = index(MUSCLES);
const EQUIPMENT_INDEX = index(EQUIPMENT);
const DIFFICULTY_INDEX = index(DIFFICULTIES);
const EXERCISE_TYPE_INDEX = index(EXERCISE_TYPES);
const PATTERN_INDEX = index(MOVEMENT_PATTERNS);

/** Turns an unknown key into something a human can read. */
function humanise(key: string): string {
  return key
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export const muscleGroupLabel = (key: string): string =>
  MUSCLE_GROUP_INDEX.get(key)?.label ?? humanise(key);

export const muscleLabel = (key: string): string =>
  MUSCLE_INDEX.get(key)?.label ?? humanise(key);

export const equipmentLabel = (key: string): string =>
  EQUIPMENT_INDEX.get(key)?.label ?? humanise(key);

export const difficultyLabel = (key: string): string =>
  DIFFICULTY_INDEX.get(key)?.label ?? humanise(key);

export const exerciseTypeLabel = (key: string): string =>
  EXERCISE_TYPE_INDEX.get(key)?.label ?? humanise(key);

export const patternLabel = (key: string): string =>
  PATTERN_INDEX.get(key)?.label ?? humanise(key);

/** Every taxonomy list in one object, for the filter UI and the console. */
export const TAXONOMY = {
  muscleGroups: MUSCLE_GROUPS,
  muscles: MUSCLES,
  equipment: EQUIPMENT,
  difficulties: DIFFICULTIES,
  exerciseTypes: EXERCISE_TYPES,
  mechanics: MECHANICS,
  movementPatterns: MOVEMENT_PATTERNS,
} as const;
