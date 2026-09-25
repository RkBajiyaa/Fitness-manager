/* ============================================================
   THE MUSCLE MAP — "which part of me is this working?"

   A body chart with the exercise's muscles marked on it. Primary
   muscles are filled solid in anatomical red; secondary muscles
   are the same hue at a fraction of the weight, so they read as
   "also involved" without competing with the answer.

   Four rules this component exists to enforce:

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
     · IT SHOWS THE VIEW THAT ANSWERS THE QUESTION. A lat pulldown
       has nothing to say on the front of the body and a biceps
       curl has nothing to say on the back. Where there is only
       room for one chart it shows the one that carries the
       primary muscles (`views='key'`); where there is room for
       both it still marks which one is the answer.
   ============================================================ */
import { memo, useMemo } from 'react';
import {
  ANATOMY_VIEWBOX, BODY_SOLIDS, DEFINITION, LIMB_SEGMENTS, MIRROR, SHOULDER_CAP,
  TORSO_PATH, keyViewFor, musclesForGroup, regionPath, type AnatomyView,
} from '../../data/media/anatomy';
import { limbPath } from '../../data/media/figure';

/**
 * The static body, identical on both views apart from its
 * definition lines. Never re-rendered.
 *
 * Drawn in the same two passes as the moving figure: an ink pass
 * (fill plus a fat stroke) and a fill pass over it. Stroking the
 * shapes individually instead leaves a ring around the shoulder cap
 * and a line across the elbow — an articulated mannequin rather
 * than a body, which quietly contradicts the muscle regions laid
 * over it.
 */
const Body = memo(function Body({ view }: { view: AnatomyView }) {
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
  const lines = DEFINITION[view];
  return (
    <>
      {/* The figure's light, on the chart. Upper left, the same
          direction every drawing in the product is lit from (§7):
          two bodies lit from different sides are two products. */}
      <defs>
        <linearGradient id="mmapSkin" x1="0.1" y1="0" x2="0.95" y2="1">
          <stop offset="0" className="fig2__g-lit" />
          <stop offset="0.5" className="fig2__g-mid" />
          <stop offset="1" className="fig2__g-core" />
        </linearGradient>
      </defs>
      <g className="mmap__bodyink">{all}</g>
      <g className="mmap__bodyfill">{all}</g>
      {/* Modelling, under the highlights: enough of a body that a
          member can find a muscle before it is coloured in. */}
      <g className="mmap__detail">
        {lines.centre.map((d, i) => <path key={`c${i}`} d={d} />)}
        {lines.side.map((d, i) => <path key={`s${i}`} d={d} />)}
        <g transform={MIRROR}>
          {lines.side.map((d, i) => <path key={`m${i}`} d={d} />)}
        </g>
      </g>
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
  view, primary, secondary, label, isKey, showLabel,
}: {
  view: AnatomyView;
  primary: string[];
  secondary: string[];
  label: string;
  isKey: boolean;
  showLabel: boolean;
}) {
  return (
    <div className={`mmap__view ${isKey ? 'is-key' : ''}`}>
      <svg viewBox={ANATOMY_VIEWBOX} className="mmap__svg" role="presentation" focusable="false">
        <Body view={view} />
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
      {showLabel && <span className="mmap__viewlabel">{label}</span>}
    </div>
  );
}

export function MuscleMap({
  primaryMuscles, secondaryMuscles, muscleGroup, labelFor,
  size = 'md', variant = 'full', views = 'both',
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
  /**
   * `key` draws only the view that carries the primary muscles. The
   * player uses it: one large readable body beside the demonstration
   * beats two bodies too small to find a muscle on.
   */
  views?: 'both' | 'key';
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

  const key = useMemo(() => keyViewFor(primary, secondary), [primary, secondary]);
  const shown: AnatomyView[] = views === 'key' ? [key] : ['front', 'back'];
  const nothingKnown = primary.length === 0 && secondary.length === 0;

  /**
   * On a single view the caption may only name what that view
   * actually marks. A back squat working "Quads, Glutes" printed
   * beside a chart showing glutes alone teaches a beginner that the
   * red shape is their quadriceps. The full two-view key is one tap
   * away in the teaching sheet — colour never travels without its
   * word, and no word travels without its colour.
   */
  const onView = (list: readonly string[]) =>
    (views === 'key' ? list.filter((m) => regionPath(m, key)) : list);
  const captionOf = onView(primary).length ? onView(primary) : onView(secondary);
  const named = captionOf.map(labelFor).join(', ');

  return (
    <div className={`mmap mmap--${size} mmap--${views}`}>
      <div className="mmap__views">
        {shown.map((v) => (
          <View key={v} view={v} primary={primary} secondary={secondary}
            label={v === 'front' ? 'Front' : 'Back'}
            isKey={v === key && !nothingKnown}
            showLabel={views === 'both'} />
        ))}
      </div>

      {nothingKnown ? (
        <p className="mmap__none">No muscles recorded.</p>
      ) : variant === 'compact' ? (
        <p className="mmap__caption">
          {views === 'key' && (
            <span className="mmap__captionview">{key === 'front' ? 'Front' : 'Back'}</span>
          )}
          <span className="mmap__captionnames">
            <span className="mmap__swatch mmap__swatch--primary" />
            {named}
          </span>
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
