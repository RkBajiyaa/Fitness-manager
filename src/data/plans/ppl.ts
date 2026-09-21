/* ============================================================
   PUSH / PULL / LEGS — the six-day classic.

   Days reference exercises BY SLUG. Nothing about an exercise is
   duplicated here (§21): change the bench press instructions once
   in data/exercises.ts and every plan that prescribes it updates.
   ============================================================ */
import type { PlanTemplateContent } from '../types';

export const PPL_PLAN: PlanTemplateContent = {
  slug: 'ppl',
  name: 'Push / Pull / Legs',
  family: 'ppl',
  schedule: 'weekly',
  summary: 'Six training days a week, each body region hit twice.',
  description:
    'The most popular intermediate split there is, and for good reason: every muscle gets trained twice a week, '
    + 'sessions stay under an hour, and the movements repeat often enough that you get good at them fast. '
    + 'Six days is the full version — running it four days a week (Push, Pull, Legs, Push) works too.',
  difficulty: 'intermediate',
  daysPerWeek: 6,
  durationWeeks: 8,
  highlights: [
    'Each muscle group trained twice a week',
    'Sessions of 5–6 exercises, roughly 50 minutes',
    'Built around barbell, dumbbell and cable work',
  ],
  equipmentNeeded: ['barbell', 'dumbbell', 'cable', 'machine', 'bodyweight'],
  days: [
    {
      dayIndex: 1, title: 'Push A', focus: 'Chest · Shoulders · Triceps', estimatedMin: 55,
      warmup: ['warmup-easy-treadmill', 'warmup-band-pull-apart', 'warmup-ramp-up-sets'],
      cooldown: ['thoracic-rotation'],
      exercises: [
        { slug: 'barbell-bench-press', sets: 4, reps: 8, repsMax: 10, targetWeightKg: 60, restSec: 120, notes: 'Leave one rep in reserve on the first three sets.' },
        { slug: 'incline-dumbbell-press', sets: 3, reps: 10, repsMax: 12, targetWeightKg: 22, restSec: 90 },
        { slug: 'overhead-press', sets: 3, reps: 8, repsMax: 10, targetWeightKg: 35, restSec: 90 },
        { slug: 'lateral-raise', sets: 3, reps: 12, repsMax: 15, targetWeightKg: 8, restSec: 60, notes: 'Strict form, light weight.' },
        { slug: 'triceps-pushdown', sets: 3, reps: 12, repsMax: 15, targetWeightKg: 25, restSec: 60 },
      ],
    },
    {
      dayIndex: 2, title: 'Pull A', focus: 'Back · Biceps', estimatedMin: 55,
      warmup: ['warmup-easy-bike', 'warmup-scapular-hang', 'warmup-ramp-up-sets'],
      cooldown: ['thoracic-rotation'],
      exercises: [
        { slug: 'deadlift', sets: 4, reps: 5, repsMax: 6, targetWeightKg: 100, restSec: 180, notes: 'Stop the set the moment the back rounds.' },
        { slug: 'pull-ups', sets: 4, reps: 6, repsMax: 10, targetWeightKg: 0, restSec: 120, notes: 'Use the assist machine or a band if needed.' },
        { slug: 'barbell-row', sets: 3, reps: 10, repsMax: 12, targetWeightKg: 45, restSec: 90 },
        { slug: 'face-pull', sets: 3, reps: 15, repsMax: 20, targetWeightKg: 20, restSec: 60 },
        { slug: 'barbell-curl', sets: 3, reps: 10, repsMax: 12, targetWeightKg: 25, restSec: 60 },
      ],
    },
    {
      dayIndex: 3, title: 'Legs A', focus: 'Quads · Glutes · Hamstrings', estimatedMin: 60,
      warmup: ['warmup-easy-bike', 'warmup-leg-swings', 'warmup-bodyweight-squats'],
      cooldown: ['foam-roll-quads', 'hip-flexor-stretch'],
      exercises: [
        { slug: 'back-squat', sets: 4, reps: 8, repsMax: 10, targetWeightKg: 80, restSec: 150, notes: 'Full depth. Set the safety pins.' },
        { slug: 'romanian-deadlift', sets: 3, reps: 10, repsMax: 12, targetWeightKg: 60, restSec: 120 },
        { slug: 'leg-press', sets: 3, reps: 12, repsMax: 15, targetWeightKg: 140, restSec: 90 },
        { slug: 'leg-curl', sets: 3, reps: 12, repsMax: 15, targetWeightKg: 35, restSec: 60 },
        { slug: 'calf-raise', sets: 4, reps: 15, repsMax: 20, targetWeightKg: 40, restSec: 45 },
      ],
    },
    {
      dayIndex: 4, title: 'Recovery', focus: 'Mobility & easy cardio', isRest: true, estimatedMin: 25,
      notes: 'Optional 20–30 minutes of easy movement plus the mobility work. Rest is part of the programme, not a gap in it.',
      exercises: [
        { slug: 'incline-walk', sets: 1, reps: 1, restSec: 0, notes: '20–30 minutes, easy.' },
        { slug: 'cat-cow', sets: 1, reps: 10, restSec: 0 },
        { slug: 'hip-flexor-stretch', sets: 1, reps: 1, restSec: 0, notes: '45 seconds each side.' },
      ],
    },
    {
      dayIndex: 5, title: 'Push B', focus: 'Shoulders · Chest · Triceps', estimatedMin: 50,
      warmup: ['warmup-arm-circles', 'warmup-shoulder-rotations', 'warmup-ramp-up-sets'],
      exercises: [
        { slug: 'dumbbell-shoulder-press', sets: 4, reps: 10, repsMax: 12, targetWeightKg: 20, restSec: 90 },
        { slug: 'dips', sets: 3, reps: 8, repsMax: 12, targetWeightKg: 0, restSec: 90 },
        { slug: 'cable-fly', sets: 3, reps: 12, repsMax: 15, targetWeightKg: 15, restSec: 60 },
        { slug: 'overhead-triceps-extension', sets: 3, reps: 12, repsMax: 15, targetWeightKg: 15, restSec: 60 },
        { slug: 'plank', sets: 3, reps: 1, restSec: 45, notes: 'Hold 45–60 seconds.' },
      ],
    },
    {
      dayIndex: 6, title: 'Pull B + Conditioning', focus: 'Back · Arms · Engine', estimatedMin: 55,
      warmup: ['warmup-easy-bike', 'warmup-band-pull-apart'],
      cooldown: ['walking'],
      exercises: [
        { slug: 'lat-pulldown', sets: 4, reps: 10, repsMax: 12, targetWeightKg: 50, restSec: 90 },
        { slug: 'seated-cable-row', sets: 3, reps: 12, repsMax: 15, targetWeightKg: 45, restSec: 90 },
        { slug: 'hammer-curl', sets: 3, reps: 12, repsMax: 15, targetWeightKg: 12, restSec: 60 },
        { slug: 'hanging-leg-raise', sets: 3, reps: 8, repsMax: 12, targetWeightKg: 0, restSec: 60 },
        { slug: 'assault-bike', sets: 1, reps: 1, restSec: 0, notes: '10 rounds: 20 seconds hard, 40 seconds easy.' },
      ],
    },
    {
      dayIndex: 0, title: 'Rest', focus: 'Full rest', isRest: true,
      notes: 'Sleep, food, and stay off the gym floor. This is when the work you did actually turns into progress.',
    },
  ],
};
