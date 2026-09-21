/* ============================================================
   Shapes for the structured content in this folder.

   These are CONTENT types, not domain types. `lib/types.ts` owns
   the rows that get stored; this file owns the authoring format
   that produces them at seed time. They are deliberately separate:
   content carries a `slug` and references exercises BY SLUG so a
   plan file stays readable and diffable, while the stored rows
   carry generated ids and reference each other by id.

   That translation happens once, in `lib/seed.ts`. It is also the
   Postgres seeding path later (§30) — these files become the
   fixtures, not the schema.
   ============================================================ */
import type { ExerciseMedia } from '../lib/types';
import type {
  DifficultyKey, EquipmentKey, ExerciseTypeKey, MechanicKey,
  MovementPatternKey, MuscleGroupKey, MuscleKey,
} from './taxonomy';

/** One exercise as authored. Becomes an `Exercise` row with scope `global`. */
export interface ExerciseContent {
  /** Stable, human-readable key. Plans reference exercises by this. */
  slug: string;
  name: string;
  muscleGroup: MuscleGroupKey;
  primaryMuscles: MuscleKey[];
  secondaryMuscles: MuscleKey[];
  equipment: EquipmentKey;
  type: ExerciseTypeKey;
  /** null for mobility and warm-up work, where the distinction is meaningless. */
  mechanic: MechanicKey | null;
  pattern: MovementPatternKey;
  difficulty: DifficultyKey;
  /** One sentence for the library card. */
  summary: string;
  /**
   * THE one thing to get right. Shown next to the demonstration,
   * on its own, in the player.
   *
   * Separate from `steps` because it answers a different question:
   * steps are the order of operations, focus is what a beginner
   * will get wrong if nobody tells them. A member mid-set reads one
   * line or none, and this is the line worth spending it on (§12).
   */
  focus: string;
  /** How to get into position. */
  setup: string[];
  /** The movement itself, in order. */
  steps: string[];
  breathing: string;
  mistakes: string[];
  /** Only where there is a genuine risk. An empty warning trains people to ignore warnings. */
  safety: string | null;
  tags: string[];
  media: ExerciseMedia | null;
}

/* ---------------- plans ---------------- */

/** A prescribed exercise inside a plan day. References an exercise by slug. */
export interface PlanExerciseContent {
  slug: string;
  sets: number;
  /** Target reps. For timed work this is 1 and the note carries the duration. */
  reps: number;
  /** Rep range upper bound, when the plan prescribes one. Drives the progression hint. */
  repsMax?: number;
  targetWeightKg?: number;
  restSec: number;
  notes?: string;
}

/**
 * One day of a plan.
 *
 * `dayIndex` is the day of the WEEK (0 = Sunday) for weekly plans;
 * `dayNo` is the day of the PROGRAMME (1..30) for day-numbered
 * plans like the beginner foundation. A plan uses one or the
 * other — see PlanTemplateContent.schedule.
 */
export interface PlanDayContent {
  dayIndex?: number;
  dayNo?: number;
  title: string;
  focus: string;
  isRest?: boolean;
  /** Warm-up exercise slugs. Structured, never prose (§6). */
  warmup?: string[];
  cooldown?: string[];
  notes?: string;
  /** Estimated minutes. Shown on the Today card; omitted when we cannot say honestly. */
  estimatedMin?: number;
  exercises?: PlanExerciseContent[];
}

export type PlanFamily = 'ppl' | 'body_part_split' | 'beginner' | 'cardio' | 'hybrid';

/**
 * `weekly` repeats the same seven days indefinitely.
 * `numbered` runs day 1 → day N once, and the member sees "Day 7 / 30".
 */
export type PlanSchedule = 'weekly' | 'numbered';

export interface PlanTemplateContent {
  slug: string;
  name: string;
  family: PlanFamily;
  schedule: PlanSchedule;
  /** One line for the plan card. */
  summary: string;
  description: string;
  difficulty: DifficultyKey;
  /** Training days per week, as the plan intends it. */
  daysPerWeek: number;
  /** Total weeks for a weekly plan; ceil(days / 7) for a numbered one. */
  durationWeeks: number;
  /** What the member gets out of it. Three bullets, no marketing. */
  highlights: string[];
  equipmentNeeded: EquipmentKey[];
  days: PlanDayContent[];
}
