/* ============================================================
   THE HOW-TO RENDERER (§12, §9).

   Turns a `pose` ExerciseMedia record into a compact animated
   demonstration. This is the only module that knows a drawing is
   made of angles; every screen above it just hands over an
   exercise id.

   Three things it deliberately does NOT do:

     · It does not take over the screen. The figure is capped at
       112px tall so the set controls stay in the thumb zone on a
       360px phone — the single most important constraint in the
       whole player.
     · It does not autoplay behind your back. The frame timer only
       runs while the component is mounted, and the component is
       only mounted for the ACTIVE exercise (§27) — opening a
       workout with eight exercises animates one, not eight.
     · It does not carry playback chrome. No scrubber, no sound,
       no fullscreen. If the movement needs a control surface, the
       drawing has failed.

   `resolvePose` is imported straight from the pose engine on
   purpose: it is a rendering algorithm with no content in it. The
   DRAWING itself is content and arrives through `api.exercises.howTo`.
   ============================================================ */
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  FIGURE_VIEWBOX, HEAD_RADIUS, resolvePose,
  type MovementDrawing, type Pose, type PropGlyph, type SceneGlyph,
} from '../../data/media/figure';

/* ---------------- scenery ----------------
   Fixed furniture behind the figure. It carries the SETUP — a
   bench, a bar, a cable stack — which is information the pose
   alone cannot express, and which is exactly what a member
   standing in front of the wrong machine needs.
   ---------------------------------------- */
function Scene({ scene }: { scene: SceneGlyph }) {
  const ground = <line x1="4" y1="92" x2="96" y2="92" className="howto__ground" />;
  switch (scene) {
    case 'floor':
      return <g>{ground}</g>;
    case 'flat_bench':
      return (
        <g>
          {ground}
          <rect x="18" y="66" width="48" height="4" className="howto__kit" />
          <line x1="24" y1="70" x2="24" y2="92" className="howto__kit-l" />
          <line x1="60" y1="70" x2="60" y2="92" className="howto__kit-l" />
        </g>
      );
    case 'incline_bench':
      return (
        <g>
          {ground}
          <line x1="18" y1="56" x2="60" y2="74" className="howto__kit-l" />
          <line x1="56" y1="74" x2="56" y2="92" className="howto__kit-l" />
        </g>
      );
    case 'seat':
      return (
        <g>
          {ground}
          <rect x="38" y="74" width="30" height="4" className="howto__kit" />
          <line x1="52" y1="78" x2="52" y2="92" className="howto__kit-l" />
        </g>
      );
    case 'press_sled':
      return (
        <g>
          {ground}
          {/* reclined back pad */}
          <line x1="12" y1="54" x2="58" y2="86" className="howto__kit-l" />
          {/* angled foot plate */}
          <line x1="74" y1="46" x2="90" y2="70" className="howto__kit-l" />
        </g>
      );
    case 'pull_bar':
      // No floor: the feet are off it, and drawing one makes the
      // figure look like it is standing on air.
      return <line x1="20" y1="10" x2="80" y2="10" className="howto__kit-l" />;
    case 'cable_tower':
      return (
        <g>
          {ground}
          <line x1="88" y1="14" x2="88" y2="92" className="howto__kit-l" />
        </g>
      );
    case 'rack':
      return (
        <g>
          {ground}
          <line x1="16" y1="26" x2="16" y2="92" className="howto__kit-l" />
          <line x1="84" y1="26" x2="84" y2="92" className="howto__kit-l" />
        </g>
      );
    case 'treadmill':
      return <g><rect x="10" y="92" width="80" height="3" className="howto__kit" /></g>;
    case 'bike':
      return (
        <g>
          {ground}
          <circle cx="50" cy="86" r="7" className="howto__kit-l" fill="none" />
        </g>
      );
    case 'rower':
      return <line x1="20" y1="92" x2="88" y2="92" className="howto__kit-l" />;
    default:
      return null;
  }
}

/** The implement, drawn at the hand. `--accent` is earned here: it is the load. */
function Prop({ glyph, at }: { glyph: PropGlyph; at: [number, number] }) {
  const [x, y] = at;
  switch (glyph) {
    case 'barbell':
      return <line x1={x - 13} y1={y} x2={x + 13} y2={y} className="howto__prop" />;
    case 'dumbbell':
      return <line x1={x - 4.5} y1={y} x2={x + 4.5} y2={y} className="howto__prop" />;
    case 'machine_handle':
      return <line x1={x - 5.5} y1={y} x2={x + 5.5} y2={y} className="howto__prop" />;
    case 'kettlebell':
      return <circle cx={x} cy={y + 3} r={3.2} className="howto__prop-f" />;
    case 'cable':
    case 'band':
      return <circle cx={x} cy={y} r={2.2} className="howto__prop-f" />;
    case 'rope':
      return <path d={`M ${x} ${y} Q 50 30 ${100 - x} ${y}`} className="howto__prop" fill="none" />;
    default:
      return null;
  }
}

/** One posture. Pure — given the same pose it renders the same thing. */
const Figure = memo(function Figure({ pose, prop }: { pose: Pose; prop: PropGlyph }) {
  const p = resolvePose(pose);
  const seg = (a: readonly [number, number], b: readonly [number, number], key: string) => (
    <line key={key} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />
  );
  return (
    <>
      <g className="howto__fig">
        {seg(p.hip, p.shoulder, 'spine')}
        {seg(p.hip, p.knee, 'thigh')}
        {seg(p.knee, p.ankle, 'shin')}
        {seg(p.ankle, p.toe, 'foot')}
        {seg(p.shoulder, p.elbow, 'upper')}
        {seg(p.elbow, p.hand, 'fore')}
        <circle cx={p.head[0]} cy={p.head[1]} r={HEAD_RADIUS} className="howto__head" />
      </g>
      <Prop glyph={prop} at={p.hand} />
    </>
  );
});

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

/**
 * The compact demonstration.
 *
 * With reduced motion the animation stops and every frame is drawn
 * side by side instead — the movement is still legible as a strip,
 * which is better than freezing on frame one and calling it
 * accessible.
 */
/**
 * Note for whoever extends this: there is deliberately no effect
 * resetting `frame` when `drawing` changes. The call site passes
 * `key={drawing.key}`, so a different movement gets a fresh
 * component rather than a stale frame index — which is both simpler
 * and one less cascading render.
 */
export function HowTo({
  drawing, prop, scene, paused = false,
}: {
  drawing: MovementDrawing;
  prop: PropGlyph;
  scene: SceneGlyph;
  /** Stop the timer without unmounting — used while a set is being typed. */
  paused?: boolean;
}) {
  const reduced = usePrefersReducedMotion();
  const [frame, setFrame] = useState(0);
  const timer = useRef<number | undefined>(undefined);

  const frames = drawing.frames;
  const stepLabels = useMemo(() => frames.map((f) => f.label), [frames]);

  useEffect(() => {
    if (reduced || paused || frames.length < 2) return;
    const hold = frames[frame]?.holdMs ?? 700;
    timer.current = window.setTimeout(
      () => setFrame((i) => (i + 1) % frames.length),
      hold,
    );
    return () => window.clearTimeout(timer.current);
  }, [frame, frames, reduced, paused]);

  // Reduced motion: the whole movement as a static strip.
  if (reduced) {
    return (
      <div className="howto howto--strip">
        {frames.map((f, i) => (
          <figure key={i} className="howto__cell">
            <svg viewBox={FIGURE_VIEWBOX} className="howto__svg" role="img"
              aria-label={`${drawing.name}, ${f.label}`}>
              <Scene scene={scene} />
              <Figure pose={f.pose} prop={prop} />
            </svg>
            <figcaption className="howto__step">{f.label}</figcaption>
          </figure>
        ))}
      </div>
    );
  }

  const current = frames[frame] ?? frames[0];
  return (
    <div className="howto">
      <div className="howto__cell">
        <svg viewBox={FIGURE_VIEWBOX} className="howto__svg" role="img"
          aria-label={`${drawing.name} demonstration`}>
          <Scene scene={scene} />
          <Figure pose={current.pose} prop={prop} />
        </svg>
      </div>
      {/* The labels ARE the instruction — "Setup → Lower → Press".
          The active one is marked so the still and the words agree. */}
      <ol className="howto__steps" aria-label={`${drawing.name} steps`}>
        {stepLabels.map((label, i) => (
          <li key={label + i} className={i === frame ? 'is-now' : ''}>{label}</li>
        ))}
      </ol>
    </div>
  );
}
