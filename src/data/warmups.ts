/* ============================================================
   WARM-UP LIBRARY (§6).

   Warm-ups are STRUCTURED EXERCISES, not a sentence of prose on a
   program day. That is the whole point of this file: the old
   `ProgramDay.warmup` string could not be reused, searched,
   illustrated, or reliably kept out of the working-set maths.

   Two independent things keep a warm-up from ever becoming a
   personal record:
     1. `type: 'warmup'` here, which classifies the EXERCISE, and
     2. `SetKind === 'warmup'`, which classifies the SET
        (hard rule 11, `countableSets()` in lib/derive.ts).
   They are different questions — a warm-up SET of bench press is
   a normal exercise done lightly — so both exist.
   ============================================================ */
import { poseMedia } from './media';
import type { ExerciseContent } from './types';

export const WARMUP_EXERCISES: ExerciseContent[] = [
  {
    slug: 'warmup-easy-treadmill', name: 'Easy Treadmill Walk',
    muscleGroup: 'cardio', primaryMuscles: ['heart_lungs'], secondaryMuscles: [],
    equipment: 'treadmill', type: 'warmup', mechanic: null, pattern: 'gait',
    difficulty: 'beginner',
    summary: 'Five minutes to raise the body temperature before anything else.',
    setup: ['Comfortable walking pace, flat or a light incline.'],
    steps: ['Walk for 5 minutes.', 'You should be warm, not tired.'],
    breathing: 'Easy and nasal.',
    mistakes: ['Turning the warm-up into the workout.'],
    safety: null, tags: ['warmup'], media: poseMedia('walk'),
  },
  {
    slug: 'warmup-easy-bike', name: 'Easy Bike Spin',
    muscleGroup: 'cardio', primaryMuscles: ['heart_lungs'], secondaryMuscles: ['quads'],
    equipment: 'bike', type: 'warmup', mechanic: null, pattern: 'gait',
    difficulty: 'beginner',
    summary: 'Low-resistance spinning. The default warm-up before legs.',
    setup: ['Low resistance, saddle at the right height.'],
    steps: ['Spin easily for 5 minutes.'],
    breathing: 'Easy.',
    mistakes: ['Adding resistance because it feels too easy. It is meant to.'],
    safety: null, tags: ['warmup'], media: poseMedia('cycle'),
  },
  {
    slug: 'warmup-arm-circles', name: 'Arm Circles',
    muscleGroup: 'shoulders', primaryMuscles: ['front_delts', 'rotator_cuff'], secondaryMuscles: ['traps'],
    equipment: 'none', type: 'warmup', mechanic: null, pattern: 'isolation_raise',
    difficulty: 'beginner',
    summary: 'Wakes the shoulder up through its full circle.',
    setup: ['Stand tall, arms out to the sides.'],
    steps: ['10 small circles forward, growing bigger.', '10 backwards.'],
    breathing: 'Normal.',
    mistakes: ['Rushing and shrugging.'],
    safety: null, tags: ['warmup', 'mobility'], media: poseMedia('arm_circle'),
  },
  {
    slug: 'warmup-shoulder-rotations', name: 'Shoulder Rotations',
    muscleGroup: 'shoulders', primaryMuscles: ['rotator_cuff'], secondaryMuscles: ['rear_delts'],
    equipment: 'band', type: 'warmup', mechanic: null, pattern: 'rotation',
    difficulty: 'beginner',
    summary: 'Rotator cuff prep. Two minutes that protect every press you do.',
    setup: ['Light band, elbow tucked at your side at 90°.'],
    steps: ['Rotate the forearm outwards against the band.', 'Return slowly. 12–15 per side.'],
    breathing: 'Normal.',
    mistakes: ['Using a band so heavy the shoulder shrugs to help.'],
    safety: null, tags: ['warmup', 'mobility'], media: poseMedia('shoulder_rotation'),
  },
  {
    slug: 'warmup-band-pull-apart', name: 'Band Pull-Apart',
    muscleGroup: 'shoulders', primaryMuscles: ['rear_delts'], secondaryMuscles: ['rhomboids'],
    equipment: 'band', type: 'warmup', mechanic: null, pattern: 'horizontal_pull',
    difficulty: 'beginner',
    summary: 'Switches the upper back on before pressing or pulling.',
    setup: ['Band at chest height, arms straight.'],
    steps: ['Pull the band apart until it touches the chest.', 'Return slowly. 15–20 reps.'],
    breathing: 'Out as you pull apart.',
    mistakes: ['Bending the elbows.'],
    safety: null, tags: ['warmup', 'mobility'], media: poseMedia('face_pull', { prop: 'band', scene: 'floor' }),
  },
  {
    slug: 'warmup-leg-swings', name: 'Leg Swings',
    muscleGroup: 'mobility', primaryMuscles: ['hip_flexors', 'hamstrings'], secondaryMuscles: ['glutes'],
    equipment: 'none', type: 'warmup', mechanic: null, pattern: 'gait',
    difficulty: 'beginner',
    summary: 'Opens the hips before squatting or running.',
    setup: ['Hold something stable for balance.'],
    steps: ['Swing one leg forward and back, controlled, 12 times.', 'Swap sides.'],
    breathing: 'Normal.',
    mistakes: ['Swinging so hard the lower back arches.'],
    safety: null, tags: ['warmup', 'mobility'], media: poseMedia('leg_swing'),
  },
  {
    slug: 'warmup-bodyweight-squats', name: 'Warm-up Squats',
    muscleGroup: 'legs', primaryMuscles: ['quads', 'glutes'], secondaryMuscles: [],
    equipment: 'bodyweight', type: 'warmup', mechanic: null, pattern: 'squat',
    difficulty: 'beginner',
    summary: 'Grooves the pattern before you load it.',
    setup: ['Feet shoulder-width.'],
    steps: ['10–15 slow, full-depth squats.'],
    breathing: 'In down, out up.',
    mistakes: ['Going fast and shallow.'],
    safety: null, tags: ['warmup'], media: poseMedia('squat_bodyweight'),
  },
  {
    slug: 'warmup-cat-cow', name: 'Warm-up Cat–Cow',
    muscleGroup: 'mobility', primaryMuscles: ['spinal_erectors'], secondaryMuscles: ['abs'],
    equipment: 'none', type: 'warmup', mechanic: null, pattern: 'stretch',
    difficulty: 'beginner',
    summary: 'Gets the spine moving before it has to brace.',
    setup: ['Hands and knees.'],
    steps: ['8–10 slow cycles of rounding and arching.'],
    breathing: 'Out as you round, in as you arch.',
    mistakes: ['Moving quickly.'],
    safety: null, tags: ['warmup', 'mobility'], media: poseMedia('cat_cow'),
  },
  {
    slug: 'warmup-scapular-hang', name: 'Scapular Hang',
    muscleGroup: 'back', primaryMuscles: ['lats', 'traps'], secondaryMuscles: ['forearms'],
    equipment: 'bodyweight', type: 'warmup', mechanic: null, pattern: 'vertical_pull',
    difficulty: 'beginner',
    summary: 'Prepares the shoulders for pulling and decompresses the spine.',
    setup: ['Hang from a bar with straight arms.'],
    steps: ['Pull the shoulder blades down without bending the elbows.', 'Release. 8 slow reps.'],
    breathing: 'Normal.',
    mistakes: ['Bending the arms — the elbows stay straight.'],
    safety: null, tags: ['warmup'], media: poseMedia('hang'),
  },
  {
    slug: 'warmup-ramp-up-sets', name: 'Ramp-up Sets',
    muscleGroup: 'full_body', primaryMuscles: ['heart_lungs'], secondaryMuscles: [],
    equipment: 'none', type: 'warmup', mechanic: null, pattern: 'brace',
    difficulty: 'beginner',
    summary: 'Two or three progressively heavier sets of the first lift of the day.',
    setup: ['Use the first working exercise of the session.'],
    steps: ['Set 1: about half your working weight, 8 reps.', 'Set 2: about three-quarters, 4 reps.', 'Then start your working sets.'],
    breathing: 'As for the lift itself.',
    mistakes: ['Skipping them on a heavy day.'],
    safety: 'Log these as warm-up sets so they never count towards a record.',
    tags: ['warmup'], media: null,
  },
];
