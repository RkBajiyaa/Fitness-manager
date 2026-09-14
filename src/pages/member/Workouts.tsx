import { useNavigate } from 'react-router-dom';
import {
  Badge, Button, Card, CardBody, EmptyState,
} from '../../components/ui/primitives';
import { Icon } from '../../components/ui/Icon';
import { useApp, useData } from '../../state/app';
import * as api from '../../lib/api';
import { relativeDay } from '../../lib/format';
import { dayOf } from '../../lib/date';

/**
 * The member's own saved workouts.
 *
 * Kept visibly separate from "Program" — what the coach prescribes and
 * what the member builds are different things, and the app never lets
 * one quietly overwrite the other.
 */
export default function MemberWorkouts() {
  const { session, toast, confirm } = useApp();
  const nav = useNavigate();
  const memberId = session?.memberId ?? '';

  const rows = useData(
    () => (session && memberId ? api.workouts.list(session, memberId) : []),
    [memberId],
  );
  const program = useData(
    () => (session && memberId ? api.programs.forMember(session, memberId) : null),
    [memberId],
  );
  const active = useData(
    () => (session && memberId ? api.sessions.active(session, memberId) : null),
    [memberId],
  );

  if (!session || !memberId) return null;

  const start = async (id: string, name: string) => {
    if (active) {
      const ok = await confirm({
        title: 'A workout is already in progress',
        confirmLabel: 'Go to it',
        message: `“${active.title}” has not been finished. Open it instead of starting another.`,
      });
      if (ok) nav('/member/session');
      return;
    }
    await api.sessions.start(session, memberId, { workoutId: id });
    toast('success', `${name} started`);
    nav('/member/session');
  };

  const remove = async (id: string, name: string) => {
    const ok = await confirm({
      title: `Delete “${name}”?`,
      tone: 'danger',
      confirmLabel: 'Delete',
      message: 'The workout template is removed. Sessions you already logged with it keep their history.',
    });
    if (!ok) return;
    await api.workouts.remove(session, memberId, id);
    toast('success', 'Workout deleted');
  };

  return (
    <div className="anim-page u-col u-gap-4">
      <div className="u-between">
        <div>
          <h1 className="t-h1">My workouts</h1>
          <p className="t-sm t-muted u-mt-2">
            {rows.length === 0 ? 'Build your own routines' : `${rows.length} saved`}
          </p>
        </div>
        <Button variant="primary" icon="plus" onClick={() => nav('/member/workouts/new')}>New</Button>
      </div>

      {program && (
        <div className="inline-alert">
          <Icon name="route" size={17} style={{ flex: 'none', marginTop: 1, color: 'var(--text-2)' }} />
          <span className="t-sm t-muted">
            Your coach has assigned <strong>{program.name}</strong>. These are your own workouts —
            building one here never changes the program.{' '}
            <button className="auth__link" onClick={() => nav('/member/workout')}>See the program</button>
          </span>
        </div>
      )}

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon="dumbbell"
            title="No workouts yet"
            message="Build a routine once — pick your exercises, sets and target weights — then start it with one tap whenever you train it."
            action={(
              <div className="u-row u-gap-2 u-wrap" style={{ justifyContent: 'center' }}>
                <Button variant="primary" icon="plus" onClick={() => nav('/member/workouts/new')}>
                  Build a workout
                </Button>
                <Button icon="library" onClick={() => nav('/member/exercises')}>Browse exercises</Button>
              </div>
            )}
          />
        </Card>
      ) : (
        <div className="u-col u-gap-3">
          {rows.map((w) => (
            <Card key={w.id}>
              <CardBody>
                <div className="u-between u-gap-3">
                  <div style={{ minWidth: 0 }}>
                    <div className="u-row u-gap-2 u-wrap">
                      <span className="t-h3">{w.name}</span>
                      {w.lastUsedAt && <Badge>Last used {relativeDay(dayOf(w.lastUsedAt))}</Badge>}
                    </div>
                    {w.focus && <p className="t-sm t-muted u-mt-2">{w.focus}</p>}
                  </div>
                  <Button size="sm" variant="ghost" icon="edit"
                    onClick={() => nav(`/member/workouts/${w.id}`)} aria-label={`Edit ${w.name}`} />
                </div>

                <ul className="u-mt-4">
                  {w.exercises.map((x, i) => (
                    <li key={x.id} className="exline">
                      <span className="exline__idx">{i + 1}</span>
                      <span className="u-grow" style={{ minWidth: 0 }}>
                        <span className="exline__name u-truncate" style={{ display: 'block' }}>
                          {api.exercises.name(x.exerciseId)}
                        </span>
                      </span>
                      <span className="exline__target u-nowrap">
                        {x.sets} × {x.reps}{x.targetWeightKg ? ` · ${x.targetWeightKg} kg` : ''}
                      </span>
                    </li>
                  ))}
                </ul>

                {w.notes && <p className="t-xs t-faint u-mt-3">{w.notes}</p>}

                <div className="u-row u-gap-2 u-mt-4">
                  <Button className="u-grow" variant="primary" icon="play"
                    onClick={() => start(w.id, w.name)}>
                    Start workout
                  </Button>
                  <Button variant="ghost" icon="trash"
                    onClick={() => remove(w.id, w.name)} aria-label={`Delete ${w.name}`} />
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <p className="quiet-note u-center">
        Your workouts are yours. Nothing here is visible to other members.
      </p>
    </div>
  );
}
