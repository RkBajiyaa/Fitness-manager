/* ============================================================
   THE KIT — scenery and implements (§12, §13, §18).

   Two rules run this file, and they are the two things that give a
   drawing away as a diagram when they are broken.

   1. THE IMPLEMENT IS BUILT FROM THE HANDS, NOT PLACED NEAR THEM.
      A barbell is a shaft through the two hands the pose resolved,
      so correcting a pose moves the bar with it and the bar can
      never drift away from the grip. Where a view separates the
      hands — anything but a strict profile — the bar SPANS them,
      which is what a barbell actually is and what a pair of
      dumbbells is not.

   2. THE SCENERY KNOWS WHICH WAY WE ARE STANDING. A bench drawn in
      strict profile behind a figure seen from the front is the
      clearest possible signal that the two were drawn by different
      people. Pads widen, legs separate, and the two machines that
      are genuinely a different object from the front say so.

   Everything is drawn with `--fig-load` on the implement and
   `--fig-kit`/`--fig-pad` on the furniture, so the thing being
   lifted is always the thing found first (§20).
   ============================================================ */
import { memo } from 'react';
import type { BodyPlan, PropGlyph, SceneGlyph } from '../../data/media/figure';

/** Where a cable or band is anchored, per scene. */
const CABLE_ANCHOR: Partial<Record<SceneGlyph, [number, number]>> = {
  cable_tower: [88, 20],
  lat_tower: [50, 13],
  seat: [95, 80],
  rower: [90, 82],
  row_station: [90, 79],
  rack: [84, 30],
};

export function anchorFor(scene: SceneGlyph, plan?: BodyPlan): [number, number] | null {
  const a = CABLE_ANCHOR[scene];
  if (!a) return null;
  // Seen from the front, a lat tower's cable comes straight down the
  // midline and a cable stack is off to one side but much less so.
  if (plan && plan.facing !== 'side' && scene === 'cable_tower') {
    return [72 + (a[0] - 72) * (1 - plan.lateralShare * 0.55), a[1]];
  }
  return a;
}

export const GROUND_Y = 92;

/* ============================================================
   SCENERY
   ============================================================ */

function Ground({ shadow }: { shadow?: boolean }) {
  return (
    <>
      {shadow && (
        <rect x="-40" y={GROUND_Y} width="180" height="26" className="fig2__floorwash" />
      )}
      <line x1="-30" y1={GROUND_Y} x2="130" y2={GROUND_Y} className="fig2__ground" />
    </>
  );
}

/**
 * A padded surface, drawn with an upholstery seam and a lit top edge
 * so it reads as a cushion rather than a coloured rectangle (§13).
 */
function Pad({
  x, y, w, h, r,
}: { x: number; y: number; w: number; h: number; r?: number }) {
  const rr = r ?? Math.min(h / 2, 3.4);
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={rr} className="fig2__pad" />
      <rect x={x + 1.2} y={y + 0.7} width={w - 2.4} height={h * 0.32} rx={rr * 0.7}
        className="fig2__padlit" />
      <line x1={x + 2} y1={y + h * 0.66} x2={x + w - 2} y2={y + h * 0.66}
        className="fig2__padseam" />
    </g>
  );
}

/** A tube of frame. Lit down one edge so the steel has a direction. */
function Tube({
  x, y, w, h, r,
}: { x: number; y: number; w: number; h: number; r?: number }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={r ?? Math.min(w, h) * 0.32}
        className="fig2__frame" />
      <rect x={x + w * 0.16} y={y + (h > w ? h * 0.04 : h * 0.16)}
        width={Math.max(w * 0.26, 0.5)} height={h > w ? h * 0.92 : h * 0.6}
        rx={w * 0.14} className="fig2__framelit" />
    </g>
  );
}

/** A weight stack with its plate lines — what makes it read as weight. */
function Stack({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  const rows = Math.max(3, Math.round(h / 5));
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="1.6" className="fig2__stack" />
      {Array.from({ length: rows - 1 }, (_, i) => (
        <line key={i} x1={x + 0.8} y1={y + ((i + 1) * h) / rows}
          x2={x + w - 0.8} y2={y + ((i + 1) * h) / rows} className="fig2__stackline" />
      ))}
    </g>
  );
}

function Pulley({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} className="fig2__pulley" />
      <circle cx={cx} cy={cy} r={r * 0.34} className="fig2__pulleyhub" />
    </g>
  );
}

export const Scene = memo(function Scene({ scene, plan }: { scene: SceneGlyph; plan: BodyPlan }) {
  // How much the viewpoint has turned the furniture towards us. A
  // bench seen at three-quarters shows its far legs and a wider pad.
  const turn = plan.facing === 'side' ? 0 : plan.lateralShare;
  const spread = 1 + turn * 0.55;

  switch (scene) {
    case 'floor':
      return <g><Ground shadow /></g>;

    case 'flat_bench':
      return (
        <g>
          <Ground shadow />
          {turn > 0 && (
            <g className="fig2__behind">
              <Tube x={24} y={70} w={4} h={20} />
              <Tube x={56} y={70} w={4} h={20} />
            </g>
          )}
          <Pad x={50 - 26 * spread} y={63} w={52 * spread} h={7.4} />
          <Tube x={21} y={70} w={4.4} h={22} />
          <Tube x={57} y={70} w={4.4} h={22} />
          <Tube x={15} y={88.6} w={17} h={3.6} />
          <Tube x={51} y={88.6} w={17} h={3.6} />
        </g>
      );

    case 'incline_bench':
      return (
        <g>
          <Ground shadow />
          <path d="M 13.4 49.4 L 58.6 70 L 54 77.6 L 9 57" className="fig2__pad" />
          <path d="M 14.6 51.4 L 56 70.8 L 54.6 73.4 L 12.6 54.4" className="fig2__padlit" />
          <Pad x={51} y={69.6} w={21} h={6.4} />
          <Tube x={55} y={76} w={4.4} h={16} />
          <Tube x={43} y={76} w={4.4} h={16} />
          <Tube x={38} y={88.6} w={30} h={3.6} />
        </g>
      );

    case 'seat':
      return (
        <g>
          <Ground shadow />
          <Pad x={50 - 18 * spread} y={72.6} w={36 * spread} h={6.4} />
          <path d="M 66 73 L 72.4 73 L 74.4 51.6 L 68 51.6 Z" className="fig2__pad" />
          <Tube x={48.6} y={79} w={5} h={13} />
          <Tube x={37} y={88.6} w={28} h={3.6} />
        </g>
      );

    case 'lat_tower':
      // The one machine that is genuinely a different object from the
      // front: two uprights and a beam, with the bar coming down the
      // middle rather than a side view of a single post.
      return turn > 0.8 ? (
        <g>
          <Ground shadow />
          <Tube x={14} y={11} w={5} h={81} />
          <Tube x={81} y={11} w={5} h={81} />
          <Tube x={14} y={10} w={72} h={4.6} r={2} />
          <Pulley cx={50} cy={16.6} r={3.2} />
          <Pad x={38} y={72.6} w={24} h={6.4} />
          <Pad x={40} y={59.6} w={20} h={5} />
          <Tube x={47.6} y={79} w={5} h={13} />
          <Stack x={17} y={40} w={11} h={34} />
          <Stack x={72} y={40} w={11} h={34} />
        </g>
      ) : (
        <g>
          <Ground shadow />
          <Tube x={83.6} y={11} w={5} h={81} />
          <Tube x={48} y={10} w={40} h={4.6} r={2} />
          <Pulley cx={50} cy={16.6} r={3.2} />
          <Pad x={34} y={72.6} w={34} h={6.4} />
          <Pad x={40} y={59.6} w={20} h={5} />
          <Tube x={46.6} y={79} w={5} h={13} />
          <Stack x={70} y={40} w={12} h={34} />
        </g>
      );

    case 'press_sled':
      return (
        <g>
          <Ground shadow />
          <path d="M 7.6 47.6 L 50 78 L 45.6 85.4 L 3.4 55" className="fig2__pad" />
          <path d="M 9 49.6 L 47.6 77.4 L 46.4 80 L 6.6 52.4" className="fig2__padlit" />
          <Pad x={41.6} y={77.6} w={22} h={6.4} />
          <path d="M 71.6 39.6 L 92 68 L 86 73 L 65.6 44.6 Z" className="fig2__plate" />
          <path d="M 73 41.6 L 90 66 L 88.4 67.6 L 71.4 43.4 Z" className="fig2__platelit" />
          <line x1="60" y1="84" x2="90" y2="42" className="fig2__frameline" />
          <Tube x={5.6} y={88.6} w={80} h={3.6} />
        </g>
      );

    case 'pull_bar':
      // No ground: the feet are off it, and a floor line under a
      // hanging figure makes it look like it is standing on air.
      return (
        <g>
          <Tube x={13.6} y={7.6} w={72.8} h={5} r={2.4} />
          <Tube x={13.6} y={12.6} w={5} h={92} />
          <Tube x={81.4} y={12.6} w={5} h={92} />
        </g>
      );

    case 'cable_tower':
      return (
        <g>
          <Ground shadow />
          <Tube x={83.6} y={9.6} w={6} h={82} />
          <Pulley cx={86.6} cy={18.6} r={3.6} />
          <Stack x={71.6} y={44} w={11} h={40} />
        </g>
      );

    case 'dip_bars':
      return (
        <g>
          <Ground shadow />
          <Tube x={26} y={49.6} w={52} h={4} r={2} />
          <Tube x={30} y={55.6} w={44} h={3.2} r={1.6} />
          <Tube x={27.6} y={54} w={4.6} h={38} />
          <Tube x={70.6} y={54} w={4.6} h={38} />
          <Tube x={21.6} y={88} w={20} h={4} />
          <Tube x={61.6} y={88} w={20} h={4} />
        </g>
      );

    case 'row_station':
      return (
        <g>
          <Ground shadow />
          <Tube x={21.6} y={84} w={62} h={4} />
          <Pad x={34} y={77.6} w={26} h={6.4} />
          <path d="M 76 65.6 L 84 69.6 L 80 84 L 71.6 82 Z" className="fig2__pad" />
          <Pulley cx={89.6} cy={78.6} r={3.6} />
          <Stack x={86} y={46} w={10} h={30} />
        </g>
      );

    case 'rack':
      return (
        <g>
          <Ground shadow />
          <Tube x={11.6} y={19.6} w={6} h={72} />
          <Tube x={81.6} y={19.6} w={6} h={72} />
          <path d="M 17.6 34 L 24 34 L 24 29" className="fig2__frameline" fill="none" />
          <path d="M 81.6 34 L 76 34 L 76 29" className="fig2__frameline" fill="none" />
          <Tube x={5.6} y={88} w={18} h={4} />
          <Tube x={75.6} y={88} w={18} h={4} />
        </g>
      );

    case 'stairs':
      return (
        <g>
          {[0, 1, 2].map((i) => (
            <Tube key={i} x={26 + i * 18} y={92 - i * 12} w={22} h={4} r={1.5} />
          ))}
          <rect x="26" y="96" width="70" height="4" className="fig2__floorwash" />
        </g>
      );

    case 'treadmill':
      return (
        <g>
          <Tube x={7.6} y={88} w={84} h={7} r={3} />
          <Pad x={12} y={85.6} w={76} h={3.4} r={1.6} />
          <Tube x={83.6} y={46} w={4} h={42} />
          <rect x="70" y="36" width="20" height="12" rx="2.5" className="fig2__stack" />
        </g>
      );

    case 'bike':
      return (
        <g>
          <Ground shadow />
          <circle cx="71" cy="87" r="5" className="fig2__frameline" fill="none" />
          <path d="M 50 76 L 71 87" className="fig2__frameline" fill="none" />
          <path d="M 71 87 L 70 44" className="fig2__frameline" fill="none" />
          <Pad x={41} y={70.6} w={19} h={5} />
          <Tube x={60} y={38} w={21} h={3.6} r={1.8} />
          <circle cx="86" cy="72" r="9" className="fig2__frameline" fill="none" />
          <Tube x={60} y={88} w={34} h={4} />
        </g>
      );

    case 'rower':
      return (
        <g>
          <Ground shadow />
          <Tube x={17.6} y={86} w={62} h={4} />
          <Pad x={32} y={80.6} w={30} h={5} />
          <path d="M 62 71.6 L 70 75.6 L 66 88 L 57.6 85 Z" className="fig2__pad" />
          <circle cx="84" cy="68" r="11" className="fig2__frameline" fill="none" />
        </g>
      );

    default:
      return null;
  }
});

/* ============================================================
   THE IMPLEMENT
   ============================================================ */

export interface Grip {
  /** The wrist/hand joint. */
  at: readonly [number, number];
  /** Unit vector along the forearm, elbow → hand. */
  dir: readonly [number, number];
}

/**
 * A loaded plate, with a rim highlight so it reads as a disc of iron
 * rather than a coloured rectangle.
 */
function Plate({
  cx, cy, rx, ry,
}: { cx: number; cy: number; rx: number; ry: number }) {
  return (
    <g>
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} className="fig2__plate" />
      <ellipse cx={cx - rx * 0.22} cy={cy - ry * 0.16} rx={rx * 0.5} ry={ry * 0.68}
        className="fig2__platelit" />
    </g>
  );
}

/**
 * The barbell.
 *
 * Runs THROUGH both grips. In profile the two hands coincide, so it
 * falls back to a fixed span across the body — a bar seen truly
 * end-on is a disc, which is honest and unreadable, and being
 * recognised is the entire job of this glyph.
 */
function Barbell({ grips }: { grips: Grip[] }) {
  const a = grips[0].at;
  const b = grips[grips.length - 1].at;
  const apart = Math.hypot(b[0] - a[0], b[1] - a[1]);
  let ux: number; let uy: number; let mid: [number, number];
  if (apart < 3) {
    ux = 1; uy = 0;
    mid = [a[0], a[1]];
  } else {
    ux = (b[0] - a[0]) / apart; uy = (b[1] - a[1]) / apart;
    mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  }
  const half = Math.max(apart / 2 + 7.4, 15);
  const e1: [number, number] = [mid[0] - ux * half, mid[1] - uy * half];
  const e2: [number, number] = [mid[0] + ux * half, mid[1] + uy * half];
  const px = -uy; const py = ux;
  return (
    <g>
      <line x1={e1[0]} y1={e1[1]} x2={e2[0]} y2={e2[1]} className="fig2__bar" />
      <line x1={e1[0] + ux * 1.4} y1={e1[1] + uy * 1.4}
        x2={e2[0] - ux * 1.4} y2={e2[1] - uy * 1.4} className="fig2__barlit" />
      {[-1, 1].map((s) => {
        const base: [number, number] = [mid[0] + ux * half * s, mid[1] + uy * half * s];
        return (
          <g key={s}>
            {/* collar, then two plates stepping outward */}
            <line
              x1={base[0] - ux * s * 4.6 + px * 2.1} y1={base[1] - uy * s * 4.6 + py * 2.1}
              x2={base[0] - ux * s * 4.6 - px * 2.1} y2={base[1] - uy * s * 4.6 - py * 2.1}
              className="fig2__collar" />
            <Plate cx={base[0] - ux * s * 3.2} cy={base[1] - uy * s * 3.2} rx={1.9} ry={6} />
            <Plate cx={base[0] - ux * s * 0.9} cy={base[1] - uy * s * 0.9} rx={1.5} ry={4.2} />
          </g>
        );
      })}
    </g>
  );
}

/** One dumbbell per hand, aligned across the grip. */
function Dumbbell({ grip }: { grip: Grip }) {
  const [x, y] = grip.at;
  // Across the forearm, which is how a dumbbell sits in a hand.
  const ax = -grip.dir[1]; const ay = grip.dir[0];
  const h = 5.4;
  return (
    <g>
      <line x1={x - ax * 4.4} y1={y - ay * 4.4} x2={x + ax * 4.4} y2={y + ay * 4.4}
        className="fig2__bar" />
      {[-1, 1].map((s) => (
        <g key={s}>
          <rect
            x={x + ax * h * s - 2.1} y={y + ay * h * s - 3.9}
            width="4.2" height="7.8" rx="1.7" className="fig2__plate"
            transform={`rotate(${(Math.atan2(ay, ax) * 180) / Math.PI} ${x + ax * h * s} ${y + ay * h * s})`} />
        </g>
      ))}
    </g>
  );
}

function Kettlebell({ grip }: { grip: Grip }) {
  const [x, y] = grip.at;
  return (
    <g>
      <path d={`M ${x - 3.4} ${y} A 3.4 3.4 0 0 1 ${x + 3.4} ${y}`}
        className="fig2__bar" fill="none" />
      <path d={`M ${x - 4.6} ${y + 1.5} A 5 5 0 1 0 ${x + 4.6} ${y + 1.5} Z`}
        className="fig2__plate" />
      <ellipse cx={x - 1.4} cy={y + 3.4} rx="1.6" ry="1.9" className="fig2__platelit" />
    </g>
  );
}

/** A cable attachment: a straight bar, a rope or a single handle. */
function Attachment({
  grips, anchor, kind,
}: { grips: Grip[]; anchor: readonly [number, number] | null; kind: 'bar' | 'rope' | 'single' }) {
  const a = grips[0].at;
  const b = grips[grips.length - 1].at;
  const apart = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const mid: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const to = anchor ?? [mid[0], mid[1] - 16];
  return (
    <g>
      {kind === 'rope' ? (
        <>
          <line x1={to[0]} y1={to[1]} x2={mid[0]} y2={mid[1] - 5} className="fig2__cable" />
          {grips.map((g, i) => (
            <path key={i}
              d={`M ${mid[0]} ${mid[1] - 5} Q ${(mid[0] + g.at[0]) / 2} ${mid[1] - 1} ${g.at[0]} ${g.at[1]}`}
              className="fig2__rope" fill="none" />
          ))}
        </>
      ) : (
        <line x1={to[0]} y1={to[1]} x2={mid[0]} y2={mid[1]} className="fig2__cable" />
      )}
      {kind === 'bar' && (
        <>
          {apart < 3 ? (
            <line x1={mid[0] - 8} y1={mid[1]} x2={mid[0] + 8} y2={mid[1]} className="fig2__bar" />
          ) : (
            <line x1={a[0] - (b[0] - a[0]) * 0.18} y1={a[1] - (b[1] - a[1]) * 0.18}
              x2={b[0] + (b[0] - a[0]) * 0.18} y2={b[1] + (b[1] - a[1]) * 0.18}
              className="fig2__bar" />
          )}
        </>
      )}
      {kind === 'single' && grips.map((g, i) => (
        <g key={i}>
          <line x1={g.at[0] - 3.4} y1={g.at[1]} x2={g.at[0] + 3.4} y2={g.at[1]}
            className="fig2__bar" />
        </g>
      ))}
    </g>
  );
}

/**
 * Everything the hands are holding.
 *
 * Rendered BETWEEN the palm and the fingers by `Figure`, which is
 * what makes §4 true: the palm is behind the bar, the fingers close
 * over the front of it, and the grip therefore cannot look like a
 * hand hovering near a floating object.
 */
export const Prop = memo(function Prop({
  glyph, grips, anchor,
}: {
  glyph: PropGlyph;
  grips: Grip[];
  anchor: readonly [number, number] | null;
}) {
  if (glyph === 'none' || grips.length === 0) return null;
  switch (glyph) {
    case 'barbell': return <Barbell grips={grips} />;
    case 'dumbbell': return <>{grips.map((g, i) => <Dumbbell key={i} grip={g} />)}</>;
    case 'kettlebell': return <Kettlebell grip={grips[0]} />;
    case 'cable': return <Attachment grips={grips} anchor={anchor} kind="bar" />;
    case 'rope': return <Attachment grips={grips} anchor={anchor} kind="rope" />;
    case 'machine_handle': return <Attachment grips={grips} anchor={null} kind="single" />;
    case 'band': {
      const a = grips[0].at;
      const to = anchor ?? [100 - a[0], a[1]];
      return (
        <path d={`M ${a[0]} ${a[1]} Q ${(a[0] + to[0]) / 2} ${(a[1] + to[1]) / 2 + 7} ${to[0]} ${to[1]}`}
          className="fig2__band" fill="none" />
      );
    }
    default: return null;
  }
});
