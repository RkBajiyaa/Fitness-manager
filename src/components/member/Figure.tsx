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
  HEAD_RADIUS, SEGMENTS, closedCurve, farSideOf, footPath, limbPath,
  offsetSide, openCurve, resolvePose, shadeAxis, trunkOutline,
  type BodyPlan, type FigurePoints, type Pose, type Symmetry,
} from '../../data/media/figure';
import {
  belliesOn, bellyPath, bonesOf, contourPath, contoursOn,
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
  const len = SEGMENTS.foot * 0.62;
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
  const w = plan.widths.foot;
  const out = side === 'near' ? 1 : -1;
  const a = p.ankle;
  return limbPath(a, [a[0] + out * w * 0.34, a[1] + 3.4], w * 0.94, w * 1.28);
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
      ear: at(-0.16, -0.06) as [number, number],
      earR: R * 0.24,
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
      line([[0.16, 0.24], [0.42, 0.22]]),
      line([[-0.16, 0.24], [-0.42, 0.22]]),
      line([[-0.16, -0.36], [0.16, -0.36]]),
    ],
    ear: null,
    earR: 0,
    jaw: line([[0.42, -0.5], [0.0, -0.8], [-0.42, -0.5]]),
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

function armPart(
  p: FigurePoints, plan: BodyPlan, far: boolean, holding: boolean,
): { part: Part; hand: { palm: string; fingers: string[]; knuckle: string } } {
  const w = plan.widths;
  const hand = handShapes(p, plan, holding);
  const key = far ? 'fa' : 'na';
  return {
    part: {
      key,
      far,
      depth: far ? depthOf(plan) : '',
      bones: ['upperArm', 'foreArm'],
      vols: [
        vol(`${key}-u`, limbPath(p.shoulder, p.elbow, w.shoulder, w.elbow),
          p.shoulder, p.elbow, w.shoulder / 2),
        vol(`${key}-f`, limbPath(p.elbow, p.hand, w.elbow, w.wrist),
          p.elbow, p.hand, w.elbow / 2),
        vol(`${key}-p`, hand.palm, p.elbow, p.hand, w.hand / 2),
      ],
    },
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
      vol(`${key}-t`, limbPath(p.hip, p.knee, w.thighTop, w.knee),
        p.hip, p.knee, w.thighTop / 2),
      vol(`${key}-s`, limbPath(p.knee, p.ankle, w.knee, w.ankle),
        p.knee, p.ankle, w.knee / 2),
      vol(`${key}-f`, footShape(p, plan, far ? 'far' : 'near'),
        p.ankle, p.toe, w.foot / 2),
    ],
  };
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

function Bellies({
  bones, boneMap, facing, primary, secondary, activation, pairSides,
}: {
  bones: BoneRef[];
  boneMap: Record<BoneRef, Bone>;
  facing: Facing;
  primary: ReadonlySet<string>;
  secondary: ReadonlySet<string>;
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
          : secondary.has(belly.muscle) ? 'secondary' : null;
        if (tone) {
          out.push(
            <path key={`a${k}`} d={d}
              className={`fig2__act fig2__act--${tone}`}
              style={{ opacity: activation * (tone === 'primary' ? 0.62 : 0.24) }} />,
          );
        }
      }
    }
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
  part, uid, boneMap, facing, primary, secondary, activation, pairSides, extra,
}: {
  part: Part;
  uid: string;
  boneMap: Record<BoneRef, Bone>;
  facing: Facing;
  primary: ReadonlySet<string>;
  secondary: ReadonlySet<string>;
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
        primary={primary} secondary={secondary} activation={activation}
        pairSides={pairSides} />
      <Contours bones={part.bones} boneMap={boneMap} facing={facing} pairSides={pairSides} />
      {extra}
    </g>
  );
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
}

const EMPTY: ReadonlySet<string> = new Set();

export const Figure = memo(function Figure({
  pose, plan, far: farPose, primary = EMPTY, secondary = EMPTY,
  activation = 0, holding = false, kit,
}: FigureProps) {
  const uid = useId().replace(/:/g, '');
  const facing = plan.facing;

  const near = offsetSide(resolvePose(pose), plan, 'near');
  const off = offsetSide(resolvePose(farPose), plan, 'far');
  const midline = resolvePose(pose);

  const trunk = trunkPart(midline, plan);
  const nearLeg = legPart(near, plan, false);
  const farLeg = legPart(off, plan, true);
  const nearArm = armPart(near, plan, false, holding);
  const farArm = armPart(off, plan, true, holding);

  const boneNear = bonesOf(near, plan);
  const boneFar = bonesOf(off, plan);
  const boneMid = bonesOf(midline, plan);
  const head = headShapes(midline, facing);

  const gradients = [trunk, farLeg, farArm.part, nearLeg, nearArm.part]
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
  const shared = { facing, primary, secondary, activation, uid };

  return (
    <>
      <defs>
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

      <Contact at={near.toe} />
      <Contact at={off.toe} />

      <PartG {...shared} part={farLeg} boneMap={boneFar} pairSides={false} />
      <PartG {...shared} part={farArm.part} boneMap={boneFar} pairSides={false} />

      <PartG {...shared} part={trunk} boneMap={boneMid} pairSides={pairSides} />

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

      {/* The implement, then the FAR fingers, then the near arm. A
          two-handed grip therefore closes both hands on the bar
          without putting the far one in front of the near one. */}
      {kit}
      <g className={`fig2__part${depthOf(plan)}`}>
        <g className="fig2__ink">{farArm.hand.fingers.map((d, i) => <path key={i} d={d} />)}</g>
        <g className="fig2__form">{farArm.hand.fingers.map((d, i) => <path key={i} d={d} />)}</g>
      </g>

      <PartG {...shared} part={nearArm.part} boneMap={boneNear} pairSides={false}
        extra={<path d={nearArm.hand.knuckle} className="fig2__line fig2__line--fine" />} />
      <g className="fig2__part">
        <g className="fig2__ink">{nearArm.hand.fingers.map((d, i) => <path key={i} d={d} />)}</g>
        <g className="fig2__form">{nearArm.hand.fingers.map((d, i) => <path key={i} d={d} />)}</g>
      </g>
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
  partner?: Pose, override?: Partial<Pose>,
): Pose {
  return { ...farSideOf(pose, symmetry, partner, plan), ...(override ?? {}) };
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
      <circle cx={points[0][0]} cy={points[0][1]} r="1.8" className="fig2__pathstart" />
      <path d="M 0 0 L -4.4 2.5 L -3.2 0 L -4.4 -2.5 Z" className="fig2__pathtip"
        transform={`translate(${head[0].toFixed(2)} ${head[1].toFixed(2)}) rotate(${ang.toFixed(1)})`} />
    </g>
  );
});

export { HEAD_RADIUS };
