import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, EmptyState, Modal } from '../../components/ui/primitives';
import { SearchInput } from '../../components/ui/forms';
import { Icon } from '../../components/ui/Icon';
import { useApp, useData } from '../../state/app';
import * as api from '../../lib/api';
import type { SessionSet, WorkoutSession } from '../../lib/types';
import { errorMessage } from '../../components/ui/forms';

/**
 * The live training loop. Everything here is thumb-first: previous performance
 * is pre-filled, one tap completes a set, and the rest timer starts itself.
 * Research is blunt that auto-filling last time's numbers is the single most
 * useful feature for progressive overload — so it is the default, not a setting.
 */
export default function SessionPlayer() {
  const { session, toast, celebrate, confirm } = useApp();
  const nav = useNavigate();
  const memberId = session?.memberId ?? '';

  const active = useData(() => (session && memberId ? api.sessions.active(session, memberId) : null), [memberId]);
  const [starting, setStarting] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [picker, setPicker] = useState(false);
  const [rest, setRest] = useState<{ total: number; left: number } | null>(null);
  const [elapsed, setElapsed] = useState(0);

  /* ---- elapsed clock ---- */
  useEffect(() => {
    if (!active) return;
    const tick = () => setElapsed(Math.max(0, Math.round((Date.now() - new Date(active.startedAt).getTime()) / 1000)));
    tick();
    const t = window.setInterval(tick, 1000);
    return () => window.clearInterval(t);
  }, [active?.id, active?.startedAt]);

  /* ---- rest timer ---- */
  useEffect(() => {
    if (!rest) return;
    if (rest.left <= 0) { setRest(null); return; }
    const t = window.setTimeout(() => setRest((r) => (r ? { ...r, left: r.left - 1 } : null)), 1000);
    return () => window.clearTimeout(t);
  }, [rest]);

  const start = useCallback(async () => {
    if (!session || !memberId) return;
    setStarting(true);
    try {
      await api.sessions.start(session, memberId, {});
    } catch (e) {
      toast('error', 'Could not start the session', errorMessage(e));
    } finally {
      setStarting(false);
    }
  }, [session, memberId, toast]);

  // Auto-start so "Start workout" is genuinely one tap from Home.
  useEffect(() => {
    if (session && memberId && !active && !starting) void start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, memberId, active]);

  if (!session || !memberId) return null;

  if (!active) {
    return (
      <div className="player">
        <div className="player__body">
          <div className="player__inner">
            <EmptyState icon="dumbbell" title="Preparing your session" message="One moment." />
          </div>
        </div>
      </div>
    );
  }

  const grouped = groupByExercise(active);
  const workingSets = active.sets.filter((s) => s.kind !== 'warmup');
  const completed = workingSets.filter((s) => s.completed);
  const volume = active.sets
    .filter((s) => s.completed && s.kind !== 'warmup')
    .reduce((sum, s) => sum + s.reps * s.weightKg, 0);

  const finish = async () => {
    if (!completed.length) {
      const ok = await confirm({
        title: 'Nothing logged yet',
        message: 'You have not completed any sets. Discard this session?',
        confirmLabel: 'Discard',
        tone: 'danger',
      });
      if (ok) { await api.sessions.discard(session, active.id); nav('/member', { replace: true }); }
      return;
    }
    setFinishing(true);
    try {
      const summary = await api.sessions.finish(session, active.id, {});
      const prs = summary.records;
      const delta = summary.previousVolume != null
        ? Math.round(summary.volume - summary.previousVolume) : null;

      celebrate({
        icon: prs.length ? 'trophy' : 'checkCircle',
        title: prs.length ? 'New personal record' : 'Workout complete',
        message: prs.length
          ? prs.slice(0, 2).map((p) =>
            `${api.exercises.name(p.exerciseId)} — ${p.value.toFixed(1)} kg`
            + (p.previous > 0 ? ` (up ${(p.value - p.previous).toFixed(1)} kg)` : ''),
          ).join(' · ')
          : delta != null && delta !== 0
            ? `${Math.abs(delta).toLocaleString('en-IN')} kg ${delta > 0 ? 'more' : 'less'} volume than your last session.`
            : 'Logged and added to your history.',
        stats: [
          { value: formatClock(summary.session.durationSec), label: 'Duration' },
          { value: String(summary.workingSets), label: 'Sets' },
          { value: `${Math.round(summary.volume).toLocaleString('en-IN')} kg`, label: 'Volume' },
        ],
        actionLabel: 'Done',
        onAction: () => nav('/member', { replace: true }),
      });
    } catch (e) {
      toast('error', 'Could not finish the session', errorMessage(e));
    } finally {
      setFinishing(false);
    }
  };

  const discard = async () => {
    const ok = await confirm({
      title: 'Discard this workout?',
      message: 'Everything logged in this session will be removed. This cannot be undone.',
      confirmLabel: 'Discard workout',
      tone: 'danger',
    });
    if (!ok) return;
    await api.sessions.discard(session, active.id);
    toast('info', 'Workout discarded');
    nav('/member', { replace: true });
  };

  return (
    <div className="player">
      <div className="player__bar">
        <Button variant="ghost" size="sm" icon="chevronDown" onClick={() => nav('/member')}
          aria-label="Minimise session" />
        <div className="u-grow" style={{ minWidth: 0 }}>
          <div className="t-sm u-truncate" style={{ fontWeight: 620 }}>{active.title}</div>
          <div className="t-xs t-faint">
            {completed.length} of {workingSets.length} sets · {Math.round(volume).toLocaleString('en-IN')} kg
          </div>
        </div>
        <span className="player__clock">{formatClock(elapsed)}</span>
      </div>

      <div className="player__body">
        <div className="player__inner">
          {grouped.length === 0 ? (
            <EmptyState
              icon="dumbbell" title="Nothing planned for today"
              message="Add the exercises you are training and log them as you go."
              action={<Button variant="primary" icon="plus" onClick={() => setPicker(true)}>Add exercise</Button>}
            />
          ) : (
            grouped.map((group) => (
              <ExerciseBlock
                key={group.exerciseId}
                sessionId={active.id}
                exerciseId={group.exerciseId}
                sets={group.sets}
                memberId={memberId}
                onSetCompleted={(restSec) => setRest({ total: restSec, left: restSec })}
              />
            ))
          )}

          {grouped.length > 0 && (
            <Button block icon="plus" onClick={() => setPicker(true)} className="u-mt-2">
              Add exercise
            </Button>
          )}

          {rest && (
            <div className="resttimer" role="status" aria-live="polite">
              <span className="resttimer__time">{formatClock(rest.left)}</span>
              <span className="resttimer__bar">
                <span className="resttimer__fill" style={{ width: `${(rest.left / rest.total) * 100}%` }} />
              </span>
              <button onClick={() => setRest((r) => (r ? { ...r, left: r.left + 30 } : null))}>+30s</button>
              <button onClick={() => setRest(null)}>Skip</button>
            </div>
          )}
        </div>
      </div>

      <div className="player__foot">
        <div className="player__foot-inner">
          <Button onClick={discard} style={{ flex: '0 0 auto' }} aria-label="Discard workout" icon="trash" />
          <Button variant="primary" size="lg" className="u-grow" loading={finishing} onClick={finish}>
            Finish workout
          </Button>
        </div>
      </div>

      {picker && (
        <ExercisePicker
          sessionId={active.id}
          memberId={memberId}
          onClose={() => setPicker(false)}
        />
      )}
    </div>
  );
}

/* ============================================================
   One exercise, its sets, and the last time it was trained
   ============================================================ */
function ExerciseBlock({
  sessionId, exerciseId, sets, memberId, onSetCompleted,
}: {
  sessionId: string; exerciseId: string; sets: SessionSet[]; memberId: string;
  onSetCompleted: (restSec: number) => void;
}) {
  const { session, toast } = useApp();
  const exercise = useData(() => (session ? safeExercise(session, exerciseId) : null), [exerciseId]);
  const last = useData(
    () => (session ? api.sessions.lastPerformance(session, memberId, exerciseId, sessionId) : null),
    [exerciseId, memberId],
  );

  if (!session || !exercise) return null;
  const tracksWeight = exercise.tracks.includes('weight');
  const anyDone = sets.some((s) => s.completed);

  const complete = async (set: SessionSet) => {
    await api.sessions.updateSet(session, sessionId, set.id, { completed: !set.completed });
    if (!set.completed && set.kind !== 'warmup') onSetCompleted(90);
  };

  const change = async (set: SessionSet, field: 'reps' | 'weightKg', raw: string) => {
    const value = Number(raw.replace(/[^\d.]/g, '')) || 0;
    await api.sessions.updateSet(session, sessionId, set.id, { [field]: value });
  };

  const addSet = async () => {
    const template = sets.filter((x) => x.kind !== 'warmup').at(-1);
    try {
      await api.sessions.addSet(session, sessionId, {
        exerciseId,
        reps: template?.reps ?? last?.reps ?? 10,
        weightKg: template?.weightKg ?? last?.weightKg ?? 0,
        kind: 'normal',
      });
    } catch (e) {
      toast('error', 'Could not add the set', errorMessage(e));
    }
  };

  const removeSet = async (setId: string) => {
    try { await api.sessions.removeSet(session, sessionId, setId); }
    catch (e) { toast('error', 'Could not remove the set', errorMessage(e)); }
  };

  return (
    <section className={`exblock ${anyDone ? '' : 'exblock--active'}`}>
      <div className="exblock__head">
        <div className="u-grow" style={{ minWidth: 0 }}>
          <div className="exblock__name">{exercise.name}</div>
          <div className="exblock__meta">
            {exercise.muscleGroup} · {exercise.equipment}
          </div>
          {last ? (
            <span className="exblock__last">
              <Icon name="undo" size={11} />
              Last time: {last.weightKg > 0 ? `${last.weightKg} kg × ${last.reps}` : `${last.reps} reps`}
            </span>
          ) : (
            <span className="exblock__last">First time — set your baseline</span>
          )}
        </div>
      </div>

      <div className="setgrid">
        <span className="setgrid__head">Set</span>
        <span className="setgrid__head">{tracksWeight ? 'kg' : 'Time'}</span>
        <span className="setgrid__head">Reps</span>
        <span className="setgrid__head" />

        {sets.map((set) => (
          <div key={set.id} className={`setrow-contents ${set.completed ? 'setrow--done' : ''}`}>
            <button
              className={`setrow-num ${set.kind === 'warmup' ? 'setrow-num--warmup' : ''} ${set.completed ? 'setrow-num--done' : ''}`}
              onClick={() => removeSet(set.id)}
              title="Remove this set"
              aria-label={`Remove set ${set.setNo}`}
            >
              {set.kind === 'warmup' ? 'W' : set.setNo}
            </button>
            <input
              className="setinput" inputMode="decimal"
              value={tracksWeight ? (set.weightKg || '') : Math.round(set.durationSec / 60) || ''}
              placeholder={tracksWeight ? String(last?.weightKg ?? 0) : '—'}
              onChange={(e) => change(set, 'weightKg', e.target.value)}
              aria-label={`Set ${set.setNo} weight`}
            />
            <input
              className="setinput" inputMode="numeric"
              value={set.reps || ''}
              placeholder={String(last?.reps ?? 10)}
              onChange={(e) => change(set, 'reps', e.target.value)}
              aria-label={`Set ${set.setNo} reps`}
            />
            <button
              className="setcheck" aria-pressed={set.completed}
              onClick={() => complete(set)}
              aria-label={set.completed ? `Mark set ${set.setNo} incomplete` : `Complete set ${set.setNo}`}
            >
              <Icon name="check" size={18} strokeWidth={2.6} />
            </button>
          </div>
        ))}
      </div>

      <div style={{ padding: '0 var(--s-4) var(--s-4)' }}>
        <Button size="sm" icon="plus" block onClick={addSet}>Add set</Button>
      </div>
    </section>
  );
}

/* ============================================================
   Exercise picker
   ============================================================ */
function ExercisePicker({
  sessionId, memberId, onClose,
}: { sessionId: string; memberId: string; onClose: () => void }) {
  const { session, toast } = useApp();
  const [q, setQ] = useState('');
  const rows = useData(() => (session ? api.exercises.list(session, { q }) : []), [q]);

  const add = async (exerciseId: string) => {
    if (!session) return;
    const last = api.sessions.lastPerformance(session, memberId, exerciseId);
    try {
      await api.sessions.addExercise(session, sessionId, exerciseId, {
        sets: 3, reps: last?.reps ?? 10, weightKg: last?.weightKg ?? 0,
      });
      toast('success', 'Added to this workout', api.exercises.name(exerciseId));
      onClose();
    } catch (e) {
      toast('error', 'Could not add the exercise', errorMessage(e));
    }
  };

  return (
    <Modal title="Add exercise" onClose={onClose}
      footer={<Button block onClick={onClose}>Close</Button>}>
      <div className="u-col u-gap-3">
        <SearchInput value={q} onChange={setQ} placeholder="Search by name, muscle or equipment" />
        <ul className="cardlist" style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-md)', overflow: 'hidden', maxHeight: '46dvh', overflowY: 'auto' }}>
          {rows.slice(0, 40).map((e) => (
            <li key={e.id}>
              <button className="cardlist__item" onClick={() => add(e.id)}>
                <span className="u-grow" style={{ minWidth: 0 }}>
                  <span className="t-sm" style={{ fontWeight: 560 }}>{e.name}</span>
                  <span className="t-xs t-faint" style={{ display: 'block' }}>
                    {e.muscleGroup} · {e.equipment}
                  </span>
                </span>
                {e.scope === 'member' && <span className="tag tag--custom">Custom</span>}
                <Icon name="plus" size={16} className="t-faint" />
              </button>
            </li>
          ))}
          {rows.length === 0 && (
            <li style={{ padding: 'var(--s-4)' }} className="t-sm t-faint">
              No exercise matches “{q}”. You can create it in the exercise library.
            </li>
          )}
        </ul>
      </div>
    </Modal>
  );
}

/* ---------------- helpers ---------------- */

function groupByExercise(session: WorkoutSession): Array<{ exerciseId: string; sets: SessionSet[] }> {
  const map = new Map<string, SessionSet[]>();
  for (const set of [...session.sets].sort((a, b) => a.order - b.order || a.setNo - b.setNo)) {
    map.set(set.exerciseId, [...(map.get(set.exerciseId) ?? []), set]);
  }
  return [...map.entries()].map(([exerciseId, sets]) => ({ exerciseId, sets }));
}

function safeExercise(session: Parameters<typeof api.exercises.get>[0], id: string) {
  try { return api.exercises.get(session, id); } catch { return null; }
}

function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    : `${m}:${String(sec).padStart(2, '0')}`;
}

export { formatClock };
