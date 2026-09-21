/* ============================================================
   30-DAY BEGINNER FOUNDATION (§5).

   Deliberately THIRTY days, not seven. A seven-day beginner plan
   ends the week someone is finally starting to feel competent,
   which is exactly the wrong moment to hand them an empty
   calendar. Thirty days is long enough to learn six movement
   patterns, build the habit of turning up, and see the first
   honest strength change.

   The days are GENERATED from a small table rather than written
   out thirty times. Three full-body sessions rotate on a seven-day
   cycle, and the set count steps up by week. Hand-writing them
   would be 700 lines in which a single wrong slug hides perfectly.

   Progression rule, stated once here so it is checkable:
     week 1  — 2 sets, learn the pattern, light
     week 2  — 2 sets, same movements, a little more load
     week 3  — 3 sets
     week 4+ — 3 sets, top of the rep range before adding weight
   ============================================================ */
import type { PlanDayContent, PlanExerciseContent, PlanTemplateContent } from '../types';

/** One movement as it appears across the programme, before set counts are applied. */
type Slot = [slug: string, reps: number, repsMax: number, weight: number, rest: number, note?: string];

const SESSION_A: Slot[] = [
  ['goblet-squat', 8, 12, 10, 90, 'Learn to sit down between your knees. Depth before load.'],
  ['machine-chest-press', 8, 12, 20, 90],
  ['seated-cable-row', 10, 12, 25, 90],
  ['glute-bridge', 12, 15, 0, 60],
  ['plank', 1, 1, 0, 60, 'Hold 20–30 seconds.'],
];

const SESSION_B: Slot[] = [
  ['romanian-deadlift', 8, 10, 20, 90, 'Hips back, not down. Stop where the hamstrings stop stretching.'],
  ['lat-pulldown', 10, 12, 25, 90],
  ['dumbbell-shoulder-press', 8, 12, 8, 90],
  ['leg-curl', 10, 12, 15, 60],
  ['dead-bug', 8, 10, 0, 45, '8 per side, slow.'],
];

const SESSION_C: Slot[] = [
  ['leg-press', 10, 15, 60, 90],
  ['dumbbell-bench-press', 8, 12, 10, 90],
  ['dumbbell-row', 10, 12, 10, 90, '10 per side.'],
  ['hammer-curl', 10, 12, 6, 60],
  ['triceps-pushdown', 10, 12, 15, 60],
];

const SESSION_META = {
  A: { title: 'Full body A', focus: 'Squat · Push · Pull', slots: SESSION_A },
  B: { title: 'Full body B', focus: 'Hinge · Pull · Press', slots: SESSION_B },
  C: { title: 'Full body C', focus: 'Legs · Push · Arms', slots: SESSION_C },
} as const;

const WARMUP = ['warmup-easy-treadmill', 'warmup-leg-swings', 'warmup-arm-circles'];
const COOLDOWN = ['cat-cow', 'hip-flexor-stretch'];

/** Sets by week. Weeks are 1-indexed; week 5 exists because day 29 falls in it. */
function setsForWeek(week: number): number {
  if (week <= 2) return 2;
  return 3;
}

function noteForWeek(week: number): string {
  switch (week) {
    case 1: return 'Week 1 — the goal is the movement, not the weight. Finish every set feeling like you had three more.';
    case 2: return 'Week 2 — same movements. If last week felt easy, add a small amount of weight.';
    case 3: return 'Week 3 — three sets now. This is where it starts to feel like training.';
    case 4: return 'Week 4 — aim for the top of each rep range before you add weight.';
    default: return 'Final days. Take the best numbers from this month into whichever plan you pick next.';
  }
}

function toExercises(slots: readonly Slot[], sets: number): PlanExerciseContent[] {
  return slots.map(([slug, reps, repsMax, targetWeightKg, restSec, notes]) => ({
    slug, sets, reps, repsMax, targetWeightKg, restSec, notes,
  }));
}

/** The 7-day cycle: three sessions, one easy day, three rests. */
const CYCLE = ['A', 'rest', 'B', 'walk', 'C', 'rest', 'rest'] as const;

function buildDays(): PlanDayContent[] {
  const days: PlanDayContent[] = [];
  for (let dayNo = 1; dayNo <= 30; dayNo++) {
    const week = Math.ceil(dayNo / 7);
    const slot = CYCLE[(dayNo - 1) % 7];

    if (slot === 'rest') {
      days.push({
        dayNo, title: `Day ${dayNo} — Rest`, focus: 'Recovery', isRest: true,
        notes: 'A full rest day. Your body builds the strength you trained for on the days you do not train.',
      });
      continue;
    }

    if (slot === 'walk') {
      days.push({
        dayNo, title: `Day ${dayNo} — Easy movement`, focus: 'Active recovery',
        isRest: true, estimatedMin: 25,
        notes: 'Not a training day. Twenty minutes of easy walking and some mobility work, and you will feel better tomorrow.',
        exercises: [
          { slug: 'walking', sets: 1, reps: 1, restSec: 0, notes: '20 minutes at an easy pace.' },
          { slug: 'cat-cow', sets: 1, reps: 10, restSec: 0 },
          { slug: 'hip-flexor-stretch', sets: 1, reps: 1, restSec: 0, notes: '45 seconds each side.' },
        ],
      });
      continue;
    }

    const meta = SESSION_META[slot];
    const sets = setsForWeek(week);
    days.push({
      dayNo,
      title: `Day ${dayNo} — ${meta.title}`,
      focus: meta.focus,
      estimatedMin: sets === 2 ? 35 : 45,
      warmup: WARMUP,
      cooldown: COOLDOWN,
      notes: noteForWeek(week),
      exercises: toExercises(meta.slots, sets),
    });
  }
  return days;
}

export const BEGINNER_30_PLAN: PlanTemplateContent = {
  slug: 'beginner-foundation-30',
  name: '30-Day Beginner Foundation',
  family: 'beginner',
  schedule: 'numbered',
  summary: 'Thirty days to learn the six movements everything else is built from.',
  description:
    'Three full-body sessions a week, rotating, with rest and easy-movement days between them. '
    + 'Nothing exotic: squat, hinge, push, pull, press, carry — done properly and repeated often enough '
    + 'to become automatic. By day 30 you will know your way around the floor and have real numbers to '
    + 'carry into whichever plan you choose next.',
  difficulty: 'beginner',
  daysPerWeek: 3,
  durationWeeks: 5,
  highlights: [
    'Sessions of 35–45 minutes, never longer',
    'Every day tells you exactly what to do',
    'Load steps up on a schedule, so you never have to guess',
  ],
  equipmentNeeded: ['dumbbell', 'machine', 'cable', 'bodyweight', 'treadmill'],
  days: buildDays(),
};
