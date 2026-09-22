/* ============================================================
   THE HOW-TO DEMONSTRATION (§12, §9).

   Turns a `pose` ExerciseMedia record into an animated
   demonstration. This is the only module that knows a drawing is
   made of angles; every screen above it just hands over an
   exercise id.

   It teaches four things at once, and each one is a separate
   decision:

     WHAT THE BODY DOES   the posed figure, animated on the
                          drawing's own timings so the effort
                          phase is held and the return is quick.
     WHICH WAY IT MOVES   a ghost of the previous position plus an
                          arrow on the joint that actually
                          travelled. A still frame cannot say
                          "downwards", and a loop only says it to
                          somebody who happened to be watching.
     WHAT THE PHASES ARE  the name of the phase you are looking
                          at, and how many there are. In the
                          player this is a caption ACROSS THE
                          BOTTOM OF THE STAGE, not a row of
                          controls under it: the demonstration
                          already shows the phases by running
                          through them, and a strip of pills plus
                          a cue plus a summary line was 133px of
                          an exercise card that has to reach the
                          set inputs. The full strip survives at
                          `hero`, where explaining IS the job.
     WHAT ONE REP IS      spelled out under the strip in the
                          teaching sheet, because "how far do I
                          go?" is a question a beginner cannot
                          answer from a picture of a person
                          part-way through a movement. It is not
                          in the player: by then they have opened
                          the sheet or they have not.

   Three things it still deliberately does NOT do:

     · It does not autoplay behind your back. The frame timer only
       runs while the component is mounted, and the component is
       only mounted for the ACTIVE exercise (§27) — opening a
       workout with eight exercises animates one, not eight.
     · It does not carry playback chrome. No scrubber, no sound,
       no fullscreen. If the movement needs a control surface, the
       drawing has failed.
     · It does not grow without limit. `size` picks from three
       fixed stages. A media block that scales with the viewport
       is how "the visual is the primary information" quietly
       becomes "the set inputs are below the fold".
   ============================================================ */
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  FIGURE_VIEWBOX, effortIndex, motionBetween, resolvePose,
  type MovementDrawing, type PatternFrame, type PropGlyph, type SceneGlyph,
} from '../../data/media/figure';
import { Figure, MotionArrow, Prop, Scene, anchorFor } from './Figure';

/** How much room the demonstration gets. Never a fluid value. */
export type HowToSize = 'hero' | 'player' | 'compact';

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
 * One frame, drawn. Shared by the animation, the reduced-motion
 * strip and the static thumbnail, so all three are guaranteed to
 * be the same picture.
 */
const Frame = memo(function Frame({
  drawing, frame, prop, scene, ghost, arrow,
}: {
  drawing: MovementDrawing;
  frame: PatternFrame;
  prop: PropGlyph;
  scene: SceneGlyph;
  ghost: PatternFrame | null;
  arrow: boolean;
}) {
  const points = resolvePose(frame.pose);
  const motion = arrow && ghost ? motionBetween(ghost.pose, frame.pose) : null;
  // In a gait loop the far side takes the OTHER frame's pose, which
  // is what turns two frames of running into running rather than
  // two frames of hopping.
  const partner = drawing.frames.find((f) => f !== frame)?.pose;
  return (
    <g transform={drawing.flip ? 'translate(100,0) scale(-1,1)' : undefined}>
      <Scene scene={scene} />
      <Figure
        pose={frame.pose}
        symmetry={drawing.symmetry}
        partner={partner}
        farOverride={frame.farPose}
        ghost={ghost ? ghost.pose : null}
      />
      <Prop glyph={prop} at={points.hand} anchor={anchorFor(scene)} />
      <MotionArrow cue={motion} points={points} />
    </g>
  );
});

/**
 * A single still frame with no timer at all.
 *
 * Used wherever a list needs to show WHICH exercise a row is —
 * the library grid, the plan day, the exercise picker. A list of
 * thirty rows must not start thirty animations (§27), and a still
 * of the effort frame already answers "which movement is this?".
 */
export const PoseThumb = memo(function PoseThumb({
  drawing, prop, scene, label,
}: {
  drawing: MovementDrawing;
  prop: PropGlyph;
  scene: SceneGlyph;
  label?: string;
}) {
  const frame = drawing.frames[effortIndex(drawing)] ?? drawing.frames[0];
  return (
    <svg viewBox={FIGURE_VIEWBOX} className="posethumb" role="img"
      aria-label={label ?? `${drawing.name} demonstration`}>
      <Frame drawing={drawing} frame={frame} prop={prop} scene={scene} ghost={null} arrow={false} />
    </svg>
  );
});

export function HowTo({
  drawing, prop, scene, size = 'player', paused = false, showPhases = true,
}: {
  drawing: MovementDrawing;
  prop: PropGlyph;
  scene: SceneGlyph;
  size?: HowToSize;
  /** Stop the timer without unmounting — used while a set is being typed. */
  paused?: boolean;
  showPhases?: boolean;
}) {
  const reduced = usePrefersReducedMotion();
  const [frame, setFrame] = useState(0);
  const timer = useRef<number | undefined>(undefined);

  const frames = drawing.frames;

  /**
   * "One rep" is everything after the setup frame. Derived rather
   * than authored: a drawing that gains a frame should not also
   * need somebody to remember to update a sentence about it.
   */
  const repPhases = useMemo(() => {
    if (frames.length < 3) return null;
    return frames.slice(1).map((f) => f.label).join(' → ');
  }, [frames]);

  useEffect(() => {
    if (reduced || paused || frames.length < 2) return;
    const hold = frames[frame]?.holdMs ?? 700;
    timer.current = window.setTimeout(
      () => setFrame((i) => (i + 1) % frames.length),
      hold,
    );
    return () => window.clearTimeout(timer.current);
  }, [frame, frames, reduced, paused]);

  /**
   * Every phase and its cue, always in the DOM. This is the
   * demonstration's equivalent of a chart's data table: the
   * movement has to be readable by somebody who cannot see the
   * figure move, and by somebody whose browser never animates it.
   */
  const description = (
    <ol className="sr-only">
      {frames.map((f, i) => (
        <li key={f.label + i}>{f.label}. {f.cue ?? ''}</li>
      ))}
    </ol>
  );

  // Reduced motion: the movement as a strip, which is a legitimate
  // way to read a movement rather than a degraded one.
  //
  // In the player the strip has the SAME footprint as the animated
  // stage — one 180px square — so three frames came out 46px wide
  // each and taught nothing. It shows two instead: the start, and the
  // position the effort is in. Start and end are the pair that
  // actually define a repetition; the frames between them are the
  // animation's business. The sheet still gets every frame.
  if (reduced) {
    const strip = size === 'hero' || frames.length < 3
      ? frames
      : [frames[0], frames[effortIndex(drawing)]].filter((f, i, a) => a.indexOf(f) === i);
    return (
      <figure className={`howto howto--${size} howto--strip`}>
        <div className="howto__row">
          {strip.map((f, i) => (
            <div key={f.label + i} className="howto__cell">
              <svg viewBox={FIGURE_VIEWBOX} className="howto__svg" role="img"
                aria-label={`${drawing.name}, ${f.label}`}>
                <Frame drawing={drawing} frame={f} prop={prop} scene={scene}
                  ghost={i > 0 ? strip[i - 1] : null} arrow />
              </svg>
              <span className="howto__steplabel">{f.label}</span>
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

  const current = frames[frame] ?? frames[0];
  const previous = frames.length > 1 ? frames[(frame - 1 + frames.length) % frames.length] : null;
  const hold = current.holdMs ?? 700;

  // The teaching sheet explains; the player demonstrates. Only the
  // sheet gets the strip, the per-frame cue and the rep summary.
  const explain = size === 'hero';

  return (
    <figure className={`howto howto--${size}`}>
      <div className="howto__stage">
        <svg viewBox={FIGURE_VIEWBOX} className="howto__svg" role="img"
          aria-label={`${drawing.name} demonstration, ${current.label}`}>
          <Frame drawing={drawing} frame={current} prop={prop} scene={scene}
            ghost={previous} arrow />
        </svg>

        {/* The phase, ON the picture. It costs no layout height, it
            sits next to the thing it is naming, and the dots answer
            "how many parts are there" without a control surface. */}
        {showPhases && !explain && frames.length > 1 && (
          <div className="howto__tag" aria-hidden="true">
            <span className="howto__tagname">{current.label}</span>
            <span className="howto__dots">
              {frames.map((f, i) => (
                <i key={f.label + i} className={i === frame ? 'is-now' : ''} />
              ))}
            </span>
          </div>
        )}
      </div>

      {showPhases && explain && (
        <div className="howto__phases">
          <ol className="howto__steps" aria-hidden="true">
            {frames.map((f, i) => (
              <li key={f.label + i} className={i === frame ? 'is-now' : ''}>
                <span className="howto__stepname">{f.label}</span>
                {/* The bar runs for exactly as long as the frame is
                    held, so the strip is a clock rather than a legend. */}
                {i === frame && !paused && (
                  <span key={`${frame}-bar`} className="howto__stepbar"
                    style={{ animationDuration: `${hold}ms` }} />
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
