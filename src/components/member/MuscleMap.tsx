/* ============================================================
   THE MUSCLE MAP — "which part of me is this working?"

   A front-and-back body chart with the exercise's muscles marked
   on it. Primary muscles are filled solid; secondary muscles are
   the same hue at a fraction of the weight, so they read as
   "also involved" without competing with the answer.

   Three rules this component exists to enforce:

     · PRIMARY AND SECONDARY MUST LOOK DIFFERENT, and the
       difference must survive both themes and a colourblind
       viewer. They differ in FILL WEIGHT, not in hue — the same
       colour at two opacities, which no form of colour vision
       collapses, and which reads correctly in greyscale.
     · COLOUR NEVER TRAVELS ALONE. Every chart ships a legend and
       a written list of the muscles it marked, for the same
       reason every chart in this product ships a data table.
     · IT NEVER GUESSES. An exercise with no muscles recorded —
       every member-authored one — falls back to its muscle GROUP,
       which is honest, and if there is nothing to say it renders
       the body with nothing marked rather than inventing a
       plausible-looking highlight.

   `--accent` is not used here on purpose. Accent means achievement
   in this product (a record, a streak, a milestone); a muscle you
   are about to train is information, not a reward.
   ============================================================ */
import { memo, useMemo } from 'react';
import {
  ANATOMY_VIEWBOX, BODY_SOLIDS, LIMB_SEGMENTS, MIRROR, SHOULDER_CAP, TORSO_PATH,
  musclesForGroup, regionPath, type AnatomyView,
} from '../../data/media/anatomy';
import { limbPath } from '../../data/media/figure';

/**
 * The static body, identical on both views. Never re-rendered.
 *
 * Drawn in the same two passes as the moving figure: an ink pass
 * (fill plus a fat stroke) and a fill pass over it. Stroking the
 * shapes individually instead leaves a ring around the shoulder cap
 * and a line across the elbow — an articulated mannequin rather
 * than a body, which quietly contradicts the muscle regions laid
 * over it.
 */
const Body = memo(function Body() {
  const side = (
    <>
      {LIMB_SEGMENTS.map(([a, b, wa, wb], i) => (
        <path key={i} d={limbPath(a, b, wa, wb)} />
      ))}
      <circle cx={SHOULDER_CAP.cx} cy={SHOULDER_CAP.cy} r={SHOULDER_CAP.r} />
      <ellipse {...BODY_SOLIDS.hand} />
      <ellipse {...BODY_SOLIDS.foot} />
    </>
  );
  const all = (
    <>
      <ellipse {...BODY_SOLIDS.head} />
      <rect x={BODY_SOLIDS.neck.x} y={BODY_SOLIDS.neck.y}
        width={BODY_SOLIDS.neck.w} height={BODY_SOLIDS.neck.h} rx={BODY_SOLIDS.neck.r} />
      <path d={TORSO_PATH} />
      <g>{side}</g>
      <g transform={MIRROR}>{side}</g>
    </>
  );
  return (
    <>
      <g className="mmap__bodyink">{all}</g>
      <g className="mmap__bodyfill">{all}</g>
    </>
  );
});

/** One highlighted muscle, on both sides of the body. */
function Region({ d, tone }: { d: string; tone: 'primary' | 'secondary' }) {
  return (
    <>
      <path d={d} className={`mmap__region mmap__region--${tone}`} />
      <path d={d} className={`mmap__region mmap__region--${tone}`} transform={MIRROR} />
    </>
  );
}

function View({
  view, primary, secondary, label,
}: {
  view: AnatomyView;
  primary: string[];
  secondary: string[];
  label: string;
}) {
  return (
    <div className="mmap__view">
      <svg viewBox={ANATOMY_VIEWBOX} className="mmap__svg" role="presentation" focusable="false">
        <Body />
        {/* Secondary first: where two muscles overlap on the chart
            the primary must win, and paint order is the cheapest
            way to guarantee it. */}
        {secondary.map((m) => {
          const d = regionPath(m, view);
          return d ? <Region key={m} d={d} tone="secondary" /> : null;
        })}
        {primary.map((m) => {
          const d = regionPath(m, view);
          return d ? <Region key={m} d={d} tone="primary" /> : null;
        })}
      </svg>
      <span className="mmap__viewlabel">{label}</span>
    </div>
  );
}

export function MuscleMap({
  primaryMuscles, secondaryMuscles, muscleGroup, labelFor, size = 'md', variant = 'full',
}: {
  primaryMuscles: readonly string[];
  secondaryMuscles: readonly string[];
  /** Fallback for rows with no muscle list — see `musclesForGroup`. */
  muscleGroup: string;
  /** `api.exercises.label.muscle`. Keys are stored, labels are rendered (rule 22). */
  labelFor: (key: string) => string;
  size?: 'sm' | 'md';
  /**
   * `compact` drops the two-row key for a single caption naming the
   * primary muscles. It is NOT a version without words: colour still
   * never travels alone, the caption just says less.
   */
  variant?: 'full' | 'compact';
}) {
  const primary = useMemo(
    () => (primaryMuscles.length ? [...primaryMuscles] : musclesForGroup(muscleGroup)),
    [primaryMuscles, muscleGroup],
  );
  const secondary = useMemo(
    // A muscle cannot be both. Where an author has listed one twice,
    // primary wins and the chart does not paint it at two weights.
    () => secondaryMuscles.filter((m) => !primary.includes(m)),
    [secondaryMuscles, primary],
  );

  const nothingKnown = primary.length === 0 && secondary.length === 0;

  return (
    <div className={`mmap mmap--${size}`}>
      <div className="mmap__views">
        <View view="front" primary={primary} secondary={secondary} label="Front" />
        <View view="back" primary={primary} secondary={secondary} label="Back" />
      </div>

      {nothingKnown ? (
        <p className="mmap__none">No muscles recorded.</p>
      ) : variant === 'compact' ? (
        <p className="mmap__caption">
          <span className="mmap__swatch mmap__swatch--primary" />
          {(primary.length ? primary : secondary).map(labelFor).join(', ')}
        </p>
      ) : (
        <dl className="mmap__key">
          {primary.length > 0 && (
            <div className="mmap__keyrow">
              <dt><span className="mmap__swatch mmap__swatch--primary" />Works</dt>
              <dd>{primary.map(labelFor).join(', ')}</dd>
            </div>
          )}
          {secondary.length > 0 && (
            <div className="mmap__keyrow">
              <dt><span className="mmap__swatch mmap__swatch--secondary" />Also</dt>
              <dd>{secondary.map(labelFor).join(', ')}</dd>
            </div>
          )}
        </dl>
      )}
    </div>
  );
}
