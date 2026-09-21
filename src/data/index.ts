/* ============================================================
   THE CONTENT LAYER (§29).

   Structured local data is the temporary source of truth for
   exercises, taxonomy, media and plans. `lib/seed.ts` reads this
   folder once, on first boot, and turns it into stored rows; from
   then on `lib/api.ts` is the only reader. Nothing in
   `components/` or `pages/` imports from here.

   That indirection is what makes the Postgres migration (§30) a
   data move rather than a UI rewrite: these files become the
   fixtures that populate `exercises`, `workout_plans` and friends,
   and the member screens never learn where the rows came from.
   ============================================================ */
import { STRENGTH_EXERCISES } from './exercises';
import { CARDIO_EXERCISES } from './cardio';
import { WARMUP_EXERCISES } from './warmups';
import { PLAN_TEMPLATES } from './plans';
import { DRAWING_INDEX, undrawableMuscles, ungroupedMuscleGroups } from './media';
import { EQUIPMENT, EXERCISE_TYPES, MUSCLES, MUSCLE_GROUPS } from './taxonomy';
import type { ExerciseContent } from './types';

/** Every exercise the platform ships, in one list. */
export const ALL_EXERCISES: ExerciseContent[] = [
  ...STRENGTH_EXERCISES,
  ...CARDIO_EXERCISES,
  ...WARMUP_EXERCISES,
];

export const EXERCISE_BY_SLUG: ReadonlyMap<string, ExerciseContent> =
  new Map(ALL_EXERCISES.map((e) => [e.slug, e]));

/* ---------------- content validation ----------------
   Run at seed time. Every one of these has a failure mode that is
   invisible in code review and obvious to a member at 6am: a plan
   day whose exercise does not exist renders as a blank row, a
   media record pointing at a missing drawing renders as an empty
   box, and a duplicate slug silently drops an exercise from the
   library.
   ---------------------------------------------------- */

export interface ContentProblem {
  where: string;
  problem: string;
}

const MUSCLE_GROUP_KEYS = new Set<string>(MUSCLE_GROUPS.map((m) => m.key));
const MUSCLE_KEYS = new Set<string>(MUSCLES.map((m) => m.key));
const EQUIPMENT_KEYS = new Set<string>(EQUIPMENT.map((e) => e.key));
const TYPE_KEYS = new Set<string>(EXERCISE_TYPES.map((t) => t.key));

export function validateContent(): ContentProblem[] {
  const problems: ContentProblem[] = [];
  const seen = new Set<string>();
  const names = new Set<string>();

  for (const ex of ALL_EXERCISES) {
    const where = `exercise:${ex.slug}`;
    if (seen.has(ex.slug)) problems.push({ where, problem: 'duplicate slug' });
    seen.add(ex.slug);

    const nameKey = ex.name.toLowerCase();
    if (names.has(nameKey)) problems.push({ where, problem: `duplicate name "${ex.name}"` });
    names.add(nameKey);

    if (!MUSCLE_GROUP_KEYS.has(ex.muscleGroup)) {
      problems.push({ where, problem: `unknown muscle group "${ex.muscleGroup}"` });
    }
    if (!EQUIPMENT_KEYS.has(ex.equipment)) {
      problems.push({ where, problem: `unknown equipment "${ex.equipment}"` });
    }
    if (!TYPE_KEYS.has(ex.type)) {
      problems.push({ where, problem: `unknown type "${ex.type}"` });
    }
    for (const m of [...ex.primaryMuscles, ...ex.secondaryMuscles]) {
      if (!MUSCLE_KEYS.has(m)) problems.push({ where, problem: `unknown muscle "${m}"` });
    }
    if (!ex.steps.length) problems.push({ where, problem: 'no movement steps' });
    // The focus cue is the one line a member reads mid-set. An exercise
    // without one silently loses the most useful sentence on the screen,
    // and nothing else would ever report it.
    if (!ex.focus.trim()) problems.push({ where, problem: 'no focus cue' });
    if (ex.media?.kind === 'pose' && !DRAWING_INDEX.has(ex.media.src)) {
      problems.push({ where, problem: `media points at missing drawing "${ex.media.src}"` });
    }
  }

  /* The muscle chart is keyed to the taxonomy, so a muscle we declare
     but cannot draw is an exercise whose "primary muscle" lights nothing
     at all — invisible in review, obvious the first time it renders. */
  for (const muscle of undrawableMuscles()) {
    problems.push({ where: `anatomy:${muscle}`, problem: 'taxonomy muscle has no chart region' });
  }
  for (const group of ungroupedMuscleGroups()) {
    problems.push({ where: `anatomy:${group}`, problem: 'muscle group has no chart fallback' });
  }

  for (const plan of PLAN_TEMPLATES) {
    const numbered = plan.schedule === 'numbered';
    for (const day of plan.days) {
      const where = `plan:${plan.slug}/${day.title}`;
      if (numbered && day.dayNo == null) problems.push({ where, problem: 'numbered plan day has no dayNo' });
      if (!numbered && day.dayIndex == null) problems.push({ where, problem: 'weekly plan day has no dayIndex' });
      for (const slug of [...(day.warmup ?? []), ...(day.cooldown ?? [])]) {
        if (!EXERCISE_BY_SLUG.has(slug)) problems.push({ where, problem: `unknown warm-up/cool-down "${slug}"` });
      }
      for (const item of day.exercises ?? []) {
        if (!EXERCISE_BY_SLUG.has(item.slug)) {
          problems.push({ where, problem: `unknown exercise "${item.slug}"` });
        }
        if (item.repsMax != null && item.repsMax < item.reps) {
          problems.push({ where, problem: `${item.slug}: repsMax below reps` });
        }
      }
    }
  }

  return problems;
}

export { STRENGTH_EXERCISES, CARDIO_EXERCISES, WARMUP_EXERCISES, PLAN_TEMPLATES };
export * from './taxonomy';
export type { ExerciseContent, PlanTemplateContent, PlanDayContent, PlanExerciseContent } from './types';
