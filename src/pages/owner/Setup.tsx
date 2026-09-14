import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, CardBody, Badge } from '../../components/ui/primitives';
import {
  MoneyField, SelectField, Switch, TextField, TextareaField, fieldErrors, errorMessage,
} from '../../components/ui/forms';
import { Icon, Logo, type IconName } from '../../components/ui/Icon';
import { useApp, useData } from '../../state/app';
import * as api from '../../lib/api';
import { money } from '../../lib/format';
import { CATEGORY_LABEL, CATEGORY_ORDER, type FeatureCategory } from '../../lib/platform/catalog';
import type { PaymentMethod, SetupStep } from '../../lib/types';

const STEPS: Array<{ key: SetupStep; title: string; icon: IconName; lead: string }> = [
  { key: 'profile', title: 'Gym information', icon: 'building', lead: 'The basics your members see.' },
  { key: 'plans', title: 'Membership plans', icon: 'layers', lead: 'What you sell, and what it costs.' },
  { key: 'payments', title: 'Payment settings', icon: 'wallet', lead: 'How you take money today.' },
  { key: 'features', title: 'Your features', icon: 'sparkles', lead: 'What your plan includes.' },
  { key: 'first_member', title: 'First member', icon: 'userPlus', lead: 'Add someone and the dashboard comes alive.' },
];

/**
 * Owner onboarding (§M.9).
 *
 * EVERY step is skippable. A setup wizard that blocks the product until
 * it is finished is a worse product than an empty dashboard — this one
 * keeps a checklist instead, so the owner can come back to anything.
 */
export default function OwnerSetup() {
  const { session, toast } = useApp();
  const nav = useNavigate();
  const [index, setIndex] = useState(0);

  const progress = useData(() => (session ? api.setup.progress(session) : null), [session?.gymId]);
  const gym = useData(() => (session ? api.gyms.current(session) : null), [session?.gymId]);

  if (!session || !progress || !gym) return null;

  const step = STEPS[index];
  const done = progress.steps.filter((s) => s.state === 'done' || s.satisfied).length;

  const advance = async (state: 'done' | 'skipped') => {
    await api.setup.mark(session, step.key, state);
    if (index < STEPS.length - 1) setIndex(index + 1);
    else finish();
  };

  const finish = async () => {
    await api.setup.finish(session);
    toast('success', 'Your gym is ready', 'Anything you skipped is waiting in Settings.');
    nav('/owner', { replace: true });
  };

  const leaveForNow = async () => {
    await api.setup.finish(session, true);
    nav('/owner', { replace: true });
  };

  return (
    <div className="setup">
      <header className="setup__top">
        <div className="u-row u-gap-3">
          <Logo size={28} />
          <div>
            <div className="t-sm" style={{ fontWeight: 620 }}>Set up {gym.name}</div>
            <div className="t-xs t-faint">Step {index + 1} of {STEPS.length} · {done} complete</div>
          </div>
        </div>
        <Button size="sm" variant="ghost" onClick={leaveForNow}>I’ll do this later</Button>
      </header>

      <div className="setup__rail" aria-label="Setup progress">
        {STEPS.map((s, i) => {
          const state = progress.steps.find((x) => x.key === s.key);
          const satisfied = state?.satisfied || state?.state === 'done';
          return (
            <button
              key={s.key}
              className={`setup__dot ${i === index ? 'setup__dot--current' : ''} ${satisfied ? 'setup__dot--done' : ''}`}
              onClick={() => setIndex(i)}
              aria-current={i === index ? 'step' : undefined}
            >
              <span className="setup__dotmark">
                {satisfied ? <Icon name="check" size={12} strokeWidth={2.8} /> : i + 1}
              </span>
              <span className="setup__dotlabel">{s.title}</span>
            </button>
          );
        })}
      </div>

      <main className="setup__body">
        <div className="setup__head">
          <span className="setup__icon"><Icon name={step.icon} size={20} /></span>
          <div>
            <h1 className="t-h1">{step.title}</h1>
            <p className="t-sm t-muted u-mt-2">{step.lead}</p>
          </div>
        </div>

        <div className="u-mt-6">
          {step.key === 'profile' && <ProfileStep onDone={() => advance('done')} />}
          {step.key === 'plans' && <PlansStep onDone={() => advance('done')} />}
          {step.key === 'payments' && <PaymentsStep onDone={() => advance('done')} />}
          {step.key === 'features' && <FeaturesStep />}
          {step.key === 'first_member' && <FirstMemberStep onDone={() => advance('done')} />}
        </div>

        <div className="setup__foot">
          <Button variant="ghost" disabled={index === 0} onClick={() => setIndex(index - 1)} icon="arrowLeft">
            Back
          </Button>
          <span className="u-grow" />
          <Button onClick={() => advance('skipped')}>Skip for now</Button>
          {step.key === 'features' && (
            <Button variant="primary" iconRight="arrowRight" onClick={() => advance('done')}>
              {index === STEPS.length - 1 ? 'Finish' : 'Continue'}
            </Button>
          )}
        </div>

        {index === STEPS.length - 1 && (
          <p className="quiet-note u-center u-mt-5">
            Nothing here is permanent — every setting lives in Settings, and skipped steps
            stay on your dashboard checklist.
          </p>
        )}
      </main>
    </div>
  );
}

/* ---------------- Step 1: profile ---------------- */
function ProfileStep({ onDone }: { onDone: () => void }) {
  const { session, toast } = useApp();
  const gym = useData(() => (session ? api.gyms.current(session) : null), [session?.gymId]);
  const [name, setName] = useState(gym?.name ?? '');
  const [phone, setPhone] = useState(gym?.phone ?? '');
  const [email, setEmail] = useState(gym?.email ?? '');
  const [address, setAddress] = useState(gym?.address ?? '');
  const [hours, setHours] = useState(gym?.hours ?? []);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  if (!session || !gym) return null;
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const save = async () => {
    setBusy(true); setErrors({});
    try {
      await api.gyms.update(session, { name, phone, email, address, hours });
      toast('success', 'Gym details saved');
      onDone();
    } catch (e) {
      setErrors(fieldErrors(e));
      if (!Object.keys(fieldErrors(e)).length) toast('error', 'Could not save', errorMessage(e));
    } finally { setBusy(false); }
  };

  return (
    <Card>
      <CardBody>
        <div className="grid-2">
          <div className="u-col u-gap-4">
            <TextField label="Gym name" required value={name} error={errors.name}
              onChange={(e) => setName(e.target.value)} />
            <TextField label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 ..." />
            <TextField label="Email" type="email" value={email} error={errors.email}
              onChange={(e) => setEmail(e.target.value)} placeholder="hello@yourgym.com" />
            <TextareaField label="Address" rows={3} value={address}
              onChange={(e) => setAddress(e.target.value)} />
          </div>

          <div>
            <div className="t-label u-mb-3">Opening hours</div>
            <ul className="u-col u-gap-2">
              {hours.map((h, i) => (
                <li key={DAYS[i]} className="hoursrow">
                  <span className="t-sm hoursrow__day">{DAYS[i].slice(0, 3)}</span>
                  {h.closed ? (
                    <span className="t-sm t-faint u-grow">Closed</span>
                  ) : (
                    <>
                      <input className="input" type="time" value={h.open} aria-label={`${DAYS[i]} opens`}
                        onChange={(e) => setHours(hours.map((x, j) => (j === i ? { ...x, open: e.target.value } : x)))} />
                      <span className="t-xs t-faint">to</span>
                      <input className="input" type="time" value={h.close} aria-label={`${DAYS[i]} closes`}
                        onChange={(e) => setHours(hours.map((x, j) => (j === i ? { ...x, close: e.target.value } : x)))} />
                    </>
                  )}
                  <Switch
                    checked={!h.closed} hideLabel label={`${DAYS[i]} open`}
                    onChange={(open) => setHours(hours.map((x, j) => (j === i ? { ...x, closed: !open } : x)))}
                  />
                </li>
              ))}
            </ul>
          </div>
        </div>

        <Button className="u-mt-5" variant="primary" loading={busy} onClick={save} iconRight="arrowRight">
          Save and continue
        </Button>
      </CardBody>
    </Card>
  );
}

/* ---------------- Step 2: plans ---------------- */
const PLAN_PRESETS: Array<{ name: string; durationDays: number; price: number; description: string }> = [
  { name: 'Monthly', durationDays: 30, price: 2500, description: 'Full access, month to month.' },
  { name: 'Quarterly', durationDays: 90, price: 6500, description: 'Three months, better value.' },
  { name: 'Half-Yearly', durationDays: 180, price: 12000, description: 'Six months.' },
  { name: 'Annual', durationDays: 365, price: 21000, description: 'Twelve months, best value.' },
];

function PlansStep({ onDone }: { onDone: () => void }) {
  const { session, toast } = useApp();
  const plans = useData(() => {
    if (!session) return [];
    try { return api.plans.list(session); } catch { return []; }
  }, [session?.gymId]);

  const [name, setName] = useState('');
  const [duration, setDuration] = useState(30);
  const [price, setPrice] = useState(0);
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  if (!session) return null;

  const add = async (input: { name: string; durationDays: number; price: number; description?: string }) => {
    setBusy(true); setErrors({});
    try {
      await api.plans.create(session, input);
      toast('success', `${input.name} added`);
      setName(''); setPrice(0); setDescription('');
    } catch (e) {
      setErrors(fieldErrors(e));
      if (!Object.keys(fieldErrors(e)).length) toast('error', 'Could not add plan', errorMessage(e));
    } finally { setBusy(false); }
  };

  return (
    <div className="grid-2">
      <Card>
        <CardBody>
          <div className="t-label u-mb-3">Add a plan</div>
          <div className="u-col u-gap-4">
            <TextField label="Plan name" required value={name} error={errors.name}
              onChange={(e) => setName(e.target.value)} placeholder="e.g. Monthly" />
            <SelectField
              label="Duration" value={String(duration)}
              onChange={(e) => setDuration(Number(e.target.value))}
              options={[
                { value: '30', label: 'Monthly — 30 days' },
                { value: '90', label: 'Quarterly — 90 days' },
                { value: '180', label: 'Half-yearly — 180 days' },
                { value: '365', label: 'Annual — 365 days' },
                { value: '7', label: 'Weekly — 7 days' },
                { value: '1', label: 'Day pass — 1 day' },
              ]}
            />
            <MoneyField label="Price" required value={price || ''} error={errors.price}
              onChange={(e) => setPrice(Number(e.target.value.replace(/[^\d]/g, '')) || 0)}
              placeholder="0" />
            <TextField label="Description" value={description}
              onChange={(e) => setDescription(e.target.value)} placeholder="Optional" />
            <Button variant="primary" icon="plus" loading={busy}
              onClick={() => add({ name, durationDays: duration, price, description })}>
              Add plan
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <div className="u-between u-mb-3">
            <span className="t-label">Your plans</span>
            {plans.length > 0 && <Badge tone="good">{plans.length}</Badge>}
          </div>

          {plans.length === 0 ? (
            <>
              <p className="t-sm t-muted">
                Nothing yet. Add your own on the left, or start from a common set and edit the
                prices afterwards.
              </p>
              <div className="u-col u-gap-2 u-mt-4">
                {PLAN_PRESETS.map((preset) => (
                  <button key={preset.name} className="presetrow" onClick={() => add(preset)}>
                    <span className="u-grow">
                      <span className="t-sm" style={{ fontWeight: 550 }}>{preset.name}</span>
                      <span className="t-xs t-faint" style={{ display: 'block' }}>
                        {preset.durationDays} days · suggested {money(preset.price)}
                      </span>
                    </span>
                    <Icon name="plusCircle" size={17} className="t-faint" />
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <ul className="cardlist">
                {plans.map((p) => (
                  <li key={p.id} className="cardlist__item" style={{ cursor: 'default' }}>
                    <span className="u-grow" style={{ minWidth: 0 }}>
                      <span className="t-sm" style={{ fontWeight: 550 }}>{p.name}</span>
                      <span className="t-xs t-faint" style={{ display: 'block', marginTop: 2 }}>
                        {p.durationDays} days
                      </span>
                    </span>
                    <span className="u-num t-sm" style={{ fontWeight: 600 }}>{money(p.price)}</span>
                  </li>
                ))}
              </ul>
              <Button className="u-mt-4" variant="primary" iconRight="arrowRight" onClick={onDone}>
                Continue
              </Button>
            </>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

/* ---------------- Step 3: payments ---------------- */
const METHODS: Array<{ value: PaymentMethod; label: string; hint: string }> = [
  { value: 'cash', label: 'Cash', hint: 'Taken at the desk' },
  { value: 'upi', label: 'UPI', hint: 'Scan and pay' },
  { value: 'card', label: 'Card', hint: 'Machine at the desk' },
  { value: 'bank_transfer', label: 'Bank transfer', hint: 'NEFT / IMPS' },
];

function PaymentsStep({ onDone }: { onDone: () => void }) {
  const { session, toast } = useApp();
  const gym = useData(() => (session ? api.gyms.current(session) : null), [session?.gymId]);
  const [methods, setMethods] = useState<PaymentMethod[]>(gym?.payment.methods ?? ['cash']);
  const [upiId, setUpiId] = useState(gym?.payment.upiId ?? '');
  const [bankAccountName, setBankName] = useState(gym?.payment.bankAccountName ?? '');
  const [bankAccountNumber, setBankNumber] = useState(gym?.payment.bankAccountNumber ?? '');
  const [bankIfsc, setIfsc] = useState(gym?.payment.bankIfsc ?? '');
  const [invoicePrefix, setPrefix] = useState(gym?.payment.invoicePrefix ?? 'INV');
  const [busy, setBusy] = useState(false);

  if (!session || !gym) return null;

  const toggle = (m: PaymentMethod, on: boolean) => {
    setMethods((prev) => (on ? [...new Set([...prev, m])] : prev.filter((x) => x !== m)));
  };

  const save = async () => {
    setBusy(true);
    try {
      await api.gyms.updatePayment(session, {
        methods: methods.length ? methods : ['cash'],
        upiId, bankAccountName, bankAccountNumber, bankIfsc, invoicePrefix,
      });
      toast('success', 'Payment settings saved');
      onDone();
    } catch (e) {
      toast('error', 'Could not save', errorMessage(e));
    } finally { setBusy(false); }
  };

  return (
    <Card>
      <CardBody>
        <div className="grid-2">
          <div>
            <div className="t-label u-mb-3">How you take payment</div>
            <ul className="u-col u-gap-2">
              {METHODS.map((m) => (
                <li key={m.value} className="pkgfeature">
                  <span className="u-grow">
                    <span className="t-sm" style={{ fontWeight: 540 }}>{m.label}</span>
                    <span className="t-xs t-faint" style={{ display: 'block', marginTop: 2 }}>{m.hint}</span>
                  </span>
                  <Switch checked={methods.includes(m.value)} label={m.label} hideLabel
                    onChange={(on) => toggle(m.value, on)} />
                </li>
              ))}
            </ul>

            <div className="inline-alert u-mt-4">
              <Icon name="info" size={16} style={{ flex: 'none', marginTop: 1, color: 'var(--text-2)' }} />
              <span className="t-xs t-muted">
                No online payment gateway is connected in this build. These settings record how
                you take money at the studio so receipts and reports are accurate — nothing here
                charges a card.
              </span>
            </div>
          </div>

          <div className="u-col u-gap-4">
            {methods.includes('upi') && (
              <TextField label="UPI ID" value={upiId} onChange={(e) => setUpiId(e.target.value)}
                placeholder="yourgym@bank" hint="Shown to members when they ask how to pay." />
            )}
            {methods.includes('bank_transfer') && (
              <>
                <TextField label="Account name" value={bankAccountName}
                  onChange={(e) => setBankName(e.target.value)} />
                <TextField label="Account number" value={bankAccountNumber}
                  onChange={(e) => setBankNumber(e.target.value)} />
                <TextField label="IFSC" value={bankIfsc} onChange={(e) => setIfsc(e.target.value)} />
              </>
            )}
            <TextField label="Receipt prefix" value={invoicePrefix}
              onChange={(e) => setPrefix(e.target.value)}
              hint="Receipt numbers look like INV-1001." />
          </div>
        </div>

        <Button className="u-mt-5" variant="primary" loading={busy} onClick={save} iconRight="arrowRight">
          Save and continue
        </Button>
      </CardBody>
    </Card>
  );
}

/* ---------------- Step 4: features (read-only) ---------------- */
function FeaturesStep() {
  const { session } = useApp();
  const rows = useData(() => (session ? api.features.list(session) : []), [session?.gymId]);
  const plan = useData(() => (session ? api.features.plan(session) : null), [session?.gymId]);
  if (!session) return null;

  const on = rows.filter((r) => r.effective);

  return (
    <Card>
      <CardBody>
        <div className="u-between u-gap-4 u-wrap u-mb-4">
          <div>
            <div className="t-sm" style={{ fontWeight: 580 }}>
              {plan?.pkg ? `You are on ${plan.pkg.name}` : 'No plan assigned yet'}
            </div>
            <p className="t-xs t-muted u-mt-2" style={{ maxWidth: '56ch' }}>
              {on.length} modules are available to you. Anything not listed is not part of your
              plan — your navigation only shows what you actually have, so the app stays as
              simple as your gym needs it to be.
            </p>
          </div>
          <Badge tone="good">{on.length} enabled</Badge>
        </div>

        {CATEGORY_ORDER.map((cat) => {
          const group = on.filter((r) => r.def.category === cat);
          if (!group.length) return null;
          return (
            <div key={cat} className="u-mb-4">
              <div className="t-label u-mb-3">{CATEGORY_LABEL[cat as FeatureCategory]}</div>
              <div className="chiprow">
                {group.map((r) => (
                  <span key={r.key} className="featurechip">
                    <Icon name="check" size={12} strokeWidth={2.6} />
                    {r.def.name}
                    {r.def.delivery === 'designed' && <span className="tag tag--quiet">soon</span>}
                  </span>
                ))}
              </div>
            </div>
          );
        })}

        <p className="quiet-note u-mt-4">
          Need something that is not here? Your features are set by Fitness Manager, not from
          inside your own workspace — get in touch and we will switch it on.
        </p>
      </CardBody>
    </Card>
  );
}

/* ---------------- Step 5: first member ---------------- */
function FirstMemberStep({ onDone }: { onDone: () => void }) {
  const { session, toast } = useApp();
  const nav = useNavigate();
  const plans = useData(() => {
    if (!session) return [];
    try { return api.plans.list(session); } catch { return []; }
  }, [session?.gymId]);
  const counts = useData(() => {
    if (!session) return null;
    try { return api.members.counts(session); } catch { return null; }
  }, [session?.gymId]);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [planId, setPlanId] = useState('');
  const [amountPaid, setAmountPaid] = useState(0);
  const [method, setMethod] = useState<PaymentMethod>('upi');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  if (!session) return null;

  const chosen = plans.find((p) => p.id === (planId || plans[0]?.id));

  if (!plans.length) {
    return (
      <Card>
        <CardBody>
          <div className="empty">
            <span className="empty__art"><Icon name="layers" size={22} /></span>
            <span className="empty__title">Add a plan first</span>
            <span className="empty__msg">
              A member joins on a plan, so there is nothing to put them on yet. You skipped that
              step — it is still waiting on your dashboard.
            </span>
          </div>
        </CardBody>
      </Card>
    );
  }

  const submit = async () => {
    setBusy(true); setErrors({});
    try {
      await api.members.register(session, {
        name, phone, email,
        planId: chosen!.id,
        startDate: new Date().toISOString().slice(0, 10),
        discount: 0,
        amountPaid,
        method,
      });
      toast('success', `${name.split(' ')[0]} is your first member`, 'Your dashboard has real numbers now.');
      onDone();
    } catch (e) {
      setErrors(fieldErrors(e));
      if (!Object.keys(fieldErrors(e)).length) toast('error', 'Could not add member', errorMessage(e));
    } finally { setBusy(false); }
  };

  if (counts && counts.all > 0) {
    return (
      <Card>
        <CardBody>
          <div className="empty">
            <span className="empty__art" style={{ background: 'var(--good-soft)', color: 'var(--good)' }}>
              <Icon name="checkCircle" size={22} />
            </span>
            <span className="empty__title">You already have {counts.all} member{counts.all === 1 ? '' : 's'}</span>
            <span className="empty__msg">Your gym is set up. Everything else lives in the app.</span>
            <div className="u-row u-gap-2 u-mt-2">
              <Button onClick={() => nav('/owner/members')}>See members</Button>
              <Button variant="primary" onClick={onDone}>Finish setup</Button>
            </div>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardBody>
        <div className="grid-2">
          <div className="u-col u-gap-4">
            <TextField label="Full name" required autoFocus value={name} error={errors.name}
              onChange={(e) => setName(e.target.value)} placeholder="Their name" />
            <TextField label="Phone" required value={phone} error={errors.phone}
              onChange={(e) => setPhone(e.target.value)} placeholder="+91 ..." />
            <TextField label="Email" type="email" value={email} error={errors.email}
              onChange={(e) => setEmail(e.target.value)} placeholder="Optional" />
          </div>
          <div className="u-col u-gap-4">
            <SelectField label="Plan" value={chosen?.id ?? ''} onChange={(e) => setPlanId(e.target.value)}
              options={plans.map((p) => ({ value: p.id, label: `${p.name} — ${money(p.price)}` }))} />
            <MoneyField label="Amount paid now" value={amountPaid || ''} error={errors.amountPaid}
              onChange={(e) => setAmountPaid(Number(e.target.value.replace(/[^\d]/g, '')) || 0)}
              hint={chosen ? `Plan price is ${money(chosen.price)}. Part payments are fine.` : undefined} />
            <SelectField label="Method" value={method}
              onChange={(e) => setMethod(e.target.value as PaymentMethod)}
              options={METHODS.map((m) => ({ value: m.value, label: m.label }))} />
          </div>
        </div>

        <Button className="u-mt-5" variant="primary" loading={busy} onClick={submit} icon="userPlus">
          Add member and finish
        </Button>
      </CardBody>
    </Card>
  );
}
