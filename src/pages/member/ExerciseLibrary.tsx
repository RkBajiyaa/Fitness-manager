import { useState } from 'react';
import {
  Badge, Button, Card, EmptyState, Modal, Segmented,
} from '../../components/ui/primitives';
import {
  SearchInput, SelectField, TextField, TextareaField, fieldErrors, errorMessage,
} from '../../components/ui/forms';
import { Icon } from '../../components/ui/Icon';
import { useApp, useData } from '../../state/app';
import * as api from '../../lib/api';
import type { Exercise, ExerciseKind } from '../../lib/types';
import { titleCase } from '../../lib/format';

type Scope = 'all' | 'library' | 'mine';

export default function ExerciseLibrary() {
  const { session, confirm, toast } = useApp();
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState('all');
  const [equipment, setEquipment] = useState('all');
  const [scope, setScope] = useState<Scope>('all');
  const [creating, setCreating] = useState(false);
  const [detail, setDetail] = useState<Exercise | null>(null);

  const facets = useData(() => (session ? api.exercises.facets(session) : { muscleGroups: [], equipment: [], difficulties: [], kinds: [] }), [session?.gymId]);
  const all = useData(() => (session ? api.exercises.list(session, { q, muscleGroup: muscle, equipment }) : []),
    [q, muscle, equipment]);

  if (!session) return null;

  const rows = scope === 'mine' ? all.filter((e) => e.scope === 'member')
    : scope === 'library' ? all.filter((e) => e.scope !== 'member')
    : all;
  const mineCount = all.filter((e) => e.scope === 'member').length;

  const remove = async (e: Exercise) => {
    const ok = await confirm({
      title: `Delete “${e.name}”?`,
      message: 'This removes your custom exercise. Sessions that already used it keep their history.',
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await api.exercises.remove(session, e.id);
      toast('success', 'Exercise deleted');
      setDetail(null);
    } catch (err) { toast('error', 'Could not delete', errorMessage(err)); }
  };

  return (
    <div className="anim-page u-col u-gap-4">
      <div className="u-between">
        <div>
          <h1 className="t-h1">Exercises</h1>
          <p className="t-sm t-muted u-mt-2">{all.length} available to you</p>
        </div>
        <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>Create</Button>
      </div>

      <SearchInput value={q} onChange={setQ} placeholder="Search by name, muscle or equipment" />

      <Segmented
        ariaLabel="Scope" value={scope} onChange={setScope}
        options={[
          { value: 'all', label: 'All' },
          { value: 'library', label: 'Gym library' },
          { value: 'mine', label: 'My exercises', count: mineCount },
        ]}
      />

      <div className="u-row u-gap-2 u-wrap">
        <SelectField aria-label="Muscle group" value={muscle} onChange={(e) => setMuscle(e.target.value)}
          options={[{ value: 'all', label: 'All muscles' },
            ...facets.muscleGroups]} />
        <SelectField aria-label="Equipment" value={equipment} onChange={(e) => setEquipment(e.target.value)}
          options={[{ value: 'all', label: 'All equipment' },
            ...facets.equipment]} />
      </div>

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon="library"
            title={scope === 'mine' ? 'No custom exercises yet' : 'Nothing matches those filters'}
            message={scope === 'mine'
              ? 'Create your own movement if the studio library does not have it. Yours stays private to you.'
              : 'Try a different search or clear the filters.'}
            action={scope === 'mine'
              ? <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>Create exercise</Button>
              : <Button icon="x" onClick={() => { setQ(''); setMuscle('all'); setEquipment('all'); }}>Clear filters</Button>}
          />
        </Card>
      ) : (
        <div className="exgrid">
          {rows.map((e) => (
            <button key={e.id} className="excard" onClick={() => setDetail(e)}>
              <div className="u-between u-gap-2">
                <span className="excard__name">{e.name}</span>
                {e.scope === 'member' && <span className="tag tag--custom">Mine</span>}
              </div>
              <span className="excard__meta">
                  {api.exercises.label.muscleGroup(e.muscleGroup)} · {api.exercises.label.equipment(e.equipment)}
                </span>
              <span className="excard__tags">
                <span className="tag">{api.exercises.label.kind(e.kind)}</span>
                <span className="tag">{titleCase(e.difficulty)}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {creating && <CreateExercise onClose={() => setCreating(false)} />}

      {detail && (
        <Modal title={detail.name} subtitle={`${api.exercises.label.muscleGroup(detail.muscleGroup)} · ${api.exercises.label.equipment(detail.equipment)}`}
          onClose={() => setDetail(null)}
          footer={
            <>
              {detail.scope === 'member' && (
                <Button icon="trash" onClick={() => remove(detail)} style={{ color: 'var(--critical)' }}>
                  Delete
                </Button>
              )}
              <Button variant="primary" onClick={() => setDetail(null)}>Close</Button>
            </>
          }>
          <div className="u-col u-gap-4">
            <div className="u-row u-gap-2 u-wrap">
              <Badge>{titleCase(detail.kind)}</Badge>
              <Badge>{titleCase(detail.difficulty)}</Badge>
              {detail.scope === 'member' && <Badge tone="brand">Your exercise</Badge>}
              {detail.tags.map((t) => <Badge key={t}>{t}</Badge>)}
            </div>
            {detail.instructions && (
              <div>
                <h3 className="t-label u-mb-2">How to do it</h3>
                <p className="t-sm t-muted" style={{ lineHeight: 1.65 }}>{detail.instructions}</p>
              </div>
            )}
            {detail.secondaryMuscles.length > 0 && (
              <div className="kv">
                <span className="kv__k">Also works</span>
                <span className="kv__v">{detail.secondaryMuscles.join(', ')}</span>
              </div>
            )}
            <div className="kv">
              <span className="kv__k">Tracks</span>
              <span className="kv__v">{detail.tracks.map(titleCase).join(' · ')}</span>
            </div>
            <p className="quiet-note">
              <Icon name="info" size={12} /> Video demonstrations are a planned addition.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}

function CreateExercise({ onClose }: { onClose: () => void }) {
  const { session, toast } = useApp();
  const [name, setName] = useState('');
  const [muscleGroup, setMuscleGroup] = useState('chest');
  const [equipment, setEquipment] = useState('dumbbell');
  const [kind, setKind] = useState<ExerciseKind>('strength');
  const [instructions, setInstructions] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!session) return;
    setBusy(true); setErrors({});
    try {
      await api.exercises.create(session, { name, muscleGroup, equipment, kind, instructions });
      toast('success', 'Exercise created', `${name} is now in your list.`);
      onClose();
    } catch (e) {
      setErrors(fieldErrors(e));
      if (!Object.keys(fieldErrors(e)).length) toast('error', 'Could not create', errorMessage(e));
    } finally { setBusy(false); }
  };

  return (
    <Modal
      title="Create an exercise"
      subtitle="Yours alone — it never changes the studio's library."
      onClose={onClose}
      footer={<>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={submit} loading={busy} disabled={!name.trim()}>Create</Button>
      </>}
    >
      <div className="u-col u-gap-4">
        <TextField label="Exercise name" required autoFocus value={name} error={errors.name}
          onChange={(e) => setName(e.target.value)} placeholder="e.g. Landmine Press" />
        <div className="form-grid">
          <SelectField label="Muscle group" value={muscleGroup} error={errors.muscleGroup}
            onChange={(e) => setMuscleGroup(e.target.value)}
            options={api.exercises.taxonomy().muscleGroups.map((m) => ({ value: m.key, label: m.label }))} />
          <SelectField label="Equipment" value={equipment} onChange={(e) => setEquipment(e.target.value)}
            options={api.exercises.taxonomy().equipment.map((m) => ({ value: m.key, label: m.label }))} />
        </div>
        <SelectField label="Type" value={kind} onChange={(e) => setKind(e.target.value as ExerciseKind)}
          options={[
            { value: 'strength', label: 'Strength — weight and reps' },
            { value: 'bodyweight', label: 'Bodyweight — reps only' },
            { value: 'cardio', label: 'Cardio — duration and distance' },
            { value: 'mobility', label: 'Mobility — duration' },
          ]} />
        <TextareaField label="Notes" placeholder="Optional — cues, setup, anything you want to remember"
          value={instructions} onChange={(e) => setInstructions(e.target.value)} />
      </div>
    </Modal>
  );
}
