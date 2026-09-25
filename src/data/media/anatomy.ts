/* ============================================================
   THE MUSCLE CHART — "which part of me is this working?"

   The animated figure answers HOW the body moves. It cannot also
   answer WHICH MUSCLE is doing the work: a profile figure mid-rep
   is a silhouette, and painting a pectoral onto a silhouette that
   is lying on a bench with its arm across it produces a coloured
   smudge, not a lesson. Every product that teaches this well —
   and every anatomy atlas before them — uses the same device: a
   separate, still, front-and-back body chart with the working
   muscles marked on it.

   So there are two visuals with two jobs, and neither is trying to
   do the other's:

       figure.ts   → the movement, in motion
       anatomy.ts  → the muscles, at rest

   Both are keyed to the SAME vocabulary. A region here exists only
   if `data/taxonomy.ts` declares the muscle, and `MUSCLE_REGIONS`
   is checked against the taxonomy by `validateContent()` — so a
   muscle nobody can draw cannot be quietly assigned to an exercise
   (hard rule 22's failure mode, one level deeper).

   Like the pose engine this is GEOMETRY, not content: no exercise,
   no muscle name, nothing a gym could edit. Components import it
   directly (§21).

   ------------------------------------------------------------
   AUTHORING

   Every shape is authored for the viewer's RIGHT half of the body
   and drawn twice, the second time through `MIRROR`. That is not
   only half the work — it is the only way a hand-authored chart
   stays symmetrical, and an asymmetric deltoid is the first thing
   the eye catches.

   Both views are 120 × 210. Centre line is x = 60.
   ============================================================ */
import { MUSCLES, MUSCLE_GROUPS, type MuscleGroupKey, type MuscleKey } from '../taxonomy';

export const ANATOMY_VIEWBOX = '0 0 120 210' as const;

/** Applied to the second copy of every shape. */
export const MIRROR = 'translate(120,0) scale(-1,1)' as const;

export type AnatomyView = 'front' | 'back';

/* ============================================================
   THE BODY

   Composed from primitives rather than one giant outline path.
   A limb authored as "from here to there, this thick" can be
   nudged; a 40-node silhouette cannot be touched once it looks
   right, and every future change becomes a rewrite.
   ============================================================ */

/** Drawn once, centred — the trunk is symmetric by construction. */
export const TORSO_PATH =
  'M 41 44 C 40 56 44 68 45.5 79 C 44.5 88 43 94 43 102 L 77 102 '
  + 'C 77 94 75.5 88 74.5 79 C 76 68 80 56 79 44 C 72 40 48 40 41 44 Z';

/** Head, neck and hands: simple solids, positioned once. */
export const BODY_SOLIDS = {
  head: { cx: 60, cy: 17, rx: 10.5, ry: 13 },
  neck: { x: 54, y: 25, w: 12, h: 14, r: 4 },
  hand: { cx: 94, cy: 118, rx: 5.2, ry: 7 },
  foot: { cx: 66, cy: 194, rx: 6, ry: 5 },
} as const;

/**
 * Limb segments, as [from, to, widthFrom, widthTo]. Rendered with
 * the same tapered-capsule builder as the moving figure, so the
 * two visuals are recognisably the same body.
 */
export const LIMB_SEGMENTS: ReadonlyArray<
  readonly [readonly [number, number], readonly [number, number], number, number]
> = [
  [[74, 47], [85, 79], 15, 11.5],     // upper arm
  [[85, 79], [92, 110], 11.5, 8.5],   // forearm
  [[68, 101], [69, 148], 21, 14],     // thigh
  [[69, 148], [66.5, 190], 14, 9],    // shin
];

/** The deltoid cap, which is what makes a shoulder look like a shoulder. */
export const SHOULDER_CAP = { cx: 75, cy: 50, r: 9.5 } as const;

/* ============================================================
   DEFINITION

   The body underneath the highlights was a flat silhouette — a
   paper doll with coloured patches on it. Real anatomy charts
   carry enough modelling that you can find a muscle BEFORE it is
   highlighted, which is what makes the highlight mean something
   rather than just being the only shape on the page.

   These are hairlines, not shading: a linea alba, the lower edge
   of a pectoral, the fold under a glute, the split between the
   two heads of a calf. They sit UNDER the highlights, in their
   own quiet token, and they are geometry like everything else
   here — nothing to author per exercise and nothing to drift.

   `SIDE` is mirrored with the rest of the half-body. `CENTRE` is
   drawn once, because a line on the midline mirrored onto itself
   doubles its own weight.
   ============================================================ */

export interface DefinitionLines {
  /** Authored on the viewer's right half; drawn twice. */
  side: readonly string[];
  /** On x = 60. Drawn once. */
  centre: readonly string[];
}

export const DEFINITION: Readonly<Record<AnatomyView, DefinitionLines>> = {
  front: {
    side: [
      'M 61 68.5 C 66 69.5 71 68.6 74 65.5',        // lower edge of the pec
      'M 68.5 43 C 72 50 73 58 71.5 62.5',          // deltoid / pec seam
      'M 60.5 78 L 68.6 77.6',                      // abdominal bands
      'M 60.5 85.5 L 68.2 85.2',
      'M 60.5 93 L 67.4 92.6',
      'M 70.5 71 C 73 79 72.6 89 70 96',            // oblique edge
      'M 73 70.5 L 70.6 72.5',                      // serratus
      'M 73.6 75 L 71.2 77',
      'M 82.5 77.5 L 87.5 80.5',                    // elbow crease
      'M 66 106 C 70 118 71 133 69.4 145',          // vastus lateralis
      'M 62.6 106 C 62.9 120 62.9 134 62.5 144',    // vastus medialis
      'M 63 149 C 66 151.6 69.4 151 71 148.4',      // patella
    ],
    centre: ['M 60 45.5 L 60 68', 'M 60 70.5 L 60 99'],
  },
  back: {
    side: [
      'M 66 46.5 C 65 56 63 66 61 76',              // trapezius edge
      'M 66.5 52.5 C 71 55.5 72.6 62 70 68',        // scapula
      'M 61 84 C 66 84 71 80 74 73.5',              // lower border of the lat
      'M 77 62 C 81 67 83.5 73 84.6 78',            // triceps
      'M 61 117.5 C 67 118.6 72 116 75.4 112',      // gluteal fold
      'M 68 120.5 C 69 132 68.6 141 67 148',        // hamstring split
      'M 67.5 154 C 68.6 165 67.6 176 66 185',      // gastrocnemius split
      'M 82.5 78 L 87.5 81',                        // elbow
    ],
    centre: ['M 60 44 L 60 96'],
  },
};

/* ============================================================
   MUSCLE REGIONS

   A muscle can appear on one view or both. `forearms` is the same
   muscle from either side and is drawn on both; `calves` is drawn
   only on the back, because the front of that shin is the tibialis
   and marking it "calves" teaches a beginner something false.
   ============================================================ */

export interface MuscleRegion {
  front?: string;
  back?: string;
}

export const MUSCLE_REGIONS: Readonly<Record<MuscleKey, MuscleRegion>> = {
  traps: {
    front: 'M 60 31 L 66.5 33.5 L 78 45.5 L 69.5 44 L 60 39.5 Z',
    back: 'M 60 29.5 L 66.5 33 L 77.5 46.5 C 74 54.5 70 64.5 66 76 L 60 78 Z',
  },
  front_delts: {
    front: 'M 68 42.5 C 76 41.5 82 48 81.5 56.5 C 81 62.5 76 64.5 71.5 60.5 '
      + 'C 68.8 55 66.8 48 68 42.5 Z',
  },
  side_delts: {
    front: 'M 79 46.5 C 85.5 51 86.5 60.5 84 68.5 L 77.5 62.5 C 81 56.5 81 51 79 46.5 Z',
    back: 'M 79 47 C 85.5 51.5 86.5 61 84 69 L 77.5 63 C 81 57 81 51.5 79 47 Z',
  },
  rear_delts: {
    back: 'M 69.5 43.5 C 77.5 43.5 83 50.5 82 60 C 80 66 75 65 71.5 60 '
      + 'C 69.5 54 68.5 48 69.5 43.5 Z',
  },
  rotator_cuff: {
    back: 'M 70.5 46 C 76.5 47 79 53 77 58.5 C 73.5 59.5 70.5 55 69.5 50 Z',
  },
  pectorals: {
    /* Stops at x = 61.4 so the mirrored pair leaves a sternum between
       them. Two pectorals meeting in the middle is one shield. */
    front: 'M 61.4 45.5 L 72 47 C 78 50.5 78 60.5 73.5 66.5 C 68.5 70.5 63.5 69.5 61.4 68.5 Z',
  },
  lats: {
    /* A WING. Authored as an oval reaching the midline, this drew a
       single red disc over the spine the moment its mirror image
       joined it — a lat pulldown whose chart looked like a target.
       Now it runs from under the armpit, out along the flank and in
       to the lower back, and stops short of x = 61.5 so the mirrored
       pair leaves the spinal channel open. */
    back: 'M 71.5 56.5 C 77 59 79 68 76.5 79 C 74 89 69 95 63.5 97 '
      + 'L 62.8 88 C 67.5 81 70 70.5 70.5 60 Z',
  },
  rhomboids: {
    /* Inboard and high — the strip between the spine and the shoulder
       blade. It has to keep its own territory or a back exercise that
       works both it and the lats paints one shape. */
    back: 'M 61.5 50 L 68.5 53.5 C 69.3 60 68.6 66.5 67 71 L 61.5 72 Z',
  },
  spinal_erectors: {
    back: 'M 61.5 54 L 65.8 56.5 C 66 70 65.2 84 64 96 L 61.5 96.5 Z',
  },
  biceps: {
    front: 'M 70.5 59.5 C 78 59.5 82 66 84 74 L 79.5 80 C 76 74 72 68 70.5 59.5 Z',
  },
  triceps: {
    back: 'M 72.5 57.5 C 80 59.5 84 68 85.5 76.5 L 80 80.5 C 78 72 75 64.5 72.5 57.5 Z',
  },
  forearms: {
    front: 'M 82 82 C 88 88.5 92 100 93 110.5 L 87.5 112 C 85 100 82 90 79.5 84.5 Z',
    back: 'M 82 82 C 88 88.5 92 100 93 110.5 L 87.5 112 C 85 100 82 90 79.5 84.5 Z',
  },
  abs: {
    front: 'M 61.3 69 L 69 70 C 70 80 69 90 67 98 L 61.3 99 Z',
  },
  obliques: {
    front: 'M 69.5 70 C 74 74 74.5 84 71 95 L 67.5 97 C 69.5 88 70.5 79 69.5 70 Z',
  },
  hip_flexors: {
    front: 'M 61 97.5 L 68 96.5 C 69.5 102 68 107.5 65 110.5 L 61 106 Z',
  },
  glutes: {
    back: 'M 61.6 93.8 L 72 96 C 77.5 100 78.5 110 75 117.5 L 61.6 118.5 Z',
  },
  quads: {
    front: 'M 61 103 L 74.5 105 C 76.5 118 75 134 71.5 146.5 L 62 147 C 62 132 62 117 61 103 Z',
  },
  adductors: {
    front: 'M 60.5 104 L 63.5 104.5 C 63.5 118 63.5 132 62.8 144 L 60.5 143.5 Z',
  },
  hamstrings: {
    back: 'M 61.5 119 L 76 119 C 75 132 72.5 142.5 70 148.5 L 62.5 148.5 Z',
  },
  calves: {
    back: 'M 62 152 L 73.5 152 C 73 165 71 177 68.5 187 L 63 187 C 63 174 62.5 163 62 152 Z',
  },
  /**
   * Not a muscle, and drawn as the thorax on purpose. Cardio work
   * marked "full body" teaches nothing; a lit-up chest on a figure
   * that is running is immediately legible as "this trains your
   * heart and lungs".
   */
  heart_lungs: {
    front: 'M 61.3 44 L 72.5 47 C 77 54 76 65 71.5 69 L 61.3 70.5 Z',
    back: 'M 61.3 46 L 70 49 C 73.5 56 72.5 66 69 69.5 L 61.3 71 Z',
  },
};

/* ============================================================
   Lookups
   ============================================================ */

/** Does this view have anything to show for these muscles? */
export function viewHasRegions(muscles: readonly string[], view: AnatomyView): boolean {
  return muscles.some((m) => MUSCLE_REGIONS[m as MuscleKey]?.[view]);
}

/**
 * The view worth showing when there is only room for one.
 *
 * Not every exercise is best understood from the same side, and
 * showing both costs twice the width for one useful answer: a lat
 * pulldown says nothing on the front of the body, and a biceps curl
 * says nothing on the back.
 *
 * Scored rather than counted, because counting picks the busier
 * view and not the truer one. The FIRST primary muscle is worth
 * most: the content author already ranked them, and that ranking is
 * the best information anybody has about which one the member came
 * for. A back squat is the case that settled the weights — quads on
 * the front, glutes on the back, with the hamstrings and the spinal
 * erectors also behind. Counted, the back wins; but a member opening
 * a squat is looking for their quadriceps, which is exactly what
 * `primaryMuscles[0]` says. Front takes a tie for the same reason:
 * it is the view a member reads as "me".
 */
export function keyViewFor(
  primary: readonly string[], secondary: readonly string[] = [],
): AnatomyView {
  const drawn = (m: string, view: AnatomyView) => Boolean(MUSCLE_REGIONS[m as MuscleKey]?.[view]);
  const score = (view: AnatomyView) =>
    primary.reduce((n, m, i) => n + (drawn(m, view) ? (i === 0 ? 3 : 2) : 0), 0)
    + secondary.reduce((n, m) => n + (drawn(m, view) ? 1 : 0), 0);
  return score('back') > score('front') ? 'back' : 'front';
}

export function regionPath(muscle: string, view: AnatomyView): string | undefined {
  return MUSCLE_REGIONS[muscle as MuscleKey]?.[view];
}

/**
 * A fallback for rows that carry a muscle GROUP but no muscle list —
 * every member-authored exercise, and any older row written before
 * the structured fields existed. Highlighting the whole group is
 * honest ("this is a back exercise") where inventing specific
 * muscles would not be.
 */
const GROUP_MUSCLES: Record<MuscleGroupKey, MuscleKey[]> = {
  chest: ['pectorals'],
  back: ['lats', 'traps', 'rhomboids'],
  shoulders: ['front_delts', 'side_delts', 'rear_delts'],
  arms: ['biceps', 'triceps', 'forearms'],
  legs: ['quads', 'hamstrings', 'calves'],
  glutes: ['glutes'],
  core: ['abs', 'obliques'],
  cardio: ['heart_lungs'],
  mobility: [],
  full_body: ['pectorals', 'lats', 'quads', 'glutes', 'abs'],
};

export function musclesForGroup(group: string): MuscleKey[] {
  return GROUP_MUSCLES[group as MuscleGroupKey] ?? [];
}

/**
 * Content check, run at seed time alongside the drawing check.
 * A muscle the taxonomy declares but the chart cannot draw is
 * invisible in code review and shows up as an exercise whose
 * "primary muscle" lights nothing at all.
 */
export function undrawableMuscles(): string[] {
  return MUSCLES
    .map((m) => m.key)
    .filter((key) => {
      const region = MUSCLE_REGIONS[key];
      return !region || (!region.front && !region.back);
    });
}

/** Guards the group fallback table against a new muscle group nobody wired up. */
export function ungroupedMuscleGroups(): string[] {
  return MUSCLE_GROUPS.map((g) => g.key).filter((key) => !(key in GROUP_MUSCLES));
}

/**
 * The two muscle sets an exercise marks, resolved once.
 *
 * Shared by the CHART and the FIGURE so the two can never disagree
 * about what an exercise works — including the group fallback, which
 * is the case where they would most easily drift: a member-authored
 * exercise has no muscle list, the chart falls back to the group, and
 * a figure that did not would highlight nothing beside a chart that
 * highlighted a thigh.
 *
 * A muscle listed twice is primary. It cannot be both, and painting
 * it at two weights makes the secondary key a lie.
 */
export function muscleSets(
  primaryMuscles: readonly string[],
  secondaryMuscles: readonly string[],
  muscleGroup: string,
): { primary: Set<string>; secondary: Set<string> } {
  const primary = new Set<string>(
    primaryMuscles.length ? primaryMuscles : musclesForGroup(muscleGroup),
  );
  const secondary = new Set<string>(secondaryMuscles.filter((m) => !primary.has(m)));
  return { primary, secondary };
}
