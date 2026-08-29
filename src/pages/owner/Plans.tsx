import { useState } from 'react';
import {
  Badge, Button, Card, CardBody, EmptyState, Modal, PageHead, StatTile,
} from '../../components/ui/primitives';
import { MoneyField, TextField, TextareaField, fieldErrors, errorMessage } from '../../components/ui/forms';
import { Icon } from '../../components/ui/Icon';
import { useApp, useData } from '../../state/app';
import * as api from '../../lib/api';
import type { MembershipPlan } from '../../lib/types';
import { count, money } from '../../lib/format';

export default function Plans() {
  const { session } = useApp();
  const [editing, setEditing] = useState<MembershipPlan | 'new' | null>(null);

  const plans = useData(() => (session ? api.plans.list(session) : []), [session?.gymId]);
  const all = useData(() => (session ? api.memberships.list(session, { status: 'all' }) : []), [session?.gymId]);

  if (!session) return null;

  const usage = (planId: string) => all.filter((r) => r.membership?.planId === planId).length;

  return (
    <div className="anim-page">
      <PageHead
        title="Membership plans"
        subtitle="Monthly, quarterly, yearly or anything custom — a plan is just a duration and a price."
        actions={<Button variant="primary" icon="plus" onClick={() => setEditing('new')}>New plan</Button>}
      />

      <div className="grid-stats u-mb-5">
        <StatTile label="Plans offered" icon="layers" value={count(plans.length)} />
        <StatTile label="Cheapest" icon="wallet"
          value={plans.length ? money(Math.min(...plans.map((p) => p.price))) : '—'} />
        <StatTile label="Longest" icon="calendar"
          value={plans.length ? `${Math.max(...plans.map((p) => p.durationDays))} days` : '—'} />
        <StatTile label="Members on a plan" icon="users" value={count(all.length)} />
      </div>

      {plans.length === 0 ? (
        <Card><EmptyState icon="layers" title="No plans yet"
          message="Create your first membership plan to start registering members."
          action={<Button variant="primary" icon="plus" onClick={() => setEditing('new')}>New plan</Button>} /></Card>
      ) : (
        <div className="grid-3">
          {plans.map((p) => (
            <Card key={p.id}>
              <CardBody>
                <div className="u-between u-gap-3">
                  <div>
                    <h2 className="t-h3">{p.name}</h2>
                    <div className="t-xs t-faint u-mt-2">{p.durationDays} days</div>
                  </div>
                  {p.isActive ? <Badge tone="good" dot>Active</Badge> : <Badge>Hidden</Badge>}
                </div>

                <div className="u-mt-4">
                  <span style={{ fontSize: 'var(--fs-28)', fontWeight: 660, letterSpacing: '-0.026em' }}>
                    {money(p.price)}
                  </span>
                  <span className="t-xs t-faint" style={{ marginLeft: 6 }}>
                    ≈ {money(Math.round((p.price / p.durationDays) * 30))}/month
                  </span>
                </div>

                {p.description && <p className="t-sm t-muted u-mt-3">{p.description}</p>}

                <div className="u-between u-mt-5">
                  <span className="t-xs t-faint">{usage(p.id)} members on this plan</span>
                  <Button size="sm" icon="edit" onClick={() => setEditing(p)}>Edit</Button>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <p className="t-xs t-faint u-mt-5 u-row u-gap-2">
        <Icon name="info" size={13} />
        Changing a price never rewrites history — every membership stores the price it was sold at.
      </p>

      {editing && <PlanDialog plan={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function PlanDialog({ plan, onClose }: { plan: MembershipPlan | null; onClose: () => void }) {
  const { session, toast } = useApp();
  const [name, setName] = useState(plan?.name ?? '');
  const [durationDays, setDurationDays] = useState(String(plan?.durationDays ?? 30));
  const [price, setPrice] = useState(String(plan?.price ?? ''));
  const [description, setDescription] = useState(plan?.description ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!session) return;
    setBusy(true); setErrors({});
    try {
      const payload = {
        name, durationDays: Number(durationDays), price: Number(price), description,
      };
      if (plan) {
        await api.plans.update(session, plan.id, payload);
        toast('success', 'Plan updated', name);
      } else {
        await api.plans.create(session, payload);
        toast('success', 'Plan created', `${name} · ${money(Number(price))}`);
      }
      onClose();
    } catch (e) {
      setErrors(fieldErrors(e));
      if (!Object.keys(fieldErrors(e)).length) toast('error', 'Could not save plan', errorMessage(e));
    } finally { setBusy(false); }
  };

  return (
    <Modal
      title={plan ? 'Edit plan' : 'New membership plan'}
      subtitle={plan ? 'Existing memberships keep the price they were sold at.' : undefined}
      onClose={onClose}
      footer={<>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={submit} loading={busy}>{plan ? 'Save changes' : 'Create plan'}</Button>
      </>}
    >
      <div className="form-grid">
        <TextField label="Plan name" required autoFocus className="span-2" placeholder="e.g. Quarterly"
          value={name} error={errors.name} onChange={(e) => setName(e.target.value)} />
        <TextField label="Duration" required suffix="days" inputMode="numeric"
          value={durationDays} error={errors.durationDays}
          onChange={(e) => setDurationDays(e.target.value.replace(/[^\d]/g, ''))}
          hint="30 · 90 · 180 · 365 — or anything custom" />
        <MoneyField label="Price" required value={price} error={errors.price}
          onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ''))} />
        <TextareaField label="Description" className="span-2" placeholder="What is included?"
          value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
    </Modal>
  );
}
