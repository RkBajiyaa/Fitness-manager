import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, CardBody, PageHead, Badge } from '../../components/ui/primitives';
import {
  DateField, MoneyField, SelectField, TextField, TextareaField, fieldErrors, errorMessage,
} from '../../components/ui/forms';
import { Icon } from '../../components/ui/Icon';
import { useApp, useData } from '../../state/app';
import * as api from '../../lib/api';
import type { Gender, PaymentMethod } from '../../lib/types';
import { dateShort, money } from '../../lib/format';
import { addDays, todayISO } from '../../lib/date';

const STEPS = ['Personal', 'Membership', 'Payment', 'Review'] as const;

interface Form {
  name: string; phone: string; email: string; dob: string; gender: Gender; address: string;
  emergencyName: string; emergencyPhone: string; emergencyRelation: string;
  planId: string; startDate: string; discount: string;
  amountPaid: string; method: PaymentMethod;
}

const RELATIONS = ['Spouse', 'Father', 'Mother', 'Brother', 'Sister', 'Friend', 'Other'];

/**
 * Registration split into four short screens rather than one wall of fields.
 * Each step is independently valid, so nobody discovers a mistake at the end.
 */
export default function AddMember() {
  const { session, toast } = useApp();
  const nav = useNavigate();
  const plans = useData(() => (session ? api.plans.list(session) : []), [session?.gymId]);

  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState<Form>(() => ({
    name: '', phone: '', email: '', dob: '', gender: 'male', address: '',
    emergencyName: '', emergencyPhone: '', emergencyRelation: 'Spouse',
    planId: '', startDate: todayISO(), discount: '', amountPaid: '', method: 'upi',
  }));

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => (e[k as string] ? { ...e, [k as string]: '' } : e));
  };

  const plan = plans.find((p) => p.id === form.planId) ?? plans[0];
  const discount = Number(form.discount || 0);
  const net = Math.max(0, (plan?.price ?? 0) - discount);
  const paid = form.amountPaid === '' ? net : Number(form.amountPaid);
  const pending = Math.max(0, net - paid);
  const endDate = plan && form.startDate ? addDays(form.startDate, plan.durationDays - 1) : '';

  const validateStep = (i: number): boolean => {
    const e: Record<string, string> = {};
    if (i === 0) {
      if (!form.name.trim()) e.name = 'Full name is required.';
      const digits = form.phone.replace(/\D/g, '');
      if (!digits) e.phone = 'Phone number is required.';
      else if (digits.length < 10) e.phone = 'Enter a 10-digit phone number.';
      if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'That email address is not valid.';
      if (form.dob && form.dob > todayISO()) e.dob = 'Date of birth cannot be in the future.';
    }
    if (i === 1) {
      if (!plan) e.planId = 'Choose a membership plan.';
      if (!form.startDate) e.startDate = 'Choose a start date.';
      if (discount > (plan?.price ?? 0)) e.discount = 'Discount cannot exceed the plan price.';
    }
    if (i === 2) {
      if (paid < 0) e.amountPaid = 'Amount cannot be negative.';
      if (paid > net) e.amountPaid = `Amount cannot exceed the payable ${money(net)}.`;
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => { if (validateStep(step)) setStep((s) => Math.min(STEPS.length - 1, s + 1)); };
  const back = () => setStep((s) => Math.max(0, s - 1));

  const save = async () => {
    if (!session || !plan) return;
    setBusy(true); setErrors({});
    try {
      const member = await api.members.register(session, {
        name: form.name, phone: form.phone, email: form.email, dob: form.dob,
        gender: form.gender, address: form.address,
        emergencyName: form.emergencyName, emergencyPhone: form.emergencyPhone,
        emergencyRelation: form.emergencyRelation,
        planId: plan.id, startDate: form.startDate, discount,
        amountPaid: paid, method: form.method,
      });
      toast('success', 'Member added successfully',
        `${member.name} · ${plan.name}${pending > 0 ? ` · ${money(pending)} pending` : ' · paid in full'}`);
      nav(`/owner/members/${member.id}`);
    } catch (e) {
      const f = fieldErrors(e);
      setErrors(f);
      if (f.name || f.phone || f.email || f.dob) setStep(0);
      else if (f.discount || f.startDate) setStep(1);
      else if (f.amountPaid) setStep(2);
      else toast('error', 'Could not add member', errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (!session) return null;

  return (
    <div className="anim-page" style={{ maxWidth: 860, margin: '0 auto' }}>
      <PageHead
        title="Add member"
        subtitle="Four short steps — personal details, plan, payment, then a final check."
        actions={<Button icon="arrowLeft" onClick={() => nav('/owner/members')}>Back to members</Button>}
      />

      <div className="wizard-steps u-mb-5">
        {STEPS.map((label, i) => (
          <div key={label} className="wstep" data-state={i === step ? 'active' : i < step ? 'done' : 'todo'}>
            <button
              className="wstep__dot"
              onClick={() => { if (i < step) setStep(i); }}
              disabled={i > step}
              aria-label={`Step ${i + 1}: ${label}`}
              aria-current={i === step ? 'step' : undefined}
            >
              {i < step ? <Icon name="check" size={13} strokeWidth={2.6} /> : i + 1}
            </button>
            <span className="wstep__label">{label}</span>
            {i < STEPS.length - 1 && <span className="wstep__line" />}
          </div>
        ))}
      </div>

      <Card>
        <CardBody>
          {step === 0 && (
            <div className="u-col u-gap-5">
              <section>
                <h2 className="t-label u-mb-4">Personal information</h2>
                <div className="form-grid">
                  <TextField label="Full name" required autoFocus className="span-2"
                    placeholder="e.g. Ananya Iyer"
                    value={form.name} error={errors.name} onChange={(e) => set('name', e.target.value)} />
                  <TextField label="Phone" required type="tel" placeholder="+91 98450 21174"
                    value={form.phone} error={errors.phone} onChange={(e) => set('phone', e.target.value)}
                    hint="Used as the member's unique contact." />
                  <TextField label="Email" type="email" placeholder="optional"
                    value={form.email} error={errors.email} onChange={(e) => set('email', e.target.value)} />
                  <DateField label="Date of birth" max={todayISO()}
                    value={form.dob} error={errors.dob} onChange={(e) => set('dob', e.target.value)} />
                  <SelectField label="Gender" value={form.gender}
                    onChange={(e) => set('gender', e.target.value as Gender)}
                    options={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }, { value: 'other', label: 'Other' }]} />
                  <TextareaField label="Address" className="span-2" placeholder="optional"
                    value={form.address} onChange={(e) => set('address', e.target.value)} />
                </div>
              </section>

              <hr className="divider" />

              <section>
                <h2 className="t-label u-mb-4">Emergency contact</h2>
                <div className="form-grid form-grid--3">
                  <TextField label="Name" placeholder="optional"
                    value={form.emergencyName} onChange={(e) => set('emergencyName', e.target.value)} />
                  <TextField label="Phone" type="tel" placeholder="optional"
                    value={form.emergencyPhone} onChange={(e) => set('emergencyPhone', e.target.value)} />
                  <SelectField label="Relationship" value={form.emergencyRelation}
                    onChange={(e) => set('emergencyRelation', e.target.value)}
                    options={RELATIONS.map((r) => ({ value: r, label: r }))} />
                </div>
              </section>
            </div>
          )}

          {step === 1 && (
            <div className="u-col u-gap-5">
              <section>
                <h2 className="t-label u-mb-4">Membership plan</h2>
                <div className="grid-3">
                  {plans.map((p) => {
                    const active = plan?.id === p.id;
                    return (
                      <button
                        key={p.id}
                        onClick={() => set('planId', p.id)}
                        className="card card--interactive"
                        style={{
                          padding: 'var(--s-4)', textAlign: 'left', cursor: 'pointer',
                          borderColor: active ? 'var(--brand)' : undefined,
                          background: active ? 'var(--brand-soft)' : undefined,
                        }}
                        aria-pressed={active}
                      >
                        <div className="u-between">
                          <span className="t-h3">{p.name}</span>
                          {active && <Icon name="checkCircle" size={17} style={{ color: 'var(--brand)' }} />}
                        </div>
                        <div className="t-h2 u-num u-mt-2">{money(p.price)}</div>
                        <div className="t-xs t-faint u-mt-2">{p.durationDays} days · {p.description}</div>
                      </button>
                    );
                  })}
                </div>
                {errors.planId && <p className="field__error u-mt-3"><Icon name="alert" size={12} />{errors.planId}</p>}
              </section>

              <div className="form-grid">
                <DateField label="Start date" required value={form.startDate} error={errors.startDate}
                  onChange={(e) => set('startDate', e.target.value)}
                  hint={endDate ? `Expires ${dateShort(endDate)}` : undefined} />
                <MoneyField label="Discount" placeholder="0" value={form.discount} error={errors.discount}
                  onChange={(e) => set('discount', e.target.value.replace(/[^\d]/g, ''))}
                  hint={discount > 0 ? `Payable becomes ${money(net)}` : 'Optional'} />
              </div>

              <Summary rows={[
                ['Plan', plan?.name ?? '—'],
                ['Duration', plan ? `${plan.durationDays} days` : '—'],
                ['Starts', form.startDate ? dateShort(form.startDate) : '—'],
                ['Expires', endDate ? dateShort(endDate) : '—'],
                ['Price', money(plan?.price ?? 0)],
                ['Discount', discount > 0 ? `− ${money(discount)}` : '—'],
                ['Payable', money(net), true],
              ]} />
            </div>
          )}

          {step === 2 && (
            <div className="u-col u-gap-5">
              <section>
                <h2 className="t-label u-mb-4">Payment</h2>
                <div className="form-grid">
                  <MoneyField
                    label="Amount received now" autoFocus
                    placeholder={String(net)} value={form.amountPaid} error={errors.amountPaid}
                    onChange={(e) => set('amountPaid', e.target.value.replace(/[^\d]/g, ''))}
                    hint={`Leave blank to record the full ${money(net)}.`}
                  />
                  <SelectField label="Payment method" value={form.method}
                    onChange={(e) => set('method', e.target.value as PaymentMethod)}
                    options={[
                      { value: 'upi', label: 'UPI' }, { value: 'cash', label: 'Cash' },
                      { value: 'card', label: 'Card' }, { value: 'bank_transfer', label: 'Bank transfer' },
                    ]} />
                </div>
                <div className="u-row u-gap-2 u-wrap u-mt-4">
                  {[net, Math.round(net / 2 / 50) * 50, 0].map((amt, i) => (
                    <button key={i} className="chip" onClick={() => set('amountPaid', String(amt))}
                      aria-pressed={paid === amt}>
                      {i === 0 ? `Full ${money(amt)}` : i === 1 ? `Half ${money(amt)}` : 'Nothing yet'}
                    </button>
                  ))}
                </div>
              </section>

              <Summary rows={[
                ['Payable', money(net)],
                ['Paying now', money(paid)],
                ['Pending', pending > 0 ? money(pending) : 'Nil', true],
              ]} />

              {pending > 0 && (
                <p className="t-sm t-muted u-row u-gap-2">
                  <Icon name="info" size={15} style={{ color: 'var(--warning)', flex: 'none', marginTop: 2 }} />
                  This member will appear in <strong>Payments → Outstanding</strong> until the balance is cleared.
                </p>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="u-col u-gap-5">
              <ReviewBlock title="Personal" onEdit={() => setStep(0)} rows={[
                ['Name', form.name],
                ['Phone', form.phone],
                ['Email', form.email || '—'],
                ['Date of birth', form.dob ? dateShort(form.dob) : '—'],
                ['Gender', form.gender],
                ['Address', form.address || '—'],
                ['Emergency contact', form.emergencyName
                  ? `${form.emergencyName} (${form.emergencyRelation}) · ${form.emergencyPhone || 'no number'}`
                  : '—'],
              ]} />
              <ReviewBlock title="Membership" onEdit={() => setStep(1)} rows={[
                ['Plan', plan?.name ?? '—'],
                ['Starts', form.startDate ? dateShort(form.startDate) : '—'],
                ['Expires', endDate ? dateShort(endDate) : '—'],
                ['Price', money(plan?.price ?? 0)],
                ['Discount', discount > 0 ? `− ${money(discount)}` : '—'],
              ]} />
              <ReviewBlock title="Payment" onEdit={() => setStep(2)} rows={[
                ['Payable', money(net)],
                ['Paying now', `${money(paid)} · ${form.method.replace('_', ' ')}`],
                ['Pending', pending > 0 ? money(pending) : 'Nil'],
              ]} />

              <div className="u-row u-gap-3 u-wrap">
                <Badge tone="brand" icon="info">Saving writes a member, a membership and a payment together</Badge>
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      <div className="sticky-actions">
        {step > 0 && <Button icon="arrowLeft" onClick={back} disabled={busy}>Back</Button>}
        <span className="u-grow hide-mobile" />
        {step < STEPS.length - 1 ? (
          <Button variant="primary" iconRight="arrowRight" onClick={next} block={step === 0}>
            Continue
          </Button>
        ) : (
          <Button variant="primary" icon="check" onClick={save} loading={busy}>
            Save member
          </Button>
        )}
      </div>
    </div>
  );
}

function Summary({ rows }: { rows: Array<[string, string, boolean?]> }) {
  return (
    <div className="card" style={{ background: 'var(--surface-2)' }}>
      <div className="card__body" style={{ padding: 'var(--s-3) var(--s-4)' }}>
        {rows.map(([k, v, strong]) => (
          <div key={k} className="u-between t-sm" style={{ padding: '5px 0' }}>
            <span className="t-muted">{k}</span>
            <span className="u-num" style={{ fontWeight: strong ? 650 : 550, fontSize: strong ? 'var(--fs-15)' : undefined }}>
              {v}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReviewBlock({ title, rows, onEdit }: {
  title: string; rows: Array<[string, string]>; onEdit: () => void;
}) {
  return (
    <section>
      <div className="u-between u-mb-3">
        <h2 className="t-label">{title}</h2>
        <Button size="sm" variant="ghost" icon="edit" onClick={onEdit}>Edit</Button>
      </div>
      <div className="card" style={{ background: 'var(--surface-2)' }}>
        <div className="card__body" style={{ padding: 'var(--s-2) var(--s-4)' }}>
          {rows.map(([k, v]) => (
            <div key={k} className="kv">
              <span className="kv__k">{k}</span>
              <span className="kv__v u-cap" style={{ maxWidth: '60%' }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
