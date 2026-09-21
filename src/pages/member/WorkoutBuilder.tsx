import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Badge, Button, Card, CardBody, EmptyState, Modal,
} from '../../components/ui/primitives';
import {
  NumberStepper, SearchInput, TextField, TextareaField, fieldErrors, errorMessage,
} from '../../components/ui/forms';
import { Icon } from '../../components/ui/Icon';
import { useApp, useData } from '../../state/app';
import * as api from '../../lib/api';
import type { WorkoutInput } from '../../lib/api';

interface Draft {
  exerciseId: string;
  name: string;
  sets: number;
  reps: number;
  targetWeightKg: number;
  restSec: number;
  notes: string;
}

/**
 * Member workout builder (§M.7).
 *
 * Add, remove, reorder, set targets, save, start. Deliberately a
 * builder and not a spreadsheet: the defaults are sensible, the last
 * weight you actually lifted is offered, and every control is
 * thumb-sized because this is used standing in a gym.
 */
export default function WorkoutBuilder() {
  const { id } = useParams();
  const { session, toast, confirm } = useApp();
  const nav = useNavigate();
  const memberId = session?.memberId ?? '';
  const editing = Boolean(id);

  const existing = useData(() => {
    if (!session || !memberId || !id) return null;
    try { return api.workouts.get(session, memberId, id); } catch { return null; }
  }, [memberId, id]);

  const [name, setName] = useState('');
  const [focus, setFocus] = useState('');
  const [notes, setNotes] = useState('');
  const [rows, setRows] = useState<Draft[] | null>(null);
  const [picking, setPicking] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  if (!session || !memberId) return null;

  // Seed the form from the stored workout exactly once.
  if (editing && existing && !loaded) {
    setName(existing.name);
    setFocus(existing.focus);
    setNotes(existing.notes);
    setRows(existing.exercises.map((x) => ({
      exerciseId: x.exerciseId,
      name: api.exercises.name(x.exerciseId),
      sets: x.sets, reps: x.reps, targetWeightKg: x.targetWeightKg,
      restSec: x.restSec, notes: x.notes,
    })));
    setLoaded(true);
  }

  if (editing && !existing) {
    return (
      <Card>
        <EmptyState icon="dumbbell" title="Workout not found"
          message="It may have been deleted."
          action={<Button variant="primary" onClick={() => nav('/member/workouts')}>My workouts</Button>} />
      </Card>
    );
  }

  const list = rows ?? [];

  const add = (exerciseId: string, exName: string) => {
    const last = api.sessions.lastPerformance(session, memberId, exerciseId);
    setRows([...list, {
      exerciseId,
      name: exName,
      sets: 3,
      reps: last?.reps || 10,
      targetWeightKg: last?.weightKg ?? 0,
      restSec: 90,
      notes: '',
    }]);
    setPicking(false);
  };

  const move = (index: number, delta: number) => {
    const next = [...list];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setRows(next);
  };

  const patch = (index: number, changes: Partial<Draft>) => {
    setRows(list.map((r, i) => (i === index ? { ...r, ...changes } : r)));
  };

  const save = async () => {
    setBusy(true); setErrors({});
    const input: WorkoutInput = {
      name, focus, notes,
      exercises: list.map((r) => ({
        exerciseId: r.exerciseId, sets: r.sets, reps: r.reps,
        targetWeightKg: r.targetWeightKg, restSec: r.restSec, notes: r.notes,
      })),
    };
    try {
      if (editing && id) {
        await api.workouts.update(session, memberId, id, input);
        toast('success', 'Workout saved');
      } else {
        await api.workouts.create(session, memberId, input);
        toast('success', 'Workout created', 'Start it whenever you train.');
      }
      nav('/member/workouts');
    } catch (e) {
      setErrors(fieldErrors(e));
      if (!Object.keys(fieldErrors(e)).length) toast('error', 'Could not save', errorMessage(e));
    } finally { setBusy(false); }
  };

  const leave = async () => {
    if (list.length > 0 || name) {
      const ok = await confirm({
        title: 'Discard this workout?',
        tone: 'danger',
        confirmLabel: 'Discard',
        message: 'Nothing you have added here is saved yet.',
      });
      if (!ok) return;
    }
    nav('/member/workouts');
  };

  const totalSets = list.reduce((s, r) => s + r.sets, 0);

  return (
    <div className="anim-page u-col u-gap-4">
      <div className="u-between">
        <div>
          <h1 className="t-h1">{editing ? 'Edit workout' : 'New workout'}</h1>
          <p className="t-sm t-muted u-mt-2">
            {list.length === 0 ? 'Add your exercises'
              : `${list.length} exercise${list.length === 1 ? '' : 's'} · ${totalSets} sets`}
          </p>
        </div>
        <Button size="sm" variant="ghost" icon="x" onClick={leave} aria-label="Cancel" />
      </div>

      <Card>
        <CardBody>
          <div className="u-col u-gap-4">
            <TextField label="Workout name" required autoFocus={!editing} value={name}
              error={errors.name} onChange={(e) => setName(e.target.value)}
              placeholder="e.g. My Chest Day" />
            <TextField label="Focus" value={focus} onChange={(e) => setFocus(e.target.value)}
              placeholder="Optional — e.g. Chest & triceps" />
          </div>
        </CardBody>
      </Card>

      {errors.exercises && (
        <div className="inline-alert inline-alert--critical">
          <Icon name="alert" size={16} style={{ flex: 'none', marginTop: 1, color: 'var(--critical)' }} />
          <span className="t-sm" style={{ color: 'var(--critical)' }}>{errors.exercises}</span>
        </div>
      )}

      {list.length === 0 ? (
        <Card>
          <EmptyState
            icon="library"
            title="No exercises yet"
            message="Pick from the library, or create your own exercise if what you do is not listed."
            action={<Button variant="primary" icon="plus" onClick={() => setPicking(true)}>Add exercise</Button>}
          />
        </Card>
      ) : (
        <div className="u-col u-gap-3">
          {list.map((r, i) => (
            <Card key={`${r.exerciseId}-${i}`}>
              <CardBody>
                <div className="u-between u-gap-2">
                  <div className="u-row u-gap-3" style={{ minWidth: 0 }}>
                    <span className="exline__idx">{i + 1}</span>
                    <span className="t-sm u-truncate" style={{ fontWeight: 570 }}>{r.name}</span>
                  </div>
                  <div className="u-row" style={{ gap: 2 }}>
                    <Button size="sm" variant="ghost" icon="chevronUp" disabled={i === 0}
                      onClick={() => move(i, -1)} aria-label={`Move ${r.name} up`} />
                    <Button size="sm" variant="ghost" icon="chevronDown" disabled={i === list.length - 1}
                      onClick={() => move(i, 1)} aria-label={`Move ${r.name} down`} />
                    <Button size="sm" variant="ghost" icon="trash"
                      onClick={() => setRows(list.filter((_, j) => j !== i))}
                      aria-label={`Remove ${r.name}`} />
                  </div>
                </div>

                <div className="buildergrid u-mt-4">
                  <NumberStepper label="Sets" value={r.sets} min={1} max={20}
                    onChange={(v) => patch(i, { sets: v })} />
                  <NumberStepper label="Reps" value={r.reps} min={1} max={100}
                    onChange={(v) => patch(i, { reps: v })} />
                  <NumberStepper label="Weight" value={r.targetWeightKg} step={2.5} min={0} max={500}
                    suffix="kg" onChange={(v) => patch(i, { targetWeightKg: v })} />
                  <NumberStepper label="Rest" value={r.restSec} step={15} min={0} max={600}
                    suffix="sec" onChange={(v) => patch(i, { restSec: v })} />
                </div>

                <TextField className="u-mt-3" label="Note" value={r.notes}
                  onChange={(e) => patch(i, { notes: e.target.value })}
                  placeholder="Optional — e.g. slow negatives" />
              </CardBody>
            </Card>
          ))}

          <Button icon="plus" block onClick={() => setPicking(true)}>Add another exercise</Button>
        </div>
      )}

      <Card>
        <CardBody>
          <TextareaField label="Workout notes" rows={2} value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything you want to remember about this session" />
        </CardBody>
      </Card>

      <div className="u-row u-gap-3">
        <Button onClick={leave}>Cancel</Button>
        <Button className="u-grow" variant="primary" size="lg" loading={busy} onClick={save}>
          {editing ? 'Save changes' : 'Save workout'}
        </Button>
      </div>

      {picking && <ExercisePicker onPick={add} onClose={() => setPicking(false)} />}
    </div>
  );
}

/* ---------------- Exercise picker ---------------- */
function ExercisePicker({ onPick, onClose }: {
  onPick: (id: string, name: string) => void;
  onClose: () => void;
}) {
  const { session } = useApp();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState('all');

  const rows = useData(
    () => (session ? api.exercises.list(session, { q, muscleGroup: muscle }) : []),
    [session?.gymId, q, muscle],
  );
  const facets = useData(() => (session ? api.exercises.facets(session) : null), [session?.gymId]);

  return (
    <Modal
      title="Add an exercise"
      subtitle={`${rows.length} available`}
      onClose={onClose}
      footer={<Button onClick={onClose}>Done</Button>}
    >
      <div className="u-col u-gap-3">
        <SearchInput value={q} onChange={setQ} placeholder="Search exercises" />

        {facets && (
          <div className="chiprow">
            <button className={`togglechip ${muscle === 'all' ? 'togglechip--on' : ''}`}
              onClick={() => setMuscle('all')} aria-pressed={muscle === 'all'}>
              All
            </button>
            {facets.muscleGroups.map((m) => (
              <button key={m.value} className={`togglechip ${muscle === m.value ? 'togglechip--on' : ''}`}
                onClick={() => setMuscle(m.value)} aria-pressed={muscle === m.value}>
                {m.label}
              </button>
            ))}
          </div>
        )}

        {rows.length === 0 ? (
          <EmptyState
            icon="search"
            title="Nothing matches"
            message="Try a different search, or create a custom exercise for what you actually do."
            action={<Button onClick={() => { onClose(); nav('/member/exercises'); }}>Exercise library</Button>}
          />
        ) : (
          <ul className="cardlist" style={{ maxHeight: '48vh', overflowY: 'auto' }}>
            {rows.slice(0, 80).map((e) => (
              <li key={e.id}>
                <button className="cardlist__item" onClick={() => onPick(e.id, e.name)}>
                  <span className="u-grow" style={{ minWidth: 0 }}>
                    <span className="u-row u-gap-2">
                      <span className="t-sm u-truncate" style={{ fontWeight: 545 }}>{e.name}</span>
                      {e.scope === 'member' && <span className="tag tag--custom">Mine</span>}
                      {e.scope === 'gym' && <span className="tag tag--quiet">Gym</span>}
                    </span>
                    <span className="t-xs t-faint" style={{ display: 'block', marginTop: 2 }}>
                      {api.exercises.label.muscleGroup(e.muscleGroup)} · {api.exercises.label.equipment(e.equipment)}
                    </span>
                  </span>
                  <Badge>{api.exercises.label.difficulty(e.difficulty)}</Badge>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
