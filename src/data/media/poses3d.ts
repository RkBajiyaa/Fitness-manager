/* ============================================================
   THE TWELVE — premium 3D demonstrations, authored as angles.

   These are the controlled experiment: the six pushes and six
   pulls a member meets first, rebuilt on the 3D figure so the
   quality bar can be judged before the other fifty-three follow.

   A pose is the same two numbers per segment everywhere:

       el   degrees from hanging straight DOWN.  0 down,
            90 horizontal, 180 straight up.
       az   which way the horizontal part points, around the
            body.  0 the way the model is heading, +90 its right,
            −90 its left, 180 behind.

   Both are measured against a horizontal compass, never against
   the parent joint, so "the shin is nearly vertical" stays true
   on the page when the torso is at 100° — which is exactly the
   frame a deadlift is impossible to author in otherwise.

   `heading` turns the whole model in front of a fixed camera, and
   it is chosen per exercise rather than set once. A curl wants to
   be seen from the front, because the question is what the elbows
   are doing. A deadlift wants to be seen from nearly the side,
   because the question is where the hips are. Forcing both into
   one viewpoint is how a library of demonstrations ends up with
   half of them unreadable.

   This is CONTENT — it names exercises — so it reaches screens
   through `api.ts` and never by direct import from a screen (§21).
   The engine it is authored against (`figure3d`, `rig3d`) is
   geometry, and components import that directly.
   ============================================================ */
import { pair, type Limb3D, type Pose3D, type Seg } from './figure3d';
import type { Rig } from './rig3d';

export interface Model3DFrame {
  /** The word under the demonstration. One or two syllables. */
  label: string;
  pose: Pose3D;
  /** Milliseconds held. Longer on the phase that costs something. */
  holdMs?: number;
  /** What the body is doing in THIS frame, so the words and the picture agree. */
  cue?: string;
}

export interface Model3DDrawing {
  /** The exercise this belongs to, by content slug. */
  slug: string;
  name: string;
  rig: Rig;
  frames: Model3DFrame[];
  /** Which frame is the working end of the rep. Defaults to the longest hold. */
  effortFrame?: number;
}

/* ---------------- authoring shorthands ---------------- */

const limb = (upper: Seg, lower: Seg, end?: Seg): Limb3D =>
  (end ? { upper, lower, end } : { upper, lower });

/** Feet planted, knees soft — the base every standing lift shares. */
const STANCE = pair(limb([5, 5], [3, 2], [95, 2]));
/** A little wider, for pressing and pulling heavy. */
const STANCE_WIDE = pair(limb([7, 9], [4, 4], [95, 4]));

/* ============================================================
   PUSH
   ============================================================ */

/* ---- 1. Barbell Bench Press --------------------------------
   Lying supine. The heading is set to 90 so the model's own
   compass lies along its spine — az 0 toward the FEET, 180 toward
   the head, ±90 out to the sides — which does two things at once:
   the sagittal mirror goes back to a plain sign flip, and `pair()`
   puts the right arm on the model's right. Heading −90 also lines
   the compass up with the spine, and it silently crosses both arms
   over the chest, which took a contact sheet to notice. */
const BENCH_LEGS = pair(limb([58, 5], [14, 2], [96, 2]));

const benchPress: Model3DDrawing = {
  slug: 'barbell-bench-press',
  name: 'Barbell Bench Press',
  rig: 'bench_barbell',
  effortFrame: 2,
  frames: [
    {
      label: 'Set',
      holdMs: 900,
      cue: 'Shoulder blades pinned back, feet driving into the floor.',
      pose: {
        root: [0, 58, 0], heading: 90, torso: [90, 180], chest: [180, 0],
        arms: pair(limb([172, 80], [176, 82])),
        legs: BENCH_LEGS,
      },
    },
    {
      label: 'Lower',
      holdMs: 1100,
      cue: 'Bar travels to the lower chest with the elbows tucked to about 45°.',
      pose: {
        root: [0, 58, 0], heading: 90, torso: [90, 180], chest: [180, 0],
        arms: pair(limb([74, 62], [154, 96])),
        legs: BENCH_LEGS,
      },
    },
    {
      label: 'Press',
      holdMs: 950,
      cue: 'Push the bar back over the shoulders, not over the face.',
      pose: {
        root: [0, 58, 0], heading: 90, torso: [90, 180], chest: [180, 0],
        arms: pair(limb([172, 80], [176, 82])),
        legs: BENCH_LEGS,
      },
    },
  ],
};

/* ---- 2. Incline Dumbbell Press -----------------------------
   The same reclined frame at 45°: the spine runs up and back, so
   the torso elevation sits between upright (180) and flat (90). */
const INCLINE_LEGS = pair(limb([34, 10], [16, 4], [96, 4]));
const inclineBase = {
  root: [0, 56, 0] as const, heading: 90,
  // Spine up and back at about 48° from vertical; the chest normal
  // is square to it, so it looks up and toward the feet.
  torso: [132, 180] as Seg, chest: [132, 0] as Seg,
};

const inclinePress: Model3DDrawing = {
  slug: 'incline-dumbbell-press',
  name: 'Incline Dumbbell Press',
  rig: 'bench_incline',
  effortFrame: 2,
  frames: [
    {
      label: 'Set',
      holdMs: 900,
      cue: 'Sit back into the bench; the dumbbells start over the upper chest.',
      pose: { ...inclineBase, arms: pair(limb([166, 76], [170, 80])), legs: INCLINE_LEGS },
    },
    {
      label: 'Lower',
      holdMs: 1100,
      cue: 'Let the elbows travel down and slightly out until you feel the chest stretch.',
      pose: { ...inclineBase, arms: pair(limb([86, 56], [150, 92])), legs: INCLINE_LEGS },
    },
    {
      label: 'Press',
      holdMs: 950,
      cue: 'Drive up and slightly together, without clashing the bells.',
      pose: { ...inclineBase, arms: pair(limb([166, 76], [170, 80])), legs: INCLINE_LEGS },
    },
  ],
};

/* ---- 3. Overhead Press ------------------------------------- */
const pressBase = { root: [0, 48, 0] as const, heading: -16, torso: [180, 0] as Seg };

const overheadPress: Model3DDrawing = {
  slug: 'overhead-press',
  name: 'Overhead Press',
  rig: 'rack_standing',
  effortFrame: 2,
  frames: [
    {
      label: 'Rack',
      holdMs: 1000,
      cue: 'Bar on the front of the shoulders, elbows under it, ribs down.',
      pose: {
        ...pressBase,
        arms: pair(limb([40, 12], [168, 196])),
        legs: STANCE,
      },
    },
    {
      label: 'Press',
      holdMs: 1000,
      cue: 'Push the bar straight up and move your head back out of its way.',
      pose: {
        ...pressBase,
        arms: pair(limb([120, 14], [170, 8])),
        legs: STANCE,
      },
    },
    {
      label: 'Lock',
      holdMs: 1000,
      cue: 'Finish with the bar over the middle of your feet, not in front of you.',
      pose: {
        ...pressBase,
        arms: pair(limb([174, 10], [178, 6])),
        legs: STANCE,
      },
    },
  ],
};

/* ---- 4. Dumbbell Lateral Raise ----------------------------- */
const raiseBase = { root: [0, 48, 0] as const, heading: 4, torso: [180, 0] as Seg };

const lateralRaise: Model3DDrawing = {
  slug: 'lateral-raise',
  name: 'Dumbbell Lateral Raise',
  rig: 'free_dumbbells',
  effortFrame: 1,
  frames: [
    {
      label: 'Hang',
      holdMs: 800,
      cue: 'Bells just off the thighs, elbows very slightly soft.',
      pose: { ...raiseBase, arms: pair(limb([10, 30], [7, 22])), legs: STANCE },
    },
    {
      label: 'Raise',
      holdMs: 1200,
      cue: 'Lead with the elbows out to the side, stopping level with the shoulders.',
      pose: { ...raiseBase, arms: pair(limb([86, 74], [88, 78])), legs: STANCE },
    },
    {
      label: 'Lower',
      holdMs: 900,
      cue: 'Come down slowly — the way down is where the shoulder actually works.',
      pose: { ...raiseBase, arms: pair(limb([46, 68], [44, 66])), legs: STANCE },
    },
  ],
};

/* ---- 5. Cable Chest Fly ------------------------------------ */
const flyBase = { root: [0, 48, 0] as const, heading: 2, torso: [174, 0] as Seg };

const cableFly: Model3DDrawing = {
  slug: 'cable-fly',
  name: 'Cable Chest Fly',
  rig: 'cable_double',
  effortFrame: 2,
  frames: [
    {
      label: 'Open',
      holdMs: 1000,
      cue: 'Arms wide with a fixed, slightly bent elbow — the angle never changes.',
      pose: { ...flyBase, arms: pair(limb([96, 108], [92, 128])), legs: STANCE_WIDE },
    },
    {
      label: 'Close',
      holdMs: 1100,
      cue: 'Bring the hands together in front of the chest as if hugging a barrel.',
      pose: { ...flyBase, arms: pair(limb([84, 40], [86, 14])), legs: STANCE_WIDE },
    },
    {
      label: 'Squeeze',
      holdMs: 700,
      cue: 'Hold for a beat where the chest is shortest, then open under control.',
      pose: { ...flyBase, arms: pair(limb([84, 26], [88, 4])), legs: STANCE_WIDE },
    },
  ],
};

/* ---- 6. Triceps Pushdown ----------------------------------- */
const pushdownBase = { root: [0, 48, 0] as const, heading: -14, torso: [176, 4] as Seg };

const tricepsPushdown: Model3DDrawing = {
  slug: 'triceps-pushdown',
  name: 'Triceps Pushdown',
  rig: 'cable_high',
  effortFrame: 1,
  frames: [
    {
      label: 'Top',
      holdMs: 900,
      cue: 'Elbows pinned to your sides, forearms up against the cable.',
      pose: { ...pushdownBase, arms: pair(limb([18, 16], [112, 16])), legs: STANCE },
    },
    {
      label: 'Push',
      holdMs: 1150,
      cue: 'Only the forearms move — straighten the elbow until the arm is locked.',
      pose: { ...pushdownBase, arms: pair(limb([14, 14], [10, 12])), legs: STANCE },
    },
    {
      label: 'Return',
      holdMs: 800,
      cue: 'Let the bar come back up without the elbows drifting forward.',
      pose: { ...pushdownBase, arms: pair(limb([16, 15], [72, 14])), legs: STANCE },
    },
  ],
};

/* ============================================================
   PULL

   Seen from nearer the side — heading in the low thirties — so
   the pelvis, the spine angle and the shin angle are all readable
   at once. These are the four the brief singles out, and they are
   singled out for a reason: every one of them is a question about
   where the hips are.
   ============================================================ */

/* ---- 7. Conventional Deadlift ------------------------------
   Heading 12 rather than the near-side view a deadlift is usually
   photographed from. A side view shows the hinge perfectly and
   puts a 45cm plate directly over the lifter's chest, because the
   bar runs straight at the camera. Twelve degrees keeps about
   seventy per cent of the hinge and moves both plates clear of the
   body, which is the trade that leaves the pelvis readable. */
const dlHeading = 12;

const deadlift: Model3DDrawing = {
  slug: 'deadlift',
  name: 'Conventional Deadlift',
  rig: 'floor_barbell',
  effortFrame: 2,
  frames: [
    {
      label: 'Set',
      holdMs: 1100,
      cue: 'Bar over mid-foot, shins touching it, back flat and chest proud.',
      pose: {
        // The setup is SOLVED, not guessed: the hands have to land on
        // a bar sitting on 45cm plates, which fixes the shoulder
        // height, which fixes how far the torso has to come over.
        // A deadlift setup really is close to horizontal — a figure
        // at a comfortable-looking 45° has its hands in mid-air.
        root: [0, 61, 0], heading: dlHeading, torso: [104, 0],
        arms: pair(limb([8, 14], [6, 12])),
        legs: pair(limb([52, 6], [8, 2], [95, 2])),
      },
    },
    {
      label: 'Pull',
      holdMs: 1200,
      cue: 'Push the floor away. Hips and shoulders rise together — the bar stays against you.',
      pose: {
        root: [0, 55, 0], heading: dlHeading, torso: [132, 0],
        arms: pair(limb([7, 13], [5, 12])),
        legs: pair(limb([28, 6], [8, 2], [95, 2])),
      },
    },
    {
      label: 'Lock',
      holdMs: 900,
      cue: 'Stand tall with the glutes squeezed. Do not lean back at the top.',
      pose: {
        root: [0, 48, 0], heading: dlHeading, torso: [178, 0],
        arms: pair(limb([6, 12], [5, 11])),
        legs: pair(limb([4, 5], [2, 2], [95, 2])),
      },
    },
    {
      label: 'Lower',
      holdMs: 900,
      cue: 'Push the hips back first, then bend the knees once the bar passes them.',
      pose: {
        root: [0, 52, 0], heading: dlHeading, torso: [122, 0],
        arms: pair(limb([7, 13], [6, 12])),
        legs: pair(limb([34, 6], [8, 2], [95, 2])),
      },
    },
  ],
};

/* ---- 8. Pull-Up -------------------------------------------- */
const puHeading = 26;
const PU_LEGS = pair(limb([16, 192], [40, 190], [118, 190]));

const pullUp: Model3DDrawing = {
  slug: 'pull-ups',
  name: 'Pull-Up',
  rig: 'pullup_bar',
  effortFrame: 1,
  frames: [
    {
      label: 'Hang',
      holdMs: 900,
      cue: 'Full hang, then pull the shoulder blades down before the elbows bend.',
      pose: {
        root: [0, 58, 0], heading: puHeading, torso: [178, 0],
        arms: pair(limb([166, 30], [172, 26])),
        legs: PU_LEGS,
      },
    },
    {
      label: 'Pull',
      holdMs: 1250,
      cue: 'Drive the elbows down to your ribs and bring the chest toward the bar.',
      pose: {
        root: [0, 44, 0], heading: puHeading, torso: [176, 0],
        arms: pair(limb([142, 40], [104, 14])),
        legs: PU_LEGS,
      },
    },
    {
      label: 'Lower',
      holdMs: 950,
      cue: 'Come down all the way under control — a half rep trains half a back.',
      pose: {
        root: [0, 52, 0], heading: puHeading, torso: [177, 0],
        arms: pair(limb([156, 34], [138, 18])),
        legs: PU_LEGS,
      },
    },
  ],
};

/* ---- 9. Barbell Row ---------------------------------------- */
const rowBase = {
  heading: 14,
  torso: [108, 0] as Seg,
  legs: pair(limb([28, 6], [16, 2], [95, 2])),
};

const barbellRow: Model3DDrawing = {
  slug: 'barbell-row',
  name: 'Barbell Row',
  rig: 'floor_barbell',
  effortFrame: 1,
  frames: [
    {
      label: 'Hinge',
      holdMs: 1000,
      cue: 'Hips back until the torso is close to parallel, back flat, arms long.',
      pose: { root: [0, 54, 0], ...rowBase, arms: pair(limb([9, 13], [6, 11])) },
    },
    {
      label: 'Row',
      holdMs: 1200,
      cue: 'Pull the bar to the lower ribs by driving the elbows past your back.',
      pose: { root: [0, 54, 0], ...rowBase, arms: pair(limb([48, 196], [22, 8])) },
    },
    {
      label: 'Lower',
      holdMs: 900,
      cue: 'Lower it all the way down. The torso stays exactly where it started.',
      pose: { root: [0, 54, 0], ...rowBase, arms: pair(limb([20, 10], [12, 8])) },
    },
  ],
};

/* ---- 10. Lat Pulldown -------------------------------------- */
const pdBase = {
  root: [0, 62, 0] as const,
  heading: 24,
  torso: [172, 182] as Seg,
  legs: pair(limb([76, 8], [10, 4], [95, 4])),
};

const latPulldown: Model3DDrawing = {
  slug: 'lat-pulldown',
  name: 'Lat Pulldown',
  rig: 'lat_tower',
  effortFrame: 1,
  frames: [
    {
      label: 'Reach',
      holdMs: 950,
      cue: 'Arms long overhead, chest up, a small lean back from the hips.',
      pose: { ...pdBase, arms: pair(limb([160, 34], [168, 30])) },
    },
    {
      label: 'Pull',
      holdMs: 1250,
      cue: 'Lead with the elbows and bring the bar to your collarbone.',
      pose: { ...pdBase, arms: pair(limb([116, 44], [86, 8])) },
    },
    {
      label: 'Return',
      holdMs: 900,
      cue: 'Let the bar rise until the arms are straight and the shoulders lift.',
      pose: { ...pdBase, arms: pair(limb([146, 40], [148, 24])) },
    },
  ],
};

/* ---- 11. Face Pull ----------------------------------------- */
const facePullBase = { root: [0, 48, 0] as const, heading: 8, torso: [178, 0] as Seg };

const facePull: Model3DDrawing = {
  slug: 'face-pull',
  name: 'Face Pull',
  rig: 'cable_rope',
  effortFrame: 1,
  frames: [
    {
      label: 'Reach',
      holdMs: 900,
      cue: 'Arms out toward the pulley, thumbs back, shoulders relaxed forward.',
      pose: { ...facePullBase, arms: pair(limb([100, 18], [96, 12])), legs: STANCE_WIDE },
    },
    {
      label: 'Pull',
      holdMs: 1250,
      cue: 'Pull the rope to your eyebrows with the elbows high and wide.',
      pose: { ...facePullBase, arms: pair(limb([104, 86], [146, 118])), legs: STANCE_WIDE },
    },
    {
      label: 'Return',
      holdMs: 850,
      cue: 'Let the arms travel back out without the shoulders rolling forward.',
      pose: { ...facePullBase, arms: pair(limb([102, 48], [116, 60])), legs: STANCE_WIDE },
    },
  ],
};

/* ---- 12. Barbell Curl -------------------------------------- */
const curlBase = { root: [0, 48, 0] as const, heading: -10, torso: [179, 0] as Seg };

const barbellCurl: Model3DDrawing = {
  slug: 'barbell-curl',
  name: 'Barbell Curl',
  rig: 'free_barbell',
  effortFrame: 1,
  frames: [
    {
      label: 'Hang',
      holdMs: 850,
      cue: 'Bar at arms length, elbows just in front of the hips.',
      pose: { ...curlBase, arms: pair(limb([12, 14], [8, 10])), legs: STANCE },
    },
    {
      label: 'Curl',
      holdMs: 1200,
      cue: 'Bend at the elbow only. If the elbows travel forward, the shoulders took over.',
      pose: { ...curlBase, arms: pair(limb([20, 14], [140, 16])), legs: STANCE },
    },
    {
      label: 'Lower',
      holdMs: 950,
      cue: 'Lower until the arm is completely straight before the next rep.',
      pose: { ...curlBase, arms: pair(limb([16, 14], [78, 12])), legs: STANCE },
    },
  ],
};

/* ============================================================
   The set
   ============================================================ */

export const MODEL_DRAWINGS: readonly Model3DDrawing[] = [
  benchPress, inclinePress, overheadPress, lateralRaise, cableFly, tricepsPushdown,
  deadlift, pullUp, barbellRow, latPulldown, facePull, barbellCurl,
];

/** Keyed by exercise slug — the only lookup a caller needs. */
export const MODEL_INDEX: ReadonlyMap<string, Model3DDrawing> =
  new Map(MODEL_DRAWINGS.map((d) => [d.slug, d]));

/** Which frame carries the effort, for a still thumbnail. */
export function effortFrameOf(d: Model3DDrawing): number {
  if (d.effortFrame != null) return Math.min(d.effortFrame, d.frames.length - 1);
  let best = 0;
  d.frames.forEach((f, i) => {
    if ((f.holdMs ?? 0) > (d.frames[best].holdMs ?? 0)) best = i;
  });
  return best;
}
