import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Avatar, Badge, Button, Card, CardBody, CardHead, EmptyState, KV, Meter,
  Modal, Segmented, StatusBadge,
} from '../../components/ui/primitives';
import {
  DateField, NumberStepper, SelectField, TextField, TextareaField, fieldErrors, errorMessage,
} from '../../components/ui/forms';
import { Icon } from '../../components/ui/Icon';
import { useApp, useData } from '../../state/app';
import * as api from '../../lib/api';
import type { FitnessGoal, GoalKind, TrainingExperience } from '../../lib/types';
import { bmi, bmiBand } from '../../lib/derive';
import { dateShort, money, phoneMask, titleCase } from '../../lib/format';
import { age, todayISO } from '../../lib/date';

type Tab = 'personal' | 'fitness' | 'goals' | 'preferences';

const GOAL_LABEL: Record<FitnessGoal, string> = {
  lose_fat: 'Lose fat',
  build_muscle: 'Build muscle',
  gain_strength: 'Gain strength',
  endurance: 'Improve endurance',
  general_fitness: 'General fitness',
};

const EXPERIENCE_LABEL: Record<TrainingExperience, string> = {
  beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced',
};

const DAY_LABEL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function MemberProfilePage() {
  const { session, theme, toggleTheme, signOut, confirm } = useApp();
  const nav = useNavigate();
  const memberId = session?.memberId ?? '';
  const [tab, setTab] = useState<Tab>('personal');
  const [editing, setEditing] = useState(false);
  const [addingGoal, setAddingGoal] = useState(false);

  const me = useData(() => (session && memberId ? api.members.get(session, memberId) : null), [memberId]);
  const gym = useData(() => (session ? api.gyms.current(session) : null), [session?.gymId]);
  const latest = useData(() => (session && memberId ? api.measurements.latest(session, memberId) : null), [memberId]);
  const payments = useData(() => (session && memberId ? api.payments.forMember(session, memberId) : []), [memberId]);
  const goals = useData(() => (session && memberId ? api.goals.progress(session, memberId) : []), [memberId]);
  const messages = useData(() => (session ? api.messages.list(session) : []), [session?.gymId]);

  if (!session || !me || !gym) return null;
  const { member, membership, status, daysLeft, dues } = me;
  const f = member.fitness;
  const bmiValue = bmi(latest?.weightKg, f.heightCm ?? latest?.heightCm);

  const signOutNow = async () => {
    const ok = await confirm({
      title: 'Sign out?',
      message: 'You will need to sign in again to see your training.',
      confirmLabel: 'Sign out',
    });
    if (ok) { signOut(); nav('/', { replace: true }); }
  };

  return (
    <div className="anim-page u-col u-gap-4">
      <Card>
        <CardBody>
          <div className="u-col u-gap-3" style={{ alignItems: 'center', textAlign: 'center' }}>
            <Avatar name={member.name} size="xl" />
            <div>
              <h1 className="t-h2">{member.name}</h1>
              <div className="t-xs t-faint u-mt-2">
                {member.memberCode}
                {age(member.dob) != null && ` · ${age(member.dob)} yrs`}
                {` · ${GOAL_LABEL[f.goal]}`}
              </div>
            </div>
            <div className="u-row u-gap-2">
              <Badge>{EXPERIENCE_LABEL[f.experience]}</Badge>
              {status === 'active'
                ? <Badge tone="good" dot>Membership active</Badge>
                : <StatusBadge status={status} daysLeft={daysLeft} />}
            </div>
          </div>
        </CardBody>
      </Card>

      <Segmented
        ariaLabel="Profile section" value={tab} onChange={setTab}
        options={[
          { value: 'personal', label: 'Personal' },
          { value: 'fitness', label: 'Fitness' },
          { value: 'goals', label: 'Goals' },
          { value: 'preferences', label: 'Settings' },
        ]}
      />

      {/* ================= PERSONAL ================= */}
      {tab === 'personal' && (
        <div className="u-col u-gap-4">
          <Card>
            <CardHead title="Your details" />
            <CardBody>
              <KV k="Phone">{phoneMask(member.phone)}</KV>
              {member.email && <KV k="Email">{member.email}</KV>}
              {member.dob && <KV k="Date of birth">{dateShort(member.dob)}</KV>}
              <KV k="Gender">{titleCase(member.gender)}</KV>
              {member.address && (
                <KV k="Address"><span style={{ maxWidth: 210, display: 'inline-block' }}>{member.address}</span></KV>
              )}
              <KV k="Member since">{dateShort(member.joinedAt)}</KV>
              {member.emergencyContact.name && (
                <KV k="Emergency contact">
                  {member.emergencyContact.name}
                  {member.emergencyContact.relation ? ` (${member.emergencyContact.relation})` : ''}
                </KV>
              )}
              <p className="quiet-note u-mt-4">
                Ask the front desk to change these — personal records are kept by the studio.
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHead title="Membership" />
            <CardBody>
              {membership ? (
                <>
                  <KV k="Plan">{membership.planNameSnapshot}</KV>
                  <KV k="Valid until">{dateShort(membership.endDate)}</KV>
                  <KV k="Days remaining">{daysLeft >= 0 ? daysLeft : 'Expired'}</KV>
                  <KV k="Paid">{money(dues.paid)} of {money(dues.billed)}</KV>
                  {dues.due > 0 && (
                    <div className="u-mt-4">
                      <Meter value={dues.paid} max={dues.billed} tone="warning"
                        label={`${Math.round((dues.paid / dues.billed) * 100)}% paid`} />
                      <p className="quiet-note u-mt-3">
                        {money(dues.due)} outstanding — settle at the front desk.
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <EmptyState icon="card" title="No active membership"
                  message="Visit the front desk to activate a plan." />
              )}
            </CardBody>
          </Card>

          {payments.length > 0 && (
            <Card>
              <CardHead title="Payment history" subtitle={`${payments.length} payments`} />
              <CardBody flush>
                <ul className="cardlist">
                  {payments.slice(0, 8).map((p) => (
                    <li key={p.id} className="cardlist__item" style={{ cursor: 'default' }}>
                      <span className="u-grow" style={{ minWidth: 0 }}>
                        <span className="u-between u-gap-2">
                          <span className="t-sm" style={{ fontWeight: 560 }}>{money(p.amount)}</span>
                          <span className="t-xs t-faint">{dateShort(p.paidAt)}</span>
                        </span>
                        <span className="t-xs t-faint" style={{ display: 'block', marginTop: 2 }}>
                          {titleCase(p.method)} · {p.receiptNo}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          )}

          {messages.length > 0 && (
            <Card>
              <CardHead title="From your studio" />
              <CardBody flush>
                <ul className="cardlist">
                  {messages.slice(0, 5).map((m) => (
                    <li key={m.id} className="cardlist__item" style={{ cursor: 'default', alignItems: 'flex-start' }}>
                      <span className="u-grow" style={{ minWidth: 0 }}>
                        <span className="t-sm" style={{ fontWeight: 560 }}>{m.subject}</span>
                        <span className="t-xs t-muted" style={{ display: 'block', marginTop: 3, lineHeight: 1.55 }}>
                          {m.body}
                        </span>
                        <span className="t-xs t-faint" style={{ display: 'block', marginTop: 4 }}>
                          {dateShort(m.createdAt)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          )}
        </div>
      )}

      {/* ================= FITNESS ================= */}
      {tab === 'fitness' && (
        <div className="u-col u-gap-4">
          <Card>
            <CardHead
              title="Fitness profile"
              subtitle="Yours to manage"
              action={<Button size="sm" icon="edit" onClick={() => setEditing(true)}>Edit</Button>}
            />
            <CardBody>
              <KV k="Height">{f.heightCm ? `${f.heightCm} cm` : '—'}</KV>
              <KV k="Current weight">{latest ? `${latest.weightKg} kg` : '—'}</KV>
              <KV k="Target weight">{f.targetWeightKg ? `${f.targetWeightKg} kg` : '—'}</KV>
              <KV k="BMI">
                {bmiValue ? (
                  <>
                    {bmiValue.toFixed(1)}
                    <span className="t-xs t-faint" style={{ marginLeft: 6 }}>{bmiBand(bmiValue).label}</span>
                  </>
                ) : '—'}
              </KV>
              <KV k="Primary goal">{GOAL_LABEL[f.goal]}</KV>
              <KV k="Experience">{EXPERIENCE_LABEL[f.experience]}</KV>
              <KV k="Weekly target">{f.weeklySessionTarget} sessions</KV>
              <KV k="Water target">{(f.waterTargetMl / 1000).toFixed(1)} L</KV>
            </CardBody>
          </Card>

          {latest && (
            <Card>
              <CardHead title="Latest measurements" subtitle={dateShort(latest.takenAt)}
                action={<Button size="sm" variant="ghost" iconRight="arrowRight"
                  onClick={() => nav('/member/progress')}>Charts</Button>} />
              <CardBody>
                {latest.chestCm && <KV k="Chest">{latest.chestCm} cm</KV>}
                {latest.waistCm && <KV k="Waist">{latest.waistCm} cm</KV>}
                {latest.armsCm && <KV k="Arms">{latest.armsCm} cm</KV>}
                {latest.thighsCm && <KV k="Thighs">{latest.thighsCm} cm</KV>}
                {latest.bodyFatPct && <KV k="Body fat">{latest.bodyFatPct}%</KV>}
              </CardBody>
            </Card>
          )}

          {f.notes && (
            <Card>
              <CardHead title="Notes for your coach" />
              <CardBody><p className="t-sm t-muted" style={{ lineHeight: 1.65 }}>{f.notes}</p></CardBody>
            </Card>
          )}
        </div>
      )}

      {/* ================= GOALS ================= */}
      {tab === 'goals' && (
        <div className="u-col u-gap-4">
          <div className="u-between">
            <h2 className="t-label">Your goals</h2>
            <Button size="sm" icon="plus" onClick={() => setAddingGoal(true)}>Add goal</Button>
          </div>

          {goals.length === 0 ? (
            <Card>
              <EmptyState icon="target" title="No goals set"
                message="A goal gives your training a direction — a target weight, a lift, or a number of sessions a month."
                action={<Button variant="primary" icon="plus" onClick={() => setAddingGoal(true)}>Set a goal</Button>} />
            </Card>
          ) : (
            goals.map((g) => (
              <Card key={g.goal.id}>
                <CardBody>
                  <div className="u-between u-gap-3">
                    <div className="u-grow" style={{ minWidth: 0 }}>
                      <div className="u-row u-gap-2">
                        <span className="t-sm" style={{ fontWeight: 600 }}>{g.goal.label}</span>
                        {g.achieved && <Badge tone="good" icon="check">Reached</Badge>}
                      </div>
                      <div className="t-xs t-faint u-mt-2">
                        {g.current.toFixed(g.goal.unit === 'kg' ? 1 : 0)} of {g.target} {g.goal.unit}
                        {g.goal.targetDate ? ` · by ${dateShort(g.goal.targetDate)}` : ''}
                      </div>
                    </div>
                    <Button size="sm" variant="ghost" icon="trash" aria-label="Remove goal"
                      onClick={() => api.goals.remove(session, memberId, g.goal.id)} />
                  </div>
                  <div className="u-mt-4">
                    <Meter value={g.ratio * 100} max={100} tone={g.achieved ? 'good' : undefined}
                      label={`${Math.round(g.ratio * 100)}% complete`} />
                  </div>
                </CardBody>
              </Card>
            ))
          )}
        </div>
      )}

      {/* ================= PREFERENCES ================= */}
      {tab === 'preferences' && (
        <div className="u-col u-gap-4">
          <Card>
            <CardHead title="Training preferences"
              action={<Button size="sm" icon="edit" onClick={() => setEditing(true)}>Edit</Button>} />
            <CardBody>
              <KV k="Preferred days">
                {f.preferredDays.length ? f.preferredDays.map((d) => DAY_LABEL[d]).join(', ') : '—'}
              </KV>
              <KV k="Sessions a week">{f.weeklySessionTarget}</KV>
              <KV k="Water target">{(f.waterTargetMl / 1000).toFixed(1)} L</KV>
            </CardBody>
          </Card>

          <Card>
            <CardHead title="Appearance" />
            <CardBody>
              <div className="u-between">
                <span className="t-sm">Dark theme</span>
                <Button size="sm" icon={theme === 'dark' ? 'sun' : 'moon'} onClick={toggleTheme}>
                  {theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
                </Button>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHead title={gym.name} subtitle="Your studio" />
            <CardBody>
              <KV k="Phone"><a href={`tel:${gym.phone}`}>{gym.phone}</a></KV>
              <KV k="Email"><a href={`mailto:${gym.email}`}>{gym.email}</a></KV>
              <KV k="Address">
                <span style={{ maxWidth: 210, display: 'inline-block' }}>{gym.address}</span>
              </KV>
            </CardBody>
          </Card>

          <Button icon="logout" block onClick={signOutNow}>Sign out</Button>

          <p className="quiet-note u-center">
            <Icon name="shield" size={12} /> You can only ever see your own training data.
          </p>
        </div>
      )}

      {editing && <EditFitness onClose={() => setEditing(false)} />}
      {addingGoal && <AddGoal onClose={() => setAddingGoal(false)} />}
    </div>
  );
}

/* ---------------- edit fitness profile ---------------- */
function EditFitness({ onClose }: { onClose: () => void }) {
  const { session, toast } = useApp();
  const memberId = session?.memberId ?? '';
  const me = useData(() => (session && memberId ? api.members.get(session, memberId) : null), [memberId]);
  const f = me?.member.fitness;

  const [height, setHeight] = useState(f?.heightCm ?? 170);
  const [targetWeight, setTargetWeight] = useState(f?.targetWeightKg ?? 70);
  const [goal, setGoal] = useState<FitnessGoal>(f?.goal ?? 'general_fitness');
  const [experience, setExperience] = useState<TrainingExperience>(f?.experience ?? 'beginner');
  const [weekly, setWeekly] = useState(f?.weeklySessionTarget ?? 3);
  const [water, setWater] = useState((f?.waterTargetMl ?? 3000) / 1000);
  const [days, setDays] = useState<number[]>(f?.preferredDays ?? [1, 3, 5]);
  const [notes, setNotes] = useState(f?.notes ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!session) return;
    setBusy(true); setErrors({});
    try {
      await api.members.updateFitness(session, memberId, {
        heightCm: height, targetWeightKg: targetWeight, goal, experience,
        weeklySessionTarget: weekly, waterTargetMl: Math.round(water * 1000),
        preferredDays: days, notes,
      });
      toast('success', 'Fitness profile updated');
      onClose();
    } catch (e) {
      setErrors(fieldErrors(e));
      if (!Object.keys(fieldErrors(e)).length) toast('error', 'Could not save', errorMessage(e));
    } finally { setBusy(false); }
  };

  return (
    <Modal title="Fitness profile" subtitle="This is yours to change at any time." onClose={onClose}
      footer={<>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={submit} loading={busy}>Save</Button>
      </>}>
      <div className="u-col u-gap-4">
        <div className="form-grid">
          <NumberStepper label="Height (cm)" value={height} onChange={setHeight}
            step={1} min={90} max={250} error={errors.heightCm} />
          <NumberStepper label="Target weight (kg)" value={targetWeight} onChange={setTargetWeight}
            step={0.5} min={25} max={300} error={errors.targetWeightKg} />
        </div>
        <SelectField label="Primary goal" value={goal} onChange={(e) => setGoal(e.target.value as FitnessGoal)}
          options={(Object.keys(GOAL_LABEL) as FitnessGoal[]).map((k) => ({ value: k, label: GOAL_LABEL[k] }))} />
        <SelectField label="Training experience" value={experience}
          onChange={(e) => setExperience(e.target.value as TrainingExperience)}
          options={(Object.keys(EXPERIENCE_LABEL) as TrainingExperience[])
            .map((k) => ({ value: k, label: EXPERIENCE_LABEL[k] }))} />
        <div className="form-grid">
          <NumberStepper label="Sessions a week" value={weekly} onChange={setWeekly}
            step={1} min={1} max={14} error={errors.weeklySessionTarget} />
          <NumberStepper label="Water target (L)" value={water} onChange={setWater}
            step={0.25} min={0.5} max={8} error={errors.waterTargetMl} />
        </div>
        <div className="field">
          <span className="field__label">Preferred training days</span>
          <div className="u-row u-gap-2 u-wrap">
            {DAY_LABEL.map((d, i) => (
              <button key={d} type="button" className="chip" aria-pressed={days.includes(i)}
                onClick={() => setDays((v) => v.includes(i) ? v.filter((x) => x !== i) : [...v, i].sort())}>
                {d}
              </button>
            ))}
          </div>
        </div>
        <TextareaField label="Anything your coach should know"
          placeholder="Injuries, restrictions, preferences…"
          value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
    </Modal>
  );
}

/* ---------------- add goal ---------------- */
function AddGoal({ onClose }: { onClose: () => void }) {
  const { session, toast } = useApp();
  const memberId = session?.memberId ?? '';
  const records = useData(() => (session && memberId ? api.records.forMember(session, memberId) : []), [memberId]);

  const [kind, setKind] = useState<GoalKind>('weight');
  const [label, setLabel] = useState('');
  const [targetValue, setTargetValue] = useState('');
  const [exerciseId, setExerciseId] = useState(records[0]?.exerciseId ?? '');
  const [targetDate, setTargetDate] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const unit = kind === 'attendance' ? 'sessions' : 'kg';

  const submit = async () => {
    if (!session) return;
    setBusy(true); setErrors({});
    try {
      await api.goals.create(session, memberId, {
        kind, label: label.trim(), targetValue: Number(targetValue), unit,
        exerciseId: kind === 'strength' ? exerciseId : null,
        targetDate: targetDate || null,
      });
      toast('success', 'Goal added');
      onClose();
    } catch (e) {
      setErrors(fieldErrors(e));
      if (!Object.keys(fieldErrors(e)).length) toast('error', 'Could not add the goal', errorMessage(e));
    } finally { setBusy(false); }
  };

  return (
    <Modal title="Set a goal" onClose={onClose}
      footer={<>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={submit} loading={busy}
          disabled={!label.trim() || !targetValue}>Add goal</Button>
      </>}>
      <div className="u-col u-gap-4">
        <SelectField label="Goal type" value={kind} onChange={(e) => setKind(e.target.value as GoalKind)}
          options={[
            { value: 'weight', label: 'Reach a body weight' },
            { value: 'strength', label: 'Lift a target weight' },
            { value: 'attendance', label: 'Train a number of times a month' },
          ]} />
        {kind === 'strength' && records.length > 0 && (
          <SelectField label="Exercise" value={exerciseId} onChange={(e) => setExerciseId(e.target.value)}
            options={records.map((r) => ({ value: r.exerciseId, label: r.exerciseName }))} />
        )}
        <TextField label="Describe it" required value={label} error={errors.label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={kind === 'strength' ? 'e.g. Bench press 90 kg' : kind === 'weight' ? 'e.g. Reach 76 kg' : 'e.g. Train 20 times this month'} />
        <TextField label={`Target (${unit})`} required inputMode="decimal" value={targetValue}
          error={errors.targetValue}
          onChange={(e) => setTargetValue(e.target.value.replace(/[^\d.]/g, ''))} />
        <DateField label="Target date" value={targetDate} min={todayISO()}
          onChange={(e) => setTargetDate(e.target.value)} hint="Optional" />
      </div>
    </Modal>
  );
}
