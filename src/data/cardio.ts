/* ============================================================
   CARDIO LIBRARY (§5).

   Kept in its own file because cardio combines WITH strength work
   rather than replacing it — the plan builders pull from here to
   append a conditioning block to a lifting day, and the member's
   cardio-only plan is built from the same rows. One definition,
   two uses.

   Every row tracks duration and distance rather than weight and
   reps, which is what stops `sessionVolume()` and the personal
   record derivation from treating 30 minutes on a bike as a
   0 kg × 1 rep set.
   ============================================================ */
import { poseMedia } from './media';
import type { ExerciseContent } from './types';

export const CARDIO_EXERCISES: ExerciseContent[] = [
  {
    slug: 'treadmill-run', name: 'Treadmill Run',
    muscleGroup: 'cardio', primaryMuscles: ['heart_lungs'], secondaryMuscles: ['quads', 'calves'],
    equipment: 'treadmill', type: 'cardio', mechanic: null, pattern: 'gait',
    difficulty: 'beginner',
    summary: 'Steady running or intervals, with the pace under your control.',
    setup: ['Start walking before you set the pace.', 'Clip the safety key on.'],
    steps: ['Hold a conversational pace unless the plan says intervals.', 'Land under your hips rather than reaching forward.'],
    breathing: 'Nose in, mouth out, in rhythm with your stride.',
    mistakes: ['Holding the handrails, which changes your gait.'],
    safety: null, tags: ['cardio'], media: poseMedia('run'),
  },
  {
    slug: 'incline-walk', name: 'Incline Walk',
    muscleGroup: 'cardio', primaryMuscles: ['heart_lungs'], secondaryMuscles: ['glutes', 'calves'],
    equipment: 'treadmill', type: 'cardio', mechanic: null, pattern: 'gait',
    difficulty: 'beginner',
    summary: 'Low-impact steady work. Hard on the lungs, easy on the joints.',
    setup: ['Set a walking pace first, then raise the incline.'],
    steps: ['Walk tall, arms swinging naturally.', 'Keep the incline where you can still hold a conversation.'],
    breathing: 'Steady and nasal where you can.',
    mistakes: ['Hanging off the handrails, which cancels most of the work.'],
    safety: null, tags: ['cardio'], media: poseMedia('walk'),
  },
  {
    slug: 'walking', name: 'Walking',
    muscleGroup: 'cardio', primaryMuscles: ['heart_lungs'], secondaryMuscles: ['calves'],
    equipment: 'none', type: 'cardio', mechanic: null, pattern: 'gait',
    difficulty: 'beginner',
    summary: 'The most under-rated thing in the building.',
    setup: ['Nothing to set up.'],
    steps: ['Walk at a pace where talking is possible but not effortless.'],
    breathing: 'Natural.',
    mistakes: ['Treating it as not counting. It counts.'],
    safety: null, tags: ['cardio'], media: poseMedia('walk', { scene: 'floor' }),
  },
  {
    slug: 'stationary-bike', name: 'Stationary Bike',
    muscleGroup: 'cardio', primaryMuscles: ['heart_lungs'], secondaryMuscles: ['quads', 'glutes'],
    equipment: 'bike', type: 'cardio', mechanic: null, pattern: 'gait',
    difficulty: 'beginner',
    summary: 'Seated conditioning with almost no impact.',
    setup: ['Saddle height so the knee is slightly bent at the bottom of the stroke.'],
    steps: ['Hold a cadence around 80–90 rpm for steady work.', 'Raise resistance rather than flailing the legs for intervals.'],
    breathing: 'Steady. Let the cadence set the rhythm.',
    mistakes: ['Saddle far too low, which grinds the knees.'],
    safety: null, tags: ['cardio'], media: poseMedia('cycle'),
  },
  {
    slug: 'assault-bike', name: 'Assault Bike',
    muscleGroup: 'cardio', primaryMuscles: ['heart_lungs'], secondaryMuscles: ['quads', 'lats'],
    equipment: 'bike', type: 'cardio', mechanic: null, pattern: 'gait',
    difficulty: 'intermediate',
    summary: 'Air bike. Unforgiving and very effective for intervals.',
    setup: ['Saddle height as for any bike; hands on the moving arms.'],
    steps: ['Drive with the legs, arms along for the ride.', 'Keep the cadence honest for the whole interval.'],
    breathing: 'You will not control it. Recover fully between intervals.',
    mistakes: ['Going out far too hard on the first interval.'],
    safety: null, tags: ['cardio', 'conditioning'], media: poseMedia('cycle'),
  },
  {
    slug: 'rowing-machine', name: 'Rowing Machine',
    muscleGroup: 'cardio', primaryMuscles: ['heart_lungs'], secondaryMuscles: ['lats', 'quads', 'glutes'],
    equipment: 'rower', type: 'cardio', mechanic: null, pattern: 'gait',
    difficulty: 'beginner',
    summary: 'Full-body conditioning that also builds the back.',
    setup: ['Straps over the widest part of the foot, damper around 4–5.'],
    steps: ['Legs, then hips, then arms on the drive.', 'Arms, then hips, then legs on the recovery.'],
    breathing: 'Out on the drive, in on the recovery.',
    mistakes: ['Pulling with the arms first — the legs do most of the work.'],
    safety: null, tags: ['cardio', 'conditioning'], media: poseMedia('row_erg'),
  },
  {
    slug: 'elliptical', name: 'Elliptical',
    muscleGroup: 'cardio', primaryMuscles: ['heart_lungs'], secondaryMuscles: ['quads', 'glutes'],
    equipment: 'elliptical', type: 'cardio', mechanic: null, pattern: 'gait',
    difficulty: 'beginner',
    summary: 'Zero-impact steady work. A good option around a sore knee.',
    setup: ['Stand tall, hands on the moving handles.'],
    steps: ['Push through the whole foot.', 'Use resistance rather than speed to make it harder.'],
    breathing: 'Steady.',
    mistakes: ['Leaning your weight onto the handles.'],
    safety: null, tags: ['cardio'], media: poseMedia('walk', { scene: 'floor' }),
  },
  {
    slug: 'stair-machine', name: 'Stair Machine',
    muscleGroup: 'cardio', primaryMuscles: ['heart_lungs'], secondaryMuscles: ['glutes', 'quads', 'calves'],
    equipment: 'stair_machine', type: 'cardio', mechanic: null, pattern: 'gait',
    difficulty: 'intermediate',
    summary: 'Hard conditioning that hits the glutes as a bonus.',
    setup: ['Start slow and let the machine reach a steady speed.'],
    steps: ['Stand tall, take full steps.', 'Touch the rail for balance only.'],
    breathing: 'It will get heavy. Drop the speed rather than hanging on.',
    mistakes: ['Leaning on the handrails and taking half-steps.'],
    safety: null, tags: ['cardio'], media: poseMedia('stair'),
  },
  {
    slug: 'jump-rope', name: 'Jump Rope',
    muscleGroup: 'cardio', primaryMuscles: ['heart_lungs'], secondaryMuscles: ['calves', 'forearms'],
    equipment: 'jump_rope', type: 'cardio', mechanic: null, pattern: 'gait',
    difficulty: 'intermediate',
    summary: 'Conditioning and coordination in a very small space.',
    setup: ['Rope length: handles reach the armpits when you stand on the middle.'],
    steps: ['Small hops on the balls of the feet.', 'Turn the rope from the wrists, not the shoulders.'],
    breathing: 'Relaxed. Tension in the shoulders will end the set early.',
    mistakes: ['Jumping far too high.'],
    safety: null, tags: ['cardio', 'conditioning'], media: poseMedia('jump_rope'),
  },
];
