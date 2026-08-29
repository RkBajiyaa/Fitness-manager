import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, Card, CardBody, EmptyState } from '../../components/ui/primitives';
import { NumberStepper, SelectField, TextareaField, errorMessage } from '../../components/ui/forms';
import { Icon } from '../../components/ui/Icon';
import { useApp, useData } from '../../state/app';
import * as api from '../../lib/api';
import type { WorkoutLogSet } from '../../lib/types';
import { parseISO, todayISO } from '../../lib/date';

type Draft = Omit<WorkoutLogSet, 'id'>;

/**
 * The three-tap path: pick the exercise (today's plan is pre-loaded),
 * thumb the reps and weight, add the set. Nothing here needs a keyboard.
 */
export default function LogWorkout() {
  const { session, toast } = useApp();
  const nav = useNavigate();
  const today = todayISO();
  const memberId = session?.memberId ?? '';

  const catalogue = useData(() => api.workouts.catalogue(), []);
  const plan = useData(() => (session && memberId ? api.workouts.planFor(session, memberId) : null), [memberId]);
  const existing = useData(() => (session && memberId ? api.workouts.logOn(session, memberId, today) : null), [memberId]);

  const dow = parseISO(today).getDay();
  const todayPlan = useMemo(
    () => (plan?.exercises ?? []).filter((e) => e.dayOfWeek === dow).sort((a, b) => a.order - b.order),
    [plan, dow],
  );

  const suggested = todayPlan.length
    ? todayPlan.map((e) => ({ id: e.exerciseId, target: e }))
    : catalogue.slice(0, 5).map((e) => ({ id: e.id, target: null }));

  const [exerciseId, setExerciseId] = useState(suggested[0]?.id ?? catalogue[0]?.id ?? '');
  const [reps, setReps] = useState(10);
  const [weight, setWeight] = useState(0);
  const [minutes, setMinutes] = useState(20);
  const [distance, setDistance] = useState(3);
  const [duration, setDuration] = useState(60);
  const [notes, setNotes] = useState('');
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [busy, setBusy] = useState(false);

  const exercise = catalogue.find((e) => e.id === exerciseId);
  const isCardio = exercise?.kind === 'cardio';
  const target = todayPlan.find((e) => e.exerciseId === exerciseId);

  const pickExercise = (id: string) => {
    setExerciseId(id);
    const t = todayPlan.find((e) => e.exerciseId === id);
    if (t) { setReps(t.reps); setWeight(t.targetWeight); }
  };

  const setNoFor = (id: string) =>
    drafts.filter((d) => d.exerciseId === id).length
    + (existing?.sets.filter((s) => s.exerciseId === id).length ?? 0) + 1;

  const addSet = () => {
    if (!exerciseId) return;
    setDrafts((d) => [...d, {
      exerciseId,
      setNo: setNoFor(exerciseId),
      reps: isCardio ? 0 : reps,
      weightKg: isCardio ? 0 : weight,
      durationSec: isCardio ? minutes * 60 : 0,
      distanceKm: isCardio ? distance : 0,
    }]);
  };

  const save = async () => {
    if (!session || !memberId || !drafts.length) return;
    setBusy(true);
    try {
      await api.workouts.logSets(session, memberId, {
        date: today, durationMin: duration, notes, sets: drafts,
      });
      toast('success', 'Workout logged',
        `${drafts.length} set${drafts.length === 1 ? '' : 's'} saved. It is already in your history.`);
      nav('/member/workout');
    } catch (e) {
      toast('error', 'Could not save workout', errorMessage(e));
    } finally { setBusy(false); }
  };

  if (!session) return null;

  const volume = drafts.reduce((s, d) => s + d.reps * d.weightKg, 0);

  return (
    <div className="anim-page u-col u-gap-4">
      <div className="u-between">
        <div>
          <h1 className="t-h1">Log workout</h1>
          <p className="t-sm t-muted u-mt-2">
            {todayPlan.length ? "Today's plan is loaded — adjust and add." : 'Log anything you trained today.'}
          </p>
        </div>
        <Button size="sm" variant="ghost" icon="x" onClick={() => nav(-1)} aria-label="Cancel" />
      </div>

      {/* ---- exercise picker ---- */}
      <section>
        <h2 className="t-label u-mb-3">Exercise</h2>
        <div className="u-row u-gap-2 u-wrap u-mb-3">
          {suggested.map((s) => (
            <button key={s.id} className="chip" aria-pressed={exerciseId === s.id}
              onClick={() => pickExercise(s.id)}>
              {api.workouts.exerciseName(s.id)}
            </button>
          ))}
        </div>
        <SelectField
          aria-label="Choose any exercise"
          value={exerciseId}
          onChange={(e) => pickExercise(e.target.value)}
          options={catalogue.map((e) => ({ value: e.id, label: `${e.name} · ${e.muscleGroup}` }))}
        />
        {target && (
          <p className="t-xs t-faint u-mt-2">
            Target today: {target.sets} sets × {target.reps} reps
            {target.targetWeight ? ` at ${target.targetWeight} kg` : ''}
            {target.instructions ? ` — ${target.instructions}` : ''}
          </p>
        )}
      </section>

      {/* ---- set entry ---- */}
      <Card>
        <CardBody>
          {isCardio ? (
            <div className="form-grid">
              <NumberStepper label="Duration (min)" value={minutes} onChange={setMinutes} step={5} max={300} />
              <NumberStepper label="Distance (km)" value={distance} onChange={setDistance} step={0.5} max={200} />
            </div>
          ) : (
            <div className="form-grid">
              <NumberStepper label="Reps" value={reps} onChange={setReps} step={1} min={1} max={100} />
              <NumberStepper label="Weight (kg)" value={weight} onChange={setWeight} step={2.5} max={500}
                hint="0 for bodyweight" />
            </div>
          )}
          <Button className="u-mt-4" variant="primary" block icon="plus" onClick={addSet} disabled={!exerciseId}>
            Add {isCardio ? 'session' : `set ${setNoFor(exerciseId)}`}
          </Button>
        </CardBody>
      </Card>

      {/* ---- this session ---- */}
      <section>
        <div className="u-between u-mb-3">
          <h2 className="t-label">This session</h2>
          {drafts.length > 0 && <Badge tone="brand">{drafts.length} sets · {volume.toLocaleString('en-IN')} kg volume</Badge>}
        </div>

        {drafts.length === 0 ? (
          <Card><EmptyState icon="dumbbell" title="No sets added yet"
            message="Pick an exercise, set the reps and weight, then tap Add set. Add as many as you like before saving." /></Card>
        ) : (
          <Card><CardBody flush>
            <ul className="cardlist">
              {drafts.map((d, i) => (
                <li key={i} className="cardlist__item" style={{ cursor: 'default' }}>
                  <span style={{
                    width: 28, height: 28, flex: 'none', display: 'grid', placeItems: 'center',
                    borderRadius: '50%', background: 'var(--brand-soft)', color: 'var(--brand)',
                    fontSize: 'var(--fs-12)', fontWeight: 640,
                  }}>{d.setNo}</span>
                  <span className="u-grow" style={{ minWidth: 0 }}>
                    <span className="t-sm u-truncate" style={{ fontWeight: 550, display: 'block' }}>
                      {api.workouts.exerciseName(d.exerciseId)}
                    </span>
                    <span className="t-xs t-faint">
                      {d.durationSec
                        ? `${Math.round(d.durationSec / 60)} min${d.distanceKm ? ` · ${d.distanceKm} km` : ''}`
                        : `${d.reps} reps${d.weightKg ? ` × ${d.weightKg} kg` : ' · bodyweight'}`}
                    </span>
                  </span>
                  <Button size="sm" variant="ghost" icon="trash" aria-label="Remove set"
                    onClick={() => setDrafts((x) => x.filter((_, j) => j !== i))} />
                </li>
              ))}
            </ul>
          </CardBody></Card>
        )}
      </section>

      {drafts.length > 0 && (
        <>
          <NumberStepper label="Total workout time (min)" value={duration} onChange={setDuration} step={5} max={300} />
          <TextareaField label="Notes" placeholder="Optional — how did it feel?"
            value={notes} onChange={(e) => setNotes(e.target.value)} />
        </>
      )}

      {existing && existing.sets.length > 0 && (
        <p className="t-xs t-faint u-row u-gap-2">
          <Icon name="info" size={13} style={{ flex: 'none', marginTop: 2 }} />
          You already logged {existing.sets.length} sets today — these will be added to the same workout.
        </p>
      )}

      <div className="sticky-actions">
        <Button className="u-grow" onClick={() => nav(-1)}>Cancel</Button>
        <Button className="u-grow" variant="primary" icon="check" onClick={save}
          loading={busy} disabled={!drafts.length}>
          Save workout
        </Button>
      </div>
    </div>
  );
}
