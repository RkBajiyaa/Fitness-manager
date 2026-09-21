/* ============================================================
   BODY-PART SPLIT — one region per day.

   The split most people who train in a gym already recognise.
   It trades frequency for volume: each muscle is hit once a week
   but hard, which makes it easy to follow and easy to schedule.
   ============================================================ */
import type { PlanTemplateContent } from '../types';

export const BODY_PART_PLAN: PlanTemplateContent = {
  slug: 'body-part-split',
  name: 'Body-Part Split',
  family: 'body_part_split',
  schedule: 'weekly',
  summary: 'One body part per day. Five training days, one optional cardio day.',
  description:
    'Chest, back, shoulders, arms, legs — one region each day, trained thoroughly. '
    + 'Lower frequency than Push/Pull/Legs but higher volume per session, and the simplest split to remember. '
    + 'The Saturday cardio day is optional; take it as a second rest day if the week has been heavy.',
  difficulty: 'beginner',
  daysPerWeek: 5,
  durationWeeks: 8,
  highlights: [
    'One clear focus each day — no decisions at the door',
    'Five sessions of about 50 minutes',
    'Optional cardio day that can be swapped for rest',
  ],
  equipmentNeeded: ['barbell', 'dumbbell', 'cable', 'machine', 'bodyweight'],
  days: [
    {
      dayIndex: 1, title: 'Chest', focus: 'Chest · Triceps', estimatedMin: 50,
      warmup: ['warmup-easy-treadmill', 'warmup-band-pull-apart', 'warmup-ramp-up-sets'],
      exercises: [
        { slug: 'barbell-bench-press', sets: 4, reps: 8, repsMax: 10, targetWeightKg: 50, restSec: 120 },
        { slug: 'incline-dumbbell-press', sets: 3, reps: 10, repsMax: 12, targetWeightKg: 20, restSec: 90 },
        { slug: 'machine-chest-press', sets: 3, reps: 12, repsMax: 15, targetWeightKg: 40, restSec: 75 },
        { slug: 'cable-fly', sets: 3, reps: 12, repsMax: 15, targetWeightKg: 12, restSec: 60 },
        { slug: 'triceps-pushdown', sets: 3, reps: 12, repsMax: 15, targetWeightKg: 25, restSec: 60 },
      ],
    },
    {
      dayIndex: 2, title: 'Back', focus: 'Back · Biceps', estimatedMin: 50,
      warmup: ['warmup-easy-bike', 'warmup-scapular-hang'],
      exercises: [
        { slug: 'lat-pulldown', sets: 4, reps: 10, repsMax: 12, targetWeightKg: 45, restSec: 90 },
        { slug: 'barbell-row', sets: 4, reps: 8, repsMax: 10, targetWeightKg: 40, restSec: 90 },
        { slug: 'seated-cable-row', sets: 3, reps: 12, repsMax: 15, targetWeightKg: 40, restSec: 75 },
        { slug: 'straight-arm-pulldown', sets: 3, reps: 12, repsMax: 15, targetWeightKg: 20, restSec: 60 },
        { slug: 'barbell-curl', sets: 3, reps: 10, repsMax: 12, targetWeightKg: 20, restSec: 60 },
      ],
    },
    {
      dayIndex: 3, title: 'Shoulders', focus: 'Delts · Upper back', estimatedMin: 45,
      warmup: ['warmup-arm-circles', 'warmup-shoulder-rotations', 'warmup-band-pull-apart'],
      exercises: [
        { slug: 'overhead-press', sets: 4, reps: 8, repsMax: 10, targetWeightKg: 30, restSec: 120 },
        { slug: 'dumbbell-shoulder-press', sets: 3, reps: 10, repsMax: 12, targetWeightKg: 16, restSec: 90 },
        { slug: 'lateral-raise', sets: 4, reps: 12, repsMax: 15, targetWeightKg: 7, restSec: 60 },
        { slug: 'rear-delt-fly', sets: 3, reps: 15, repsMax: 20, targetWeightKg: 6, restSec: 60 },
        { slug: 'face-pull', sets: 3, reps: 15, repsMax: 20, targetWeightKg: 18, restSec: 60 },
      ],
    },
    {
      dayIndex: 4, title: 'Arms', focus: 'Biceps · Triceps · Core', estimatedMin: 45,
      warmup: ['warmup-easy-bike', 'warmup-arm-circles'],
      exercises: [
        { slug: 'barbell-curl', sets: 4, reps: 10, repsMax: 12, targetWeightKg: 22, restSec: 75 },
        { slug: 'skull-crusher', sets: 4, reps: 10, repsMax: 12, targetWeightKg: 20, restSec: 75 },
        { slug: 'hammer-curl', sets: 3, reps: 12, repsMax: 15, targetWeightKg: 12, restSec: 60 },
        { slug: 'overhead-triceps-extension', sets: 3, reps: 12, repsMax: 15, targetWeightKg: 14, restSec: 60 },
        { slug: 'cable-crunch', sets: 3, reps: 15, repsMax: 20, targetWeightKg: 25, restSec: 60 },
      ],
    },
    {
      dayIndex: 5, title: 'Legs', focus: 'Quads · Hamstrings · Glutes · Calves', estimatedMin: 60,
      warmup: ['warmup-easy-bike', 'warmup-leg-swings', 'warmup-bodyweight-squats'],
      cooldown: ['foam-roll-quads', 'hip-flexor-stretch'],
      exercises: [
        { slug: 'back-squat', sets: 4, reps: 8, repsMax: 10, targetWeightKg: 70, restSec: 150 },
        { slug: 'romanian-deadlift', sets: 3, reps: 10, repsMax: 12, targetWeightKg: 55, restSec: 120 },
        { slug: 'leg-press', sets: 3, reps: 12, repsMax: 15, targetWeightKg: 120, restSec: 90 },
        { slug: 'leg-curl', sets: 3, reps: 12, repsMax: 15, targetWeightKg: 30, restSec: 60 },
        { slug: 'calf-raise', sets: 4, reps: 15, repsMax: 20, targetWeightKg: 35, restSec: 45 },
      ],
    },
    {
      dayIndex: 6, title: 'Cardio (optional)', focus: 'Conditioning', estimatedMin: 30,
      notes: 'Optional. Swap it for rest if the week has been heavy — the five lifting days are the programme.',
      exercises: [
        { slug: 'incline-walk', sets: 1, reps: 1, restSec: 0, notes: '25–30 minutes at a conversational pace.' },
        { slug: 'plank', sets: 3, reps: 1, restSec: 45, notes: 'Hold 45 seconds.' },
      ],
    },
    { dayIndex: 0, title: 'Rest', focus: 'Full rest', isRest: true, notes: 'Eat, sleep, recover.' },
  ],
};
