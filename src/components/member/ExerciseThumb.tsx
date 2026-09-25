/* ============================================================
   ONE EXERCISE, AS A PICTURE.

   The smallest piece of the visual system and the most widely
   used: every list that names an exercise can show it instead.
   "Incline Dumbbell Press" is a phrase somebody has to already
   understand; a figure on a raked bench pressing two dumbbells is
   not.

   Always a STILL frame. A plan day with eight exercises, a library
   with sixty and a picker with forty must not start eight, sixty
   or forty timers (§27) — and the working phase of a movement,
   frozen, already answers "which one is this?".

   It resolves its own drawing rather than taking one, so a list
   does not have to become a data-fetching component to show a
   picture. The lookup is a map hit on an already-loaded row.
   ============================================================ */
import { Icon } from '../ui/Icon';
import { PoseThumb } from './HowTo';
import { useApp, useData } from '../../state/app';
import * as api from '../../lib/api';

export function ExerciseThumb({
  exerciseId, name, size = 'md',
}: {
  exerciseId: string;
  /** Used as the image's accessible name. */
  name: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const { session } = useApp();
  const howTo = useData(
    () => (session ? api.exercises.howTo(session, exerciseId) : null),
    [exerciseId],
  );
  const cls = `exthumb exthumb--${size}`;

  // A member-authored exercise has no drawing. An icon says so
  // honestly; borrowing a picture of a different movement does not.
  if (!howTo) {
    return <span className={`${cls} exthumb--none`}><Icon name="dumbbell" size={16} /></span>;
  }
  return (
    <span className={cls}>
      <PoseThumb drawing={howTo.drawing} prop={howTo.prop} scene={howTo.scene}
        model={howTo.model} label={name} />
    </span>
  );
}
