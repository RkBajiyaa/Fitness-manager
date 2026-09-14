import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/primitives';
import {
  NumberStepper, SelectField, TextField, fieldErrors, errorMessage,
} from '../../components/ui/forms';
import { Icon, Logo } from '../../components/ui/Icon';
import { useApp, useData } from '../../state/app';
import * as api from '../../lib/api';
import type { FitnessGoal, TrainingExperience } from '../../lib/types';

const GOALS: Array<{ value: FitnessGoal; label: string; hint: string }> = [
  { value: 'lose_fat', label: 'Lose fat', hint: 'Leaner, same strength' },
  { value: 'build_muscle', label: 'Build muscle', hint: 'Size and shape' },
  { value: 'gain_strength', label: 'Get stronger', hint: 'Heavier lifts' },
  { value: 'endurance', label: 'Endurance', hint: 'Last longer' },
  { value: 'general_fitness', label: 'General fitness', hint: 'Feel better, move well' },
];

/**
 * Member onboarding (§M.10).
 *
 * Three short steps, every one skippable. This is not a medical intake
 * form — it asks only what actually changes the app: a height and a
 * weight make the progress chart start today rather than in a month,
 * and a goal changes what Home leads with.
 */
export default function MemberWelcome() {
  const { session, toast } = useApp();
  const nav = useNavigate();
  const [step, setStep] = useState(0);

  const me = useData(
    () => (session?.memberId ? api.members.get(session, session.memberId) : null),
    [session?.memberId],
  );
  const gym = useData(() => (session ? api.gyms.current(session) : null), [session?.gymId]);

  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [phone, setPhone] = useState('');
  const [heightCm, setHeight] = useState(0);
  const [currentWeightKg, setWeight] = useState(0);
  const [targetWeightKg, setTarget] = useState(0);
  const [goal, setGoal] = useState<FitnessGoal>('general_fitness');
  const [experience, setExperience] = useState<TrainingExperience>('beginner');
  const [weeklySessionTarget, setWeekly] = useState(3);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState('');

  if (!session || !session.memberId || !me) return null;
  const memberId = session.memberId;
  const first = (name || me.member.name).split(' ')[0];
  const personal = gym?.kind === 'personal';

  const finish = async () => {
    setBusy('save'); setErrors({});
    try {
      await api.members.completeOnboarding(session, memberId, {
        name: name || undefined,
        dob: dob || undefined,
        phone: phone || undefined,
        heightCm: heightCm || undefined,
        currentWeightKg: currentWeightKg || undefined,
        targetWeightKg: targetWeightKg || undefined,
        goal, experience, weeklySessionTarget,
      });
      toast('success', 'You’re set up', 'Everything else you can add as you go.');
      nav('/member', { replace: true });
    } catch (e) {
      setErrors(fieldErrors(e));
      if (!Object.keys(fieldErrors(e)).length) toast('error', 'Could not save', errorMessage(e));
    } finally { setBusy(''); }
  };

  const skip = async () => {
    setBusy('skip');
    try {
      await api.members.skipOnboarding(session, memberId);
      nav('/member', { replace: true });
    } finally { setBusy(''); }
  };

  return (
    <div className="welcome">
      <header className="welcome__top">
        <div className="u-row u-gap-3">
          <Logo size={26} />
          <span className="t-sm" style={{ fontWeight: 620 }}>Fitness Manager</span>
        </div>
        <Button size="sm" variant="ghost" loading={busy === 'skip'} onClick={skip}>Skip for now</Button>
      </header>

      <div className="welcome__body">
        <div className="welcome__steps" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span key={i} className={`welcome__step ${i <= step ? 'welcome__step--on' : ''}`} />
          ))}
        </div>

        {step === 0 && (
          <section className="anim-page">
            <h1 className="welcome__title">
              Welcome{me.member.name ? `, ${me.member.name.split(' ')[0]}` : ''}.
            </h1>
            <p className="welcome__lead">
              {personal
                ? 'This is your own training log. Nothing in it is made up — everything you see from here on is something you did.'
                : `${gym?.name ?? 'Your gym'} has your membership set up. A few quick questions and the app knows what to show you.`}
            </p>

            <div className="u-col u-gap-4 u-mt-6">
              <div>
                <div className="t-label u-mb-3">What are you training for?</div>
                <div className="goalgrid">
                  {GOALS.map((g) => (
                    <button
                      key={g.value}
                      className={`goalcard ${goal === g.value ? 'goalcard--on' : ''}`}
                      aria-pressed={goal === g.value}
                      onClick={() => setGoal(g.value)}
                    >
                      <span className="goalcard__title">{g.label}</span>
                      <span className="goalcard__hint">{g.hint}</span>
                    </button>
                  ))}
                </div>
              </div>

              <SelectField
                label="How long have you been training?"
                value={experience}
                onChange={(e) => setExperience(e.target.value as TrainingExperience)}
                options={[
                  { value: 'beginner', label: 'New to this, or coming back' },
                  { value: 'intermediate', label: 'A year or two under my belt' },
                  { value: 'advanced', label: 'Several years, I know my numbers' },
                ]}
              />
            </div>

            <Button className="u-mt-6" variant="primary" size="lg" block iconRight="arrowRight"
              onClick={() => setStep(1)}>
              Continue
            </Button>
          </section>
        )}

        {step === 1 && (
          <section className="anim-page">
            <h1 className="welcome__title">Where are you starting from?</h1>
            <p className="welcome__lead">
              Your first weigh-in becomes the first point on your progress chart. Skip it and the
              chart simply starts whenever you do.
            </p>

            <div className="u-col u-gap-5 u-mt-6">
              <NumberStepper label="Height" value={heightCm} onChange={setHeight}
                step={1} min={0} max={250} suffix="cm" error={errors.heightCm} />
              <NumberStepper label="Current weight" value={currentWeightKg} onChange={setWeight}
                step={0.5} min={0} max={400} suffix="kg" error={errors.currentWeightKg} />
              <NumberStepper label="Target weight" value={targetWeightKg} onChange={setTarget}
                step={0.5} min={0} max={300} suffix="kg — optional" error={errors.targetWeightKg} />
              <NumberStepper label="Sessions a week you're aiming for" value={weeklySessionTarget}
                onChange={setWeekly} step={1} min={1} max={7} suffix="per week" />
            </div>

            <div className="u-row u-gap-3 u-mt-6">
              <Button icon="arrowLeft" onClick={() => setStep(0)}>Back</Button>
              <Button className="u-grow" variant="primary" size="lg" iconRight="arrowRight"
                onClick={() => setStep(2)}>
                Continue
              </Button>
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="anim-page">
            <h1 className="welcome__title">Anything else?</h1>
            <p className="welcome__lead">
              All optional. You can change any of this later in your profile.
            </p>

            <div className="u-col u-gap-4 u-mt-6">
              <TextField label="Your name" value={name || me.member.name}
                onChange={(e) => setName(e.target.value)} />
              <TextField label="Date of birth" type="date" value={dob}
                onChange={(e) => setDob(e.target.value)} />
              <TextField label="Phone" value={phone || me.member.phone}
                onChange={(e) => setPhone(e.target.value)} placeholder="+91 ..." />
            </div>

            <div className="welcome__summary u-mt-6">
              <div className="t-label u-mb-3">You’re set up as</div>
              <ul className="u-col u-gap-2 t-sm">
                <li className="u-row u-gap-2">
                  <Icon name="target" size={14} className="t-faint" />
                  {GOALS.find((g) => g.value === goal)?.label}
                  {targetWeightKg > 0 && ` · target ${targetWeightKg} kg`}
                </li>
                <li className="u-row u-gap-2">
                  <Icon name="dumbbell" size={14} className="t-faint" />
                  {weeklySessionTarget} sessions a week
                </li>
                {currentWeightKg > 0 && (
                  <li className="u-row u-gap-2">
                    <Icon name="scale" size={14} className="t-faint" />
                    Starting at {currentWeightKg} kg{heightCm > 0 ? `, ${heightCm} cm` : ''}
                  </li>
                )}
              </ul>
            </div>

            <div className="u-row u-gap-3 u-mt-6">
              <Button icon="arrowLeft" onClick={() => setStep(1)}>Back</Button>
              <Button className="u-grow" variant="primary" size="lg" loading={busy === 'save'}
                onClick={finish}>
                {first ? `Let's go, ${first}` : "Let's go"}
              </Button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
