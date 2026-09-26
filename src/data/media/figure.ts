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
/*
 * CANONICAL PROPORTIONS (§1).
 *
 * Measured against the RENDERED figure rather than guessed, and two
 * of them were out far enough to be the reason it read as a toy:
 *
 *            was      now     an athletic adult
 *   torso   0.325 H  0.316 H       0.288 H
 *   head +
 *   neck    0.225 H  0.199 H       0.182 H
 *
 * A big head on a long neck over short legs is the toy-figure
 * silhouette, and no amount of shading fixes it. The legs could not
 * grow — every pose stores a hip position and lengthening the leg puts
 * the feet through the floor — so the correction is in the two
 * segments above the hip, which move nothing below it.
 */
export const SEGMENTS = {
  spine: 23.5,
  neck: 4.6,
  upperArm: 13,
  foreArm: 13,
  thigh: 17,
  shin: 17,
  foot: 7,
} as const;

/** Head radius, in viewBox units. */
export const HEAD_RADIUS = 5.1;

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
  chest: 15.6,
  waist: 10.8,
  hipTop: 13.4,
  shoulder: 8.0,
  elbow: 5.8,
  wrist: 5,
  hand: 4.6,
  thighTop: 10.6,
  knee: 7,
  ankle: 4.6,
  foot: 4,
  neck: 6,
} as const;

/** Where the waist sits along the hip→shoulder line. */
export const WAIST_AT = 0.42;

/* ============================================================
   BODY PLANS — the same skeleton, seen from somewhere else (§15).

   `WIDTHS` above is a PROFILE: those numbers are the front-to-back
   depth of the body. Turn the figure to face us and every one of
   them is the wrong measurement — a rib cage is deeper than it is
   broad at the waist and broader than it is deep at the shoulders,
   and the two arms stop being on top of each other.

   A plan is three things:

     · WIDTHS for this viewpoint;
     · LATERAL OFFSETS — how far apart the two shoulders and the two
       hips are ON THE PAGE. Zero in profile, where one hides the
       other; full from the front;
     · LATERAL SHARE — how much of the page's horizontal axis is the
       body's left-right axis, which is what `mirrorAngle` needs and
       the only number that makes a front view's far limb correct.

   Nothing here is per exercise. A drawing names a view; the view
   supplies all of this; the drawing's ANGLES are untouched, which is
   why turning the bench press to three-quarters cost no re-authoring.
   ============================================================ */

/** The width table, as a plan carries it. */
export type BodyWidths = Readonly<Record<keyof typeof WIDTHS, number>>;

/** Breadth at each joint with the body facing us. */
export const FRONT_WIDTHS: BodyWidths = {
  chest: 19.2,
  waist: 12.0,
  hipTop: 14.2,
  shoulder: 8.2,
  elbow: 6.0,
  wrist: 4.4,
  hand: 5.2,
  thighTop: 10.2,
  knee: 6.9,
  ankle: 4.8,
  foot: 5.0,
  neck: 6.6,
} as const;

export interface BodyPlan {
  view: FigureView;
  widths: BodyWidths;
  /** Half the distance between the two shoulders, on the page. */
  shoulderHalf: number;
  /** Half the distance between the two hips, on the page. */
  hipHalf: number;
  /** 0 = the page's x axis is front-to-back, 1 = it is left-to-right. */
  lateralShare: number;
  /** Which muscle set faces the viewer. */
  facing: 'front' | 'side' | 'back';
  /** +1 when the body's front is toward screen-right. Profile only. */
  toward: 1 | -1;
}

function blend(t: number): BodyWidths {
  const out = {} as Record<keyof typeof WIDTHS, number>;
  for (const k of Object.keys(WIDTHS) as Array<keyof typeof WIDTHS>) {
    out[k] = FRONT_WIDTHS[k] + (WIDTHS[k] - FRONT_WIDTHS[k]) * t;
  }
  return out;
}

/**
 * The five viewpoints, and they are five rather than a continuous
 * dial on purpose: an exercise is composed for ONE angle that makes
 * it easiest to understand (§15), and a dial invites somebody to
 * pick 41° and get a figure nobody has ever looked at.
 */
/*
 * A NOTE ON `shoulderHalf`, WHICH WAS WRONG AND MATTERED.
 *
 * It used to be 7.0 from the front, against a chest half-width of
 * 8.7 — which put the shoulder JOINT nearly two units inside the rib
 * cage. Every arm therefore started behind the chest, and an arm that
 * folds (a back squat, a front rack, a curl at the top) came out as a
 * white slab lying across the torso rather than as an arm beside it.
 *
 * On a real body the acromion is OUTSIDE the rib cage: biacromial
 * breadth is about a quarter wider than chest breadth, which is the
 * proportion that makes a trained upper body read as one. So the
 * shoulders now sit outside the chest, and the three-quarter values
 * are the frontal ones scaled by the same cosine the widths are.
 */
export const PLANS: Record<FigureView, BodyPlan> = {
  side: {
    view: 'side', widths: WIDTHS, shoulderHalf: 0, hipHalf: 0,
    lateralShare: 0, facing: 'side', toward: 1,
  },
  three_quarter: {
    view: 'three_quarter', widths: blend(0.52), shoulderHalf: 7.0, hipHalf: 4.4,
    lateralShare: 0.62, facing: 'front', toward: 1,
  },
  front: {
    view: 'front', widths: FRONT_WIDTHS, shoulderHalf: 9.2, hipHalf: 6.0,
    lateralShare: 1, facing: 'front', toward: 1,
  },
  three_quarter_rear: {
    view: 'three_quarter_rear', widths: blend(0.52), shoulderHalf: 7.0, hipHalf: 4.4,
    lateralShare: 0.62, facing: 'back', toward: -1,
  },
  rear: {
    view: 'rear', widths: FRONT_WIDTHS, shoulderHalf: 9.2, hipHalf: 6.0,
    lateralShare: 1, facing: 'back', toward: -1,
  },
};

export function planFor(view: FigureView = 'side'): BodyPlan {
  return PLANS[view];
}


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
/** Picture-plane length of a limb segment, as a fraction of its own. */
export interface Foreshorten {
  upperArm?: number;
  foreArm?: number;
  thigh?: number;
  shin?: number;
}

/** Below this a segment is so short it reads as a missing limb. */
export const MIN_FORESHORTEN = 0.45;

export interface Pose {
  /** Root joint position in the 100×100 box. */
  hip: readonly [number, number];
  /**
   * THE LUMBAR SEGMENT: hip → waist. −90 is a fully upright low back.
   *
   * It used to be the whole torso, and `chest` below is why it is not
   * any more. Every drawing authored before that change still reads
   * correctly, because a pose with no `chest` is a straight spine and
   * a straight spine puts the shoulder exactly where one segment did.
   */
  spine: number;
  /**
   * THE THORACIC SEGMENT: waist → shoulder. Defaults to `spine`.
   *
   * One segment could not tell a hip hinge from a rounded back — the
   * only thing it could say was "the torso is at −125°", and whether
   * that torso was braced or folded was the reader's guess. Two can:
   *
   *   · `chest === spine`           a neutral, braced trunk;
   *   · `chest` ABOVE `spine`       thoracic extension, the chest
   *                                 lifted out of a hinge;
   *   · `chest` BELOW `spine`       flexion, the chest dropping —
   *                                 which is the single most common
   *                                 fault on a squat and a deadlift
   *                                 and was previously undrawable.
   *
   * The waist is at `WAIST_AT` along the trunk, so the pelvis rotates
   * with the lumbar segment and the rib cage with the thoracic one.
   * Every belly and contour in `musculature.ts` is attached to one or
   * the other, which is why the abdominal wall now folds at the waist
   * and the pectorals stay square to the ribs — with no extra data.
   */
  chest?: number;
  /**
   * FORESHORTENING: how much of each limb segment lies IN the picture
   * plane, as a fraction of its true length (§5, §10).
   *
   * An angle alone is half of a polar coordinate. The other half is
   * the length, and leaving it fixed says every limb is exactly
   * side-on to the camera — which is why a back squat's upper arms,
   * which genuinely point AWAY from a three-quarter viewer, drew at
   * full thirteen units and put the elbow at the navel. Unioned with
   * the forearm folding back over it, that is a paddle fifteen units
   * wide against a seventeen-unit chest, and no choice of angle fixes
   * it: the arm is too long because it is being drawn flat.
   *
   * So a drawing may shorten a segment. This is not a 3D model and
   * does not pretend to be one — it is the second number an
   * illustrator uses when a limb comes towards or goes away from the
   * viewer, and `validateContent` keeps it in a range where it stays
   * that rather than becoming a way to build a different person.
   *
   * Absent means 1: in the picture plane, full length, which is what
   * all 43 original drawings assume and continue to get.
   */
  short?: Foreshorten;
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
 * How a movement is timed between two frames.
 *
 *   `smooth`   slow at both ends — the default, and right for most
 *              controlled resistance work.
 *   `accel`    slow then fast: a drive out of the bottom.
 *   `decel`    fast then slow: arriving at a position under control.
 *   `settle`   overshoots a hair and comes back, which is what a
 *              loaded bar actually does at a lockout.
 *   `linear`   constant. For machines and cables, which genuinely
 *              do move at one speed.
 */
export type Ease = 'linear' | 'smooth' | 'accel' | 'decel' | 'settle';

/**
 * WHICH PLANE A LIMB PAIR'S DEVIATION LIES IN.
 *
 * This is the one fact a picture-plane angle genuinely cannot carry,
 * and leaving it out drew a squat as a lunge.
 *
 * A pose stores the angle a limb makes ON THE PAGE, which is why a
 * drawing can change camera without being re-authored. But the FAR
 * limb has to be derived, and how it is derived depends on which way
 * the near limb is really pointing in the body's own frame:
 *
 *   · `sagittal` — the deviation is FRONT-TO-BACK. A squat's knees
 *     both travel forward, a row's elbows both travel back. Seen from
 *     anywhere, the two limbs point the SAME way on the page, so the
 *     far one is a copy.
 *   · `frontal` — the deviation is SIDE-TO-SIDE. A lateral raise, a
 *     lat pulldown, a bench press's flared elbows. The two limbs are
 *     genuine mirror images, and from the front the far one has to be
 *     reflected or one arm points at the ceiling and the other at the
 *     floor.
 *
 * In profile the two are indistinguishable — `lateralShare` is 0, so
 * nothing is reflected either way — which is exactly why 30 drawings
 * authored from the side never had to care and still do not.
 */
export type LimbPlane = 'sagittal' | 'frontal';

/** The viewpoint a drawing is composed for (§15). */
export type FigureView =
  | 'side' | 'three_quarter' | 'front' | 'three_quarter_rear' | 'rear';

/** An incorrect position, with the reason it is wrong. */
export interface MistakeFrame {
  /**
   * What the error is called, in three or four words.
   *
   * It must name what the DRAWING shows. The trunk is two segments,
   * so it can raise a hip, drop a chest, lose thoracic extension or
   * stand up out of a hinge — but it still has no lumbar curve of its
   * own, so "rounded lower back" remains a label this picture cannot
   * honour. A label promising something the drawing does not contain
   * is worse than no drawing.
   */
  label: string;
  /** The wrong position, as a full pose. */
  pose: Pose;
  /** Why it matters. One sentence, no medical claims. */
  why: string;
  /**
   * Which frame it is the wrong version OF. Defaults to the working
   * position, which is right for a lockout error and wrong for a
   * setup one: a hinge shown beside a standing lockout is two
   * different moments, and the reader has to find the error AND work
   * out which instant they are being compared at.
   */
  at?: number;
}

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
   * How the body TRAVELS into this frame, and how much of the
   * frame's time budget that travel is allowed to take.
   *
   * A repetition is not three pictures (§10): the renderer
   * interpolates between frames, so every frame's `holdMs` is split
   * into a move and a dwell. `moveShare` is the fraction spent
   * moving — 0.78 on a controlled eccentric that should look slow,
   * 0.5 on a lockout that should look held.
   *
   * `ease` is what stops it looking robotic. A bar does not leave
   * the chest at full speed and it does not arrive at the top at
   * full speed either, and those are two DIFFERENT curves, which is
   * why this is per frame rather than per drawing.
   */
  ease?: Ease;
  moveShare?: number;
  /**
   * A SHAPING KEY: part of the movement, not a phase of it (§15).
   *
   * A repetition needs more keys than it has phases. Four keys down
   * and four up is what keeps a planted foot planted and a bar path
   * straight; four PHASE NAMES for the same descent is a timeline the
   * reader is being asked to operate, and §15 is explicit that the
   * keys must never be perceived as separate pictures.
   *
   * So a silent key contributes its pose and its time, and nothing
   * else: no label, no dot, no line in the phase strip. The caption
   * keeps naming the phase this key is part of, which is the one the
   * body is actually in the middle of.
   */
  silent?: boolean;
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
   * WHICH WAY THE BODY FACES THE VIEWER (§15).
   *
   * Pose angles are measured in the PICTURE PLANE, not against a
   * body axis, so they do not encode a viewpoint: `upperArm: 0` is
   * "arm out to the side" from the front and "arm forward" from the
   * side. That is what makes this one field enough to change the
   * camera — the angles are already right for whichever view the
   * drawing declares, and the view only decides how BROAD the body
   * is, where the two sides sit, and which muscles face us.
   *
   * Defaults to `side`, which is what all 43 original drawings were
   * authored as.
   */
  view?: FigureView;
  /**
   * Which plane each limb pair's deviation lies in (`LimbPlane`).
   *
   * Only consulted when the camera is turned — in profile both
   * answers draw the same picture. Sagittal by default, because that
   * is what a squat, a deadlift, a row, a curl and a pushdown all do,
   * and because the failure it prevents (a squat drawn as a lunge) is
   * much louder than the one it causes.
   */
  armPlane?: LimbPlane;
  legPlane?: LimbPlane;
  /**
   * Muscles that HOLD THE POSITION rather than produce the movement
   * (§9) — a squat's abdominal wall and spinal erectors, a deadlift's
   * grip and trapezius.
   *
   * On the DRAWING rather than on the exercise, because stabilising is
   * a property of the movement: every barbell squat braces the same
   * way regardless of which exercise row points at this picture.
   *
   * A third tier, at a third of the secondary weight. Anything already
   * named primary or secondary by the exercise is dropped, so the
   * hierarchy §8 asks for cannot be inverted by a drawing.
   */
  stabilisers?: readonly string[];
  /**
   * THE ARMS AND THE IMPLEMENT ARE BEHIND THE BODY (§12).
   *
   * A back squat is held across the upper back, and drawing it in
   * front of the chest is wrong twice over. The bar reads as a front
   * rack, and — worse — the near arm folds back on itself across the
   * torso and comes out as a paddle fifteen units wide against a
   * seventeen-unit chest.
   *
   * That second one is not a pose that can be fixed by choosing
   * better angles. THIS FIGURE HAS NO FORESHORTENING: a thirteen-unit
   * upper arm draws thirteen units long whether it points across the
   * picture or straight away from the viewer, so an arm that is
   * genuinely behind the body cannot be made shorter — it can only be
   * put where it belongs, which is behind the body.
   *
   * Depth by paint order, never by opacity: the whole grip assembly —
   * far arm, implement, near arm, both sets of fingers — is drawn
   * before the trunk, so the torso covers what it would really cover
   * and the forearms and fists emerge either side of the shoulders.
   * That is what a photograph of a back squat looks like.
   */
  gripBehind?: boolean;
  /**
   * Multiplies every duration. A curl should not move like a squat
   * (§19) and the difference is mostly overall tempo, so one number
   * per drawing covers most of it and the per-frame `ease` covers
   * the rest.
   */
  tempoScale?: number;
  /**
   * The classic way this movement goes wrong, as a pose (§22).
   *
   * Never part of the animation. It is shown in the teaching sheet
   * beside the correct position, because a mistake only makes sense
   * once you know the movement it is a mistake IN — and because a
   * demonstration that cycles through an incorrect position is a
   * demonstration teaching it.
   */
  mistake?: MistakeFrame;
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
  /** The lumbar/thoracic junction — where the trunk is allowed to bend. */
  waist: [number, number];
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
  /*
   * Two segments, and the split is at WAIST_AT so that a pose with no
   * `chest` lands the shoulder in exactly the place the single
   * 26-unit segment put it. That identity is the whole reason all 43
   * existing drawings survived gaining a spine joint untouched.
   */
  const waist = project(hip, pose.spine, SEGMENTS.spine * WAIST_AT);
  const shoulder = project(waist, chestOf(pose), SEGMENTS.spine * (1 - WAIST_AT));
  const head = project(shoulder, pose.neck, SEGMENTS.neck + HEAD_RADIUS);
  const f = pose.short;
  const elbow = project(shoulder, pose.upperArm, SEGMENTS.upperArm * (f?.upperArm ?? 1));
  const hand = project(elbow, pose.foreArm, SEGMENTS.foreArm * (f?.foreArm ?? 1));
  const knee = project(hip, pose.thigh, SEGMENTS.thigh * (f?.thigh ?? 1));
  const ankle = project(knee, pose.shin, SEGMENTS.shin * (f?.shin ?? 1));
  const toe = project(ankle, pose.foot, SEGMENTS.foot);
  return { hip, waist, shoulder, head, elbow, hand, knee, ankle, toe };
}

/** The thoracic angle, which defaults to a straight spine. */
export function chestOf(pose: Pose): number {
  return pose.chest ?? pose.spine;
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

/* ------------------------------------------------------------
   LOFTED LIMBS (§5).

   `limbPath` above is a linear taper, and a linear taper is a TUBE.
   A real thigh is widest a third of the way down and draws in above
   the knee; a real calf is widest high and lands on a thin ankle; an
   upper arm is widest at the deltoid and narrows into the elbow. None
   of that is expressible as "wide at one end, narrow at the other",
   and all of it is what the eye uses to decide whether it is looking
   at a leg or at a pipe.

   So a limb is lofted through cross-sections, exactly as the trunk
   is, with ONE addition: a cap apex beyond each end. That is what
   preserves the property the round caps were there for — adjacent
   segments share a width at the joint between them, so their two caps
   land on top of each other and the joint bends as one continuous
   piece of leg rather than showing a notch on the inside of the bend.

   The widths that matter most are the ones just before a joint. A
   limb that NARROWS into the joint and then flares at it is what makes
   a knee read as a knee instead of as the place two tubes meet.
   ------------------------------------------------------------ */

/** A limb's cross-sections: `u` along the bone, a width key, a scale. */
export type LimbProfile = ReadonlyArray<readonly [number, keyof BodyWidths, number]>;

export const THIGH_PROFILE: LimbProfile = [
  [0, 'thighTop', 1.0],
  [0.3, 'thighTop', 1.02],   // the quadriceps mass
  [0.62, 'thighTop', 0.86],
  [0.86, 'knee', 0.9],       // drawn in above the joint
  [1, 'knee', 1.0],          // and flaring at it
];

export const SHIN_PROFILE: LimbProfile = [
  [0, 'knee', 1.0],
  [0.16, 'knee', 0.97],
  [0.34, 'knee', 1.04],      // the calf
  [0.7, 'ankle', 1.2],
  [1, 'ankle', 1.0],
];

export const UPPERARM_PROFILE: LimbProfile = [
  [0, 'shoulder', 1.0],
  [0.2, 'shoulder', 1.02],   // the deltoid, and then the arm narrows
  [0.52, 'shoulder', 0.84],
  [0.86, 'elbow', 0.92],
  [1, 'elbow', 1.0],
];

export const FOREARM_PROFILE: LimbProfile = [
  [0, 'elbow', 1.0],
  [0.22, 'elbow', 1.08],     // the forearm belly, high and full
  [0.62, 'wrist', 1.1],
  [1, 'wrist', 1.0],
];

/**
 * A limb as one smooth closed outline through its cross-sections,
 * rounded at both ends.
 *
 * The apex points are what round the caps. Catmull-Rom flattens them
 * slightly, which is an improvement: a joint is not a perfect circle.
 */
export function limbLoft(
  a: Pt, b: Pt, widths: BodyWidths, profile: LimbProfile,
): string {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 0.0001;
  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy;
  const ny = ux;
  const left: Pt[] = [];
  const right: Pt[] = [];
  for (const [u, key, scale] of profile) {
    const h = (widths[key] * scale) / 2;
    const cx = a[0] + dx * u;
    const cy = a[1] + dy * u;
    left.push([cx + nx * h, cy + ny * h]);
    right.push([cx - nx * h, cy - ny * h]);
  }
  /*
   * The cap apex is clamped to a fraction of the segment's own drawn
   * length. A full half-width apex is right for a limb longer than it
   * is wide, and catastrophic for one that is not: a foreshortened
   * upper arm eight units long and nine wide grew to fifteen, and the
   * two caps rather than the arm were most of what got drawn.
   */
  const first = profile[0];
  const last = profile[profile.length - 1];
  const cap = (half: number) => Math.min(half, len * 0.38);
  const ha = cap((widths[first[1]] * first[2]) / 2);
  const hb = cap((widths[last[1]] * last[2]) / 2);
  const capB: Pt = [b[0] + ux * hb, b[1] + uy * hb];
  const capA: Pt = [a[0] - ux * ha, a[1] - uy * ha];
  return closedCurve([...left, capB, ...right.reverse(), capA], 0.5);
}

/**
 * The torso, in two tapered pieces so it narrows at the waist and
 * widens again into the chest. Kept because the muscle chart and
 * the region mapping are both authored against these two pieces;
 * the drawn silhouette is `trunkOutline` below.
 */
export function torsoPaths(p: FigurePoints, plan: BodyPlan = PLANS.side): [string, string] {
  const w = plan.widths;
  return [
    limbPath(p.hip, p.waist, w.hipTop, w.waist),
    limbPath(p.waist, p.shoulder, w.waist, w.chest),
  ];
}

/* ------------------------------------------------------------
   LOFTING — one closed outline through several cross-sections.

   Two tapered capsules end to end give a trunk with a visible seam
   across the middle of it and a straight-sided waist. A real trunk
   is a curve: the pelvis flares, the waist draws in, the ribs flare
   again and the shoulders cap it. That is five cross-sections, and
   drawing them as five primitives would put four seams across the
   body.

   So it is ONE path: up one side through every station, round the
   top, down the other side, closed. Catmull-Rom through the stations
   converted to cubic Béziers, which is what makes the profile read
   as a body rather than a polygon.
   ------------------------------------------------------------ */

/** Smooth closed path through points, Catmull-Rom → cubic. */
export function closedCurve(pts: readonly Pt[], tension = 0.5): string {
  const n = pts.length;
  if (n < 3) return '';
  const at = (i: number) => pts[(i + n) % n];
  let d = `M ${fmt(pts[0][0])} ${fmt(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const k = tension / 3;
    d += ` C ${fmt(p1[0] + (p2[0] - p0[0]) * k)} ${fmt(p1[1] + (p2[1] - p0[1]) * k)}`
      + ` ${fmt(p2[0] - (p3[0] - p1[0]) * k)} ${fmt(p2[1] - (p3[1] - p1[1]) * k)}`
      + ` ${fmt(p2[0])} ${fmt(p2[1])}`;
  }
  return `${d} Z`;
}

/**
 * Where a trunk cross-section sits, and how wide it is.
 *
 * `u` is on the trunk's ORIGINAL straight parameterisation — 0 at the
 * hip joint, 1 at the shoulder — so these numbers did not change when
 * the spine gained a second segment. `trunkAt` is what turns a `u`
 * into a place on a trunk that may be folded at the waist.
 *
 * Eight stations rather than five, because a bend needs stations on
 * both sides of it: three points through a 30° fold is a polygon with
 * the corner at the waist, and the corner is the first thing the eye
 * finds.
 */
const TRUNK_STATIONS: ReadonlyArray<readonly [number, keyof BodyWidths, number]> = [
  [-0.07, 'hipTop', 0.84],   // under the seat
  [0.08, 'hipTop', 1.0],     // the hip joints — widest point below the ribs
  [0.24, 'hipTop', 0.96],    // iliac crest
  [0.42, 'waist', 1.0],      // waist: where the two segments meet
  [0.58, 'waist', 1.06],     // just above it, already flaring
  [0.78, 'chest', 0.99],     // lower ribs — the widest point of the ribcage
  [0.9, 'chest', 0.97],
  /*
   * ...and then a DOME over the top, not a flat lid.
   *
   * The outline used to stop at u = 1 and turn straight across, which
   * puts a 90° corner at each end of the shoulder line — two spikes
   * sticking out past the deltoids like epaulettes. It reads as
   * armour, and it was the loudest remaining tell that this was a
   * diagram: nothing on a body has a corner.
   *
   * Carrying the stations PAST the shoulder joint is also anatomy.
   * The joint is not the top of the body — the trapezius rises above
   * it into the neck, which is exactly what these two stations are.
   */
  [1.0, 'chest', 0.86],      // the acromion line
  [1.07, 'chest', 0.6],      // the trapezius shelf
  [1.13, 'chest', 0.28],     // and into the neck
];

/** The trunk's two segments as page geometry, with their normals. */
export interface SpineAxis {
  hip: Pt;
  waist: Pt;
  shoulder: Pt;
  lower: { ux: number; uy: number; nx: number; ny: number; len: number };
  upper: { ux: number; uy: number; nx: number; ny: number; len: number };
}

function segOf(a: Pt, b: Pt) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 0.0001;
  const ux = dx / len;
  const uy = dy / len;
  // +n is ANTERIOR in profile, the viewer's right from the front — the
  // same convention `musculature.ts` authors every belly against.
  return { ux, uy, nx: -uy, ny: ux, len };
}

export function spineAxis(p: FigurePoints): SpineAxis {
  return {
    hip: p.hip, waist: p.waist, shoulder: p.shoulder,
    lower: segOf(p.hip, p.waist),
    upper: segOf(p.waist, p.shoulder),
  };
}

/** How far either side of the waist the two normals are blended. */
const WAIST_BLEND = 0.17;

/**
 * A point on the trunk, and which way "across" is there.
 *
 * Position is piecewise and continuous, which needs no care. The
 * NORMAL does: swapping it at the waist puts a notch in the
 * silhouette exactly where the eye is looking for a waist, so it is
 * blended across a band. The result is a crease rather than a corner,
 * which is what a folded trunk actually shows.
 */
export function trunkAt(sa: SpineAxis, u: number): { c: Pt; nx: number; ny: number } {
  const lo = sa.lower;
  const up = sa.upper;
  const c: Pt = u <= WAIST_AT
    ? [sa.hip[0] + lo.ux * lo.len * (u / WAIST_AT),
      sa.hip[1] + lo.uy * lo.len * (u / WAIST_AT)]
    : [sa.waist[0] + up.ux * up.len * ((u - WAIST_AT) / (1 - WAIST_AT)),
      sa.waist[1] + up.uy * up.len * ((u - WAIST_AT) / (1 - WAIST_AT))];
  const t = (u - (WAIST_AT - WAIST_BLEND)) / (2 * WAIST_BLEND);
  const k = t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t);
  const nx = lo.nx + (up.nx - lo.nx) * k;
  const ny = lo.ny + (up.ny - lo.ny) * k;
  const l = Math.hypot(nx, ny) || 1;
  return { c, nx: nx / l, ny: ny / l };
}

/**
 * The drawn trunk: hip to shoulder as one smooth silhouette, folded
 * at the waist if the pose folds there.
 *
 * The station list runs slightly PAST the hip joint (−0.07) because
 * the hip joint is inside the body, not at the bottom of it — ending
 * the outline exactly there cuts the seat off a hinged figure and is
 * the single most obvious tell that a drawing is a diagram.
 *
 * ONE path, still. Drawing the pelvis and the rib cage as two shapes
 * would give each of them its own contour across the middle of the
 * body, which is the "pile of tubes" the loft exists to avoid. What
 * separates them is the iliac crest and the costal arch in
 * `musculature.ts` — lines on one body, not two bodies.
 */
export function trunkOutline(p: FigurePoints, plan: BodyPlan = PLANS.side): string {
  const w = plan.widths;
  const sa = spineAxis(p);
  const left: Pt[] = [];
  const right: Pt[] = [];
  for (const [u, key, scale] of TRUNK_STATIONS) {
    const { c, nx, ny } = trunkAt(sa, u);
    const h = (w[key] * scale) / 2;
    left.push([c[0] + nx * h, c[1] + ny * h]);
    right.push([c[0] - nx * h, c[1] - ny * h]);
  }
  return closedCurve([...left, ...right.reverse()], 0.58);
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
export function footPath(p: FigurePoints, plan: BodyPlan = PLANS.side): string {
  const dx = p.toe[0] - p.ankle[0];
  const dy = p.toe[1] - p.ankle[1];
  const len = Math.hypot(dx, dy) || 0.0001;
  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy;
  const ny = ux;
  const h = plan.widths.foot / 2;
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
 * WHY THIS NEEDED THE VIEW.
 *
 * In three dimensions the far limb does the mirror image of the near
 * one about the body's own front-to-back plane. What that looks like
 * on the page depends entirely on where we are standing:
 *
 *   · from the SIDE that plane is the page, so the far limb lands
 *     almost exactly on top of the near one. A few degrees of offset
 *     is all that separates them, which is what the original
 *     `mirror` rule did;
 *   · from the FRONT that plane is vertical on the page, so the far
 *     limb is the REFLECTION of the near one. A lateral raise seen
 *     from the front with both arms nudged 7° clockwise has one arm
 *     raised and one arm pointing at the floor;
 *   · from three-quarters it is somewhere in between.
 *
 * `lateralShare` is what "in between" means: the fraction of the
 * screen's horizontal axis that is genuinely the body's left-right
 * axis. Scaling the horizontal component of a limb's direction by
 * (1 − 2·share) reflects exactly that fraction of it, which
 * degrades correctly to both ends — identity at 0, a full reflection
 * at 1 — and needs no special cases.
 */
export function mirrorAngle(deg: number, lateralShare: number): number {
  const rad = (deg * Math.PI) / 180;
  const x = Math.cos(rad) * (1 - 2 * lateralShare);
  const y = Math.sin(rad);
  return (Math.atan2(y, x) * 180) / Math.PI;
}

/** Which plane each limb pair moves in. Sagittal unless a drawing says. */
export interface LimbPlanes {
  arm: LimbPlane;
  leg: LimbPlane;
}

export const SAGITTAL: LimbPlanes = { arm: 'sagittal', leg: 'sagittal' };

export function planesOf(drawing: MovementDrawing): LimbPlanes {
  return {
    arm: drawing.armPlane ?? 'sagittal',
    leg: drawing.legPlane ?? 'sagittal',
  };
}

export function farSideOf(
  pose: Pose, symmetry: Symmetry, partner?: Pose, plan: BodyPlan = PLANS.side,
  planes: LimbPlanes = SAGITTAL,
): Pose {
  /*
   * A limb is reflected only to the extent that its deviation is
   * genuinely side-to-side. A sagittal limb is never reflected, at any
   * camera angle, because from every camera angle both of them point
   * the same way — which is why a squat's two thighs must stay
   * parallel and a lateral raise's two arms must not.
   */
  const armShare = planes.arm === 'frontal' ? plan.lateralShare : 0;
  const legShare = planes.leg === 'frontal' ? plan.lateralShare : 0;
  const flipArm = (a: number) => mirrorAngle(a, armShare);
  const flipLeg = (a: number) => mirrorAngle(a, legShare);
  const flip = flipArm;

  if (symmetry === 'gait' && partner) {
    // The other half of the stride, hung off THIS frame's hip so the
    // body does not tear in two.
    return {
      ...partner, hip: pose.hip, spine: pose.spine, chest: chestOf(pose), neck: pose.neck,
      upperArm: flipArm(partner.upperArm), foreArm: flipArm(partner.foreArm),
      thigh: flipLeg(partner.thigh), shin: flipLeg(partner.shin),
      foot: flipLeg(partner.foot),
    };
  }
  if (symmetry === 'single') {
    // One-sided work: the far arm hangs off the torso, the far leg
    // matches, because that is what the other side is actually doing.
    return {
      ...pose,
      upperArm: flip(chestOf(pose) + 172), foreArm: flip(chestOf(pose) + 176),
      thigh: flipLeg(pose.thigh), shin: flipLeg(pose.shin), foot: flipLeg(pose.foot),
    };
  }
  /*
   * The nudge is depth separation, not movement, so it shrinks as
   * the reflection takes over: from the front the two sides ARE
   * symmetrical and offsetting one of them by 7° is simply an error
   * in the drawing.
   */
  const d = 1 - plan.lateralShare;
  return {
    ...pose,
    upperArm: flipArm(pose.upperArm) + 7 * d,
    foreArm: flipArm(pose.foreArm) + 8 * d,
    thigh: flipLeg(pose.thigh) + 7 * d,
    shin: flipLeg(pose.shin) - 5 * d,
    foot: flipLeg(pose.foot) + 4 * d,
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

/**
 * Which PHASE a key belongs to: itself, or the last named key before
 * it. Silent keys always follow the phase they are part of, never
 * precede it, or a descent would be captioned with the phase the body
 * has already left.
 */
export function phaseIndexOf(frames: readonly PatternFrame[], i: number): number {
  for (let k = i; k >= 0; k--) {
    if (!frames[k].silent) return k;
  }
  return 0;
}

/** The indices that are phases — everything the reader is shown. */
export function namedFrames(frames: readonly PatternFrame[]): number[] {
  const out: number[] = [];
  frames.forEach((f, i) => { if (!f.silent) out.push(i); });
  return out.length > 0 ? out : [0];
}

/** The frame the repetition is "at" — the held one, unless a drawing says otherwise. */
export function effortIndex(drawing: MovementDrawing): number {
  if (drawing.effortFrame != null) return drawing.effortFrame;
  let best = 0;
  let bestHold = -1;
  drawing.frames.forEach((f, i) => {
    // A shaping key is never the working position: it exists to make
    // the travel smooth, and it carries no label to put on a thumbnail.
    if (f.silent) return;
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

/* ============================================================
   SIDES — where the two halves of the body sit on the page.

   In profile they sit on top of each other, which is why the
   original renderer could put both limbs on the same joint and be
   right. Turn the figure and they separate: the shoulders are ~20
   units apart from the front, the hips ~18.

   Offsetting the CHAIN rather than re-posing it keeps the angles
   honest — the far arm is still the far arm's pose, just translated
   to the far shoulder, so a correction to the pose still fixes both
   sides at once.
   ============================================================ */

/** The near/far x-shift for a limb chain, per plan. */
export function sideShift(plan: BodyPlan, side: 'near' | 'far'): { arm: number; leg: number } {
  const s = side === 'near' ? 1 : -1;
  return { arm: s * plan.shoulderHalf, leg: s * plan.hipHalf };
}

/**
 * The same resolved joints, with the arm and leg chains moved out to
 * their own side of the body. The trunk, neck and head stay on the
 * midline: there is only one of each.
 */
export function offsetSide(
  pts: FigurePoints, plan: BodyPlan, side: 'near' | 'far',
): FigurePoints {
  const { arm, leg } = sideShift(plan, side);
  if (arm === 0 && leg === 0) return pts;
  const mv = (p: [number, number], dx: number): [number, number] => [p[0] + dx, p[1]];
  return {
    hip: pts.hip,
    waist: pts.waist,
    shoulder: mv(pts.shoulder, arm),
    head: pts.head,
    elbow: mv(pts.elbow, arm),
    hand: mv(pts.hand, arm),
    knee: mv(pts.knee, leg),
    ankle: mv(pts.ankle, leg),
    toe: mv(pts.toe, leg),
  };
}

/* ============================================================
   CONTINUOUS MOTION (§10, §11, §19).

   A repetition is not frame 1 → frame 2 → frame 3. Three stills
   shown in sequence tell you the positions and nothing about the
   movement: no direction while it is between them, no tempo, no
   sense that one phase is controlled and another is a drive.

   So the frames are KEYS and the renderer interpolates. Two things
   make that read as a person rather than a slideshow:

     · EASING. `smooth` on a controlled phase, `accel` on a drive out
       of the bottom, `decel` arriving at a position, `settle` at a
       lockout where a loaded bar genuinely overshoots and comes
       back. Linear interpolation between poses is the single thing
       that makes an animated figure look like a machine.
     · A DWELL. Real repetitions pause, briefly, at the end of the
       range. `moveShare` splits each frame's time budget between
       travelling there and being there.

   Angles interpolate the SHORT way round. Without that, a forearm
   going from 175° to −175° — ten degrees of real movement — swings
   350° through the body.
   ============================================================ */

/** Shortest-path angle interpolation, in degrees. */
export function lerpAngle(a: number, b: number, t: number): number {
  let d = (b - a) % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return a + d * t;
}

/** Interpolated foreshortening. Absent counts as 1, on both sides. */
function lerpShort(a?: Foreshorten, b?: Foreshorten, t = 0): Foreshorten | undefined {
  if (!a && !b) return undefined;
  const at = (k: keyof Foreshorten) => (a?.[k] ?? 1) + ((b?.[k] ?? 1) - (a?.[k] ?? 1)) * t;
  return {
    upperArm: at('upperArm'), foreArm: at('foreArm'),
    thigh: at('thigh'), shin: at('shin'),
  };
}

export function lerpPose(a: Pose, b: Pose, t: number): Pose {
  return {
    short: lerpShort(a.short, b.short, t),
    hip: [a.hip[0] + (b.hip[0] - a.hip[0]) * t, a.hip[1] + (b.hip[1] - a.hip[1]) * t],
    spine: lerpAngle(a.spine, b.spine, t),
    chest: lerpAngle(chestOf(a), chestOf(b), t),
    neck: lerpAngle(a.neck, b.neck, t),
    upperArm: lerpAngle(a.upperArm, b.upperArm, t),
    foreArm: lerpAngle(a.foreArm, b.foreArm, t),
    thigh: lerpAngle(a.thigh, b.thigh, t),
    shin: lerpAngle(a.shin, b.shin, t),
    foot: lerpAngle(a.foot, b.foot, t),
  };
}

export function applyEase(t: number, ease: Ease): number {
  const x = t < 0 ? 0 : t > 1 ? 1 : t;
  switch (ease) {
    case 'linear': return x;
    case 'accel': return x * x;
    case 'decel': return 1 - (1 - x) * (1 - x);
    case 'settle': {
      // One small overshoot and back. A loaded bar does this; a
      // spring with three oscillations does not, and reads as a toy.
      const c = 1.42;
      return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2);
    }
    default: return x * x * (3 - 2 * x);
  }
}

interface Step {
  from: number;
  to: number;
  /** Timeline ms at which the travel into `to` begins. */
  start: number;
  move: number;
  dwell: number;
  ease: Ease;
}

export interface Timeline {
  steps: Step[];
  total: number;
}

/** Default share of a frame's budget spent travelling into it. */
const MOVE_SHARE = 0.72;

/**
 * The loop, in milliseconds.
 *
 * A frame's `holdMs` was already "how long this position is worth",
 * so it becomes that frame's whole budget rather than a new field
 * nobody would remember to set. Every one of the 43 existing
 * drawings therefore animates continuously without being touched.
 */
export function buildTimeline(drawing: MovementDrawing): Timeline {
  const n = drawing.frames.length;
  const scale = drawing.tempoScale ?? 1;
  const steps: Step[] = [];
  let at = 0;
  for (let i = 0; i < n; i++) {
    const f = drawing.frames[i];
    const budget = (f.holdMs ?? 700) * scale;
    const share = f.moveShare ?? MOVE_SHARE;
    const move = budget * share;
    const dwell = budget - move;
    steps.push({
      from: (i - 1 + n) % n, to: i, start: at,
      move, dwell, ease: f.ease ?? 'smooth',
    });
    at += budget;
  }
  return { steps, total: at || 1 };
}

export interface Sample {
  pose: Pose;
  /** The frame being travelled towards — the one the caption names. */
  index: number;
  /** 0 while travelling, 1 once the position is reached and held. */
  settled: number;
}

export function sampleTimeline(
  drawing: MovementDrawing, tl: Timeline, ms: number,
): Sample {
  const t = ((ms % tl.total) + tl.total) % tl.total;
  let step = tl.steps[tl.steps.length - 1];
  for (const s of tl.steps) {
    if (t >= s.start && t < s.start + s.move + s.dwell) { step = s; break; }
  }
  const local = t - step.start;
  const a = drawing.frames[step.from].pose;
  const b = drawing.frames[step.to].pose;
  if (local >= step.move) {
    return { pose: b, index: step.to, settled: 1 };
  }
  const raw = step.move > 0 ? local / step.move : 1;
  return {
    pose: lerpPose(a, b, applyEase(raw, step.ease)),
    index: step.to,
    settled: 0,
  };
}

/* ============================================================
   THE MOVEMENT PATH (§14).

   An arrowhead the size of a hand says "this way" and nothing else.
   What a beginner actually needs is the RANGE: how far the bar
   travels, and along what line. So the path is the real trajectory
   of the joint that moves most, sampled right around the loop.

   Derived, never stored — hard rule 5. Adjust a pose and the path
   moves with it, because it is the same numbers.
   ============================================================ */

/**
 * How much a joint's travel is WORTH, as opposed to how far it is.
 *
 * Raw distance picks the wrong joint on a squat: the shoulder drops
 * further than the hip does, so the path ends up drawn across the
 * chest and the head, describing the least interesting thing about
 * the movement. What a beginner is told about a squat is where the
 * HIPS go. The bias is small — a joint that genuinely dominates still
 * wins — and it encodes what the drawing is for rather than what the
 * arithmetic happens to favour.
 */
const TRAVEL_WEIGHT: Record<JointName, number> = {
  hand: 1.25, knee: 1.05, elbow: 1.0, ankle: 1.0,
  hip: 0.95, toe: 0.9, shoulder: 0.7, waist: 0.6, head: 0.5,
};

/** Which joint the path should follow. */
export function travelJoint(drawing: MovementDrawing): JointName | null {
  const totals = new Map<JointName, number>();
  const n = drawing.frames.length;
  if (n < 2) return null;
  for (let i = 0; i < n; i++) {
    const a = resolvePose(drawing.frames[i].pose);
    const b = resolvePose(drawing.frames[(i + 1) % n].pose);
    for (const j of TRACKABLE) {
      const d = Math.hypot(b[j][0] - a[j][0], b[j][1] - a[j][1]);
      totals.set(j, (totals.get(j) ?? 0) + d);
    }
  }
  /*
   * A hand that is HELD AGAINST THE SHOULDER and travels exactly as
   * far as it does is being carried, not working. That is a back
   * squat: the bar sits on the shoulders, so the hand's path is the
   * torso's path, and drawing it puts a line across the face
   * describing the least interesting thing about the movement. What a
   * beginner is told about a squat is where the hips go.
   *
   * Both halves of the test are needed. A deadlift's hands also
   * travel exactly as far as its shoulders — straight arms are rigid
   * hangers — but they are two feet below them holding the bar, and
   * the bar path is the single most useful line in the drawing.
   */
  const near = drawing.frames.every((f) => {
    const q = resolvePose(f.pose);
    return Math.hypot(q.hand[0] - q.shoulder[0], q.hand[1] - q.shoulder[1]) < 12;
  });
  const hands = totals.get('hand') ?? 0;
  const shoulders = totals.get('shoulder') ?? 0;
  const skip = new Set<JointName>();
  if (near && shoulders > MIN_TRAVEL && Math.abs(hands - shoulders) < shoulders * 0.25) {
    skip.add('hand');
    skip.add('elbow');
  }

  let best: JointName | null = null;
  let bestScore = MIN_TRAVEL;
  for (const j of TRACKABLE) {
    if (skip.has(j)) continue;
    const score = (totals.get(j) ?? 0) * TRAVEL_WEIGHT[j];
    if (score > bestScore + 0.001) { best = j; bestScore = score; }
  }
  return best;
}

/**
 * The trajectory as a polyline, sampled over one full loop.
 *
 * Returned as points rather than a path so the renderer can taper
 * it, fade its returning half and put a marker at the working end —
 * a movement path that is one uniform stroke is an arrow drawn the
 * long way round.
 */
export function trajectory(
  drawing: MovementDrawing, joint: JointName, samples = 26,
): Array<[number, number]> {
  const tl = buildTimeline(drawing);
  const out: Array<[number, number]> = [];
  for (let i = 0; i <= samples; i++) {
    const s = sampleTimeline(drawing, tl, (tl.total * i) / samples);
    out.push(resolvePose(s.pose)[joint]);
  }
  return out;
}

/** An open smooth path through points. */
export function openCurve(pts: ReadonlyArray<readonly [number, number]>): string {
  if (pts.length < 2) return '';
  let d = `M ${fmt(pts[0][0])} ${fmt(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    d += ` C ${fmt(p1[0] + (p2[0] - p0[0]) / 6)} ${fmt(p1[1] + (p2[1] - p0[1]) / 6)}`
      + ` ${fmt(p2[0] - (p3[0] - p1[0]) / 6)} ${fmt(p2[1] - (p3[1] - p1[1]) / 6)}`
      + ` ${fmt(p2[0])} ${fmt(p2[1])}`;
  }
  return d;
}

/* ============================================================
   FRAMING (§17).

   Every drawing is authored in the same 100×100 box, and most of
   them use about half of it. On a 180px stage that is a person
   occupying 90px with 90px of empty paper around them — which is
   exactly the complaint that the visual does not teach: you cannot
   see a knuckle at that size because it is a pixel and a half.

   So the box the SVG actually shows is computed from the drawing:
   every joint of every frame of both sides, plus the implement,
   padded and squared. Computed over ALL frames at once, never per
   frame, or the figure would grow and shrink as it moved.

   Scenery is deliberately NOT included. A squat rack is 80 units
   tall and framing to it puts the person back where they started.
   ============================================================ */

export interface FitBox { x: number; y: number; size: number }

export function fitBoxOf(
  points: ReadonlyArray<readonly [number, number]>,
  pad = 7, floor?: number,
): FitBox {
  if (points.length === 0) return { x: 0, y: 0, size: 100 };
  let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  if (floor != null && floor > maxY) maxY = floor;
  minX -= pad; minY -= pad; maxX += pad; maxY += pad;
  // Square, because the stage is square and a non-square viewBox
  // would letterbox differently for every drawing.
  const size = Math.max(maxX - minX, maxY - minY, 24);
  return {
    x: minX - (size - (maxX - minX)) / 2,
    y: minY - (size - (maxY - minY)) / 2,
    size,
  };
}

export function viewBoxOf(box: FitBox): string {
  return `${fmt(box.x)} ${fmt(box.y)} ${fmt(box.size)} ${fmt(box.size)}`;
}

/** Every joint of one pose, both sides, as bare points. */
export function posePoints(pose: Pose, plan: BodyPlan, far: Pose): Array<[number, number]> {
  const near = offsetSide(resolvePose(pose), plan, 'near');
  const off = offsetSide(resolvePose(far), plan, 'far');
  return [...Object.values(near), ...Object.values(off)] as Array<[number, number]>;
}

/* ============================================================
   LIGHT (§7, §18).

   ONE direction for the whole library. Consistency is the entire
   point: a figure lit from the left beside a figure lit from the
   right looks like two products, and the shading stops reading as
   form and starts reading as decoration.

   Upper left and slightly toward the viewer, which is where a
   photographer would put a key light and where every anatomy plate
   since the sixteenth century has put it.
   ============================================================ */
export const LIGHT: readonly [number, number] = [-0.5, -0.866];

/**
 * Where a rounded volume's gradient starts and ends.
 *
 * The gradient runs ACROSS the bone, not along it, because that is
 * the axis a cylinder turns away from the light on. The lit end is
 * whichever side of the bone faces the lamp, worked out per volume
 * per frame — which is what makes a limb that swings overhead
 * relight itself instead of carrying a shadow painted on it.
 */
export function shadeAxis(
  a: Pt, b: Pt, half: number,
): { x1: number; y1: number; x2: number; y2: number } {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 0.0001;
  let nx = -dy / len;
  let ny = dx / len;
  // Point the normal at the light.
  if (nx * LIGHT[0] + ny * LIGHT[1] > 0) { nx = -nx; ny = -ny; }
  const cx = (a[0] + b[0]) / 2;
  const cy = (a[1] + b[1]) / 2;
  return {
    x1: cx + nx * half * 1.15, y1: cy + ny * half * 1.15,
    x2: cx - nx * half * 1.25, y2: cy - ny * half * 1.25,
  };
}
