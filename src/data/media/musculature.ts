/* ============================================================
   MUSCULATURE — what turns the silhouette into a body (§6, §8).

   The single decision this file exists to make:

     A MUSCLE IS DEFINED IN THE BONE'S OWN COORDINATES, NEVER ON
     THE PAGE.

   A pectoral authored as page coordinates is a pectoral for exactly
   one pose. Author it instead as a shape on the trunk — "from a
   quarter of the way up to three quarters of the way up, and from
   the midline to eight tenths of the way out" — and it follows the
   trunk into a hinge, a supine bench press and an overhead lockout
   with no further work. Sixty exercises then cost no anatomy at all,
   which is the only version of this that is affordable.

   Two consequences worth knowing before extending it:

     · THE SAME GEOMETRY IS THE ACTIVATION OVERLAY (§8, §9). The
       shape that draws the quadriceps is the shape that lights up
       when an exercise works the quadriceps. There is no second set
       of highlight regions to disagree with the first, and a muscle
       highlight is therefore incapable of being in the wrong place.
     · MUSCLES ARE GROUPED BY FACING, not by view. There are three
       sets — front, side, back — and the five viewpoints in
       `figure.ts` map onto them. A pectoral seen from the side is a
       different shape from a pectoral seen from the front, so it is
       a different entry; a pectoral seen from three-quarters is the
       front one drawn on a narrower trunk, which is what an
       illustrator would do and is close enough to be right.

   ------------------------------------------------------------
   LOCAL COORDINATES

   `u` runs 0 → 1 from the bone's proximal end to its distal end.
   `n` runs −1 → 1 ACROSS the bone, and is normalised to the half
   width AT THAT u — so n = 1 is the silhouette edge wherever you
   are along a tapering limb, and a belly authored inside ±0.9 can
   never poke out of the leg it is on.

   `n` positive is ANTERIOR on a profile view (the chest side, the
   quadriceps side) and the VIEWER'S RIGHT on a front or rear view.
   Those are the same axis seen from two places, which is why the
   two sets are authored separately rather than reused.
   ============================================================ */
import { MUSCLES } from '../taxonomy';
import {
  closedCurve, openCurve,
  type BodyPlan, type FigurePoints,
} from './figure';

/** Which bone a shape is attached to. */
export type BoneRef =
  | 'trunkLower' | 'trunkUpper' | 'neck' | 'upperArm' | 'foreArm' | 'thigh' | 'shin';

/** Which way the body is turned. Five views, three sets of anatomy. */
export type Facing = 'front' | 'side' | 'back';

/** A muscle belly, in bone-local coordinates. */
export interface Belly {
  /** Taxonomy muscle key, so activation needs no lookup table. */
  muscle: string;
  bone: BoneRef;
  facings: readonly Facing[];
  /** Closed outline, (u, n). Smoothed when drawn. */
  pts: ReadonlyArray<readonly [number, number]>;
  /**
   * Draw a mirrored copy about n = 0. True for anything paired
   * across the midline on a front or rear view — a pectoral, an
   * oblique, half a trapezius.
   */
  pair?: boolean;
  /** Only draw on this side of the body. */
  only?: 'near' | 'far';
  /** Paint order within a bone. Higher draws later. */
  z?: number;
}

/**
 * A BONY LANDMARK: a kneecap, an elbow point, a sternum (§3, §5).
 *
 * Filled like a muscle and shaped like one, but it is not one — it
 * carries no taxonomy key, so it never lights up and never appears in
 * the activation overlay. A patella that glowed when an exercise
 * worked the quadriceps would be teaching a beginner that their
 * kneecap is a muscle.
 *
 * These are what make a joint read as a JOINT rather than as the place
 * two limbs meet. The width flare in the limb profile gives the joint
 * its shape; the plate gives it a hard highlight, which is what the
 * eye actually uses to tell bone under skin from muscle under skin.
 */
export interface Plate {
  bone: BoneRef;
  facings: readonly Facing[];
  pts: ReadonlyArray<readonly [number, number]>;
  pair?: boolean;
}

/** A contour line — modelling, not a muscle. Open, stroked. */
export interface Contour {
  bone: BoneRef;
  facings: readonly Facing[];
  pts: ReadonlyArray<readonly [number, number]>;
  pair?: boolean;
  /** Thin by default; `firm` for a line that carries real structure. */
  weight?: 'fine' | 'firm';
}

/* ============================================================
   BONES

   Seven, which is every segment that carries visible muscle. The
   hands, feet and head are shapes in their own right and are built
   in the renderer.
   ============================================================ */

export interface Bone {
  a: readonly [number, number];
  b: readonly [number, number];
  wa: number;
  wb: number;
  /**
   * Which way to rotate the bone axis to get +n.
   *
   * +1 for the trunk, which runs hip → shoulder (upwards), and −1
   * for the limbs, which run proximal → distal (downwards). Both
   * mean the same thing in the body's own terms — "anterior is this
   * way" — and getting them the same sign is what would put the
   * quadriceps on the back of the leg.
   */
  turn: 1 | -1;
}

export function bonesOf(p: FigurePoints, plan: BodyPlan): Record<BoneRef, Bone> {
  const w = plan.widths;
  /*
   * `p.waist` rather than a point interpolated along hip → shoulder,
   * and that one substitution is what makes the whole anatomy fold.
   * The trunk has two segments now, so the abdominal wall and the
   * pelvis hang off the lumbar one and the pectorals and the rib cage
   * off the thoracic one — every belly and contour on this body
   * inherited a hip hinge without a single shape being re-authored.
   */
  const waist = p.waist as readonly [number, number];
  const neckEnd: readonly [number, number] = [
    p.shoulder[0] + (p.head[0] - p.shoulder[0]) * 0.55,
    p.shoulder[1] + (p.head[1] - p.shoulder[1]) * 0.55,
  ];
  return {
    trunkLower: { a: p.hip, b: waist, wa: w.hipTop, wb: w.waist, turn: 1 },
    trunkUpper: { a: waist, b: p.shoulder, wa: w.waist, wb: w.chest, turn: 1 },
    neck: { a: p.shoulder, b: neckEnd, wa: w.neck * 1.3, wb: w.neck, turn: 1 },
    upperArm: { a: p.shoulder, b: p.elbow, wa: w.shoulder, wb: w.elbow, turn: -1 },
    foreArm: { a: p.elbow, b: p.hand, wa: w.elbow, wb: w.wrist, turn: -1 },
    thigh: { a: p.hip, b: p.knee, wa: w.thighTop, wb: w.knee, turn: -1 },
    shin: { a: p.knee, b: p.ankle, wa: w.knee, wb: w.ankle, turn: -1 },
  };
}

/** Local (u, n) → page. The one function everything here depends on. */
export function toPage(bone: Bone, u: number, n: number): [number, number] {
  const dx = bone.b[0] - bone.a[0];
  const dy = bone.b[1] - bone.a[1];
  const len = Math.hypot(dx, dy) || 0.0001;
  const ux = dx / len;
  const uy = dy / len;
  // rotate(u, −90) = (uy, −ux); rotate(u, +90) = (−uy, ux)
  const nx = bone.turn === -1 ? uy : -uy;
  const ny = bone.turn === -1 ? -ux : ux;
  const half = (bone.wa + (bone.wb - bone.wa) * u) / 2;
  return [
    bone.a[0] + dx * u + nx * n * half,
    bone.a[1] + dy * u + ny * n * half,
  ];
}

export function bellyPath(belly: Belly, bone: Bone, mirror = false): string {
  const s = mirror ? -1 : 1;
  return closedCurve(belly.pts.map(([u, n]) => toPage(bone, u, n * s)), 0.58);
}

export function contourPath(c: Contour, bone: Bone, mirror = false): string {
  const s = mirror ? -1 : 1;
  return openCurve(c.pts.map(([u, n]) => toPage(bone, u, n * s)));
}

/* ============================================================
   THE MUSCLES

   Priorities are the brief's (§6): the groups that matter for
   understanding an exercise, not every head of every muscle. A
   pectoral, a deltoid, a biceps, a triceps, a forearm, a trapezius,
   a latissimus, an abdominal wall, an oblique, a gluteus, a
   quadriceps, a hamstring, a calf. Thirteen shapes and the anatomy
   reads; thirty and the figure reads as a textbook plate, which §2
   explicitly does not want.

   Shapes stay inside ±0.92 so nothing crosses the silhouette, and
   nothing is authored to n = 0 on a paired shape — two pectorals
   meeting at the midline draw one slab across the sternum, which is
   the same mistake the muscle chart already learned once.
   ============================================================ */

const F: readonly Facing[] = ['front'];
const S: readonly Facing[] = ['side'];
const B: readonly Facing[] = ['back'];
const FS: readonly Facing[] = ['front', 'side'];
const BS: readonly Facing[] = ['back', 'side'];
const ALL: readonly Facing[] = ['front', 'side', 'back'];

export const BELLIES: readonly Belly[] = [
  /* ---------------- chest ---------------- */
  {
    // Pectoral: fans from the sternum out to the shoulder, and the
    // lower border is the line a beginner recognises as "chest".
    muscle: 'pectorals', bone: 'trunkUpper', facings: F, pair: true, z: 2,
    pts: [[0.55, 0.08], [0.72, 0.1], [0.94, 0.42], [1.0, 0.86], [0.9, 0.9],
      [0.72, 0.62], [0.58, 0.34]],
  },
  {
    // In profile a pectoral is a slab on the front edge of the ribs,
    // not a fan. Same muscle, different shape, because it is being
    // seen end-on.
    muscle: 'pectorals', bone: 'trunkUpper', facings: S, z: 2,
    pts: [[0.54, 0.34], [0.78, 0.6], [1.0, 0.72], [1.0, 0.94], [0.72, 0.9], [0.52, 0.62]],
  },

  /* ---------------- back ---------------- */
  {
    // Latissimus: wide under the armpit, narrow into the low back.
    // The V every pulling exercise is trying to build.
    muscle: 'lats', bone: 'trunkUpper', facings: B, pair: true, z: 1,
    pts: [[0.98, 0.2], [1.0, 0.88], [0.72, 0.8], [0.34, 0.5], [0.12, 0.26], [0.3, 0.16]],
  },
  {
    /*
     * A latissimus IS visible from the front — it is the wedge under
     * the armpit that makes a back look wide from any angle. Without
     * this entry a lat pulldown drawn at three-quarters highlighted
     * nothing at all, which looks exactly like an exercise that works
     * nothing. Every muscle an exercise can name needs a belly on
     * every facing it can actually be seen on.
     */
    muscle: 'lats', bone: 'trunkUpper', facings: F, pair: true, z: 1,
    pts: [[0.94, 0.52], [1.0, 0.92], [0.52, 0.74], [0.18, 0.4], [0.5, 0.42]],
  },
  {
    muscle: 'lats', bone: 'trunkUpper', facings: S, z: 1,
    pts: [[0.96, -0.3], [1.0, -0.92], [0.6, -0.86], [0.24, -0.5], [0.4, -0.26]],
  },
  {
    muscle: 'traps', bone: 'trunkUpper', facings: B, pair: true, z: 3,
    pts: [[1.04, 0.1], [1.06, 0.78], [0.86, 0.6], [0.72, 0.3], [0.8, 0.08]],
  },
  {
    muscle: 'traps', bone: 'neck', facings: ALL, pair: true, z: 1,
    pts: [[0.0, 0.3], [0.1, 1.0], [0.62, 0.92], [0.7, 0.34]],
  },
  {
    muscle: 'rhomboids', bone: 'trunkUpper', facings: B, pair: true, z: 2,
    pts: [[0.78, 0.12], [0.98, 0.16], [0.94, 0.52], [0.74, 0.4]],
  },
  {
    muscle: 'spinal_erectors', bone: 'trunkLower', facings: B, pair: true, z: 2,
    pts: [[0.1, 0.1], [0.3, 0.12], [1.0, 0.34], [1.0, 0.06]],
  },
  {
    muscle: 'spinal_erectors', bone: 'trunkLower', facings: S, z: 1,
    pts: [[0.05, -0.55], [0.3, -0.8], [1.0, -0.86], [1.0, -0.5]],
  },

  /* ---------------- core ---------------- */
  {
    // The abdominal wall as ONE shape with the blocks cut into it by
    // contour lines rather than as six separate shapes: six shapes
    // at this scale is a waffle, and a waffle on a moving figure is
    // the thing §2 calls a textbook.
    muscle: 'abs', bone: 'trunkLower', facings: F, z: 3,
    pts: [[0.16, -0.5], [0.16, 0.5], [0.86, 0.62], [1.06, 0.34], [1.06, -0.34],
      [0.86, -0.62]],
  },
  {
    muscle: 'abs', bone: 'trunkLower', facings: S, z: 3,
    pts: [[0.2, 0.5], [0.24, 0.92], [1.02, 0.94], [1.0, 0.56]],
  },
  {
    muscle: 'obliques', bone: 'trunkLower', facings: F, pair: true, z: 2,
    pts: [[0.12, 0.54], [0.34, 0.9], [0.9, 0.84], [1.0, 0.44], [0.82, 0.62]],
  },
  {
    muscle: 'obliques', bone: 'trunkLower', facings: S, z: 2,
    pts: [[0.16, 0.2], [0.3, 0.6], [0.92, 0.52], [0.96, 0.18]],
  },
  {
    muscle: 'hip_flexors', bone: 'trunkLower', facings: F, pair: true, z: 1,
    pts: [[-0.04, 0.18], [0.02, 0.72], [0.24, 0.6], [0.2, 0.16]],
  },
  {
    muscle: 'hip_flexors', bone: 'trunkLower', facings: S, z: 1,
    pts: [[-0.08, 0.34], [-0.02, 0.9], [0.26, 0.82], [0.22, 0.3]],
  },

  /* ---------------- glutes ---------------- */
  {
    muscle: 'glutes', bone: 'trunkLower', facings: B, pair: true, z: 1,
    pts: [[-0.12, 0.1], [-0.16, 0.8], [0.16, 0.86], [0.24, 0.24]],
  },
  {
    muscle: 'glutes', bone: 'trunkLower', facings: S, z: 1,
    pts: [[-0.14, -0.4], [-0.2, -0.95], [0.2, -0.98], [0.26, -0.44]],
  },

  /* ---------------- shoulders ---------------- */
  {
    // The deltoid cap. Sits on the upper arm rather than the trunk
    // so it travels with the arm, which is what makes a lateral
    // raise's shoulder visibly the thing doing the work.
    muscle: 'side_delts', bone: 'upperArm', facings: ALL, z: 3,
    pts: [[-0.06, -0.72], [-0.1, 0.72], [0.22, 0.86], [0.34, 0.0], [0.22, -0.86]],
  },
  {
    muscle: 'front_delts', bone: 'upperArm', facings: FS, z: 4,
    pts: [[-0.04, 0.2], [0.0, 0.84], [0.26, 0.8], [0.24, 0.16]],
  },
  {
    muscle: 'rear_delts', bone: 'upperArm', facings: BS, z: 4,
    pts: [[-0.04, -0.2], [0.0, -0.84], [0.26, -0.8], [0.24, -0.16]],
  },
  {
    muscle: 'rotator_cuff', bone: 'upperArm', facings: ALL, z: 2,
    pts: [[-0.02, -0.5], [0.02, 0.5], [0.16, 0.44], [0.14, -0.44]],
  },

  /* ---------------- arms ---------------- */
  {
    muscle: 'biceps', bone: 'upperArm', facings: ALL, z: 2,
    pts: [[0.24, 0.12], [0.3, 0.78], [0.62, 0.86], [0.84, 0.5], [0.8, 0.14]],
  },
  {
    muscle: 'triceps', bone: 'upperArm', facings: ALL, z: 2,
    pts: [[0.2, -0.16], [0.26, -0.84], [0.66, -0.88], [0.88, -0.52], [0.86, -0.14]],
  },
  {
    muscle: 'forearms', bone: 'foreArm', facings: ALL, z: 2,
    pts: [[0.02, -0.72], [0.02, 0.74], [0.3, 0.86], [0.56, 0.5], [0.58, -0.5], [0.3, -0.86]],
  },

  /* ---------------- legs ---------------- */
  {
    muscle: 'quads', bone: 'thigh', facings: FS, z: 2,
    pts: [[0.1, 0.1], [0.12, 0.84], [0.5, 0.94], [0.82, 0.74], [0.92, 0.3], [0.7, 0.14]],
  },
  {
    muscle: 'hamstrings', bone: 'thigh', facings: BS, z: 2,
    pts: [[0.12, -0.12], [0.14, -0.86], [0.56, -0.94], [0.84, -0.7], [0.88, -0.24], [0.6, -0.12]],
  },
  {
    muscle: 'adductors', bone: 'thigh', facings: F, z: 1,
    pts: [[0.06, -0.06], [0.08, -0.6], [0.66, -0.5], [0.8, -0.1]],
  },
  {
    muscle: 'calves', bone: 'shin', facings: ALL, z: 2,
    pts: [[0.06, -0.2], [0.08, -0.88], [0.4, -0.94], [0.62, -0.6], [0.56, -0.16]],
  },
];

/* ============================================================
   BONY LANDMARKS (§3, §5)
   ============================================================ */
export const PLATES: readonly Plate[] = [
  {
    // The patella. On the shin rather than the thigh so it stays with
    // the lower leg through flexion, which is where a kneecap actually
    // travels — on the thigh it would slide up the leg as the knee bent.
    bone: 'shin', facings: ['front', 'side'],
    pts: [[-0.03, 0.14], [0.02, 0.46], [0.13, 0.6], [0.21, 0.42], [0.17, 0.1],
      [0.06, 0.0]],
  },
  {
    // The olecranon — the point of the elbow, on the back of the arm.
    bone: 'foreArm', facings: ['front', 'side', 'back'],
    pts: [[-0.05, -0.16], [0.0, -0.52], [0.12, -0.6], [0.18, -0.34], [0.1, -0.08]],
  },
  {
    // The sternum, between the two pectorals. Narrow on purpose: this
    // is the one place on the trunk where the eye expects bone, and it
    // is what stops a pair of pectorals reading as one slab.
    bone: 'trunkUpper', facings: ['front'],
    pts: [[0.5, -0.1], [0.52, 0.1], [0.98, 0.13], [1.0, -0.13]],
  },
  {
    // The iliac crest, as a plane rather than a line: the top surface
    // of the pelvis, which is what §3 needs visible for the rib cage →
    // waist → pelvis → hip → femur chain to read.
    bone: 'trunkLower', facings: ['front'], pair: true,
    pts: [[0.3, 0.3], [0.38, 0.72], [0.2, 0.86], [0.14, 0.44]],
  },
  {
    bone: 'trunkLower', facings: ['side'],
    pts: [[0.3, 0.18], [0.42, 0.62], [0.26, 0.84], [0.16, 0.36]],
  },
];

export function platesOn(bone: BoneRef, facing: Facing): Plate[] {
  return PLATES.filter((pl) => pl.bone === bone && pl.facings.includes(facing));
}

export function platePath(pl: Plate, bone: Bone, mirror = false): string {
  const s = mirror ? -1 : 1;
  return closedCurve(pl.pts.map(([u, n]) => toPage(bone, u, n * s)), 0.5);
}

/* ============================================================
   CONTOURS

   The lines that make a body legible BEFORE anything is coloured
   in — the same argument the muscle chart already makes. A sternum,
   a linea alba, the cuts across the abdominal wall, a knee cap, the
   groove beside the spine. Without them a highlighted quadriceps is
   a red shape on a leg; with them it is a leg you can already see
   the quadriceps on, now marked.
   ============================================================ */
export const CONTOURS: readonly Contour[] = [
  /* ---- the rib cage (§2) ----
     A costal arch and a clavicle line. Between them they turn one
     smooth trunk into upper chest / sternum / rib cage / abdominal
     wall, which is the whole of §2 and costs four lines. */
  { bone: 'trunkUpper', facings: F, weight: 'firm', pts: [[0.62, 0.0], [1.0, 0.0]] },
  {
    // The costal arch: down and out from the xiphoid. This is the line
    // that separates the rib cage from the abdominal wall, and without
    // it a braced trunk and a folded one look the same from the front.
    bone: 'trunkUpper', facings: F, weight: 'firm', pair: true,
    pts: [[0.44, 0.04], [0.32, 0.4], [0.12, 0.66]],
  },
  {
    // The clavicle — §2's "upper chest". It is also what gives the
    // shoulder somewhere to attach to instead of floating beside the neck.
    bone: 'trunkUpper', facings: F, weight: 'firm', pair: true,
    pts: [[0.97, 0.08], [0.93, 0.44], [0.85, 0.74]],
  },
  { bone: 'trunkUpper', facings: F, pts: [[0.58, 0.3], [0.78, 0.56], [0.96, 0.66]], pair: true },
  /* ---- the abdominal wall ---- */
  /* The linea alba and two tendinous intersections. SHORT and curved:
     spanning the full width and crossing a full-length midline drew a
     crosshair on the belly, which is one more shape to decode rather
     than the abdominal wall it is supposed to be reading as. */
  { bone: 'trunkLower', facings: F, pts: [[0.28, 0.0], [0.62, 0.02], [0.98, 0.0]] },
  { bone: 'trunkLower', facings: F, pts: [[0.52, -0.3], [0.56, 0.0], [0.52, 0.3]] },
  { bone: 'trunkLower', facings: F, pts: [[0.84, -0.34], [0.88, 0.0], [0.84, 0.34]] },
  /* ---- the pelvis (§3) ----
     The inguinal line from the iliac crest down to the pubis is THE
     pelvis signal: it is the boundary the eye reads as "the leg starts
     here", and it is what makes a hip joint a joint rather than the
     point where a thigh happens to be attached. Firm, because it has
     to survive at thumbnail size. */
  {
    bone: 'trunkLower', facings: F, weight: 'firm', pair: true,
    pts: [[0.34, 0.8], [0.16, 0.46], [-0.06, 0.1]],
  },
  {
    // And the hip crease itself — the short arc around the femoral head.
    bone: 'trunkLower', facings: F, pair: true,
    pts: [[0.16, 0.92], [0.0, 0.78], [-0.14, 0.5]],
  },
  /* trunk, side */
  { bone: 'trunkUpper', facings: S, pts: [[0.5, 0.36], [0.74, 0.66], [1.0, 0.76]] },
  {
    bone: 'trunkUpper', facings: S, weight: 'firm',
    pts: [[0.46, 0.42], [0.32, 0.72], [0.18, 0.84]],
  },
  { bone: 'trunkLower', facings: S, pts: [[0.32, 0.6], [0.36, 0.94]] },
  { bone: 'trunkLower', facings: S, pts: [[0.64, 0.64], [0.68, 0.96]] },
  {
    bone: 'trunkLower', facings: S, weight: 'firm',
    pts: [[0.32, 0.86], [0.1, 0.56], [-0.08, 0.2]],
  },
  /* trunk, back */
  { bone: 'trunkUpper', facings: B, weight: 'firm', pts: [[0.1, 0.0], [1.0, 0.0]] },
  { bone: 'trunkLower', facings: B, weight: 'firm', pts: [[0.1, 0.0], [1.0, 0.0]] },
  { bone: 'trunkUpper', facings: B, pts: [[0.98, 0.22], [0.7, 0.34], [0.3, 0.5]], pair: true },
  {
    // The scapula's medial border — the rib cage, read from behind.
    bone: 'trunkUpper', facings: B, pair: true,
    pts: [[0.92, 0.22], [0.78, 0.5], [0.6, 0.6]],
  },
  {
    // The sacral triangle: the pelvis from behind.
    bone: 'trunkLower', facings: B, pair: true,
    pts: [[0.36, 0.72], [0.22, 0.34], [0.06, 0.1]],
  },
  /* shoulder seam — the line that separates a deltoid from an arm */
  { bone: 'upperArm', facings: ALL, weight: 'firm', pts: [[0.3, -0.8], [0.22, 0.0], [0.3, 0.8]] },
  /* elbow and knee, the two joints §3 names */
  { bone: 'foreArm', facings: ALL, pts: [[0.02, -0.66], [-0.04, 0.0], [0.02, 0.66]] },
  { bone: 'shin', facings: ALL, weight: 'firm', pts: [[0.0, 0.62], [-0.05, 0.0], [0.0, -0.62]] },
  { bone: 'shin', facings: FS, pts: [[0.03, 0.2], [0.1, 0.5], [0.04, 0.72]] },
  /* leg separation */
  { bone: 'thigh', facings: FS, pts: [[0.14, 0.42], [0.6, 0.6], [0.88, 0.44]] },
  { bone: 'thigh', facings: BS, pts: [[0.16, -0.4], [0.6, -0.56], [0.9, -0.4]] },
  { bone: 'shin', facings: BS, pts: [[0.1, -0.5], [0.42, -0.66], [0.58, -0.4]] },
  /* neck */
  { bone: 'neck', facings: F, pts: [[0.1, 0.34], [0.8, 0.5]], pair: true },
];

/* ============================================================
   LOOKUP
   ============================================================ */

const BY_MUSCLE = new Map<string, Belly[]>();
for (const b of BELLIES) {
  const list = BY_MUSCLE.get(b.muscle);
  if (list) list.push(b);
  else BY_MUSCLE.set(b.muscle, [b]);
}

/** Every muscle this system can draw. Checked by `validateContent`. */
export const DRAWN_MUSCLES: ReadonlySet<string> = new Set(BY_MUSCLE.keys());

/**
 * Which bellies to light up for a list of muscles, on this facing.
 *
 * Returns the BELLIES rather than the muscle keys so the renderer
 * cannot pick a different shape from the one the anatomy drew.
 */
export function belliesFor(
  muscles: readonly string[], facing: Facing,
): Belly[] {
  const out: Belly[] = [];
  for (const m of muscles) {
    for (const b of BY_MUSCLE.get(m) ?? []) {
      if (b.facings.includes(facing)) out.push(b);
    }
  }
  return out;
}

export function belliesOn(bone: BoneRef, facing: Facing): Belly[] {
  return BELLIES
    .filter((b) => b.bone === bone && b.facings.includes(facing))
    .sort((a, b) => (a.z ?? 0) - (b.z ?? 0));
}

export function contoursOn(bone: BoneRef, facing: Facing): Contour[] {
  return CONTOURS.filter((c) => c.bone === bone && c.facings.includes(facing));
}

/**
 * How hard the working muscles are shown, from the movement's own
 * geometry (§9).
 *
 * Highlighting that never changes is a label. Highlighting that
 * flashes is a distraction. This is a function of HOW FAR THE BODY IS
 * FROM THE WORKING POSITION: faint at the far end of the range, full
 * at the position the effort is actually in, and smoothly between —
 * so the anatomy is responding to the movement rather than being
 * switched on by a frame index, and no exercise has to author it.
 */
export function activationFrom(distance: number, range: number): number {
  if (range <= 0.001) return 0.6;
  const t = Math.min(1, Math.max(0, distance / range));
  return 0.26 + 0.74 * Math.pow(1 - t, 1.4);
}

/**
 * Taxonomy muscles the FIGURE cannot model.
 *
 * `heart_lungs` is the one deliberate exception, for the same reason
 * the chart draws it as the thorax: it is the honest answer for
 * cardio work and it is not a muscle, so it has no belly. Anything
 * else appearing here is a muscle an exercise can name while the
 * figure highlights nothing at all — which looks exactly like an
 * exercise that works nothing.
 */
const NOT_A_BELLY: ReadonlySet<string> = new Set(['heart_lungs']);

export function unmodelledMuscles(): string[] {
  return MUSCLES
    .map((m) => m.key)
    .filter((key) => !NOT_A_BELLY.has(key) && !BY_MUSCLE.has(key));
}
