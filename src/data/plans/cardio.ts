/* ============================================================
   CARDIO PLAN (§5).

   A standalone conditioning plan AND the source of the cardio
   blocks other plans append to a lifting day. Same rows either
   way — strength and cardio combine rather than compete, which is
   why cardio is a plan family here and not a separate product
   area.
   ============================================================ */
import type { PlanTemplateContent } from '../types';

export const CARDIO_PLAN: PlanTemplateContent = {
  slug: 'cardio-base',
  name: 'Cardio Base',
  family: 'cardio',
  schedule: 'weekly',
  summary: 'Four conditioning sessions a week — steady work, intervals, and one long easy day.',
  description:
    'Built for engine, not for exhaustion. Three of the four sessions are easy enough to hold a conversation '
    + 'through; one is genuinely hard. That ratio is what makes it sustainable week after week. '
    + 'It combines cleanly with any strength plan — run it on your off days, or add a single block to the end '
    + 'of a lifting session.',
  difficulty: 'beginner',
  daysPerWeek: 4,
  durationWeeks: 8,
  highlights: [
    'Mostly easy, occasionally hard — the ratio that actually works',
    'Machine-agnostic: swap the bike for the rower or the stairs',
    'Runs alongside a strength plan without clashing',
  ],
  equipmentNeeded: ['treadmill', 'bike', 'rower', 'stair_machine', 'none'],
  days: [
    {
      dayIndex: 1, title: 'Steady state', focus: 'Aerobic base', estimatedMin: 35,
      warmup: ['warmup-easy-treadmill'],
      exercises: [
        { slug: 'incline-walk', sets: 1, reps: 1, restSec: 0, notes: '30 minutes. You should be able to speak in full sentences.' },
      ],
    },
    { dayIndex: 2, title: 'Rest', focus: 'Recovery', isRest: true },
    {
      dayIndex: 3, title: 'Intervals', focus: 'Hard conditioning', estimatedMin: 30,
      warmup: ['warmup-easy-bike', 'warmup-leg-swings'],
      cooldown: ['walking'],
      exercises: [
        { slug: 'assault-bike', sets: 1, reps: 1, restSec: 0, notes: '10 rounds: 30 seconds hard, 60 seconds easy.' },
      ],
    },
    { dayIndex: 4, title: 'Rest', focus: 'Recovery', isRest: true },
    {
      dayIndex: 5, title: 'Machine mix', focus: 'Aerobic base', estimatedMin: 35,
      warmup: ['warmup-easy-bike'],
      exercises: [
        { slug: 'rowing-machine', sets: 1, reps: 1, restSec: 0, notes: '15 minutes, steady.' },
        { slug: 'stair-machine', sets: 1, reps: 1, restSec: 0, notes: '10 minutes at a sustainable pace.' },
      ],
    },
    {
      dayIndex: 6, title: 'Long easy', focus: 'Aerobic base', estimatedMin: 50,
      exercises: [
        { slug: 'walking', sets: 1, reps: 1, restSec: 0, notes: '45–60 minutes. Outdoors if you can.' },
        { slug: 'hip-flexor-stretch', sets: 1, reps: 1, restSec: 0, notes: '45 seconds each side.' },
      ],
    },
    { dayIndex: 0, title: 'Rest', focus: 'Full rest', isRest: true },
  ],
};
