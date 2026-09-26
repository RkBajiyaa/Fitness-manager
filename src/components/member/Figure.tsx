/* ============================================================
   THE FIGURE — one posture, drawn as a body (§1–§9).

   `HowTo.tsx` owns time; this file owns what a single instant looks
   like. Everything it draws is derived from eight joint angles and a
   body plan, so there is no per-exercise artwork anywhere in the
   product and there never will be (§23).

   ------------------------------------------------------------
   THE FIVE LAYERS, AND WHY THEY ARE IN THIS ORDER

     1  SILHOUETTE   an ink pass then a form pass, per limb chain.
                     The ink pass grows every shape by half a stroke
                     so the union of an upper arm and a forearm gets
                     ONE contour; the form pass fills them and hides
                     the seam. Stroking each segment instead draws a
                     line across the elbow and the knee, which is a
                     person made of sausages — worse than the stick
                     figure this replaced.
     2  FORM         a gradient per volume, ACROSS the bone, lit from
                     one direction for the whole library (§7, §18).
                     Across rather than along, because that is the
                     axis a cylinder turns away from the light on,
                     and recomputed per frame so an arm that swings
                     overhead relights itself instead of carrying a
                     painted-on shadow.
     3  MUSCLE       bellies from `musculature.ts`, in bone-local
                     coordinates. Subtle by default: this is
                     modelling, not a diagram.
     4  CONTOUR      the lines that make the anatomy legible before
                     anything is coloured — a sternum, the cuts in
                     the abdominal wall, a knee cap, a shoulder seam.
     5  ACTIVATION   the SAME belly shapes, in anatomical red, at a
                     weight the animation drives (§8, §9).

   Layer 5 is why layers 3 and 4 exist. Painting a working muscle
   onto a moving figure was tried once and rejected, and the reason
   it failed was that there was no anatomy under the paint: a red
   shape on a blank thigh is a smudge. A red shape on a thigh that
   already has a quadriceps drawn on it is that quadriceps, marked.

   ------------------------------------------------------------
   WHERE THE EQUIPMENT GOES

   In the middle of the hand. The palm draws, then `kit`, then the
   fingers close over the front of it (§4, §12). That single ordering
   is the difference between a person holding a barbell and a person
   standing next to one.
   ============================================================ */
import { memo, useId, type ReactNode } from 'react';
import {
  FOREARM_PROFILE, HEAD_RADIUS, SHIN_PROFILE, THIGH_PROFILE,
  SAGITTAL, UPPERARM_PROFILE, closedCurve, farSideOf, footPath, limbLoft, limbPath,
  offsetSide, openCurve, resolvePose, shadeAxis, trunkOutline,
  type BodyPlan, type FigurePoints, type LimbPlanes, type Pose, type Symmetry,
} from '../../data/media/figure';
import {
  belliesOn, bellyPath, bonesOf, contourPath, contoursOn, platePath, platesOn,
  type Bone, type BoneRef, type Facing,
} from '../../data/media/musculature';
import { GROUND_Y, type Grip } from './Kit';

/* ============================================================
   GEOMETRY
   ============================================================ */

type Pt = readonly [number, number];

/**
 * How much a far limb is set back from a near one, ON THE PAGE.
 *
 * In profile the two sides are genuinely at different depths and the
 * far one has to recede or the figure reads flat. Turn the body to
 * face us and that stops being true: both arms are the same distance
 * away, and greying one of them out says "this arm is behind you",
 * which on a lateral raise is exactly the wrong thing to say.
 */
function depthOf(plan: BodyPlan): '' | ' fig2__part--mid' | ' fig2__part--far' {
  if (plan.lateralShare >= 0.85) return '';
  return plan.lateralShare >= 0.25 ? ' fig2__part--mid' : ' fig2__part--far';
}

/** A drawn volume: its outline, and where its light comes from. */
interface Volume {
  key: string;
  d: string;
  axis: { x1: number; y1: number; x2: number; y2: number };
}

function unit(a: Pt, b: Pt): [number, number] {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l = Math.hypot(dx, dy) || 0.0001;
  return [dx / l, dy / l];
}

/**
 * The hand, in two halves.
 *
 * `palm` goes under the implement and `fingers` go over it. The
 * fingers curl BACK along the forearm rather than continuing along
 * it, because that is what a hand closed around a bar does, and it
 * is the shape that reads as a grip at a size where an individual
 * finger is three pixels wide.
 */
function handShapes(
  p: FigurePoints, plan: BodyPlan, holding: boolean,
): { palm: string; fingers: string[]; knuckle: string } {
  const [ux, uy] = unit(p.elbow, p.hand);
  const ax = -uy;
  const ay = ux;
  const w = plan.widths.hand;
  /*
   * The hand is sized from the DRAWN forearm, not from a constant.
   * A forearm that is foreshortened (§5) keeps its width but loses its
   * length, and a fixed hand on the end of it becomes half as long as
   * the arm it is attached to — which is what made a back squat's grip
   * read as a mitten. Scaled this way a full-length forearm gets
   * exactly the hand it always had, and a foreshortened one gets a
   * hand foreshortened with it.
   */
  const fore = Math.hypot(p.hand[0] - p.elbow[0], p.hand[1] - p.elbow[1]);
  const len = Math.max(2.4, fore * 0.335);
  const base: Pt = p.hand;
  const tip: Pt = [base[0] + ux * len * 0.72, base[1] + uy * len * 0.72];

  const palm = limbPath(base, tip, plan.widths.wrist * 1.05, w * 1.04);
  const knuckle = openCurve([
    [tip[0] + ax * w * 0.42, tip[1] + ay * w * 0.42],
    [tip[0] + ux * 0.5, tip[1] + uy * 0.5],
    [tip[0] - ax * w * 0.42, tip[1] - ay * w * 0.42],
  ]);

  const fingers: string[] = [];
  if (holding) {
    // Three finger groups across the knuckles, curling back over the
    // implement, plus a thumb closing from the other side.
    for (let i = 0; i < 3; i++) {
      const off = (i - 1) * w * 0.3;
      const from: Pt = [tip[0] + ax * off + ux * 0.6, tip[1] + ay * off + uy * 0.6];
      const to: Pt = [
        from[0] - ux * len * 0.78 + ax * off * 0.3,
        from[1] - uy * len * 0.78 + ay * off * 0.3,
      ];
      fingers.push(limbPath(from, to, w * 0.3, w * 0.26));
    }
    const tFrom: Pt = [base[0] + ax * w * 0.4, base[1] + ay * w * 0.4];
    fingers.push(limbPath(
      tFrom,
      [tFrom[0] + ux * len * 0.72 + ax * w * 0.1, tFrom[1] + uy * len * 0.72 + ay * w * 0.1],
      w * 0.34, w * 0.26,
    ));
  } else {
    // Open hand: fingers out, slightly splayed.
    for (let i = 0; i < 3; i++) {
      const off = (i - 1) * w * 0.3;
      const from: Pt = [tip[0] + ax * off, tip[1] + ay * off];
      const to: Pt = [
        from[0] + ux * len * 0.62 + ax * off * 0.7,
        from[1] + uy * len * 0.62 + ay * off * 0.7,
      ];
      fingers.push(limbPath(from, to, w * 0.3, w * 0.24));
    }
    const tFrom: Pt = [base[0] + ax * w * 0.42, base[1] + ay * w * 0.42];
    fingers.push(limbPath(
      tFrom,
      [tFrom[0] + ux * len * 0.4 + ax * w * 0.5, tFrom[1] + uy * len * 0.4 + ay * w * 0.5],
      w * 0.32, w * 0.24,
    ));
  }
  return { palm, fingers, knuckle };
}

/**
 * The foot.
 *
 * From the side it is a wedge with a heel behind the ankle, which is
 * the contact point a beginner is told to keep flat. Turn the body
 * and the same wedge points at the viewer and collapses, so a front
 * or rear view gets a short splayed shape instead — a foot seen from
 * the front is a toe box, not a plank.
 */
function footShape(p: FigurePoints, plan: BodyPlan, side: 'near' | 'far'): string {
  if (plan.facing === 'side') return footPath(p, plan);
  /*
   * Turned towards us, the toes point AT the camera, and the `foot`
   * angle cannot say that — it is measured in the picture plane, where
   * 0 means "toes to the right". So a front or rear view ignores the
   * toe joint and builds the foot from the ankle instead: short,
   * angled outward, and widening into a toe box.
   *
   * Lofted rather than capsuled, because a capsule 3.4 long and 5 wide
   * is a pebble. The taper from a narrow ankle to a broad forefoot is
   * the whole of what makes a foot read as a foot from the front.
   */
  const w = plan.widths;
  const out = side === 'near' ? 1 : -1;
  const a = p.ankle;
  const toe: [number, number] = [a[0] + out * 1.9, a[1] + 5.0];
  return limbLoft(a, toe, w, [
    [0, 'ankle', 0.92], [0.42, 'foot', 1.12], [1, 'foot', 1.42],
  ]);
}

/**
 * The head, and enough of a face that it reads as a person (§5).
 *
 * Local coordinates: +x is the direction the face points, +y is up
 * out of the crown, both in units of the head radius. The facing
 * direction is derived the same way the trunk's front is — rotate the
 * neck axis by 90° — which is why a figure lying on a bench looks up
 * rather than staying stubbornly upright.
 *
 * Restrained on purpose (§5). A brow, an eye, a nose line, a jaw. Any
 * more detail at a head diameter of eleven units is either invisible
 * or uncanny, and both are worse than a clean silhouette.
 */
function headShapes(p: FigurePoints, facing: Facing) {
  const [ax, ay] = unit(p.shoulder, p.head);
  // The face: rotate the neck axis by 90°, the same construction the
  // trunk's front uses — which is why a figure lying on a bench looks
  // UP rather than staying stubbornly upright.
  const fx = -ay;
  const fy = ax;
  // And "up" out of the crown is the neck axis itself. Negating it
  // put the crown under the chin and the mouth above the eyes: a head
  // drawn upside down, which is invisible until you look at one.
  const upx = ax;
  const upy = ay;
  const R = HEAD_RADIUS;
  const at = (x: number, y: number): [number, number] => [
    p.head[0] + fx * x * R + upx * y * R,
    p.head[1] + fy * x * R + upy * y * R,
  ];
  const curve = (pts: ReadonlyArray<readonly [number, number]>) =>
    closedCurve(pts.map(([x, y]) => at(x, y)), 0.52);
  const line = (pts: ReadonlyArray<readonly [number, number]>) =>
    openCurve(pts.map(([x, y]) => at(x, y)));

  if (facing === 'side') {
    return {
      skull: curve([
        [0.02, 1.0], [0.56, 0.78], [0.78, 0.4], [0.72, 0.18], [0.96, 0.02],
        [0.74, -0.16], [0.82, -0.34], [0.7, -0.62], [0.3, -0.86],
        [-0.34, -0.74], [-0.72, -0.28], [-0.78, 0.42], [-0.5, 0.92],
      ]),
      hair: curve([
        [0.02, 1.02], [0.5, 0.82], [0.34, 0.72], [-0.06, 0.8],
        [-0.46, 0.6], [-0.64, 0.24], [-0.76, 0.46], [-0.5, 0.92],
      ]),
      face: [
        line([[0.44, 0.44], [0.7, 0.38]]),
        line([[0.5, 0.26], [0.64, 0.24]]),
      ],
      // Back of the cheek, not the middle of the face. At R * 0.24 in
      // the centre it drew a ring exactly where an eye goes, so the
      // profile head came out looking straight at the viewer.
      ear: at(-0.3, -0.04) as [number, number],
      earR: R * 0.17,
      jaw: line([[0.68, -0.6], [0.22, -0.82], [-0.3, -0.7]]),
    };
  }
  if (facing === 'back') {
    return {
      skull: curve([
        [0.0, 1.02], [0.58, 0.7], [0.68, 0.06], [0.42, -0.54], [0.0, -0.82],
        [-0.42, -0.54], [-0.68, 0.06], [-0.58, 0.7],
      ]),
      hair: curve([
        [0.0, 1.04], [0.6, 0.72], [0.64, 0.2], [0.34, 0.36], [0.0, 0.4],
        [-0.34, 0.36], [-0.64, 0.2], [-0.6, 0.72],
      ]),
      face: [],
      ear: null,
      earR: 0,
      jaw: null,
    };
  }
  return {
    skull: curve([
      [0.0, 1.02], [0.58, 0.74], [0.7, 0.1], [0.44, -0.52], [0.0, -0.84],
      [-0.44, -0.52], [-0.7, 0.1], [-0.58, 0.74],
    ]),
    hair: curve([
      [0.0, 1.05], [0.56, 0.78], [0.5, 0.56], [0.24, 0.66], [0.0, 0.7],
      [-0.24, 0.66], [-0.5, 0.56], [-0.56, 0.78],
    ]),
    face: [
      line([[0.16, 0.26], [0.44, 0.24]]),
      line([[-0.16, 0.26], [-0.44, 0.24]]),
      // A nose as one short vertical with a base, and nothing else
      // (§7). A brow as well is a scribble at eleven units of head.
      line([[0.02, 0.1], [0.06, -0.16], [-0.06, -0.18]]),
      line([[-0.17, -0.42], [0.17, -0.42]]),
    ],
    ear: null,
    earR: 0,
    jaw: line([[0.44, -0.46], [0.0, -0.82], [-0.44, -0.46]]),
  };
}

/* ============================================================
   PARTS

   A part is a limb chain plus its anatomy: the unit that gets one
   contour. Building them as data rather than as JSX is what lets the
   far side take a different palette without a second code path.
   ============================================================ */

interface Part {
  key: string;
  vols: Volume[];
  bones: BoneRef[];
  far: boolean;
  /** CSS modifier for how far back this part sits. */
  depth: string;
}

function vol(key: string, d: string, a: Pt, b: Pt, half: number): Volume {
  return { key, d, axis: shadeAxis(a, b, half) };
}

/**
 * Past this much fold, the forearm gets its own contour.
 *
 * The one-contour-per-chain rule is right for a limb that EXTENDS:
 * stroking each segment draws a line across the elbow and the figure
 * becomes a person made of sausages. It is wrong for a limb that
 * folds back on itself, where the union of the two segments has no
 * internal edge at all and comes out as a paddle — which is what a
 * back squat's arm did. An illustrator draws the near edge of the
 * forearm over the upper arm; so does this.
 */
const FOLD_DOT = -0.17;   // ≈ 100° of elbow flexion

function armParts(
  p: FigurePoints, plan: BodyPlan, far: boolean, holding: boolean,
): { parts: Part[]; hand: { palm: string; fingers: string[]; knuckle: string } } {
  const w = plan.widths;
  const hand = handShapes(p, plan, holding);
  const key = far ? 'fa' : 'na';
  const depth = far ? depthOf(plan) : '';
  const [ux, uy] = unit(p.shoulder, p.elbow);
  const [fx, fy] = unit(p.elbow, p.hand);
  const folded = ux * fx + uy * fy < FOLD_DOT;

  const upper = vol(`${key}-u`, limbLoft(p.shoulder, p.elbow, w, UPPERARM_PROFILE),
    p.shoulder, p.elbow, w.shoulder / 2);
  const fore = vol(`${key}-f`, limbLoft(p.elbow, p.hand, w, FOREARM_PROFILE),
    p.elbow, p.hand, w.elbow / 2);
  const palm = vol(`${key}-p`, hand.palm, p.elbow, p.hand, w.hand / 2);

  if (!folded) {
    return {
      parts: [{ key, far, depth, bones: ['upperArm', 'foreArm'], vols: [upper, fore, palm] }],
      hand,
    };
  }
  return {
    parts: [
      { key: `${key}u`, far, depth, bones: ['upperArm'], vols: [upper] },
      { key: `${key}f`, far, depth, bones: ['foreArm'], vols: [fore, palm] },
    ],
    hand,
  };
}

function legPart(p: FigurePoints, plan: BodyPlan, far: boolean): Part {
  const w = plan.widths;
  const key = far ? 'fl' : 'nl';
  return {
    key,
    far,
    depth: far ? depthOf(plan) : '',
    bones: ['thigh', 'shin'],
    vols: [
      vol(`${key}-t`, limbLoft(p.hip, p.knee, w, THIGH_PROFILE),
        p.hip, p.knee, w.thighTop / 2),
      vol(`${key}-s`, limbLoft(p.knee, p.ankle, w, SHIN_PROFILE),
        p.knee, p.ankle, w.knee / 2),
      vol(`${key}-f`, footShape(p, plan, far ? 'far' : 'near'),
        p.ankle, p.toe, w.foot / 2),
    ],
  };
}

function trunkOutlineOf(p: FigurePoints, plan: BodyPlan): string {
  return trunkOutline(p, plan);
}

function trunkPart(p: FigurePoints, plan: BodyPlan): Part {
  const w = plan.widths;
  const neckEnd: Pt = [
    p.shoulder[0] + (p.head[0] - p.shoulder[0]) * 0.55,
    p.shoulder[1] + (p.head[1] - p.shoulder[1]) * 0.55,
  ];
  return {
    key: 'tr',
    far: false,
    depth: '',
    bones: ['trunkLower', 'trunkUpper', 'neck'],
    vols: [
      vol('tr-n', limbPath(p.shoulder, neckEnd, w.neck * 1.3, w.neck),
        p.shoulder, neckEnd, w.neck / 2),
      vol('tr-b', trunkOutline(p, plan), p.hip, p.shoulder, w.chest / 2),
    ],
  };
}

/* ============================================================
   DRAWING
   ============================================================ */

const TIER_WEIGHT = { primary: 0.62, secondary: 0.24, stabiliser: 0.1 } as const;

function Bellies({
  bones, boneMap, facing, primary, secondary, stabilisers, activation, pairSides,
}: {
  bones: BoneRef[];
  boneMap: Record<BoneRef, Bone>;
  facing: Facing;
  primary: ReadonlySet<string>;
  secondary: ReadonlySet<string>;
  stabilisers: ReadonlySet<string>;
  activation: number;
  /** Whether paired shapes also draw their mirror. */
  pairSides: boolean;
}) {
  const out: ReactNode[] = [];
  for (const boneRef of bones) {
    const bone = boneMap[boneRef];
    for (const belly of belliesOn(boneRef, facing)) {
      const sides = belly.pair && pairSides ? [false, true] : [false];
      for (const mirror of sides) {
        const d = bellyPath(belly, bone, mirror);
        const k = `${boneRef}-${belly.muscle}-${mirror ? 'm' : 'n'}`;
        out.push(<path key={`b${k}`} d={d} className="fig2__belly" />);
        const tone = primary.has(belly.muscle) ? 'primary'
          : secondary.has(belly.muscle) ? 'secondary'
            : stabilisers.has(belly.muscle) ? 'stabiliser' : null;
        if (tone) {
          out.push(
            <path key={`a${k}`} d={d}
              className={`fig2__act fig2__act--${tone}`}
              style={{ opacity: activation * TIER_WEIGHT[tone] }} />,
          );
        }
      }
    }
  }
  return <>{out}</>;
}

/**
 * The bony landmarks (§3, §5) — kneecap, elbow point, sternum, iliac
 * crest. Between the muscle and the contour lines, because bone sits
 * UNDER the modelling lines and OVER the muscle it is surrounded by.
 *
 * They never take activation. A kneecap that lit up when an exercise
 * worked the quadriceps would be teaching a beginner anatomy that is
 * simply false, which is a worse failure than a plain silhouette.
 */
function Plates({
  bones, boneMap, facing, pairSides,
}: {
  bones: BoneRef[];
  boneMap: Record<BoneRef, Bone>;
  facing: Facing;
  pairSides: boolean;
}) {
  const out: ReactNode[] = [];
  for (const boneRef of bones) {
    const bone = boneMap[boneRef];
    platesOn(boneRef, facing).forEach((pl, i) => {
      const sides = pl.pair && pairSides ? [false, true] : [false];
      for (const mirror of sides) {
        out.push(
          <path key={`${boneRef}-${i}-${mirror ? 'm' : 'n'}`}
            d={platePath(pl, bone, mirror)} className="fig2__bone" />,
        );
      }
    });
  }
  return <>{out}</>;
}

function Contours({
  bones, boneMap, facing, pairSides,
}: {
  bones: BoneRef[];
  boneMap: Record<BoneRef, Bone>;
  facing: Facing;
  pairSides: boolean;
}) {
  const out: ReactNode[] = [];
  for (const boneRef of bones) {
    const bone = boneMap[boneRef];
    contoursOn(boneRef, facing).forEach((c, i) => {
      const sides = c.pair && pairSides ? [false, true] : [false];
      for (const mirror of sides) {
        out.push(
          <path key={`${boneRef}-${i}-${mirror ? 'm' : 'n'}`}
            d={contourPath(c, bone, mirror)}
            className={`fig2__line fig2__line--${c.weight ?? 'fine'}`} />,
        );
      }
    });
  }
  return <>{out}</>;
}

/** One limb chain: ink, form, then its anatomy. */
function PartG({
  part, uid, boneMap, facing, primary, secondary, stabilisers,
  activation, pairSides, extra,
}: {
  part: Part;
  uid: string;
  boneMap: Record<BoneRef, Bone>;
  facing: Facing;
  primary: ReadonlySet<string>;
  secondary: ReadonlySet<string>;
  stabilisers: ReadonlySet<string>;
  activation: number;
  pairSides: boolean;
  extra?: ReactNode;
}) {
  return (
    <g className={`fig2__part${part.depth}`}>
      <g className="fig2__ink">
        {part.vols.map((v) => <path key={v.key} d={v.d} />)}
      </g>
      <g className="fig2__form">
        {part.vols.map((v) => <path key={v.key} d={v.d} fill={`url(#${uid}-${v.key})`} />)}
      </g>
      <Bellies bones={part.bones} boneMap={boneMap} facing={facing}
        primary={primary} secondary={secondary} stabilisers={stabilisers}
        activation={activation} pairSides={pairSides} />
      <Plates bones={part.bones} boneMap={boneMap} facing={facing} pairSides={pairSides} />
      <Contours bones={part.bones} boneMap={boneMap} facing={facing} pairSides={pairSides} />
      {extra}
    </g>
  );
}

/**
 * CONTACT OCCLUSION (§12) — the shadow a limb casts on the torso where
 * it enters it.
 *
 * Without it an arm in profile is a hard-edged shape lying ON the
 * chest: correct depth order, and still a cut-out rather than a limb
 * attached to a body. The armpit and the groin are where the eye looks
 * to decide, and they are dark on every body.
 *
 * This is NOT the rejected "opacity as a brightness control": that
 * dimmed a whole volume to fake distance and turned the figure to
 * glass. This adds shading, inside the silhouette, from a shape that
 * is genuinely there — and it is clipped to the trunk, so it can never
 * leak onto the stage.
 */
function Occlusion({ at, r, id }: { at: Pt; r: number; id: string }) {
  return <circle cx={at[0]} cy={at[1]} r={r} fill={`url(#${id})`} />;
}

/** The contact shadow under a point that is on or near the floor (§18). */
function Contact({ at }: { at: Pt }) {
  const gap = GROUND_Y - at[1];
  if (gap < -4 || gap > 9) return null;
  const near = 1 - Math.max(0, gap) / 9;
  return (
    <ellipse cx={at[0]} cy={GROUND_Y} rx={4.6 + near * 3.4} ry={1 + near * 0.7}
      className="fig2__contact" style={{ opacity: 0.06 + near * 0.13 }} />
  );
}

export interface FigureProps {
  pose: Pose;
  plan: BodyPlan;
  /** Far-side pose. Derived by the caller so a frame can override it. */
  far: Pose;
  /** Muscle keys to light up strongly. */
  primary?: ReadonlySet<string>;
  /** Muscle keys to light up faintly. */
  secondary?: ReadonlySet<string>;
  /** Muscle keys that only HOLD the position — the faintest tier (§9). */
  stabilisers?: ReadonlySet<string>;
  /** 0–1, from the animation. Drives how hard the activation reads (§9). */
  activation?: number;
  /** True when the hands are on an implement — changes the grip. */
  holding?: boolean;
  /**
   * The implement, spliced between the palms and the fingers. The
   * only reason `Figure` takes a node at all, and it earns it: it is
   * what makes a hand look like it is holding the thing.
   */
  kit?: ReactNode;
  /**
   * The whole grip assembly — both arms, the implement and both sets
   * of fingers — drawn BEFORE the trunk rather than around it, for
   * movements held behind the back (§12). Depth by paint order.
   */
  gripBehind?: boolean;
}

const EMPTY: ReadonlySet<string> = new Set();

export const Figure = memo(function Figure({
  pose, plan, far: farPose, primary = EMPTY, secondary = EMPTY, stabilisers = EMPTY,
  activation = 0, holding = false, kit, gripBehind = false,
}: FigureProps) {
  const uid = useId().replace(/:/g, '');
  const facing = plan.facing;

  const near = offsetSide(resolvePose(pose), plan, 'near');
  const off = offsetSide(resolvePose(farPose), plan, 'far');
  const midline = resolvePose(pose);

  const w = plan.widths;
  const trunkD = trunkOutlineOf(midline, plan);
  const trunk = trunkPart(midline, plan);
  const nearLeg = legPart(near, plan, false);
  const farLeg = legPart(off, plan, true);
  const nearArm = armParts(near, plan, false, holding);
  const farArm = armParts(off, plan, true, holding);

  const boneNear = bonesOf(near, plan);
  const boneFar = bonesOf(off, plan);
  const boneMid = bonesOf(midline, plan);
  const head = headShapes(midline, facing);

  const gradients = [trunk, farLeg, ...farArm.parts, nearLeg, ...nearArm.parts]
    .flatMap((part) => part.vols.map((v) => ({
      id: `${uid}-${v.key}`, depth: part.depth, ...v.axis,
    })));

  /*
   * On a front or rear view both halves of a paired muscle are on one
   * trunk, so the mirror is drawn. In profile the far half is hidden
   * behind the near one, and drawing it puts a second pectoral across
   * the sternum — the same mistake the muscle chart made once and now
   * has a rule about.
   */
  const pairSides = facing !== 'side';
  const shared = { facing, primary, secondary, stabilisers, activation, uid };

  /*
   * The grip assembly, as one block so it can be placed in front of
   * the body or behind it without a second code path.
   *
   * Inside it the order never changes: the FAR arm, the implement,
   * the far fingers, the near arm, the near fingers. The implement is
   * therefore always between the palms and the fingers (§4, §12) —
   * the one ordering that is the difference between a person holding
   * a barbell and a person standing next to one — and a two-handed
   * grip closes both hands on it without the far one landing in front
   * of the near one.
   */
  const grip = (
    <>
      {gripBehind && farArm.parts.map((part) => (
        <PartG {...shared} key={part.key} part={part} boneMap={boneFar} pairSides={false} />
      ))}
      {kit}
      <g className={`fig2__part${depthOf(plan)}`}>
        <g className="fig2__ink">{farArm.hand.fingers.map((d, i) => <path key={i} d={d} />)}</g>
        <g className="fig2__form">{farArm.hand.fingers.map((d, i) => <path key={i} d={d} />)}</g>
      </g>
      {nearArm.parts.map((part, i) => (
        <PartG {...shared} key={part.key} part={part} boneMap={boneNear} pairSides={false}
          extra={i === nearArm.parts.length - 1
            ? <path d={nearArm.hand.knuckle} className="fig2__line fig2__line--fine" />
            : undefined} />
      ))}
      <g className="fig2__part">
        <g className="fig2__ink">{nearArm.hand.fingers.map((d, i) => <path key={i} d={d} />)}</g>
        <g className="fig2__form">{nearArm.hand.fingers.map((d, i) => <path key={i} d={d} />)}</g>
      </g>
    </>
  );

  return (
    <>
      <defs>
        <radialGradient id={`${uid}-occ`}>
          <stop offset="0" className="fig2__occ-in" />
          <stop offset="0.55" className="fig2__occ-mid" />
          <stop offset="1" className="fig2__occ-out" />
        </radialGradient>
        <clipPath id={`${uid}-trunkclip`}>
          <path d={trunkD} />
        </clipPath>
        {gradients.map((g) => (
          <linearGradient key={g.id} id={g.id} gradientUnits="userSpaceOnUse"
            x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2}
            className={`fig2__g${g.depth.replace('part', 'g')}`}>
            <stop offset="0" className="fig2__g-lit" />
            <stop offset="0.52" className="fig2__g-mid" />
            <stop offset="1" className="fig2__g-core" />
          </linearGradient>
        ))}
      </defs>

      <Contact at={facing === 'side' ? near.toe : near.ankle} />
      <Contact at={facing === 'side' ? off.toe : off.ankle} />

      <PartG {...shared} part={farLeg} boneMap={boneFar} pairSides={false} />
      {!gripBehind && farArm.parts.map((part) => (
        <PartG {...shared} key={part.key} part={part} boneMap={boneFar} pairSides={false} />
      ))}
      {gripBehind && grip}

      <PartG {...shared} part={trunk} boneMap={boneMid} pairSides={pairSides} />

      <g clipPath={`url(#${uid}-trunkclip)`}>
        <Occlusion at={off.shoulder} r={w.shoulder * 0.92} id={`${uid}-occ`} />
        <Occlusion at={off.hip} r={w.thighTop * 0.85} id={`${uid}-occ`} />
        <Occlusion at={near.shoulder} r={w.shoulder * 0.92} id={`${uid}-occ`} />
        <Occlusion at={near.hip} r={w.thighTop * 0.85} id={`${uid}-occ`} />
      </g>

      {/* The head is its own part: it carries no muscle and it has to
          sit over the neck rather than share a contour with it. */}
      <g className="fig2__part">
        <g className="fig2__ink"><path d={head.skull} /></g>
        <g className="fig2__form"><path d={head.skull} className="fig2__headfill" /></g>
        <path d={head.hair} className="fig2__hair" />
        {head.ear && (
          <ellipse cx={head.ear[0]} cy={head.ear[1]} rx={head.earR} ry={head.earR * 1.2}
            className="fig2__ear" />
        )}
        {head.jaw && <path d={head.jaw} className="fig2__line fig2__line--fine" />}
        {head.face.map((d, i) => <path key={i} d={d} className="fig2__face" />)}
      </g>

      <PartG {...shared} part={nearLeg} boneMap={boneNear} pairSides={false} />

      {!gripBehind && grip}
    </>
  );
});

/**
 * Where the implement is held. Computed outside `Figure` so the
 * implement can be built from the same hands the body draws, which is
 * the whole of §12.
 */
export function gripsOf(pose: Pose, farPose: Pose, plan: BodyPlan): Grip[] {
  const near = offsetSide(resolvePose(pose), plan, 'near');
  const off = offsetSide(resolvePose(farPose), plan, 'far');
  const g = (p: FigurePoints): Grip => ({ at: p.hand, dir: unit(p.elbow, p.hand) });
  const apart = Math.hypot(near.hand[0] - off.hand[0], near.hand[1] - off.hand[1]);
  return apart < 2.5 ? [g(near)] : [g(off), g(near)];
}

/** The far-side pose for a frame, with any per-frame override applied. */
export function farPoseFor(
  pose: Pose, plan: BodyPlan, symmetry: Symmetry,
  partner?: Pose, override?: Partial<Pose>, planes: LimbPlanes = SAGITTAL,
): Pose {
  return { ...farSideOf(pose, symmetry, partner, plan, planes), ...(override ?? {}) };
}

/* ============================================================
   THE MOVEMENT PATH (§14).

   Replaces the arrow. An arrowhead says "this way"; the path says
   HOW FAR, along WHAT LINE, and where the repetition starts — three
   of the things §11 asks a still frame to communicate and three a
   single arrow cannot.

   It is the real trajectory of the joint that travels most, sampled
   over the loop, with an open ring at the start and a chevron
   travelling along it. Derived, never stored: adjust a pose and the
   path moves with it (hard rule 5).
   ============================================================ */
export const MotionPath = memo(function MotionPath({
  points, at,
}: {
  /** The sampled trajectory, in page coordinates. */
  points: ReadonlyArray<readonly [number, number]>;
  /** Where along the path the figure is now, 0–1. */
  at: number;
}) {
  if (points.length < 3) return null;
  const d = openCurve(points);
  const i = Math.min(points.length - 2, Math.max(0, Math.round(at * (points.length - 1))));
  const head = points[i + 1];
  const prev = points[i];
  const ang = (Math.atan2(head[1] - prev[1], head[0] - prev[0]) * 180) / Math.PI;
  return (
    <g aria-hidden="true">
      <path d={d} className="fig2__pathhalo" />
      <path d={d} className="fig2__path" />
      <circle cx={points[0][0]} cy={points[0][1]} r="1.15" className="fig2__pathstart" />
      {/* Small enough to be a direction, not a sign. An arrowhead the
          size of a hand stops being an indicator and starts being the
          subject of the drawing (§14). */}
      <path d="M 0 0 L -2.6 1.5 L -1.9 0 L -2.6 -1.5 Z" className="fig2__pathtip"
        transform={`translate(${head[0].toFixed(2)} ${head[1].toFixed(2)}) rotate(${ang.toFixed(1)})`} />
    </g>
  );
});

export { HEAD_RADIUS };
