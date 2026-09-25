/* ============================================================
   THE 3D FIGURE — a real skeleton, a real camera, a real light.

   The 2D figure in `figure.ts` is a sagittal diagram: eight joints
   in one plane, drawn flat. It is honest and it is cheap, and for
   a squat seen from the side it is enough. It is NOT enough for a
   deadlift, where the question a beginner is actually asking is
   "where is my pelvis relative to the bar" — and a flat side view
   cannot answer a question about a three-dimensional body.

   So this module is a second, richer visual system. It shares the
   philosophy of the first (geometry, authored as angles, no
   licensed assets) and almost nothing else:

     · joints live in 3D. A pose is a set of spherical angles, and
       forward kinematics produces world-space points;
     · there is a CAMERA — yaw, pitch and a weak perspective — so
       the figure is seen three-quarter rather than dead side-on.
       That single change is what makes a pelvis readable;
     · there is a LIGHT. Every volume is shaded along its own axis,
       which is what separates a rendered body from a silhouette;
     · volumes are ANATOMICAL and elliptical. A human torso is
       roughly two units wide for every one deep, and a rib cage
       flares where a waist does not. A circular cross-section is
       what makes a figure read as a balloon animal;
     · shapes are DEPTH SORTED, so a near arm covers a far one and
       the model occludes itself correctly at every camera angle.

   WHY SVG AND NOT WEBGL. Three reasons, in order of how much they
   mattered. (1) A rigged anatomical mesh is an ASSET, and this
   product does not take assets it cannot licence (§26, and the
   standing instruction not to commission or scrape artwork). A
   procedural mesh would be the same maths as this file plus a
   renderer. (2) The whole app has three dependencies; adding a
   3D engine and a loader to show twelve exercises is not a visual
   upgrade, it is a different application. (3) On the phone this is
   actually used on, a vector figure is sharp at any density, costs
   a couple of kilobytes, needs no GPU and no shader compile, and
   cannot show a blank canvas because a context was lost.

   Everything here is geometry — proportions, trigonometry and
   projection, with no exercise, muscle or equipment name in it —
   so components import it directly, exactly as they already import
   `resolvePose` (§21).
   ============================================================ */

/* ============================================================
   Vector maths
   ============================================================ */

export type V3 = readonly [number, number, number];

/** World axes: +x is the model's right, +y is DOWN (SVG's), +z is toward the front. */
export const WORLD_UP: V3 = [0, -1, 0];

export const v = {
  add: (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  mul: (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k],
  dot: (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a: V3, b: V3): V3 => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ],
  len: (a: V3): number => Math.hypot(a[0], a[1], a[2]),
  norm: (a: V3): V3 => {
    const l = Math.hypot(a[0], a[1], a[2]) || 1e-6;
    return [a[0] / l, a[1] / l, a[2] / l];
  },
  lerp: (a: V3, b: V3, t: number): V3 => [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ],
};

const RAD = Math.PI / 180;

/* ============================================================
   THE AUTHORING LANGUAGE

   A segment is two numbers, and both of them are things a human
   can picture without a calculator:

     el  ELEVATION, degrees from hanging straight down.
           0 = down, 90 = horizontal, 180 = straight up.
     az  AZIMUTH of the horizontal part, degrees around the body.
           0 = the way the body faces, 90 = the body's right,
           −90 = the body's left, 180 = behind.

   Both are measured in WORLD space, not relative to the parent
   joint. That is the same decision `figure.ts` made and for the
   same reason: a typo then distorts one limb instead of every
   limb below it, and "the thigh is nearly vertical" stays true on
   the page even when the torso is at 45°, which is exactly the
   frame a deadlift is hard to author in otherwise.
   ============================================================ */

/** `[elevation, azimuth]` in degrees. See above. */
export type Seg = readonly [number, number];

/** The body's own axes. Azimuth is a compass on the ground, not a gimbal. */
export interface BodyFrame {
  /** Straight down. Always. */
  down: V3;
  /** The way the body is heading, horizontal. */
  front: V3;
  /** The model's right hand side, horizontal. */
  right: V3;
}

/**
 * `heading` is one number: which way the model is turned, in
 * degrees, 0 facing +z. Lying down is NOT a heading — it is the
 * torso's elevation — which is what keeps the azimuth compass
 * horizontal for every pose and makes "the arm is out to the side"
 * mean the same thing standing, seated and on a bench.
 */
export function frameFor(heading = 0): BodyFrame {
  const h = heading * RAD;
  const front: V3 = [Math.sin(h), 0, Math.cos(h)];
  return { down: [0, 1, 0], front, right: [Math.cos(h), 0, -Math.sin(h)] };
}

/** A segment's unit direction inside a body frame. */
export function dirIn(f: BodyFrame, [el, az]: Seg): V3 {
  const e = el * RAD;
  const a = az * RAD;
  const horiz = Math.sin(e);
  return v.norm(v.add(
    v.mul(f.down, Math.cos(e)),
    v.add(v.mul(f.front, horiz * Math.cos(a)), v.mul(f.right, horiz * Math.sin(a))),
  ));
}

/* ============================================================
   PROPORTIONS

   Athletic, roughly seven and a half heads, in the same 100×100
   box every other drawing in this product uses. They are fixed:
   the figure never changes build between exercises, which is what
   makes twelve demonstrations read as one product rather than
   twelve illustrations.
   ============================================================ */

export const BONE = {
  spine: 25,        // pelvis centre → the line between the shoulders
  neck: 5.2,
  head: 11,         // chin to crown
  upperArm: 15.5,
  foreArm: 13.5,
  hand: 5,
  thigh: 21,
  shin: 20,
  foot: 7.5,
  shoulderHalf: 8.4,
  hipHalf: 5.2,
} as const;

/**
 * Cross-sections, as [half-width across the body, half-depth
 * front-to-back]. The 3:2 ratio on the trunk is the single number
 * that stops the model reading as a stack of tubes — a human chest
 * is much wider than it is deep, and a circular torso is a balloon.
 */
export const GIRTH = {
  pelvis: [7.3, 5.2],
  waist: [5.5, 4.0],
  ribs: [7.9, 5.5],
  clavicle: [8.5, 4.7],
  neck: [3.0, 3.2],
  head: [4.3, 4.7],
  deltoid: 4.0,
  upperArm: [3.0, 3.0],
  elbow: [2.3, 2.3],
  wrist: [1.75, 1.9],
  hand: [1.5, 2.4],
  hipBall: 3.7,
  thigh: [4.3, 4.5],
  knee: [2.9, 3.1],
  ankle: [1.9, 2.1],
  foot: [1.8, 2.0],
} as const;

/** Where the trunk's cross-sections sit along the pelvis→shoulder axis. */
const TRUNK_STATIONS = [0, 0.32, 0.64, 1] as const;

/* ============================================================
   A POSE
   ============================================================ */

export interface Limb3D {
  /** Shoulder → elbow, or hip → knee. */
  upper: Seg;
  /** Elbow → wrist, or knee → ankle. */
  lower: Seg;
  /** Wrist → knuckles, or ankle → toe. Defaults to continuing `lower`. */
  end?: Seg;
}

export interface Pose3D {
  /** Pelvis centre, in the 100×100 box (z is depth; 0 is the centre plane). */
  root: V3;
  /** Which way the model is turned, in degrees. 0 faces +z. */
  heading?: number;
  /** Pelvis → shoulders. Standing upright is `[180, 0]`; supine is `[90, ±90]`. */
  torso: Seg;
  /**
   * Which way the chest faces. Only lying and hanging poses need it:
   * for anything upright the default — the part of the heading that
   * is square to the spine — already leans with the torso, which is
   * exactly right for a hinge. A bench press has to say so, because
   * a supine chest faces the ceiling and nothing about the spine's
   * direction can tell you that.
   */
  chest?: Seg;
  /** Shoulders → crown. Defaults to continuing the torso. */
  head?: Seg;
  arms: { l: Limb3D; r: Limb3D };
  legs: { l: Limb3D; r: Limb3D };
}

export interface Skeleton {
  frame: BodyFrame;
  torsoAxis: V3;
  /** Which way the chest faces — drives the elliptical cross-sections. */
  chestNormal: V3;
  /** Across the shoulders and hips — the axis the figure has width along. */
  lateral: V3;
  pelvis: V3;
  waist: V3;
  ribs: V3;
  clavicle: V3;
  neckTop: V3;
  crown: V3;
  shoulder: { l: V3; r: V3 };
  elbow: { l: V3; r: V3 };
  wrist: { l: V3; r: V3 };
  hand: { l: V3; r: V3 };
  hip: { l: V3; r: V3 };
  knee: { l: V3; r: V3 };
  ankle: { l: V3; r: V3 };
  toe: { l: V3; r: V3 };
}

/**
 * Mirrors a limb to the other side of the body.
 *
 * `about` is the azimuth the mirror plane runs along, and it is not
 * always zero. For anything upright the sagittal plane contains the
 * heading, so a plain sign flip is right. A model lying on a bench
 * has its spine along the azimuth its head points down, and
 * mirroring THAT is `2·about − az`. Getting this wrong swaps a
 * bench presser's arms across their chest, which looks like a pose
 * bug and is really a frame bug.
 */
export function mirrorLimb(limb: Limb3D, about = 0): Limb3D {
  const flip = ([el, az]: Seg): Seg => [el, 2 * about - az];
  return {
    upper: flip(limb.upper),
    lower: flip(limb.lower),
    ...(limb.end ? { end: flip(limb.end) } : {}),
  };
}

/** The common case: one limb authored, the other derived. */
export function pair(limb: Limb3D, about = 0): { l: Limb3D; r: Limb3D } {
  return { r: limb, l: mirrorLimb(limb, about) };
}

/** Both sides doing the same thing, with the far one a touch open so the body has depth. */
export function bothArms(limb: Limb3D, spread = 0): { l: Limb3D; r: Limb3D } {
  const open = ({ upper, lower, end }: Limb3D, s: number): Limb3D => ({
    upper: [upper[0], upper[1] + s],
    lower: [lower[0], lower[1] + s],
    ...(end ? { end: [end[0], end[1] + s] as Seg } : {}),
  });
  return { r: open(limb, spread), l: mirrorLimb(open(limb, spread)) };
}

/** Angles → world points. Pure and cheap; called once per frame per figure. */
export function resolve3D(pose: Pose3D): Skeleton {
  const frame = frameFor(pose.heading ?? 0);
  const torsoAxis = dirIn(frame, pose.torso);

  // Which way the chest faces. Given for lying poses; otherwise the
  // heading with its along-the-spine component removed, so a torso
  // hinged to 45° has a chest that looks at the floor in front of
  // it — which is the whole point of drawing a deadlift.
  const along = v.dot(frame.front, torsoAxis);
  const perp = v.sub(frame.front, v.mul(torsoAxis, along));
  const chestNormal = pose.chest
    ? dirIn(frame, pose.chest)
    : (v.len(perp) < 0.05 ? frame.front : v.norm(perp));

  // The shoulders run square to both. Derived rather than stored, so
  // a pose that lies down gets its shoulder line rotated with it.
  const rawLateral = v.cross(chestNormal, torsoAxis);
  const lateral = v.len(rawLateral) < 0.05 ? frame.right : v.norm(rawLateral);

  const pelvis = pose.root;
  const at = (t: number) => v.add(pelvis, v.mul(torsoAxis, BONE.spine * t));
  const waist = at(TRUNK_STATIONS[1]);
  const ribs = at(TRUNK_STATIONS[2]);
  const clavicle = at(1);

  const headAxis = pose.head ? dirIn(frame, pose.head) : torsoAxis;
  const neckTop = v.add(clavicle, v.mul(headAxis, BONE.neck));
  const crown = v.add(neckTop, v.mul(headAxis, BONE.head));

  const side = (s: 1 | -1) => v.mul(lateral, BONE.shoulderHalf * s);
  const shoulder = { r: v.add(clavicle, side(1)), l: v.add(clavicle, side(-1)) };
  const hipOff = (s: 1 | -1) => v.mul(lateral, BONE.hipHalf * s);
  const hip = { r: v.add(pelvis, hipOff(1)), l: v.add(pelvis, hipOff(-1)) };

  const chain = (from: V3, limb: Limb3D, a: number, b: number, c: number) => {
    const j1 = v.add(from, v.mul(dirIn(frame, limb.upper), a));
    const j2 = v.add(j1, v.mul(dirIn(frame, limb.lower), b));
    const j3 = v.add(j2, v.mul(dirIn(frame, limb.end ?? limb.lower), c));
    return [j1, j2, j3] as const;
  };

  const [elR, wrR, hdR] = chain(shoulder.r, pose.arms.r, BONE.upperArm, BONE.foreArm, BONE.hand);
  const [elL, wrL, hdL] = chain(shoulder.l, pose.arms.l, BONE.upperArm, BONE.foreArm, BONE.hand);
  const [knR, anR, toR] = chain(hip.r, pose.legs.r, BONE.thigh, BONE.shin, BONE.foot);
  const [knL, anL, toL] = chain(hip.l, pose.legs.l, BONE.thigh, BONE.shin, BONE.foot);

  return {
    frame, torsoAxis, chestNormal, lateral,
    pelvis, waist, ribs, clavicle, neckTop, crown,
    shoulder, hip,
    elbow: { r: elR, l: elL }, wrist: { r: wrR, l: wrL }, hand: { r: hdR, l: hdL },
    knee: { r: knR, l: knL }, ankle: { r: anR, l: anL }, toe: { r: toR, l: toL },
  };
}

/* ============================================================
   THE CAMERA

   Yaw turns the model toward the viewer; pitch drops the horizon
   slightly so the floor reads as a floor. The perspective is
   WEAK — a divide, not a frustum — because a wide lens on a
   figure this size distorts the near hand into a paddle, and the
   only thing perspective is here to do is tell you which limb is
   in front.
   ============================================================ */

export interface Camera {
  /** Degrees. 0 looks at the model's front; 90 is a pure side view. */
  yaw: number;
  /** Degrees. Positive looks slightly down on the model. */
  pitch: number;
  /** Distance, in box units. Larger is flatter. */
  dist: number;
  /** Uniform zoom. */
  scale: number;
  /** Where the origin lands on screen. */
  origin: readonly [number, number];
}

/**
 * The house angle. Thirty-four degrees is far enough round to see
 * the pelvis and both shoulders, and near enough to a side view
 * that a hip hinge still reads as a hinge rather than foreshortening
 * into nothing.
 */
export const CAMERA: Camera = { yaw: 34, pitch: 7, dist: 340, scale: 1, origin: [50, 0] };

export interface Projected {
  x: number;
  y: number;
  /** Camera-space depth. Larger is nearer. */
  z: number;
  /** Perspective scale at this depth, for sizing radii. */
  k: number;
}

export function project(p: V3, cam: Camera = CAMERA): Projected {
  const cy = Math.cos(cam.yaw * RAD);
  const sy = Math.sin(cam.yaw * RAD);
  const cp = Math.cos(cam.pitch * RAD);
  const sp = Math.sin(cam.pitch * RAD);
  const x1 = p[0] * cy + p[2] * sy;
  const z1 = -p[0] * sy + p[2] * cy;
  const y1 = p[1] * cp - z1 * sp;
  const z2 = p[1] * sp + z1 * cp;
  const k = cam.dist / (cam.dist - z2) * cam.scale;
  return { x: cam.origin[0] + x1 * k, y: cam.origin[1] + y1 * k, z: z2, k };
}

/** The camera's view direction in world space — used for facing tests. */
export function viewDir(cam: Camera = CAMERA): V3 {
  const cy = Math.cos(cam.yaw * RAD);
  const sy = Math.sin(cam.yaw * RAD);
  const cp = Math.cos(cam.pitch * RAD);
  const sp = Math.sin(cam.pitch * RAD);
  // The third row of the camera rotation: the world vector that maps
  // to camera +z, which in `project` is the direction of "nearer".
  return v.norm([-sy * cp, sp, cy * cp]);
}

/**
 * The key light, in world space: high, in front, and over the
 * model's left so the near side of a three-quarter view catches it.
 * One light and one ambient term; a second light on a figure this
 * small only muddies the silhouette.
 */
export const LIGHT: V3 = v.norm([-0.45, -0.78, 0.44]);

/* ============================================================
   VOLUMES

   Every body part is one of two primitives, both of which project
   to a shape SVG can draw exactly:

     CAPSULE    a tapered tube between two joints, with elliptical
                cross-sections. Projects to the same outline the
                2D figure already uses, so `limbPath` is reused.
     BALL       a sphere at a joint. Projects to a circle, and
                covers the seam where two capsules meet at an
                angle — a shoulder, a hip, a knee.
   ============================================================ */

export type VolumeKind = 'capsule' | 'ball' | 'loft';

export interface Volume {
  id: string;
  kind: VolumeKind;
  a: V3;
  /** Capsules only. */
  b?: V3;
  /**
   * Lofts only: a chain of cross-sections drawn as ONE outline.
   *
   * The trunk was three stacked capsules and it read as three
   * stacked cylinders — every internal cap drew its own contour
   * across the body. A loft has one silhouette and no seams, which
   * is the difference between a torso that flares at the ribs and
   * a pile of tubes that happens to change diameter.
   */
  stations?: ReadonlyArray<{ p: V3; r: readonly [number, number] }>;
  /** Half-width across the body and half-depth front-to-back, at `a` and at `b`. */
  ra: readonly [number, number];
  rb?: readonly [number, number];
  /** Which anatomical region this is, for muscle highlighting. */
  region?: Region;
  /** Drawn behind the body — a far limb — so it can be toned down. */
  far?: boolean;
}

/**
 * The regions a muscle highlight can land on. Deliberately coarse:
 * the model answers "WHERE on my body", and the front/back chart
 * beside it answers "WHICH muscle" to the exact head. Tinting half
 * a projected capsule to separate a biceps from a triceps would be
 * a worse drawing AND a worse lesson than pointing at the arm and
 * letting the chart be precise.
 */
export type Region =
  | 'chest' | 'upperBack' | 'lowerBack' | 'abdomen' | 'shoulder'
  | 'upperArm' | 'foreArm' | 'glutes' | 'thigh' | 'shin' | 'neck';

const R = (w: number, d: number) => [w, d] as const;

/** Every volume of the body, in no particular order — the renderer sorts them. */
export function volumes(s: Skeleton): Volume[] {
  const out: Volume[] = [];
  const cap = (id: string, a: V3, b: V3, ra: readonly [number, number],
    rb: readonly [number, number], region?: Region, far?: boolean) =>
    out.push({ id, kind: 'capsule', a, b, ra, rb, region, far });
  const ball = (id: string, a: V3, r: number, region?: Region, far?: boolean) =>
    out.push({ id, kind: 'ball', a, ra: R(r, r), region, far });

  // --- the trunk: ONE outline through four cross-sections, so the
  // rib cage flares, the waist narrows and nothing seams across it.
  // It is still three REGIONS for highlighting, which is why the
  // separate pelvis and chest lofts exist either side of the waist.
  const seg = (id: string, from: V3, to: V3, ra: readonly [number, number],
    rb: readonly [number, number], region: Region) => {
    out.push({
      id, kind: 'loft', a: from, b: to, region,
      ra, rb,
      stations: [
        { p: from, r: ra },
        { p: v.lerp(from, to, 0.5), r: [(ra[0] + rb[0]) / 2, (ra[1] + rb[1]) / 2] as const },
        { p: to, r: rb },
      ],
    });
  };
  seg('pelvis', s.pelvis, s.waist, GIRTH.pelvis, GIRTH.waist, 'glutes');
  seg('abdomen', s.waist, s.ribs, GIRTH.waist, GIRTH.ribs, 'abdomen');
  seg('chest', s.ribs, s.clavicle, GIRTH.ribs, GIRTH.clavicle, 'chest');
  cap('neck', v.lerp(s.clavicle, s.pelvis, 0.06), s.neckTop, R(3.4, 3.4), GIRTH.neck, 'neck');
  // The head is an ovoid, not a length of pipe: a short capsule whose
  // caps are most of it. A full-length capsule from neck to crown
  // draws a pill, and a pill is the single fastest way to make a
  // rendered figure look like a mannequin.
  const headDir = v.norm(v.sub(s.crown, s.neckTop));
  cap('head',
    v.add(s.neckTop, v.mul(headDir, 4.1)), v.add(s.neckTop, v.mul(headDir, 7.0)),
    R(4.0, 4.3), R(3.9, 4.1));

  // --- limbs. `far` is decided by the renderer from real depth, not guessed here.
  for (const side of ['l', 'r'] as const) {
    const p = (k: keyof Skeleton) => (s[k] as { l: V3; r: V3 })[side];
    ball(`delt-${side}`, p('shoulder'), GIRTH.deltoid, 'shoulder');
    cap(`uarm-${side}`, p('shoulder'), p('elbow'), GIRTH.upperArm, GIRTH.elbow, 'upperArm');
    cap(`farm-${side}`, p('elbow'), p('wrist'), GIRTH.elbow, GIRTH.wrist, 'foreArm');
    cap(`hand-${side}`, p('wrist'), p('hand'), GIRTH.wrist, GIRTH.hand, 'foreArm');
    ball(`hip-${side}`, p('hip'), GIRTH.hipBall, 'glutes');
    cap(`thigh-${side}`, p('hip'), p('knee'), GIRTH.thigh, GIRTH.knee, 'thigh');
    cap(`shin-${side}`, p('knee'), p('ankle'), GIRTH.knee, GIRTH.ankle, 'shin');
    cap(`foot-${side}`, p('ankle'), p('toe'), GIRTH.ankle, GIRTH.foot, 'shin');
  }
  return out;
}

/* ============================================================
   PROJECTION TO SVG

   The apparent half-width of an elliptical cross-section is the
   length of its projection onto the screen direction perpendicular
   to the limb. Solved rather than sampled:

     r = √( (w · (lat·n))² + (d · (front·n))² )

   where n is the screen-perpendicular expressed in world terms.
   The alternative — projecting four rim points and taking the
   largest — is off by up to 15% on a foreshortened limb, which on
   a thigh is visible as a limb that swells when the model turns.
   ============================================================ */

export interface ScreenShape {
  id: string;
  /** SVG path for a capsule, or null for a ball. */
  path: string | null;
  /** Ball geometry, in screen units. */
  circle?: { cx: number; cy: number; r: number };
  /** Painter's-algorithm key. Larger is nearer. */
  depth: number;
  /** Unit screen vector pointing from the shadow side to the lit side. */
  lit: readonly [number, number];
  /** 0 (facing away from the light) to 1 (straight at it). */
  key: number;
  region?: Region;
  /** True when the whole volume sits behind the trunk's centre plane. */
  far: boolean;
}

function crossSectionRadius(
  half: readonly [number, number], lat: V3, front: V3, nWorld: V3,
): number {
  const a = half[0] * v.dot(lat, nWorld);
  const b = half[1] * v.dot(front, nWorld);
  return Math.hypot(a, b);
}

/**
 * A chain of cross-sections as one closed outline: down one rim,
 * round the far cap, back up the other rim, round the near cap.
 *
 * Each station's apparent half-width is measured against the screen
 * perpendicular of the LOCAL axis, so a trunk that bends still has
 * the right width at every height.
 */
function loftToScreen(vol: Volume, s: Skeleton, cam: Camera, depthRef: number): ScreenShape {
  const st = vol.stations!;
  const proj = st.map((x) => project(x.p, cam));
  const left: Array<[number, number]> = [];
  const right: Array<[number, number]> = [];

  for (let i = 0; i < st.length; i++) {
    const prev = proj[Math.max(0, i - 1)];
    const next = proj[Math.min(proj.length - 1, i + 1)];
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const len = Math.hypot(dx, dy) || 1e-6;
    const n: readonly [number, number] = [-dy / len, dx / len];
    const r = crossSectionRadius(st[i].r, s.lateral, s.chestNormal, screenToWorldDir(n, cam)) * proj[i].k;
    left.push([proj[i].x + n[0] * r, proj[i].y + n[1] * r]);
    right.push([proj[i].x - n[0] * r, proj[i].y - n[1] * r]);
  }

  const capR = (i: number) => Math.hypot(left[i][0] - right[i][0], left[i][1] - right[i][1]) / 2;
  const last = st.length - 1;
  const d = [
    `M ${fmt(left[0][0])} ${fmt(left[0][1])}`,
    ...left.slice(1).map((q) => `L ${fmt(q[0])} ${fmt(q[1])}`),
    `A ${fmt(capR(last))} ${fmt(capR(last))} 0 0 0 ${fmt(right[last][0])} ${fmt(right[last][1])}`,
    ...right.slice(0, last).reverse().map((q) => `L ${fmt(q[0])} ${fmt(q[1])}`),
    `A ${fmt(capR(0))} ${fmt(capR(0))} 0 0 0 ${fmt(left[0][0])} ${fmt(left[0][1])}`,
    'Z',
  ].join(' ');

  const axis = v.norm(v.sub(st[last].p, st[0].p));
  const depth = proj.reduce((n, q) => n + q.z, 0) / proj.length;
  return {
    id: vol.id, path: d, depth, lit: litDir(axis), key: keyTerm(axis),
    region: vol.region, far: depth < depthRef,
  };
}

/**
 * Turns one volume into something SVG can draw. `lateral` and
 * `front` are the body's own axes, which is what lets an elliptical
 * cross-section rotate with the model instead of with the screen.
 */
export function toScreen(
  vol: Volume, s: Skeleton, cam: Camera, depthRef: number,
): ScreenShape {
  const pa = project(vol.a, cam);
  const front = s.chestNormal;
  const lat = s.lateral;

  if (vol.kind === 'loft' && vol.stations) {
    return loftToScreen(vol, s, cam, depthRef);
  }

  if (vol.kind === 'ball' || !vol.b) {
    const r = ((vol.ra[0] + vol.ra[1]) / 2) * pa.k;
    return {
      id: vol.id, path: null, circle: { cx: pa.x, cy: pa.y, r },
      // A ball has no axis, so the gradient simply follows the light.
      depth: pa.z, lit: litDir([0, 0, 0]), key: 0.7,
      region: vol.region, far: pa.z < depthRef,
    };
  }

  const pb = project(vol.b, cam);
  // Screen-space perpendicular to the limb, lifted back into world
  // space along the two axes the cross-section is expressed in.
  const dx = pb.x - pa.x;
  const dy = pb.y - pa.y;
  const len = Math.hypot(dx, dy) || 1e-6;
  const nScreen: readonly [number, number] = [-dy / len, dx / len];
  const nWorld = screenToWorldDir(nScreen, cam);

  const ra = crossSectionRadius(vol.ra, lat, front, nWorld) * pa.k;
  const rb = crossSectionRadius(vol.rb ?? vol.ra, lat, front, nWorld) * pb.k;

  const axis = v.norm(v.sub(vol.b, vol.a));
  return {
    id: vol.id,
    path: capsulePath([pa.x, pa.y], [pb.x, pb.y], ra * 2, rb * 2),
    depth: (pa.z + pb.z) / 2,
    lit: litDir(axis),
    key: keyTerm(axis),
    region: vol.region,
    far: (pa.z + pb.z) / 2 < depthRef,
  };
}

/**
 * The world direction a screen direction corresponds to.
 *
 * The camera rotation is orthonormal, so its inverse is its
 * transpose and a screen vector (nx, ny) lifts back to world space
 * as nx·row0 + ny·row1. Worth doing properly: sampling rim points
 * instead is off by up to 15% on a foreshortened limb, which reads
 * as a thigh that swells when the model turns.
 */
function screenToWorldDir(n: readonly [number, number], cam: Camera): V3 {
  const cy = Math.cos(cam.yaw * RAD);
  const sy = Math.sin(cam.yaw * RAD);
  const cp = Math.cos(cam.pitch * RAD);
  const sp = Math.sin(cam.pitch * RAD);
  const row0: V3 = [cy, 0, sy];
  const row1: V3 = [sy * sp, cp, -cy * sp];
  return v.norm(v.add(v.mul(row0, n[0]), v.mul(row1, n[1])));
}

/**
 * Where the light falls ACROSS a limb, in screen space: the part
 * of the light that is perpendicular to the limb's own axis. A
 * gradient along this vector is what turns a flat outline into a
 * cylinder, and taking the perpendicular is what stops the
 * gradient sliding lengthwise down an arm that happens to point
 * at the lamp.
 */
function litDir(axis: V3): readonly [number, number] {
  const along = v.dot(LIGHT, axis);
  const perp = v.sub(LIGHT, v.mul(axis, along));
  const p = project(perp, { ...CAMERA, dist: 1e9, origin: [0, 0], scale: 1 });
  const l = Math.hypot(p.x, p.y) || 1e-6;
  return [p.x / l, p.y / l];
}

/** How square-on to the light this volume sits, 0…1. Drives overall brightness. */
function keyTerm(axis: V3): number {
  const along = Math.abs(v.dot(LIGHT, axis));
  return 0.42 + (1 - along) * 0.5;
}

const fmt = (n: number): string => (Math.round(n * 100) / 100).toString();

/**
 * The same tapered capsule outline the 2D figure uses, and for the
 * same reason: the round caps of two segments that share a joint
 * radius land on each other exactly, so a bent knee is one
 * continuous leg rather than two tubes and a notch.
 */
export function capsulePath(
  a: readonly [number, number], b: readonly [number, number], wa: number, wb: number,
): string {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1e-4;
  const nx = -dy / len;
  const ny = dx / len;
  const ra = Math.max(wa, 0.2) / 2;
  const rb = Math.max(wb, 0.2) / 2;
  return [
    `M ${fmt(a[0] + nx * ra)} ${fmt(a[1] + ny * ra)}`,
    `L ${fmt(b[0] + nx * rb)} ${fmt(b[1] + ny * rb)}`,
    `A ${fmt(rb)} ${fmt(rb)} 0 0 0 ${fmt(b[0] - nx * rb)} ${fmt(b[1] - ny * rb)}`,
    `L ${fmt(a[0] - nx * ra)} ${fmt(a[1] - ny * ra)}`,
    `A ${fmt(ra)} ${fmt(ra)} 0 0 0 ${fmt(a[0] + nx * ra)} ${fmt(a[1] + ny * ra)}`,
    'Z',
  ].join(' ');
}

/**
 * The whole body, projected, depth sorted and ready to paint.
 * Far shapes come first so near ones cover them — a painter's
 * algorithm, which is exact here because the primitives are convex
 * and never interpenetrate at the same depth.
 */
export function renderBody(pose: Pose3D, cam: Camera = CAMERA): {
  shapes: ScreenShape[];
  skeleton: Skeleton;
  points: Record<string, Projected>;
} {
  const s = resolve3D(pose);
  const depthRef = project(s.pelvis, cam).z;
  const shapes = volumes(s)
    .map((vol) => toScreen(vol, s, cam, depthRef))
    .sort((p, q) => p.depth - q.depth);

  const points: Record<string, Projected> = {
    pelvis: project(s.pelvis, cam),
    chest: project(s.ribs, cam),
    head: project(s.crown, cam),
  };
  for (const side of ['l', 'r'] as const) {
    for (const j of ['shoulder', 'elbow', 'wrist', 'hand', 'hip', 'knee', 'ankle', 'toe'] as const) {
      points[`${j}-${side}`] = project((s[j] as { l: V3; r: V3 })[side], cam);
    }
  }
  return { shapes, skeleton: s, points };
}

/* ============================================================
   THE MOVEMENT

   Direction is DERIVED from the difference between two frames, in
   3D, exactly as the 2D system derives it in 2D (§ hard rule 5
   applied to a drawing). Nothing about which way a rep travels is
   stored, so it cannot go stale when a pose is corrected.
   ============================================================ */

/** Joints worth tracking, most telling first. */
const TRACKED = [
  'hand-r', 'hand-l', 'elbow-r', 'wrist-r', 'ankle-r', 'knee-r', 'shoulder-r', 'pelvis',
] as const;

export interface Motion3D {
  from: Projected;
  to: Projected;
  /** How far the joint travelled, in screen units. */
  travel: number;
}

const MIN_TRAVEL = 6;

export function motionBetween3D(
  from: Pose3D, to: Pose3D, cam: Camera = CAMERA,
): Motion3D | null {
  const a = renderBody(from, cam).points;
  const b = renderBody(to, cam).points;
  let best: Motion3D | null = null;
  for (const key of TRACKED) {
    const p = a[key];
    const q = b[key];
    if (!p || !q) continue;
    const travel = Math.hypot(q.x - p.x, q.y - p.y);
    if (travel > (best?.travel ?? MIN_TRAVEL)) best = { from: p, to: q, travel };
  }
  return best;
}

/**
 * A bowed arrow from where a joint was to where it is, pushed away
 * from the body so it reads as an annotation rather than a strap
 * lying across the model.
 */
export function arcArrow3D(
  m: Motion3D, centre: readonly [number, number], lift = 6,
): { path: string; tipAngle: number; tipX: number; tipY: number } {
  const ax = m.from.x;
  const ay = m.from.y;
  const bx = m.to.x;
  const by = m.to.y;
  const mx = (ax + bx) / 2;
  const my = (ay + by) / 2;
  let ox = mx - centre[0];
  let oy = my - centre[1];
  const ol = Math.hypot(ox, oy) || 1;
  ox /= ol; oy /= ol;
  // Bow the curve outward, then translate the whole arrow outward too.
  const cx = mx + ox * m.travel * 0.22 + ox * lift;
  const cy = my + oy * m.travel * 0.22 + oy * lift;
  const sx = ax + ox * lift;
  const sy = ay + oy * lift;
  const ex = bx + ox * lift;
  const ey = by + oy * lift;
  const tipAngle = (Math.atan2(ey - cy, ex - cx) * 180) / Math.PI;
  return {
    path: `M ${fmt(sx)} ${fmt(sy)} Q ${fmt(cx)} ${fmt(cy)} ${fmt(ex)} ${fmt(ey)}`,
    tipAngle, tipX: ex, tipY: ey,
  };
}

/** Where the figure sits on screen, for pushing annotations away from it. */
export function bodyCentre(points: Record<string, Projected>): readonly [number, number] {
  const p = points.pelvis;
  const c = points.chest;
  return [(p.x + c.x) / 2, (p.y + c.y) / 2];
}

/* ============================================================
   FRAMING

   Every drawing is auto-framed rather than hand-placed. Authoring
   a pose then hunting for a root position that happens to centre
   it is a waste of the one resource this system has — the time of
   whoever is writing the angles — and it goes wrong again the
   moment an angle changes.

   The fit is computed over EVERY frame of a drawing at once, so
   the model does not drift or resize between phases. A camera
   that re-centres each frame reads as a wobble, which on a
   two-frame loop looks like the figure is bouncing.
   ============================================================ */

export interface Bounds { minX: number; maxX: number; minY: number; maxY: number }

export function boundsOf(pts: readonly V3[], cam: Camera): Bounds {
  let minX = Infinity; let maxX = -Infinity; let minY = Infinity; let maxY = -Infinity;
  for (const p of pts) {
    const q = project(p, cam);
    if (q.x < minX) minX = q.x;
    if (q.x > maxX) maxX = q.x;
    if (q.y < minY) minY = q.y;
    if (q.y > maxY) maxY = q.y;
  }
  return { minX, maxX, minY, maxY };
}

/** Every point a fit should keep on screen: joints, plus the girth around them. */
export function fitPoints(pose: Pose3D): V3[] {
  const s = resolve3D(pose);
  const pts: V3[] = [s.pelvis, s.waist, s.ribs, s.clavicle, s.neckTop, s.crown];
  for (const side of ['l', 'r'] as const) {
    for (const j of ['shoulder', 'elbow', 'wrist', 'hand', 'hip', 'knee', 'ankle', 'toe'] as const) {
      pts.push((s[j] as { l: V3; r: V3 })[side]);
    }
  }
  return pts;
}

/**
 * A camera that puts `pts` inside `size` with `pad` to spare.
 *
 * Scale is capped: a movement whose extremes are close together —
 * a lateral raise — would otherwise be blown up until the model
 * is larger than every other exercise in the library, and twelve
 * demonstrations at twelve different sizes is not one product.
 */
export function fitCamera(
  pts: readonly V3[], base: Camera = CAMERA, size = 100, pad = 7, maxScale = 1.05,
): Camera {
  const probe: Camera = { ...base, scale: 1, origin: [0, 0] };
  const b = boundsOf(pts, probe);
  const w = Math.max(b.maxX - b.minX, 1);
  const h = Math.max(b.maxY - b.minY, 1);
  const scale = Math.min((size - pad * 2) / w, (size - pad * 2) / h, maxScale);
  // Re-measure at the chosen scale: weak perspective is not linear
  // in scale, so centring on the unscaled box drifts on deep poses.
  const scaled: Camera = { ...base, scale, origin: [0, 0] };
  const c = boundsOf(pts, scaled);
  return {
    ...base,
    scale,
    origin: [size / 2 - (c.minX + c.maxX) / 2, size / 2 - (c.minY + c.maxY) / 2],
  };
}

/** The floor plane, in world units. Everything stands on it. */
export const GROUND_Y = 91;
