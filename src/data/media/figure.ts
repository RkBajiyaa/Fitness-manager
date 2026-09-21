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

   ------------------------------------------------------------
   WHY THIS FILE GREW A SECOND HALF

   The skeleton above is sound and every one of the 42 drawings is
   authored against it. What was wrong was not the DATA, it was the
   RENDERER: a 2.7px stroke through those joints is a stick figure,
   and a stick figure cannot show a beginner what an athletic body
   doing a hip hinge looks like.

   So the angles are untouched and this file now also owns the
   BODY: segment widths, a tapered-limb builder, a torso that is
   broad at the chest and narrow at the waist, and the far-side
   limb that turns a diagram into a person. Every existing drawing
   gained a body for free, which is the entire reason the pose data
   was stored as angles in the first place.

   Nothing here is content. These are proportions and geometry —
   a rendering algorithm — so `components/member/*` imports it
   directly, exactly as it already imported `resolvePose` (§21).
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
 * Body thickness at each joint, in viewBox units.
 *
 * These are the numbers that decide whether the figure reads as
 * a trained body or a pipe cleaner. Two rules held them:
 *
 *   · adjacent segments MUST agree at the joint they share
 *     (`kneeTop` = `kneeBottom`), otherwise the round caps step
 *     and the leg looks broken at the knee;
 *   · this is a PROFILE view, so a "width" is the front-to-back
 *     depth of the body, not its shoulder-to-shoulder breadth.
 *     A 15-unit chest against a 26-unit torso is a lean, strong
 *     build seen from the side, not a barrel.
 */
export const WIDTHS = {
  chest: 15,
  waist: 11.2,
  hipTop: 13.4,
  shoulder: 8.6,
  elbow: 6.4,
  wrist: 5,
  hand: 4.6,
  thighTop: 10.6,
  knee: 7,
  ankle: 4.6,
  foot: 4,
  neck: 6,
} as const;

/** Where the waist sits along the hip→shoulder line. */
const WAIST_AT = 0.42;

/**
 * One posture of the figure.
 *
 * `hip` is the root the whole body hangs from; everything else is
 * an angle. Only the NEAR-side arm and leg are posed — a second
 * set of angles per pose would double the authoring cost of every
 * drawing for a limb that, in profile, is almost always within a
 * few degrees of its partner. The far limb is derived instead
 * (see `farSideOf`), which keeps the content small and means a
 * pose correction fixes both sides at once.
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
  | 'pull_bar' | 'cable_tower' | 'lat_tower' | 'rack' | 'dip_bars'
  | 'row_station' | 'stairs' | 'treadmill' | 'bike' | 'rower' | 'none';

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
  /**
   * One short line explaining what the body is doing in THIS frame.
   * Shown beside the phase strip, so the words and the picture are
   * never describing different moments. Optional: where the label
   * already says everything ("Hold"), a second sentence is noise.
   */
  cue?: string;
  /**
   * Overrides for the far-side limbs on this frame only.
   *
   * `Symmetry` covers the two cases that are true of almost every
   * movement — both sides doing the same thing, or alternating —
   * but a lunge is neither: the back leg is extended behind while
   * the front one is bent to 90°. Rather than force those into a
   * rule, the handful of frames that genuinely need it say so.
   */
  farPose?: Partial<Pose>;
}

/**
 * How the two sides of the body relate, which is the only thing
 * the renderer cannot work out from a profile pose.
 *
 *   `mirror`  both sides do the same thing — a bench press, a
 *             squat. The far limb is offset a few degrees so the
 *             figure has depth instead of looking flat.
 *   `gait`    the sides alternate — running, walking, cycling.
 *             The far limb takes the OTHER frame's pose, which is
 *             what makes a two-frame run loop read as running.
 *   `single`  genuinely one-sided work. The far arm hangs.
 */
export type Symmetry = 'mirror' | 'gait' | 'single';

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
  /** Defaults to `mirror`, which is right for most resistance work. */
  symmetry?: Symmetry;
  /**
   * Which frame is the working end of the repetition. Drives the
   * "one rep" marker and the direction arrow's resting state.
   * Defaults to the frame with the longest hold.
   */
  effortFrame?: number;
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

/** The joints a movement can be tracked by. Keys of `FigurePoints`. */
export type JointName = keyof FigurePoints;

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

/* ============================================================
   BODY GEOMETRY

   Everything below turns eight joints into a silhouette. It is
   plain path arithmetic with no state, so it is safe to call on
   every frame of every figure on the screen.
   ============================================================ */

type Pt = readonly [number, number];

const fmt = (n: number): string => (Math.round(n * 100) / 100).toString();

/**
 * A limb: a quadrilateral between two joints with a round cap at
 * each end, tapering from `wa` to `wb`.
 *
 * The caps matter more than they sound. Because adjacent segments
 * share a width at the joint between them (WIDTHS.knee is both the
 * bottom of the thigh and the top of the shin), the two round caps
 * land exactly on top of each other and the knee bends as one
 * continuous piece of leg. Square caps leave a notch on the inside
 * of every bend, which at 90° of knee flexion is a hole in the
 * person.
 *
 * Both arcs sweep 0: from the +normal side to the −normal side the
 * short way is the one that bulges PAST the joint, away from the
 * segment, which is the half of the circle we want.
 */
export function limbPath(a: Pt, b: Pt, wa: number, wb: number): string {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 0.0001;
  const nx = -dy / len;
  const ny = dx / len;
  const ra = wa / 2;
  const rb = wb / 2;
  return [
    `M ${fmt(a[0] + nx * ra)} ${fmt(a[1] + ny * ra)}`,
    `L ${fmt(b[0] + nx * rb)} ${fmt(b[1] + ny * rb)}`,
    `A ${fmt(rb)} ${fmt(rb)} 0 0 0 ${fmt(b[0] - nx * rb)} ${fmt(b[1] - ny * rb)}`,
    `L ${fmt(a[0] - nx * ra)} ${fmt(a[1] - ny * ra)}`,
    `A ${fmt(ra)} ${fmt(ra)} 0 0 0 ${fmt(a[0] + nx * ra)} ${fmt(a[1] + ny * ra)}`,
    'Z',
  ].join(' ');
}

function lerp(a: Pt, b: Pt, t: number): Pt {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/**
 * The torso, in two tapered pieces so it narrows at the waist and
 * widens again into the chest. One capsule hip→shoulder gives a
 * tube; the waist is what makes it look like a trained body, and
 * it is also genuinely informative — a hip hinge is unreadable
 * unless you can see where the torso bends.
 */
export function torsoPaths(p: FigurePoints): [string, string] {
  const waist = lerp(p.hip, p.shoulder, WAIST_AT);
  return [
    limbPath(p.hip, waist, WIDTHS.hipTop, WIDTHS.waist),
    limbPath(waist, p.shoulder, WIDTHS.waist, WIDTHS.chest),
  ];
}

/** The head, as an ellipse tilted to follow the neck. */
export interface HeadShape {
  cx: number; cy: number; rx: number; ry: number; rotate: number;
}

export function headShape(p: FigurePoints, pose: Pose): HeadShape {
  return {
    cx: p.head[0], cy: p.head[1],
    rx: HEAD_RADIUS * 0.88, ry: HEAD_RADIUS * 1.04,
    // The ellipse's ry runs along the neck, so the head tips with
    // the spine instead of staying stubbornly upright on a deadlift.
    rotate: pose.neck + 90,
  };
}

/**
 * The foot as a wedge rather than a capsule: a round-ended stick
 * ankle-to-toe reads as a hoof, and the foot is the contact point
 * a beginner is told to keep flat.
 */
export function footPath(p: FigurePoints): string {
  const dx = p.toe[0] - p.ankle[0];
  const dy = p.toe[1] - p.ankle[1];
  const len = Math.hypot(dx, dy) || 0.0001;
  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy;
  const ny = ux;
  const h = WIDTHS.foot / 2;
  // Heel behind the ankle, so the foot has a back as well as a front.
  const heel: Pt = [p.ankle[0] - ux * 2.4, p.ankle[1] - uy * 2.4];
  return [
    `M ${fmt(heel[0] + nx * h * 1.25)} ${fmt(heel[1] + ny * h * 1.25)}`,
    `L ${fmt(p.toe[0] + nx * h * 0.55)} ${fmt(p.toe[1] + ny * h * 0.55)}`,
    `L ${fmt(p.toe[0] - nx * h * 0.55)} ${fmt(p.toe[1] - ny * h * 0.55)}`,
    `L ${fmt(heel[0] - nx * h * 1.25)} ${fmt(heel[1] - ny * h * 1.25)}`,
    'Z',
  ].join(' ');
}

/**
 * The far-side arm and leg.
 *
 * `mirror` nudges each far segment a few degrees and drops the hip
 * a hair, which is enough to separate the two sides without
 * inventing a second movement. The alternative — drawing one limb —
 * is what made the old figure look like a diagram of a person
 * rather than a person.
 */
export function farSideOf(pose: Pose, symmetry: Symmetry, partner?: Pose): Pose {
  if (symmetry === 'gait' && partner) {
    // The other half of the stride, hung off THIS frame's hip so the
    // body does not tear in two.
    return { ...partner, hip: pose.hip, spine: pose.spine, neck: pose.neck };
  }
  if (symmetry === 'single') {
    // One-sided work: the far arm hangs off the torso, the far leg
    // matches, because that is what the other side is actually doing.
    return { ...pose, upperArm: pose.spine + 172, foreArm: pose.spine + 176 };
  }
  return {
    ...pose,
    upperArm: pose.upperArm + 7,
    foreArm: pose.foreArm + 8,
    thigh: pose.thigh + 7,
    shin: pose.shin - 5,
    foot: pose.foot + 4,
  };
}

/* ============================================================
   MOTION

   A still frame cannot answer "which way do I move?", and a three
   frame loop only answers it for someone already watching at the
   right moment. Both are fixed by the same derived value: the
   joint that travelled furthest between the previous frame and
   this one, and the path it took.

   Derived, not authored, on purpose. A motion arrow stored next to
   a pose is a stored copy of something computable — it drifts the
   first time somebody adjusts an angle, and it drifts silently,
   which is the whole argument of hard rule 5.
   ============================================================ */

export interface MotionCue {
  joint: JointName;
  from: [number, number];
  to: [number, number];
  /** Straight-line travel in viewBox units. */
  distance: number;
}

/**
 * Joints worth pointing at, in preference order — which only breaks
 * ties, since the joint that travelled FURTHEST wins.
 *
 * The hip is last rather than absent. It is the root every other
 * joint hangs from, so on most movements it travels least and never
 * wins; but a hip thrust is the exercise where the hip is the only
 * thing that moves, and leaving the root out meant the one movement
 * named after a joint was the one with no arrow on it.
 */
const TRACKABLE: JointName[] = ['hand', 'elbow', 'ankle', 'knee', 'shoulder', 'toe', 'hip'];

/** Below this the two frames are the same picture and an arrow is a lie. */
const MIN_TRAVEL = 7;

/**
 * Which joint moved, and where it moved from.
 *
 * Ties go to whichever joint appears first in `TRACKABLE`, which
 * is ordered by how much a beginner cares: on a squat the hand and
 * the ankle barely move and the knee and hip do, so the arrow lands
 * on the knee; on a curl only the hand moves and it lands there.
 */
export function motionBetween(from: Pose, to: Pose): MotionCue | null {
  const a = resolvePose(from);
  const b = resolvePose(to);
  let best: MotionCue | null = null;
  for (const joint of TRACKABLE) {
    const distance = Math.hypot(b[joint][0] - a[joint][0], b[joint][1] - a[joint][1]);
    if (distance < MIN_TRAVEL) continue;
    if (!best || distance > best.distance + 0.001) {
      best = { joint, from: a[joint], to: b[joint], distance };
    }
  }
  return best;
}

/**
 * A curved arrow from `from` to `to`, bowed away from the body so
 * it does not cut straight through the figure it is describing.
 * Returns the path plus the end tangent, which is what the head
 * has to be rotated to.
 */
export function arcArrow(
  from: readonly [number, number],
  to: readonly [number, number],
  centre: readonly [number, number],
): { path: string; tipAngle: number } | null {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const len = Math.hypot(dx, dy);
  if (len < 1) return null;

  const mid: Pt = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
  // Bow AWAY from the body's centre of mass, so the arrow sits in
  // clear space rather than crossing the torso.
  const away = [mid[0] - centre[0], mid[1] - centre[1]] as const;
  const awayLen = Math.hypot(away[0], away[1]) || 1;
  const bow = Math.min(len * 0.2, 9);
  const ctrl: Pt = [mid[0] + (away[0] / awayLen) * bow, mid[1] + (away[1] / awayLen) * bow];

  // Tangent of a quadratic Bézier at t = 1 is (end − control).
  const tipAngle = (Math.atan2(to[1] - ctrl[1], to[0] - ctrl[0]) * 180) / Math.PI;
  return {
    path: `M ${fmt(from[0])} ${fmt(from[1])} Q ${fmt(ctrl[0])} ${fmt(ctrl[1])} ${fmt(to[0])} ${fmt(to[1])}`,
    tipAngle,
  };
}

/** Roughly the middle of the body — the point arrows bow away from. */
export function figureCentre(p: FigurePoints): [number, number] {
  return [(p.hip[0] + p.shoulder[0]) / 2, (p.hip[1] + p.shoulder[1]) / 2];
}

/** The frame the repetition is "at" — the held one, unless a drawing says otherwise. */
export function effortIndex(drawing: MovementDrawing): number {
  if (drawing.effortFrame != null) return drawing.effortFrame;
  let best = 0;
  let bestHold = -1;
  drawing.frames.forEach((f, i) => {
    const hold = f.holdMs ?? 700;
    if (hold > bestHold) { bestHold = hold; best = i; }
  });
  return best;
}

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
