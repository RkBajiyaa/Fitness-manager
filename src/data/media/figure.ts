/* ============================================================
   THE FITNESS MANAGER FIGURE — the house visual language (§34).

   Every How-To demonstration in the product is the same articulated
   figure in the same 100×100 box, posed differently. That is a
   deliberate trade against sourcing artwork per exercise:

     · one consistent style instead of a collage of stock GIFs,
       cartoon renders and 3D models (§34);
     · no licence to verify, no attribution to carry, nothing to
       re-clear if we change vendor (§33);
     · a few hundred bytes of numbers per movement instead of a
       200 KB animation, which is what makes §27 achievable on a
       phone in a gym basement;
     · new exercises cost a row, not a commission.

   A pose is stored as JOINT ANGLES, not coordinates. Angles are
   what a human can author and review — "the torso is at 20°, the
   knee is bent to 95°" is checkable; a list of 24 x/y pairs is
   not. Forward kinematics turns them into points at render time.

   Angles are DEGREES, measured clockwise from screen-right, in
   SVG's coordinate space where +y points DOWN. So −90 is straight
   up, 0 is right, 90 is straight down. Every segment angle is
   ABSOLUTE rather than relative to its parent: a typo in one
   segment then distorts one limb instead of everything below it.
   ============================================================ */

/** Segment lengths, in viewBox units. Fixed — the figure never changes build. */
export const SEGMENTS = {
  spine: 26,
  neck: 7,
  upperArm: 13,
  foreArm: 13,
  thigh: 17,
  shin: 17,
  foot: 7,
} as const;

/** Head radius, in viewBox units. */
export const HEAD_RADIUS = 5.5;

/**
 * One posture of the figure.
 *
 * `hip` is the root the whole body hangs from; everything else is
 * an angle. Only the near-side arm and leg are modelled — the
 * figure is drawn in profile, and a second limb at a slightly
 * different angle reads as noise at 88px on a phone.
 */
export interface Pose {
  /** Root joint position in the 100×100 box. */
  hip: readonly [number, number];
  /** Hip → shoulder. −90 is a fully upright torso. */
  spine: number;
  /** Shoulder → head. Usually a few degrees off the spine. */
  neck: number;
  /** Shoulder → elbow. */
  upperArm: number;
  /** Elbow → hand. */
  foreArm: number;
  /** Hip → knee. */
  thigh: number;
  /** Knee → ankle. */
  shin: number;
  /** Ankle → toe. Flat on the floor is 0. */
  foot: number;
}

/** What the hands are holding, drawn at the hand joint. */
export type PropGlyph =
  | 'barbell' | 'dumbbell' | 'cable' | 'machine_handle'
  | 'kettlebell' | 'band' | 'rope' | 'none';

/** Fixed scenery behind the figure. Communicates the setup at a glance. */
export type SceneGlyph =
  | 'floor' | 'flat_bench' | 'incline_bench' | 'seat' | 'press_sled'
  | 'pull_bar' | 'cable_tower' | 'rack' | 'treadmill' | 'bike' | 'rower' | 'none';

/**
 * A single labelled frame. `label` is the word shown under the
 * visual — "Setup → Lower → Press" (§12) is three frames, and the
 * labels ARE the short supporting instruction, so the compact
 * visual does not need a paragraph next to it.
 */
export interface PatternFrame {
  label: string;
  pose: Pose;
  /** Milliseconds this frame is held. Longer on the effort frame. */
  holdMs?: number;
}

/**
 * A movement drawn once and reused by every exercise that performs
 * it. `key` matches a MovementPatternKey-scoped identifier, but is
 * finer-grained: `horizontal_push` is the taxonomy pattern, while
 * `bench_press` and `push_up` are separate drawings of it.
 */
export interface MovementDrawing {
  key: string;
  name: string;
  scene: SceneGlyph;
  prop: PropGlyph;
  frames: PatternFrame[];
  /** Drawn mirrored — used so pulls face the opposite way to pushes. */
  flip?: boolean;
}

/* ---------------- forward kinematics ---------------- */

export interface FigurePoints {
  hip: [number, number];
  shoulder: [number, number];
  head: [number, number];
  elbow: [number, number];
  hand: [number, number];
  knee: [number, number];
  ankle: [number, number];
  toe: [number, number];
}

function project(from: readonly [number, number], deg: number, length: number): [number, number] {
  const rad = (deg * Math.PI) / 180;
  return [from[0] + Math.cos(rad) * length, from[1] + Math.sin(rad) * length];
}

/**
 * Angles → coordinates. Pure, cheap, and deliberately not memoised:
 * it is eight trig calls, and a cache keyed on a pose object would
 * cost more than it saves.
 */
export function resolvePose(pose: Pose): FigurePoints {
  const hip: [number, number] = [pose.hip[0], pose.hip[1]];
  const shoulder = project(hip, pose.spine, SEGMENTS.spine);
  const head = project(shoulder, pose.neck, SEGMENTS.neck + HEAD_RADIUS);
  const elbow = project(shoulder, pose.upperArm, SEGMENTS.upperArm);
  const hand = project(elbow, pose.foreArm, SEGMENTS.foreArm);
  const knee = project(hip, pose.thigh, SEGMENTS.thigh);
  const ankle = project(knee, pose.shin, SEGMENTS.shin);
  const toe = project(ankle, pose.foot, SEGMENTS.foot);
  return { hip, shoulder, head, elbow, hand, knee, ankle, toe };
}

/** The box every drawing is authored in. */
export const FIGURE_VIEWBOX = '0 0 100 100' as const;

/* ---------------- authoring helper ----------------
   Most poses differ from a neutral standing figure in two or three
   angles. Spelling out all eight every time buries the difference
   that actually matters, so patterns are authored as a delta.
   ---------------------------------------------------- */

/** Upright, arms down, feet under the hips. */
export const STANDING: Pose = {
  hip: [50, 56],
  spine: -90,
  neck: -90,
  upperArm: 80,
  foreArm: 85,
  thigh: 88,
  shin: 90,
  foot: 0,
};

export function pose(base: Pose, delta: Partial<Pose>): Pose {
  return { ...base, ...delta };
}
