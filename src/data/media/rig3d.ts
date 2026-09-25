/* ============================================================
   THE KIT — benches, bars, racks and cables, in the same 3D
   world as the body.

   Equipment is not decoration here. Half of what a beginner has
   to learn from a demonstration is WHERE THEY ARE: on a bench,
   under a bar, at a cable stack, hanging from something. The
   2D system solved that with flat glyphs behind the figure,
   which works until the figure has real depth and the scenery
   does not — then the person floats in front of a sticker.

   So the kit is built from the same primitives as the body, in
   world coordinates, from the SKELETON. A barbell is a tube
   through the model's two hands, not a line drawn at a remembered
   y. Correct the pose and the bar follows, because there is
   nothing to correct twice.

   Geometry only. No exercise names, no muscle names, nothing a
   gym could edit — so components import it directly (§21).
   ============================================================ */
import {
  BONE, GROUND_Y, v, type Skeleton, type V3,
} from './figure3d';

/** Which piece of the gym a drawing is set in. */
export type Rig =
  | 'bench_barbell'      // flat bench, bar in the hands
  | 'bench_incline'      // raked bench, a dumbbell in each hand
  | 'rack_standing'      // uprights behind, bar in the hands
  | 'free_dumbbells'     // a dumbbell in each hand, nothing else
  | 'free_barbell'       // a bar in the hands, nothing else
  | 'floor_barbell'      // lifting platform, loaded bar in the hands
  | 'pullup_bar'         // a bar overhead on two uprights
  | 'lat_tower'          // seat, thigh pad, high pulley, long bar
  | 'cable_high'         // one stack, high pulley, straight bar
  | 'cable_rope'         // one stack, high pulley, rope
  | 'cable_double';      // two stacks, a handle in each hand

export type Tone = 'steel' | 'load' | 'frame' | 'pad' | 'cable' | 'floor';

export type RigPart = (
  /** A round bar between two points. */
  | { t: 'tube'; a: V3; b: V3; r: number; tone: Tone }
  /** A weight plate or a pulley wheel: a disc facing along `axis`. */
  | { t: 'disc'; c: V3; axis: V3; r: number; thick: number; tone: Tone }
  /** A pad, a seat, a platform, a weight stack. */
  | { t: 'box'; c: V3; u: V3; w: V3; half: readonly [number, number, number]; tone: Tone }
  /** A cable. Drawn as a hairline, never shaded. */
  | { t: 'cable'; a: V3; b: V3; tone: Tone }
) & {
  /**
   * False for anything the framing may crop. A lifting platform is
   * 2m wide and a figure is not: including the floor in the fit
   * shrank every standing demonstration to two-thirds size to keep
   * scenery on screen that nobody is looking at.
   */
  fit?: boolean;
};

/* ---------------- small builders ---------------- */

const up: V3 = [0, -1, 0];

/** A loaded barbell through both hands, extended past them. */
function barbell(s: Skeleton, plateR = 5.2, plates = 2): RigPart[] {
  const axis = v.norm(v.sub(s.hand.r, s.hand.l));
  const mid = v.lerp(s.hand.l, s.hand.r, 0.5);
  const halfGrip = v.len(v.sub(s.hand.r, s.hand.l)) / 2;
  const end = halfGrip + 7;
  const a = v.add(mid, v.mul(axis, -end));
  const b = v.add(mid, v.mul(axis, end));
  const parts: RigPart[] = [{ t: 'tube', a, b, r: 0.85, tone: 'steel' }];
  for (let i = 0; i < plates; i++) {
    const off = halfGrip + 3.2 + i * 1.7;
    const r = plateR - i * 1.0;
    parts.push({ t: 'disc', c: v.add(mid, v.mul(axis, off)), axis, r, thick: 1.5, tone: 'load' });
    parts.push({ t: 'disc', c: v.add(mid, v.mul(axis, -off)), axis, r, thick: 1.5, tone: 'load' });
  }
  return parts;
}

/** A straight bar in both hands with no plates — a pulldown or a pushdown handle. */
function handleBar(s: Skeleton, overhang: number): RigPart[] {
  const axis = v.norm(v.sub(s.hand.r, s.hand.l));
  const mid = v.lerp(s.hand.l, s.hand.r, 0.5);
  const end = v.len(v.sub(s.hand.r, s.hand.l)) / 2 + overhang;
  return [{
    t: 'tube', a: v.add(mid, v.mul(axis, -end)), b: v.add(mid, v.mul(axis, end)),
    r: 0.8, tone: 'steel',
  }];
}

/** One dumbbell, lying along the axis the hand is gripping across. */
function dumbbell(at: V3, axis: V3): RigPart[] {
  const half = 3.4;
  const a = v.add(at, v.mul(axis, -half));
  const b = v.add(at, v.mul(axis, half));
  return [
    { t: 'tube', a, b, r: 0.75, tone: 'steel' },
    { t: 'disc', c: v.add(at, v.mul(axis, -half + 0.6)), axis, r: 2.9, thick: 2.2, tone: 'load' },
    { t: 'disc', c: v.add(at, v.mul(axis, half - 0.6)), axis, r: 2.9, thick: 2.2, tone: 'load' },
  ];
}

/** An upright column of the frame, from the floor. */
function upright(x: number, z: number, top: number, r = 1.2): RigPart {
  return { t: 'tube', a: [x, GROUND_Y, z], b: [x, top, z], r, tone: 'frame' };
}

/**
 * The floor pad every standing drawing gets, so the model is ON
 * something. Named arguments because a box's half-sizes run along
 * `u`, then the side axis, then `w` — which for an upright box is
 * height, depth, width, and is the wrong order to guess at.
 */
function platform(halfW: number, halfD: number, at: V3 = [0, GROUND_Y + 1, 0]): RigPart {
  return { t: 'box', c: at, u: up, w: [1, 0, 0], half: [1, halfD, halfW], tone: 'floor', fit: false };
}

/** A weight stack and the pulley above it. */
function stack(x: number, z: number, pulleyY: number): RigPart[] {
  return [
    upright(x, z, pulleyY - 2, 1.4),
    { t: 'box', c: [x, GROUND_Y - 11, z], u: up, w: [1, 0, 0], half: [11, 3, 3.6], tone: 'pad' },
    { t: 'disc', c: [x, pulleyY, z], axis: [0, 0, 1], r: 2.1, thick: 1.2, tone: 'steel' },
  ];
}

/* ============================================================
   THE RIGS
   ============================================================ */

export function buildRig(rig: Rig, s: Skeleton): RigPart[] {
  const lat = s.lateral;
  const mid = v.lerp(s.hand.l, s.hand.r, 0.5);

  switch (rig) {
    /* ---- flat bench, loaded bar ---- */
    case 'bench_barbell': {
      // The pad runs along the spine and sits just under the back.
      const spine = v.norm(v.sub(s.clavicle, s.pelvis));
      const padC = v.add(v.lerp(s.pelvis, s.clavicle, 0.45), v.mul(s.chestNormal, -6.4));
      return [
        { t: 'box', c: padC, u: spine, w: lat, half: [22, 1.9, 7.2], tone: 'pad' },
        { t: 'tube', a: v.add(padC, v.mul(spine, 15)), b: [padC[0] + spine[0] * 15, GROUND_Y, padC[2] + spine[2] * 15], r: 1.3, tone: 'frame' },
        { t: 'tube', a: v.add(padC, v.mul(spine, -15)), b: [padC[0] - spine[0] * 15, GROUND_Y, padC[2] - spine[2] * 15], r: 1.3, tone: 'frame' },
        ...barbell(s),
      ];
    }

    /* ---- raked bench, one dumbbell per hand ---- */
    case 'bench_incline': {
      const spine = v.norm(v.sub(s.clavicle, s.pelvis));
      const padC = v.add(v.lerp(s.pelvis, s.clavicle, 0.45), v.mul(s.chestNormal, -6.4));
      const foot = v.add(padC, v.mul(spine, -16));
      return [
        { t: 'box', c: padC, u: spine, w: lat, half: [20, 1.9, 7 ] , tone: 'pad' },
        { t: 'tube', a: foot, b: [foot[0], GROUND_Y, foot[2]], r: 1.4, tone: 'frame' },
        { t: 'tube', a: v.add(padC, v.mul(spine, 16)), b: [padC[0] + spine[0] * 8, GROUND_Y, padC[2] + spine[2] * 8], r: 1.4, tone: 'frame' },
        ...dumbbell(s.hand.l, s.frame.front),
        ...dumbbell(s.hand.r, s.frame.front),
      ];
    }

    /* ---- uprights behind the lifter, bar in the hands ---- */
    case 'rack_standing': {
      const back = v.mul(s.frame.front, -9);
      const x = BONE.shoulderHalf + 7;
      return [
        platform(20, 13),
        upright(-x + back[0], back[2], GROUND_Y - 66, 1.5),
        upright(x + back[0], back[2], GROUND_Y - 66, 1.5),
        { t: 'tube', a: [-x + back[0], GROUND_Y - 62, back[2]], b: [x + back[0], GROUND_Y - 62, back[2]], r: 0.7, tone: 'frame' },
        ...barbell(s),
      ];
    }

    case 'free_dumbbells':
      return [
        platform(18, 12),
        ...dumbbell(s.hand.l, s.frame.front),
        ...dumbbell(s.hand.r, s.frame.front),
      ];

    case 'free_barbell':
      return [platform(18, 12), ...barbell(s, 4.6, 2)];

    /* ---- a loaded bar that lives on the floor ---- */
    case 'floor_barbell':
      // Big enough to read as a loaded bar resting on the floor,
      // small enough not to become the drawing. A true-scale 45cm
      // plate is nearly a quarter of the figure's height and covers
      // the hips — which are the one thing a deadlift has to show.
      return [platform(26, 15), ...barbell(s, 6.8, 2)];

    /* ---- a bar to hang from ---- */
    case 'pullup_bar': {
      const y = Math.min(s.hand.l[1], s.hand.r[1]) - 0.6;
      const x = BONE.shoulderHalf + 16;
      const z = (s.hand.l[2] + s.hand.r[2]) / 2;
      return [
        upright(-x, z, y, 1.5),
        upright(x, z, y, 1.5),
        { t: 'tube', a: [-x, y, z], b: [x, y, z], r: 0.85, tone: 'steel' },
      ];
    }

    /* ---- seated, under a high pulley ---- */
    case 'lat_tower': {
      const seatY = s.pelvis[1] + 4.2;
      const back = s.pelvis[2] - 10;
      const pulleyY = s.clavicle[1] - 34;
      return [
        platform(22, 16),
        { t: 'box', c: [s.pelvis[0], seatY, s.pelvis[2]], u: up, w: [1, 0, 0], half: [1.8, 7, 8], tone: 'pad' },
        { t: 'tube', a: [s.pelvis[0], seatY + 2, s.pelvis[2]], b: [s.pelvis[0], GROUND_Y, s.pelvis[2]], r: 1.4, tone: 'frame' },
        // The thigh pad. It is the detail that says "seated, held down".
        {
          t: 'box',
          c: [(s.knee.l[0] + s.knee.r[0]) / 2, (s.knee.l[1] + s.knee.r[1]) / 2 - 5.5,
            (s.knee.l[2] + s.knee.r[2]) / 2],
          u: up, w: [1, 0, 0], half: [1.6, 3.4, 9], tone: 'pad',
        },
        upright(0, back, pulleyY - 3, 1.6),
        { t: 'tube', a: [-6, pulleyY - 3, back], b: [6, pulleyY - 3, back], r: 1, tone: 'frame' },
        { t: 'disc', c: [0, pulleyY, back], axis: [1, 0, 0], r: 2.2, thick: 1.4, tone: 'steel' },
        { t: 'cable', a: [0, pulleyY, back], b: mid, tone: 'cable' },
        ...handleBar(s, 7),
      ];
    }

    case 'cable_high':
    case 'cable_rope': {
      const x = 0;
      const z = s.pelvis[2] - 16;
      const pulleyY = s.clavicle[1] - 26;
      const parts: RigPart[] = [
        platform(20, 14),
        ...stack(x, z, pulleyY),
        { t: 'cable', a: [x, pulleyY, z], b: mid, tone: 'cable' },
      ];
      if (rig === 'cable_high') return [...parts, ...handleBar(s, 5)];
      // A rope: two short tails falling out of each fist.
      return [
        ...parts,
        { t: 'tube', a: mid, b: v.add(s.hand.l, v.mul(v.norm(v.sub(s.hand.l, mid)), 5)), r: 0.7, tone: 'steel' },
        { t: 'tube', a: mid, b: v.add(s.hand.r, v.mul(v.norm(v.sub(s.hand.r, mid)), 5)), r: 0.7, tone: 'steel' },
      ];
    }

    /* ---- a stack either side, a handle in each hand ---- */
    case 'cable_double': {
      const z = s.pelvis[2] - 8;
      const pulleyY = s.clavicle[1] - 4;
      const x = BONE.shoulderHalf + 22;
      return [
        platform(24, 14),
        ...stack(-x, z, pulleyY),
        ...stack(x, z, pulleyY),
        { t: 'cable', a: [-x, pulleyY, z], b: s.hand.l, tone: 'cable' },
        { t: 'cable', a: [x, pulleyY, z], b: s.hand.r, tone: 'cable' },
        { t: 'tube', a: s.hand.l, b: v.add(s.hand.l, v.mul(s.frame.front, 2.6)), r: 0.75, tone: 'steel' },
        { t: 'tube', a: s.hand.r, b: v.add(s.hand.r, v.mul(s.frame.front, 2.6)), r: 0.75, tone: 'steel' },
      ];
    }
  }
}

/** Every world point a rig occupies, so auto-framing can keep it on screen. */
export function rigPoints(parts: readonly RigPart[]): V3[] {
  const out: V3[] = [];
  for (const p of parts) {
    if (p.fit === false) continue;
    if (p.t === 'tube' || p.t === 'cable') { out.push(p.a, p.b); }
    else if (p.t === 'disc') { out.push(p.c); }
    else {
      // A box's eight corners, so a bench cannot poke out of frame.
      const sideAxis = v.norm(v.cross(p.u, p.w));
      for (const su of [-1, 1]) for (const sw of [-1, 1]) for (const ss of [-1, 1]) {
        out.push(v.add(p.c, v.add(
          v.mul(p.u, su * p.half[0]),
          v.add(v.mul(sideAxis, ss * p.half[1]), v.mul(p.w, sw * p.half[2])),
        )));
      }
    }
  }
  return out;
}
