/* ============================================================
   THE FIGURE, THE KIT AND THE LOAD.

   Three pure renderers, no state, no timers. `HowTo.tsx` owns the
   animation; this file owns what a single frame looks like.

   Everything here is geometry imported from `data/media/figure.ts`
   (§21): a rendering algorithm with no content in it. The drawing
   that decides WHICH pose still arrives through `api.exercises.howTo`.

   ------------------------------------------------------------
   WHY THE BODY IS DRAWN TWICE

   Each half of the figure is rendered as an INK pass (fill plus a
   fat stroke) and then a SKIN pass (fill only) over the top. The
   ink pass grows every shape by half a stroke, so the union of the
   shapes gets one clean contour; the skin pass hides every internal
   seam between them. Stroking the shapes individually instead draws
   a line across the hip, the knee and the elbow — a person made of
   sausages, which is worse than the stick figure it replaced.
   ============================================================ */
import { memo } from 'react';
import {
  HEAD_RADIUS, WIDTHS, arcArrow, farSideOf, figureCentre, footPath, headShape,
  limbPath, resolvePose, torsoPaths,
  type FigurePoints, type MotionCue, type Pose, type PropGlyph,
  type SceneGlyph, type Symmetry,
} from '../../data/media/figure';

/* ============================================================
   SCENERY

   Fixed furniture behind the figure. It carries the SETUP — a
   bench, a rack, a cable stack — which the pose alone cannot
   express and which is exactly what somebody standing in front of
   the wrong machine needs. It is also half the answer to "what
   equipment do I need": a member who cannot name a lat tower can
   still recognise the shape of one.
   ============================================================ */

/** Where a cable or band is anchored, per scene. */
const CABLE_ANCHOR: Partial<Record<SceneGlyph, [number, number]>> = {
  cable_tower: [88, 20],
  lat_tower: [50, 13],
  seat: [95, 80],
  rower: [90, 82],
  row_station: [90, 79],
  rack: [84, 30],
};

export function anchorFor(scene: SceneGlyph): [number, number] | null {
  return CABLE_ANCHOR[scene] ?? null;
}

const GROUND_Y = 92;

function Ground() {
  return (
    <>
      <line x1="2" y1={GROUND_Y} x2="98" y2={GROUND_Y} className="fig__ground" />
      <rect x="2" y={GROUND_Y} width="96" height="6" className="fig__groundfill" />
    </>
  );
}

export const Scene = memo(function Scene({ scene }: { scene: SceneGlyph }) {
  switch (scene) {
    case 'floor':
      return <g><Ground /></g>;

    case 'flat_bench':
      return (
        <g>
          <Ground />
          <rect x="16" y="63" width="52" height="7" rx="3" className="fig__pad" />
          <rect x="22" y="70" width="4" height="22" className="fig__frame" />
          <rect x="58" y="70" width="4" height="22" className="fig__frame" />
          <rect x="16" y="89" width="16" height="3.5" rx="1.6" className="fig__frame" />
          <rect x="52" y="89" width="16" height="3.5" rx="1.6" className="fig__frame" />
        </g>
      );

    case 'incline_bench':
      return (
        <g>
          <Ground />
          {/* back pad, raked back at about 30° */}
          <path d="M 14 50 L 58 70 L 54 77 L 10 57 Z" className="fig__pad" />
          <rect x="52" y="70" width="20" height="6" rx="3" className="fig__pad" />
          <rect x="56" y="76" width="4" height="16" className="fig__frame" />
          <rect x="44" y="76" width="4" height="16" className="fig__frame" />
          <rect x="40" y="89" width="28" height="3.5" rx="1.6" className="fig__frame" />
        </g>
      );

    case 'seat':
      return (
        <g>
          <Ground />
          <rect x="34" y="73" width="36" height="6" rx="3" className="fig__pad" />
          <path d="M 66 73 L 72 73 L 74 52 L 68 52 Z" className="fig__pad" />
          <rect x="49" y="79" width="5" height="13" className="fig__frame" />
          <rect x="38" y="89" width="28" height="3.5" rx="1.6" className="fig__frame" />
        </g>
      );

    case 'lat_tower':
      return (
        <g>
          <Ground />
          <rect x="84" y="12" width="5" height="80" className="fig__frame" />
          <rect x="48" y="11" width="40" height="4" rx="2" className="fig__frame" />
          <circle cx="50" cy="15" r="3.4" className="fig__frameline" fill="none" />
          <rect x="34" y="73" width="34" height="6" rx="3" className="fig__pad" />
          {/* thigh pad — the part a beginner never works out is adjustable */}
          <rect x="40" y="60" width="20" height="5" rx="2.5" className="fig__pad" />
          <rect x="47" y="79" width="5" height="13" className="fig__frame" />
          <rect x="70" y="40" width="12" height="34" rx="2" className="fig__stack" />
        </g>
      );

    case 'press_sled':
      return (
        <g>
          <Ground />
          <path d="M 8 48 L 50 78 L 46 85 L 4 55 Z" className="fig__pad" />
          <rect x="42" y="78" width="22" height="6" rx="3" className="fig__pad" />
          <path d="M 72 40 L 92 68 L 86 73 L 66 45 Z" className="fig__plate" />
          <line x1="60" y1="84" x2="90" y2="42" className="fig__frameline" />
          <rect x="6" y="89" width="80" height="3.5" rx="1.6" className="fig__frame" />
        </g>
      );

    case 'pull_bar':
      // No ground: the feet are off it, and a floor line under a
      // hanging figure makes it look like it is standing on air.
      return (
        <g>
          <rect x="14" y="8" width="72" height="5" rx="2.5" className="fig__frame" />
          <rect x="14" y="13" width="5" height="88" className="fig__frame" />
          <rect x="81" y="13" width="5" height="88" className="fig__frame" />
        </g>
      );

    case 'cable_tower':
      return (
        <g>
          <Ground />
          <rect x="84" y="10" width="6" height="82" className="fig__frame" />
          <circle cx="87" cy="19" r="4" className="fig__frameline" fill="none" />
          <rect x="72" y="44" width="11" height="40" rx="2" className="fig__stack" />
          <line x1="77.5" y1="16" x2="77.5" y2="46" className="fig__frameline" />
        </g>
      );

    case 'dip_bars':
      return (
        <g>
          <Ground />
          {/* parallel bars, one near and one far — a dip station is
              not a squat rack, and a beginner sent to the wrong one
              is the exact failure this scenery exists to prevent */}
          <rect x="26" y="50" width="52" height="4" rx="2" className="fig__frame" />
          <rect x="30" y="56" width="44" height="3" rx="1.5" className="fig__stack" />
          <rect x="28" y="54" width="4.5" height="38" className="fig__frame" />
          <rect x="71" y="54" width="4.5" height="38" className="fig__frame" />
          <rect x="22" y="88" width="20" height="4" rx="2" className="fig__frame" />
          <rect x="62" y="88" width="20" height="4" rx="2" className="fig__frame" />
        </g>
      );

    case 'row_station':
      return (
        <g>
          <Ground />
          <rect x="22" y="84" width="62" height="4" rx="2" className="fig__frame" />
          <rect x="34" y="78" width="26" height="6" rx="3" className="fig__pad" />
          {/* foot plate, angled, where the feet actually land */}
          <path d="M 76 66 L 84 70 L 80 84 L 72 82 Z" className="fig__pad" />
          <circle cx="90" cy="79" r="3.6" className="fig__frameline" fill="none" />
          <rect x="86" y="46" width="10" height="30" rx="2" className="fig__stack" />
        </g>
      );

    case 'rack':
      return (
        <g>
          <Ground />
          <rect x="12" y="20" width="6" height="72" className="fig__frame" />
          <rect x="82" y="20" width="6" height="72" className="fig__frame" />
          <path d="M 18 34 L 24 34 L 24 29" className="fig__frameline" fill="none" />
          <path d="M 82 34 L 76 34 L 76 29" className="fig__frameline" fill="none" />
          <rect x="6" y="88" width="18" height="4" rx="2" className="fig__frame" />
          <rect x="76" y="88" width="18" height="4" rx="2" className="fig__frame" />
        </g>
      );

    case 'stairs':
      return (
        <g>
          {[0, 1, 2].map((i) => (
            <rect key={i} x={26 + i * 18} y={92 - i * 12} width="22" height="4" rx="1.5"
              className="fig__frame" />
          ))}
          <rect x="26" y="96" width="70" height="4" className="fig__groundfill" />
        </g>
      );

    case 'treadmill':
      return (
        <g>
          <rect x="8" y="88" width="84" height="7" rx="3" className="fig__frame" />
          <rect x="12" y="86" width="76" height="3" rx="1.5" className="fig__pad" />
          <rect x="84" y="46" width="4" height="42" className="fig__frame" />
          <rect x="70" y="36" width="20" height="12" rx="2.5" className="fig__panel" />
        </g>
      );

    case 'bike':
      // Built around the resolved cycling pose rather than around a
      // picture of a bicycle: the crank sits where the feet travel
      // and the bars sit where the hands are, so the rider is ON the
      // machine instead of hovering beside it.
      return (
        <g>
          <Ground />
          <circle cx="71" cy="87" r="5" className="fig__frameline" fill="none" />
          <path d="M 50 76 L 71 87" className="fig__frameline" fill="none" />
          <path d="M 71 87 L 70 44" className="fig__frameline" fill="none" />
          <rect x="41" y="71" width="19" height="5" rx="2.5" className="fig__pad" />
          <rect x="60" y="38" width="21" height="3.6" rx="1.8" className="fig__frame" />
          <circle cx="86" cy="72" r="9" className="fig__frameline" fill="none" />
          <rect x="60" y="88" width="34" height="4" rx="2" className="fig__frame" />
        </g>
      );

    case 'rower':
      // The flywheel goes in FRONT of the rower — that is the
      // direction they are pulling from — and the seat rail is long
      // because the seat is the thing that slides.
      return (
        <g>
          <Ground />
          <rect x="18" y="86" width="62" height="4" rx="2" className="fig__frame" />
          <rect x="32" y="81" width="30" height="5" rx="2.5" className="fig__pad" />
          <path d="M 62 72 L 70 76 L 66 88 L 58 85 Z" className="fig__pad" />
          <circle cx="84" cy="68" r="11" className="fig__frameline" fill="none" />
        </g>
      );

    default:
      return null;
  }
});

/* ============================================================
   THE LOAD

   `--accent` is earned here and nowhere else in the drawing: the
   implement IS the thing being lifted, and a member scanning the
   picture should find it first.

   Everything is drawn across the body rather than in strict
   projection. A barbell seen truly side-on is a disc, which is
   correct and unreadable; the bar-with-plates everyone recognises
   wins, and being recognised is the entire job.
   ============================================================ */
export const Prop = memo(function Prop({
  glyph, at, anchor,
}: {
  glyph: PropGlyph;
  at: readonly [number, number];
  /** Where a cable or band runs to. null draws a short stub instead. */
  anchor: readonly [number, number] | null;
}) {
  const [x, y] = at;
  switch (glyph) {
    case 'barbell':
      return (
        <g>
          <line x1={x - 15} y1={y} x2={x + 15} y2={y} className="fig__bar" />
          {[-1, 1].map((s) => (
            <g key={s}>
              <rect x={x + s * 9 - 1.6} y={y - 6} width="3.2" height="12" rx="1.2" className="fig__plate" />
              <rect x={x + s * 12.4 - 1.3} y={y - 4} width="2.6" height="8" rx="1" className="fig__plate" />
            </g>
          ))}
        </g>
      );

    case 'dumbbell':
      return (
        <g>
          <line x1={x - 5} y1={y} x2={x + 5} y2={y} className="fig__bar" />
          {[-1, 1].map((s) => (
            <rect key={s} x={x + s * 6.5 - 2} y={y - 4.4} width="4" height="8.8" rx="1.6"
              className="fig__plate" />
          ))}
        </g>
      );

    case 'kettlebell':
      return (
        <g>
          <path d={`M ${x - 3.4} ${y} A 3.4 3.4 0 0 1 ${x + 3.4} ${y}`} className="fig__bar" fill="none" />
          <path d={`M ${x - 4.6} ${y + 1.5} A 5 5 0 1 0 ${x + 4.6} ${y + 1.5} Z`} className="fig__plate" />
        </g>
      );

    case 'machine_handle':
      return (
        <g>
          <line x1={x - 6} y1={y} x2={x + 6} y2={y} className="fig__bar" />
          {[-1, 1].map((s) => (
            <circle key={s} cx={x + s * 6} cy={y} r="2" className="fig__plate" />
          ))}
        </g>
      );

    case 'cable': {
      const to = anchor ?? [x, y - 14];
      return (
        <g>
          <line x1={x} y1={y} x2={to[0]} y2={to[1]} className="fig__cable" />
          <rect x={x - 5.5} y={y - 2} width="11" height="4" rx="2" className="fig__bar-f" />
        </g>
      );
    }

    case 'band': {
      // With no anchor the band runs to where the OTHER hand is —
      // across the body. That is what a pull-apart or an external
      // rotation actually looks like, and it is far better than a
      // band disappearing into the floor.
      const to = anchor ?? [100 - x, y];
      const mx = (x + to[0]) / 2;
      const my = (y + to[1]) / 2;
      return (
        <path
          d={`M ${x} ${y} Q ${mx} ${my + 7} ${to[0]} ${to[1]}`}
          className="fig__band" fill="none"
        />
      );
    }

    case 'rope':
      return (
        <g>
          <path d={`M ${x} ${y} Q 50 24 ${100 - x} ${y}`} className="fig__cable" fill="none" />
          {[-1, 1].map((s) => (
            <rect key={s} x={(s < 0 ? x : 100 - x) - 1.4} y={y - 3} width="2.8" height="6" rx="1.2"
              className="fig__bar-f" />
          ))}
        </g>
      );

    default:
      return null;
  }
});

/* ============================================================
   THE BODY
   ============================================================ */

interface Shape { d: string; key: string }

function legShapes(p: FigurePoints, prefix: string): Shape[] {
  return [
    { key: `${prefix}-thigh`, d: limbPath(p.hip, p.knee, WIDTHS.thighTop, WIDTHS.knee) },
    { key: `${prefix}-shin`, d: limbPath(p.knee, p.ankle, WIDTHS.knee, WIDTHS.ankle) },
    { key: `${prefix}-foot`, d: footPath(p) },
  ];
}

function armShapes(p: FigurePoints, prefix: string): Shape[] {
  return [
    { key: `${prefix}-upper`, d: limbPath(p.shoulder, p.elbow, WIDTHS.shoulder, WIDTHS.elbow) },
    { key: `${prefix}-fore`, d: limbPath(p.elbow, p.hand, WIDTHS.elbow, WIDTHS.wrist) },
    {
      key: `${prefix}-hand`,
      d: limbPath(p.hand, [
        p.hand[0] + (p.hand[0] - p.elbow[0]) * 0.12,
        p.hand[1] + (p.hand[1] - p.elbow[1]) * 0.12,
      ], WIDTHS.hand, WIDTHS.hand * 0.8),
    },
  ];
}

function trunkShapes(p: FigurePoints, pose: Pose): Shape[] {
  const [lower, upper] = torsoPaths(p);
  const neckEnd: [number, number] = [
    p.shoulder[0] + (p.head[0] - p.shoulder[0]) * 0.55,
    p.shoulder[1] + (p.head[1] - p.shoulder[1]) * 0.55,
  ];
  return [
    { key: 'torso-lower', d: lower },
    { key: 'torso-upper', d: upper },
    { key: 'neck', d: limbPath(p.shoulder, neckEnd, WIDTHS.neck * 1.3, WIDTHS.neck) },
    { key: 'head-anchor', d: headEllipsePath(p, pose) },
  ];
}

/**
 * The head as a path rather than an `<ellipse>`, so it lives in the
 * same ink-and-skin passes as everything else. An ellipse element
 * would need its own stroke and would show a seam where the neck
 * meets it.
 */
function headEllipsePath(p: FigurePoints, pose: Pose): string {
  const h = headShape(p, pose);
  const rad = (h.rotate * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  // Two half-arcs around the major axis, rotated into place.
  const ax = h.cx + cos * h.rx;
  const ay = h.cy + sin * h.rx;
  const bx = h.cx - cos * h.rx;
  const by = h.cy - sin * h.rx;
  return `M ${ax.toFixed(2)} ${ay.toFixed(2)} `
    + `A ${h.rx} ${h.ry} ${h.rotate} 1 0 ${bx.toFixed(2)} ${by.toFixed(2)} `
    + `A ${h.rx} ${h.ry} ${h.rotate} 1 0 ${ax.toFixed(2)} ${ay.toFixed(2)} Z`;
}

function Pass({ shapes, tone }: { shapes: Shape[]; tone: 'near' | 'far' | 'ghost' }) {
  if (tone === 'ghost') {
    return (
      <g className="fig__ghost">
        {shapes.map((s) => <path key={s.key} d={s.d} />)}
      </g>
    );
  }
  return (
    <>
      <g className={`fig__ink fig__ink--${tone}`}>
        {shapes.map((s) => <path key={s.key} d={s.d} />)}
      </g>
      <g className={`fig__skin fig__skin--${tone}`}>
        {shapes.map((s) => <path key={s.key} d={s.d} />)}
      </g>
    </>
  );
}

/**
 * One posture. Pure — the same pose renders the same thing, which
 * is what lets the animation be nothing more than an index.
 */
export const Figure = memo(function Figure({
  pose: current, symmetry = 'mirror', partner, farOverride, ghost,
}: {
  pose: Pose;
  symmetry?: Symmetry;
  /** The other frame's pose, for alternating (gait) movements. */
  partner?: Pose;
  /** Per-frame far-side corrections, for genuinely asymmetric shapes. */
  farOverride?: Partial<Pose>;
  /** The pose being moved AWAY from, drawn as a faint outline. */
  ghost?: Pose | null;
}) {
  const near = resolvePose(current);
  const farPose: Pose = { ...farSideOf(current, symmetry, partner), ...(farOverride ?? {}) };
  const far = resolvePose(farPose);

  /*
   * Four passes, in depth order, and each limb gets its OWN ink pass
   * on purpose. Drawing the whole near side in one pass merges the
   * arm into the chest, which is geometrically honest and visually
   * useless: a pull-up, a dip and an overhead press all collapsed
   * into the same featureless blob because the arm was inside the
   * torso's silhouette. A separate pass gives the limb a contour
   * where it crosses the body, exactly as an illustrator would draw
   * it, while its own segments still merge at the elbow.
   */
  return (
    <>
      {ghost && (
        <Pass tone="ghost" shapes={[
          ...trunkShapes(resolvePose(ghost), ghost),
          ...legShapes(resolvePose(ghost), 'g'),
          ...armShapes(resolvePose(ghost), 'g'),
        ]} />
      )}
      <Pass tone="far" shapes={[...legShapes(far, 'fl'), ...armShapes(far, 'fa')]} />
      <Pass tone="near" shapes={trunkShapes(near, current)} />
      <Pass tone="near" shapes={legShapes(near, 'nl')} />
      <Pass tone="near" shapes={armShapes(near, 'na')} />
    </>
  );
});

/* ============================================================
   DIRECTION

   "Which way do I move?" is the question a still frame cannot
   answer and a loop only answers to somebody already watching.
   The arrow answers it at every moment, including the first.

   The head is sized to be unmistakable without competing with the
   body — the proportion rule every technical illustration follows,
   and the reason this is not simply a bigger stroke.
   ============================================================ */
export const MotionArrow = memo(function MotionArrow({ cue, points }: {
  cue: MotionCue | null;
  points: FigurePoints;
}) {
  if (!cue) return null;
  const centre = figureCentre(points);
  const arrow = arcArrow(cue.from, cue.to, centre);
  if (!arrow) return null;

  /*
   * Shift the whole arrow clear of the body.
   *
   * Bowing the curve away from the centre of mass is not enough on
   * its own: on a bench press the hand travels straight up past the
   * chest, and an arrow that merely bulges still lies across the
   * figure's head. Translating the arrow outward puts it in empty
   * space, where it reads as an annotation rather than as part of
   * the person.
   */
  const mid: readonly [number, number] = [
    (cue.from[0] + cue.to[0]) / 2,
    (cue.from[1] + cue.to[1]) / 2,
  ];
  const ax = mid[0] - centre[0];
  const ay = mid[1] - centre[1];
  const len = Math.hypot(ax, ay) || 1;
  const shift = `translate(${((ax / len) * 5).toFixed(2)} ${((ay / len) * 5).toFixed(2)})`;

  const [tx, ty] = cue.to;
  const head = (
    <path
      d="M 0 0 L -7.6 4.3 L -5.6 0 L -7.6 -4.3 Z"
      transform={`translate(${tx.toFixed(2)} ${ty.toFixed(2)}) rotate(${arrow.tipAngle.toFixed(1)})`}
    />
  );

  /*
   * Drawn twice: a halo in the stage colour, then the arrow. Wherever
   * it does cross a limb, the halo keeps the guide colour legible
   * against the body instead of merging into its outline — the same
   * reason a caption on a photograph gets a shadow.
   */
  return (
    <g transform={shift} aria-hidden="true">
      <g className="fig__arrow-halo">
        <path d={arrow.path} />
        {head}
      </g>
      <g className="fig__arrow">
        <path d={arrow.path} />
        <g className="fig__arrowhead">{head}</g>
      </g>
    </g>
  );
});

export { HEAD_RADIUS };
