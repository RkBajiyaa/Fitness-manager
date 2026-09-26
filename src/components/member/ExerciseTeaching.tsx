/* ============================================================
   THE EXERCISE SHEET — everything one movement has to teach.

   Reading order is the order a beginner's questions arrive, which
   is not the order a database would produce:

     1  WHAT is this?          the demonstration, large, moving
     2  WHAT do I need?        equipment, plainly named
     3  WHERE do I focus?      one cue, alone, so it is read
     4  WHAT am I working?     the muscle chart
     5  HOW do I set up?       position before movement
     6  HOW does it move?      the steps, numbered
     7  WHAT goes wrong?       mistakes, last, because they only
                               make sense once you know the
                               movement they are mistakes IN

   Steps 5–7 are collapsed by default on the small variant. That
   is the whole answer to "do not make this frustrating for
   experienced members": the parts a beginner needs are the parts
   that cost screen space, so an experienced member can fold them
   away and the preference is remembered per exercise sheet by not
   existing at all — they simply do not open it.

   Nothing here fetches. Callers pass the rows they already have,
   so the sheet can be rendered inside a modal, inside the player,
   or inline in a plan without three different loading states.
   ============================================================ */
import { Badge } from '../ui/primitives';
import { Icon } from '../ui/Icon';
import { HowTo, MistakeCompare } from './HowTo';
import { MuscleMap } from './MuscleMap';
import { muscleSets } from '../../data/media/anatomy';
import type { Exercise } from '../../lib/types';
import type { ResolvedHowTo } from '../../lib/api';

export interface TeachingLabels {
  muscleGroup: (k: string) => string;
  muscle: (k: string) => string;
  equipment: (k: string) => string;
  difficulty: (k: string) => string;
  kind: (k: string) => string;
  mechanic: (k: string) => string;
}

/**
 * The equipment line.
 *
 * Deliberately a sentence and not just a chip: "Barbell" means
 * nothing to somebody who has never been handed one, and the
 * scenery in the demonstration has already shown them the bench,
 * the rack or the cable stack it goes with. Naming both closes
 * the loop between the picture and the word.
 */
function EquipmentLine({ exercise, labels }: { exercise: Exercise; labels: TeachingLabels }) {
  return (
    <div className="exsheet__kit">
      <span className="exsheet__kiticon"><Icon name="dumbbell" size={15} /></span>
      <span>
        <span className="exsheet__kitlabel">You need</span>
        <span className="exsheet__kitvalue">{labels.equipment(exercise.equipment)}</span>
      </span>
    </div>
  );
}

export function ExerciseTeaching({
  exercise, howTo, labels, size = 'hero',
}: {
  exercise: Exercise;
  howTo: ResolvedHowTo | null;
  labels: TeachingLabels;
  size?: 'hero' | 'player';
}) {
  /* One resolution of "what does this work", used by the figure and
     the chart, so the body and the map can never disagree (§16). */
  const marks = muscleSets(
    exercise.primaryMuscles, exercise.secondaryMuscles, exercise.muscleGroup,
  );
  const hasDetail = exercise.setup.length > 0 || exercise.steps.length > 0
    || exercise.mistakes.length > 0 || Boolean(exercise.breathing);

  return (
    <div className="exsheet">
      {howTo ? (
        <HowTo key={howTo.drawing.key} drawing={howTo.drawing}
          prop={howTo.prop} scene={howTo.scene} size={size}
          primary={marks.primary} secondary={marks.secondary} />
      ) : (
        /* A member-authored exercise has no drawing, and borrowing a
           picture of a different movement would be worse than saying
           so (§12). */
        <div className="exsheet__nodrawing">
          <Icon name="info" size={16} />
          <span>No demonstration for this one — it is your own exercise.</span>
        </div>
      )}

      <div className="exsheet__chips">
        <Badge>{labels.kind(exercise.kind)}</Badge>
        <Badge>{labels.difficulty(exercise.difficulty)}</Badge>
        {exercise.mechanic && <Badge>{labels.mechanic(exercise.mechanic)}</Badge>}
        {exercise.scope === 'member' && <Badge tone="brand">Your exercise</Badge>}
      </div>

      <EquipmentLine exercise={exercise} labels={labels} />

      {exercise.focus && (
        <div className="exsheet__focus">
          <span className="exsheet__focusicon"><Icon name="target" size={16} /></span>
          <span>
            <span className="exsheet__focuslabel">Focus on this</span>
            <span className="exsheet__focustext">{exercise.focus}</span>
          </span>
        </div>
      )}

      <section className="exsheet__block">
        <h3 className="exsheet__h">What it works</h3>
        <MuscleMap
          primaryMuscles={exercise.primaryMuscles}
          secondaryMuscles={exercise.secondaryMuscles}
          stabilisers={howTo?.drawing.stabilisers}
          muscleGroup={exercise.muscleGroup}
          labelFor={labels.muscle}
        />
      </section>

      {hasDetail && (
        <details className="exsheet__more" open={size === 'hero'}>
          <summary>
            <span>How to do it</span>
            <Icon name="chevronDown" size={16} />
          </summary>

          <div className="exsheet__moreinner">
            {exercise.setup.length > 0 && (
              <section className="exsheet__block">
                <h3 className="exsheet__h">Get into position</h3>
                <ul className="exsheet__list">
                  {exercise.setup.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </section>
            )}

            {exercise.steps.length > 0 && (
              <section className="exsheet__block">
                <h3 className="exsheet__h">The movement</h3>
                <ol className="exsheet__steps">
                  {exercise.steps.map((s, i) => (
                    <li key={i}><span className="exsheet__stepno">{i + 1}</span><span>{s}</span></li>
                  ))}
                </ol>
              </section>
            )}

            {exercise.breathing && (
              <p className="exsheet__breath">
                <Icon name="activity" size={14} /> {exercise.breathing}
              </p>
            )}

            {(exercise.mistakes.length > 0 || howTo?.drawing.mistake) && (
              <section className="exsheet__block">
                <h3 className="exsheet__h">Common mistakes</h3>
                {/* Where a drawing carries the classic error, it is shown
                    beside the correct position rather than described (§22).
                    It is never in the animation: a demonstration that
                    cycles through a rounded back teaches a rounded back. */}
                {howTo?.drawing.mistake && (
                  <MistakeCompare drawing={howTo.drawing} prop={howTo.prop}
                    scene={howTo.scene} />
                )}
                <ul className="exsheet__mistakes">
                  {exercise.mistakes.map((m, i) => (
                    <li key={i}><Icon name="x" size={13} strokeWidth={2.6} /><span>{m}</span></li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </details>
      )}

      {/* Safety sits outside the fold. A warning nobody opens is not
          a warning, and these only exist where there is a real risk. */}
      {exercise.safety && (
        <p className="exsheet__safety">
          <Icon name="alert" size={15} />
          <span>{exercise.safety}</span>
        </p>
      )}
    </div>
  );
}
