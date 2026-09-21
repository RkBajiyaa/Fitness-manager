import { useState } from 'react';
import {
  Badge, Button, Card, EmptyState, Modal, PageHead, Segmented, StatTile,
} from '../../components/ui/primitives';
import {
  SearchInput, SelectField, TextField, TextareaField, fieldErrors, errorMessage,
} from '../../components/ui/forms';
import { Icon } from '../../components/ui/Icon';
import { useApp, useData } from '../../state/app';
import * as api from '../../lib/api';
import type { Exercise, ExerciseKind } from '../../lib/types';
import { count, titleCase } from '../../lib/format';

export default function OwnerExercises() {
  const { session, confirm, toast } = useApp();
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState('all');
  const [equipment, setEquipment] = useState('all');
  const [scope, setScope] = useState<'all' | 'global' | 'gym' | 'member'>('all');
  const [creating, setCreating] = useState(false);
  const [detail, setDetail] = useState<Exercise | null>(null);

  const facets = useData(() => (session ? api.exercises.facets(session) : { muscleGroups: [], equipment: [], difficulties: [], kinds: [] }),
    [session?.gymId]);
  const all = useData(() => (session ? api.exercises.list(session, { q, muscleGroup: muscle, equipment }) : []),
    [q, muscle, equipment]);

  if (!session) return null;

  const rows = scope === 'all' ? all : all.filter((e) => e.scope === scope);
  const counts = {
    global: all.filter((e) => e.scope === 'global').length,
    gym: all.filter((e) => e.scope === 'gym').length,
    member: all.filter((e) => e.scope === 'member').length,
  };

  const remove = async (e: Exercise) => {
    const ok = await confirm({
      title: `Delete “${e.name}”?`,
      message: 'This removes it from the studio library. Sessions that already used it keep their history.',
      confirmLabel: 'Delete', tone: 'danger',
    });
    if (!ok) return;
    try {
      await api.exercises.remove(session, e.id);
      toast('success', 'Exercise deleted');
      setDetail(null);
    } catch (err) { toast('error', 'Could not delete', errorMessage(err)); }
  };

  return (
    <div className="anim-page">
      <PageHead
        title="Exercise library"
        subtitle="The global catalogue, your studio's own additions, and what members have created for themselves."
        actions={<Button variant="primary" icon="plus" onClick={() => setCreating(true)}>Add exercise</Button>}
      />

      <div className="grid-stats u-mb-5">
        <StatTile label="Total available" icon="library" value={count(all.length)} />
        <StatTile label="Global catalogue" icon="compass" value={count(counts.global)} hint="ships with the product" />
        <StatTile label="Studio additions" icon="building" value={count(counts.gym)} hint="yours to manage" />
        <StatTile label="Member-created" icon="user" value={count(counts.member)}
          hint="private to each member" />
      </div>

      <Card>
        <div className="card__body" style={{ paddingBottom: 'var(--s-4)' }}>
          <div className="toolbar">
            <div className="toolbar__search">
              <SearchInput value={q} onChange={setQ} placeholder="Search by name, muscle or equipment" />
            </div>
            <SelectField aria-label="Muscle group" value={muscle} onChange={(e) => setMuscle(e.target.value)}
              options={[{ value: 'all', label: 'All muscles' },
                ...facets.muscleGroups]} />
            <SelectField aria-label="Equipment" value={equipment} onChange={(e) => setEquipment(e.target.value)}
              options={[{ value: 'all', label: 'All equipment' },
                ...facets.equipment]} />
          </div>
          <div className="u-mt-4">
            <Segmented ariaLabel="Scope" value={scope} onChange={setScope}
              options={[
                { value: 'all', label: 'All' },
                { value: 'global', label: 'Global', count: counts.global },
                { value: 'gym', label: 'Studio', count: counts.gym },
                { value: 'member', label: 'Member-created', count: counts.member },
              ]} />
          </div>
        </div>
      </Card>

      <div className="u-mt-4">
        {rows.length === 0 ? (
          <Card>
            <EmptyState icon="library" title="Nothing matches those filters"
              message="Try a different search, or add an exercise to the studio library."
              action={<Button icon="x" onClick={() => { setQ(''); setMuscle('all'); setEquipment('all'); setScope('all'); }}>
                Clear filters</Button>} />
          </Card>
        ) : (
          <div className="exgrid">
            {rows.map((e) => (
              <button key={e.id} className="excard" onClick={() => setDetail(e)}>
                <div className="u-between u-gap-2">
                  <span className="excard__name">{e.name}</span>
                  {e.scope === 'member' && <span className="tag tag--custom">Member</span>}
                  {e.scope === 'gym' && <span className="tag">Studio</span>}
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
      </div>

      <p className="quiet-note u-mt-5">
        <Icon name="shield" size={12} /> A member's own exercise is visible to you but can never be
        edited into the studio library — scope is set by the service layer, not by the request.
      </p>

      {creating && <CreateExercise onClose={() => setCreating(false)} />}

      {detail && (
        <Modal title={detail.name} subtitle={`${api.exercises.label.muscleGroup(detail.muscleGroup)} · ${api.exercises.label.equipment(detail.equipment)}`}
          onClose={() => setDetail(null)}
          footer={<>
            {detail.scope === 'gym' && (
              <Button icon="trash" onClick={() => remove(detail)} style={{ color: 'var(--critical)' }}>Delete</Button>
            )}
            <Button variant="primary" onClick={() => setDetail(null)}>Close</Button>
          </>}>
          <div className="u-col u-gap-4">
            <div className="u-row u-gap-2 u-wrap">
              <Badge>{titleCase(detail.kind)}</Badge>
              <Badge>{titleCase(detail.difficulty)}</Badge>
              <Badge tone={detail.scope === 'global' ? 'neutral' : 'brand'}>
                {detail.scope === 'global' ? 'Global catalogue'
                  : detail.scope === 'gym' ? 'Studio exercise' : 'Member-created'}
              </Badge>
            </div>
            {detail.instructions && (
              <div>
                <h3 className="t-label u-mb-2">Coaching notes</h3>
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
  const [equipment, setEquipment] = useState('barbell');
  const [kind, setKind] = useState<ExerciseKind>('strength');
  const [instructions, setInstructions] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!session) return;
    setBusy(true); setErrors({});
    try {
      await api.exercises.create(session, { name, muscleGroup, equipment, kind, instructions });
      toast('success', 'Exercise added', `${name} is now in the studio library.`);
      onClose();
    } catch (e) {
      setErrors(fieldErrors(e));
      if (!Object.keys(fieldErrors(e)).length) toast('error', 'Could not create', errorMessage(e));
    } finally { setBusy(false); }
  };

  return (
    <Modal title="Add to the studio library"
      subtitle="Available to every member of this studio."
      onClose={onClose}
      footer={<>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={submit} loading={busy} disabled={!name.trim()}>Add exercise</Button>
      </>}>
      <div className="u-col u-gap-4">
        <TextField label="Exercise name" required autoFocus value={name} error={errors.name}
          onChange={(e) => setName(e.target.value)} />
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
        <TextareaField label="Coaching notes" placeholder="Cues your coaches should give"
          value={instructions} onChange={(e) => setInstructions(e.target.value)} />
      </div>
    </Modal>
  );
}
