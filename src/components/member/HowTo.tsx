/* ============================================================
   THE HOW-TO DEMONSTRATION (§10, §11, §17, §19, §27).

   This module owns TIME. `Figure.tsx` owns what one instant looks
   like; every screen above this just hands over an exercise id.

   ------------------------------------------------------------
   IT IS NOT THREE PICTURES ANY MORE

   The old demonstration stepped from frame to frame: three stills in
   sequence. That tells you the POSITIONS and nothing about the
   movement — no direction while it is between them, no tempo, and no
   sense that lowering a bar is controlled while pressing it is a
   drive. §10 is explicit that this is the wrong shape.

   So the frames are KEYS and the pose is interpolated. Four things
   make that read as a person:

     · EASING, per frame. `smooth` on a controlled phase, `accel` out
       of a bottom position, `decel` arriving somewhere, `settle` at a
       lockout where a loaded bar genuinely overshoots and comes back.
     · A DWELL at each key, so the working position is HELD rather
       than passed through.
     · TEMPO per drawing. A curl does not move like a squat (§19).
     · ONE COMPOSED FRAME. The viewBox is computed from the drawing's
       own extremes, once, over every key at the same time — so the
       body fills the stage (§17) and cannot grow, shrink or drift
       between phases.

   ------------------------------------------------------------
   AND IT STILL COSTS ALMOST NOTHING

   One demonstration animates at a time — the ACTIVE exercise (§25) —
   at a capped frame rate, and every list uses `PoseThumb`, which has
   no timer at all. Opening a workout with eight exercises animates
   one. The SVG is a few dozen paths and fifteen gradients; there is
   no filter, no mask and no raster anywhere in it.

   Three things it deliberately does NOT do: autoplay off screen,
   carry playback chrome, or scale with the viewport. A media block
   that grows with the window is how "the visual teaches the movement"
   quietly becomes "the set inputs are below the fold".
   ============================================================ */
import { memo, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  buildTimeline, effortIndex, fitBoxOf, planFor, posePoints, resolvePose,
  sampleTimeline, trajectory, travelJoint, viewBoxOf,
  type FigureView, type JointName, type MovementDrawing, type PatternFrame,
  type Pose, type PropGlyph, type SceneGlyph,
} from '../../data/media/figure';
import { activationFrom } from '../../data/media/musculature';
import { Figure, MotionPath, farPoseFor, gripsOf } from './Figure';
import { GROUND_Y, Prop, Scene, anchorFor, type Grip } from './Kit';

/** How much room the demonstration gets. Never a fluid value. */
export type HowToSize = 'hero' | 'player' | 'compact';

/** ~30fps. Smooth for a vector figure, and a third of the work of 90. */
const FRAME_MS = 33;

/** How long one phase owns the loop, tempo included. */
function budgetOf(drawing: MovementDrawing, i: number): number {
  return (drawing.frames[i]?.holdMs ?? 700) * (drawing.tempoScale ?? 1);
}

/** True when the viewer has asked the OS for less motion. */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

/* ============================================================
   COMPOSITION

   Everything that depends only on the DRAWING, computed once and
   memoised on it: the plan, the frame, the trajectory, the range the
   activation is measured against. None of it may depend on the
   current time, or the figure would resize as it moved.
   ============================================================ */

interface Composition {
  view: FigureView;
  viewBox: string;
  /**
   * The composed box's size relative to the original 100-unit box.
   *
   * Every stroke in the stylesheet is a multiple of it. Framing to the
   * body means a hero can be 46 units across and a thumbnail 78, and
   * a fixed 1.7-unit contour would then be visibly heavier on one than
   * the other — which is the exact kind of drift §28 is about.
   */
  unit: number;
  joint: JointName | null;
  path: Array<[number, number]>;
  /** Furthest any sampled position gets from the working position. */
  range: number;
  effortAt: [number, number] | null;
  effort: number;
  holding: boolean;
}

/**
 * Scenery you HOLD ON TO.
 *
 * `prop` says what is in the hands, and for a pull-up or a dip the
 * answer is "nothing" — the thing being gripped is part of the
 * scenery. Without this the hands open and a pull-up is a person
 * reaching past a bar with their fingers splayed (§4).
 */
const GRIP_SCENES: ReadonlySet<SceneGlyph> = new Set(['pull_bar', 'dip_bars']);

/** Roughly how far an implement reaches past the hands, for framing. */
function propReach(glyph: PropGlyph): number {
  switch (glyph) {
    case 'barbell': return 17;
    case 'dumbbell': return 8;
    case 'kettlebell': return 6;
    case 'cable': case 'rope': case 'machine_handle': return 9;
    default: return 3;
  }
}

function compose(drawing: MovementDrawing, prop: PropGlyph, scene: SceneGlyph): Composition {
  const plan = planFor(drawing.view);
  const symmetry = drawing.symmetry ?? 'mirror';
  const pts: Array<[number, number]> = [];

  drawing.frames.forEach((f, i) => {
    const partner = drawing.frames[(i + 1) % drawing.frames.length]?.pose;
    const far = farPoseFor(f.pose, plan, symmetry, partner, f.farPose);
    pts.push(...posePoints(f.pose, plan, far));
    // The implement reaches past the hand, and framing that clips the
    // plates off a barbell is worse than framing a little wider.
    const reach = propReach(prop);
    for (const g of gripsOf(f.pose, far, plan)) {
      pts.push([g.at[0] - reach, g.at[1]], [g.at[0] + reach, g.at[1]]);
    }
  });

  /* Include the floor only when the figure is standing on it. A
     hanging figure framed down to the floor is a person floating in
     the top third of an empty box. */
  const lowest = pts.reduce((m, p) => Math.max(m, p[1]), 0);
  const grounded = scene !== 'pull_bar' && scene !== 'none' && lowest > GROUND_Y - 12;
  const box = fitBoxOf(pts, 6, grounded ? GROUND_Y + 2 : undefined);

  const joint = travelJoint(drawing);
  const effort = effortIndex(drawing);
  const path = joint ? trajectory(drawing, joint) : [];
  const effortAt = joint ? resolvePose(drawing.frames[effort].pose)[joint] : null;
  const range = effortAt
    ? path.reduce((m, p) => Math.max(m, Math.hypot(p[0] - effortAt[0], p[1] - effortAt[1])), 0)
    : 0;

  return {
    view: drawing.view ?? 'side',
    viewBox: viewBoxOf(box),
    unit: box.size / 100,
    joint, path, range, effortAt, effort,
    holding: prop !== 'none' || GRIP_SCENES.has(scene),
  };
}

/* ============================================================
   ONE INSTANT
   ============================================================ */

const Instant = memo(function Instant({
  drawing, pose, comp, prop, scene, primary, secondary, showPath, at,
}: {
  drawing: MovementDrawing;
  pose: Pose;
  comp: Composition;
  prop: PropGlyph;
  scene: SceneGlyph;
  primary: ReadonlySet<string>;
  secondary: ReadonlySet<string>;
  showPath: boolean;
  /** Where the loop is, 0–1, for the chevron on the path. */
  at: number;
}) {
  const plan = planFor(comp.view);
  const symmetry = drawing.symmetry ?? 'mirror';
  const partner = drawing.frames.length > 1 ? drawing.frames[1].pose : undefined;
  const far = farPoseFor(pose, plan, symmetry, partner);
  const grips: Grip[] = gripsOf(pose, far, plan);

  const activation = useMemo(() => {
    if (!comp.joint || !comp.effortAt) return 0.55;
    const here = resolvePose(pose)[comp.joint];
    return activationFrom(
      Math.hypot(here[0] - comp.effortAt[0], here[1] - comp.effortAt[1]),
      comp.range,
    );
  }, [pose, comp]);

  return (
    <g transform={drawing.flip ? 'translate(100,0) scale(-1,1)' : undefined}>
      <Scene scene={scene} plan={plan} />
      <Figure pose={pose} plan={plan} far={far}
        primary={primary} secondary={secondary}
        activation={activation} holding={comp.holding}
        kit={<Prop glyph={prop} grips={grips} anchor={anchorFor(scene, plan)} />} />
      {showPath && <MotionPath points={comp.path} at={at} />}
    </g>
  );
});

/* ============================================================
   THE STAGE

   A soft vertical wash and a floor. Enough to put the figure in a
   place rather than on a blank page (§18), and nothing like a gym:
   the exercise is the subject and a dumbbell rack behind it is
   somebody else's exercise.
   ============================================================ */
const Stage = memo(function Stage({ id }: { id: string }) {
  return (
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" className="fig2__stage-top" />
        <stop offset="1" className="fig2__stage-base" />
      </linearGradient>
    </defs>
  );
});

/**
 * A single still frame with no timer at all.
 *
 * Used wherever a list needs to show WHICH exercise a row is — the
 * library grid, the plan day, the exercise picker. Thirty rows must
 * not start thirty animations (§25), and a still of the working
 * position already answers "which movement is this?".
 */
export const PoseThumb = memo(function PoseThumb({
  drawing, prop, scene, label,
}: {
  drawing: MovementDrawing;
  prop: PropGlyph;
  scene: SceneGlyph;
  label?: string;
}) {
  const comp = useMemo(() => compose(drawing, prop, scene), [drawing, prop, scene]);
  const frame = drawing.frames[comp.effort] ?? drawing.frames[0];
  const empty = useMemo<ReadonlySet<string>>(() => new Set(), []);
  return (
    <svg viewBox={comp.viewBox} className="posethumb" role="img"
      style={{ '--fig-u': comp.unit } as CSSProperties}
      aria-label={label ?? `${drawing.name} demonstration`}>
      <Instant drawing={drawing} pose={frame.pose} comp={comp} prop={prop} scene={scene}
        primary={empty} secondary={empty} showPath={false} at={0} />
    </svg>
  );
});

/**
 * The correct working position beside the classic error (§22).
 *
 * Only ever in the teaching sheet, and only where a drawing carries
 * one. It is not in the animation: a demonstration that cycles
 * through a rounded back is a demonstration teaching a rounded back.
 */
export const MistakeCompare = memo(function MistakeCompare({
  drawing, prop, scene,
}: {
  drawing: MovementDrawing;
  prop: PropGlyph;
  scene: SceneGlyph;
}) {
  const comp = useMemo(() => compose(drawing, prop, scene), [drawing, prop, scene]);
  const empty = useMemo<ReadonlySet<string>>(() => new Set(), []);
  const mistake = drawing.mistake;
  if (!mistake) return null;
  const right = drawing.frames[mistake.at ?? comp.effort] ?? drawing.frames[0];
  return (
    <div className="mistakes2">
      {([['Correct', right.pose, 'ok'], [mistake.label, mistake.pose, 'bad']] as const)
        .map(([label, pose, tone]) => (
          <figure key={tone} className={`mistakes2__cell mistakes2__cell--${tone}`}>
            <svg viewBox={comp.viewBox} className="mistakes2__svg" role="img"
              style={{ '--fig-u': comp.unit } as CSSProperties}
              aria-label={`${drawing.name}, ${label}`}>
              <Instant drawing={drawing} pose={pose} comp={comp} prop={prop} scene={scene}
                primary={empty} secondary={empty} showPath={false} at={0} />
            </svg>
            <figcaption>{label}</figcaption>
          </figure>
        ))}
      <p className="mistakes2__why">{mistake.why}</p>
    </div>
  );
});

export function HowTo({
  drawing, prop, scene, size = 'player', paused = false, showPhases = true,
  primary, secondary,
}: {
  drawing: MovementDrawing;
  prop: PropGlyph;
  scene: SceneGlyph;
  size?: HowToSize;
  /** Stop the clock without unmounting — used while a set is typed. */
  paused?: boolean;
  showPhases?: boolean;
  /** Taxonomy muscle keys to light up on the body (§8). */
  primary?: ReadonlySet<string>;
  secondary?: ReadonlySet<string>;
}) {
  const reduced = usePrefersReducedMotion();
  const comp = useMemo(() => compose(drawing, prop, scene), [drawing, prop, scene]);
  const timeline = useMemo(() => buildTimeline(drawing), [drawing]);
  const [ms, setMs] = useState(0);
  const empty = useMemo<ReadonlySet<string>>(() => new Set(), []);
  const pri = primary ?? empty;
  const sec = secondary ?? empty;

  /*
   * One rAF loop, stepped by real elapsed time so a slow device plays
   * the movement at the right speed rather than in slow motion, and
   * capped so it does not re-render sixty times a second to move a
   * figure a third of a pixel.
   */
  const raf = useRef(0);
  const last = useRef(0);
  useEffect(() => {
    if (reduced || paused || drawing.frames.length < 2) return;
    let live = true;
    last.current = 0;
    const step = (now: number) => {
      if (!live) return;
      if (last.current === 0) last.current = now;
      const dt = now - last.current;
      if (dt >= FRAME_MS) {
        last.current = now;
        setMs((t) => (t + dt) % timeline.total);
      }
      raf.current = window.requestAnimationFrame(step);
    };
    raf.current = window.requestAnimationFrame(step);
    return () => { live = false; window.cancelAnimationFrame(raf.current); };
  }, [reduced, paused, drawing, timeline]);

  const sample = sampleTimeline(drawing, timeline, ms);
  const frames = drawing.frames;
  const current = frames[sample.index] ?? frames[0];

  /**
   * "One rep" is everything after the setup frame. Derived rather
   * than authored: a drawing that gains a frame should not also need
   * somebody to remember a sentence about it.
   */
  const repPhases = useMemo(() => {
    if (frames.length < 3) return null;
    return frames.slice(1).map((f) => f.label).join(' → ');
  }, [frames]);

  /**
   * Every phase and its cue, always in the DOM. The demonstration's
   * equivalent of a chart's data table: the movement has to be
   * readable by somebody who cannot see the figure move.
   */
  const description = (
    <ol className="sr-only">
      {frames.map((f: PatternFrame, i) => (
        <li key={f.label + i}>{f.label}. {f.cue ?? ''}</li>
      ))}
    </ol>
  );

  const stageId = `stage-${drawing.key}-${size}`;

  /*
   * Reduced motion (§27): the movement as a strip. A legitimate way
   * to read a movement rather than a degraded one — the anatomy, the
   * highlighting and the movement path are all still there, and the
   * path is doing MORE work here than it does in the animation
   * because it is the only thing carrying direction.
   *
   * In the player the strip has the same footprint as the animated
   * stage, so three frames come out too small to teach anything. It
   * shows two: the start, and the working position. The sheet gets
   * every frame.
   */
  if (reduced) {
    const indices = size === 'hero' || frames.length < 3
      ? frames.map((_, i) => i)
      : [...new Set([0, comp.effort])];
    return (
      <figure className={`howto howto--${size} howto--strip`}>
        <div className="howto__row">
          {indices.map((i) => (
            <div key={i} className="howto__cell">
              <svg viewBox={comp.viewBox} className="howto__svg" role="img"
                style={{ '--fig-u': comp.unit } as CSSProperties}
                aria-label={`${drawing.name}, ${frames[i].label}`}>
                <Stage id={`${stageId}-${i}`} />
                <rect x="-200" y="-200" width="500" height="500" fill={`url(#${stageId}-${i})`} />
                <Instant drawing={drawing} pose={frames[i].pose} comp={comp}
                  prop={prop} scene={scene} primary={pri} secondary={sec}
                  showPath={i === comp.effort} at={i / Math.max(1, frames.length - 1)} />
              </svg>
              <span className="howto__steplabel">{frames[i].label}</span>
            </div>
          ))}
        </div>
        {showPhases && size === 'hero' && repPhases && (
          <figcaption className="howto__rep">One rep: {repPhases}</figcaption>
        )}
        {description}
      </figure>
    );
  }

  // The teaching sheet explains; the player demonstrates. Only the
  // sheet gets the strip, the per-frame cue and the rep summary.
  const explain = size === 'hero';

  return (
    <figure className={`howto howto--${size}`}>
      <div className="howto__stage">
        <svg viewBox={comp.viewBox} className="howto__svg" role="img"
          style={{ '--fig-u': comp.unit } as CSSProperties}
          aria-label={`${drawing.name} demonstration, ${current.label}`}>
          <Stage id={stageId} />
          <rect x="-200" y="-200" width="500" height="500" fill={`url(#${stageId})`} />
          <Instant drawing={drawing} pose={sample.pose} comp={comp} prop={prop} scene={scene}
            primary={pri} secondary={sec} showPath at={ms / timeline.total} />
        </svg>

        {/* The phase, ON the picture. It costs no layout height, it
            sits next to the thing it is naming, and the dots answer
            "how many parts are there" without a control surface. */}
        {showPhases && !explain && frames.length > 1 && (
          <div className="howto__tag" aria-hidden="true">
            <span className="howto__tagname">{current.label}</span>
            <span className="howto__dots">
              {frames.map((f, i) => (
                <i key={f.label + i} className={i === sample.index ? 'is-now' : ''} />
              ))}
            </span>
          </div>
        )}
      </div>

      {showPhases && explain && (
        <div className="howto__phases">
          <ol className="howto__steps" aria-hidden="true">
            {frames.map((f, i) => (
              <li key={f.label + i} className={i === sample.index ? 'is-now' : ''}>
                <span className="howto__stepname">{f.label}</span>
                {/* The bar runs for exactly as long as this phase owns
                    the timeline, so the strip is a clock rather than a
                    legend. Keyed on the index so it restarts on each
                    phase instead of drifting out of step with it. */}
                {i === sample.index && !paused && (
                  <span key={`bar-${sample.index}`} className="howto__stepbar"
                    style={{ animationDuration: `${budgetOf(drawing, i)}ms` }} />
                )}
              </li>
            ))}
          </ol>
          {current.cue && <p className="howto__cue">{current.cue}</p>}
          {repPhases && <p className="howto__rep">One rep: {repPhases}</p>}
        </div>
      )}
      {description}
    </figure>
  );
}
