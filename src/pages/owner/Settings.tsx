import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Badge, Button, Card, CardBody, CardHead, KV, PageHead,
} from '../../components/ui/primitives';
import {
  Switch, TextField, TextareaField, errorMessage, fieldErrors,
} from '../../components/ui/forms';
import { Icon } from '../../components/ui/Icon';
import { useApp, useData } from '../../state/app';
import * as api from '../../lib/api';
import { getDb } from '../../lib/db';
import { IS_DEMO_AUTH } from '../../lib/auth';
import { count, dateShort } from '../../lib/format';
import { ROLE_DEFS } from '../../lib/platform/permissions';
import type { PaymentMethod } from '../../lib/types';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const METHODS: Array<{ value: PaymentMethod; label: string }> = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' },
  { value: 'bank_transfer', label: 'Bank transfer' },
];

export default function Settings() {
  const { session, theme, toggleTheme, toast, has } = useApp();
  const nav = useNavigate();

  const gym = useData(() => (session ? api.gyms.current(session) : null), [session?.gymId]);
  const counts = useData(() => {
    if (!session) return null;
    try { return api.members.counts(session); } catch { return null; }
  }, [session?.gymId]);
  const setup = useData(() => (session ? api.setup.progress(session) : null), [session?.gymId]);
  const plan = useData(() => (session ? api.features.plan(session) : null), [session?.gymId]);
  const audit = useData(() => {
    if (!session) return [];
    return getDb().audit.filter((a) => a.gymId === session.gymId).slice(0, 8);
  }, [session?.gymId]);

  if (!session || !gym || !setup) return null;

  const reopenSetup = async () => {
    await api.setup.reopen(session);
    nav('/owner/setup');
  };

  return (
    <div className="anim-page">
      <PageHead
        title="Settings"
        subtitle="Your studio profile, payments, roles and data."
        actions={(
          <Button icon="layers" onClick={() => nav('/owner/features')}>
            My features
          </Button>
        )}
      />

      {!setup.complete && (
        <Card className="u-mb-4">
          <CardBody>
            <div className="u-between u-gap-4 u-wrap">
              <div>
                <div className="t-sm" style={{ fontWeight: 580 }}>
                  Setup is {setup.doneCount} of {setup.total} complete
                </div>
                <p className="t-xs t-muted u-mt-2">
                  {setup.steps.filter((s) => s.state === 'skipped' && !s.satisfied)
                    .map((s) => s.label).join(', ') || 'A few steps are still pending.'}
                </p>
              </div>
              <Button variant="primary" icon="route" onClick={reopenSetup}>Finish setup</Button>
            </div>
          </CardBody>
        </Card>
      )}

      <div className="grid-2">
        <div className="u-col u-gap-4">
          <StudioProfile />

          {has('payments') && <PaymentSettings />}

          <Card>
            <CardHead title="Your plan" subtitle="Set by Fitness Manager, not from inside your workspace" />
            <CardBody>
              <KV k="Plan">{plan?.pkg?.name ?? <span className="t-faint">None assigned</span>}</KV>
              <KV k="Status">
                {plan?.subscription
                  ? <Badge tone={plan.subscription.status === 'active' ? 'good' : 'brand'}>{plan.subscription.status}</Badge>
                  : <span className="t-faint">—</span>}
              </KV>
              <KV k="Members">{counts ? count(counts.all) : '—'}</KV>
              <KV k="Workspace">
                {gym.dataMode === 'demo'
                  ? <Badge tone="warning">Demonstration data</Badge>
                  : <Badge tone="good">Live data</Badge>}
              </KV>
              <KV k="Tenant ID"><code className="t-xs">{gym.id}</code></KV>
              <Button className="u-mt-4" icon="layers" onClick={() => nav('/owner/features')}>
                See everything I have
              </Button>
            </CardBody>
          </Card>

          <Card>
            <CardHead title="Authentication" subtitle="How sign-in works today, and what replaces it" />
            <CardBody>
              <div className="u-row u-gap-3 u-mb-4">
                <span style={{
                  width: 38, height: 38, flex: 'none', display: 'grid', placeItems: 'center',
                  borderRadius: 'var(--r-md)', background: 'var(--surface-3)', color: 'var(--text-2)',
                }}>
                  <Icon name="lock" size={18} />
                </span>
                <div className="u-grow">
                  <div className="t-sm" style={{ fontWeight: 580 }}>
                    {IS_DEMO_AUTH ? 'Development sign-in' : 'Firebase Authentication'}
                  </div>
                  <div className="u-mt-2">
                    <Badge tone={IS_DEMO_AUTH ? 'warning' : 'good'} dot>
                      {IS_DEMO_AUTH ? 'Demo adapter — not production security' : 'Connected'}
                    </Badge>
                  </div>
                </div>
              </div>

              <p className="t-sm t-muted" style={{ lineHeight: 1.65 }}>
                Sign-in runs behind an adapter interface. Screens never see which one is active,
                so replacing the demo adapter with Firebase changes no screen.
              </p>

              <div className="u-mt-4" style={{
                padding: 'var(--s-4)', background: 'var(--surface-2)',
                border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
                fontSize: 'var(--fs-12)', lineHeight: 1.9, color: 'var(--text-2)',
              }}>
                Firebase issues a token<br />
                → the <strong>backend</strong> verifies it<br />
                → uid maps to an internal user row<br />
                → role and studio resolved <strong>from the database</strong><br />
                → tenant, entitlement, role and ownership gates run<br />
                → Neon PostgreSQL, every query scoped by gym
              </div>

              <p className="quiet-note u-mt-4">
                The browser never supplies a role, a studio id or a feature flag. It supplies an
                identity; the server decides everything else.
              </p>
            </CardBody>
          </Card>
        </div>

        <div className="u-col u-gap-4">
          <Card>
            <CardHead title="Integrations" subtitle="What is connected, stated honestly" />
            <CardBody>
              <IntegrationRow
                icon="whatsapp" title="WhatsApp Business"
                desc="Receipts, renewal reminders, congratulations"
                entitled={has('whatsapp')}
                onClick={() => toast('info', 'Not connected',
                  'Messages are composed and logged; nothing is delivered. Connecting a provider is a later phase.')}
              />
              <IntegrationRow
                icon="mail" title="Email" desc="Invoices and receipts"
                entitled={has('email')}
                onClick={() => toast('info', 'Not connected', 'Same seam as WhatsApp — one provider implementation.')}
              />
              <IntegrationRow
                icon="fingerprint" title="Attendance device"
                desc="Biometric or QR reader at the entrance"
                entitled={has('biometric_attendance') || has('qr_attendance')}
                onClick={() => toast('info', 'Not connected',
                  'Attendance and device integration are separate concepts — the event log is ready for a device that is not wired up yet.')}
              />
              <IntegrationRow
                icon="card" title="Payment gateway"
                desc="Collect renewals without the desk"
                entitled={has('payment_gateway')}
                onClick={() => toast('info', 'Not connected',
                  'Configuration only. No card is ever charged in this build.')}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHead title="Roles & permissions"
              subtitle="Permission is role-level, and separate from what your plan includes" />
            <CardBody flush>
              <ul className="cardlist">
                {ROLE_DEFS.filter((r) => r.role !== 'platform_admin').map((r) => (
                  <li key={r.role} className="cardlist__item" style={{ cursor: 'default', alignItems: 'flex-start' }}>
                    <span className="u-grow" style={{ minWidth: 0 }}>
                      <span className="u-row u-gap-2 u-wrap">
                        <span className="t-sm" style={{ fontWeight: 560 }}>{r.name}</span>
                        {!r.exposed && <span className="tag tag--quiet">Coming later</span>}
                      </span>
                      <span className="t-xs t-muted" style={{ display: 'block', marginTop: 3, lineHeight: 1.55 }}>
                        {r.description}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
              <div style={{ padding: 'var(--s-4)' }}>
                <p className="quiet-note">
                  Every role exists in the model already. Exposing Manager, Trainer and Reception
                  is a screens job, not a security redesign.
                </p>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHead title="Appearance" />
            <CardBody>
              <Switch checked={theme === 'dark'} onChange={toggleTheme} label="Dark theme" />
              <p className="quiet-note u-mt-3">
                Light is the primary design. Dark is a separately selected palette, not an
                inversion — the chart colours have their own validated steps for the dark surface.
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHead title="Recent activity" subtitle="The audit trail every write produces" />
            <CardBody flush>
              {audit.length === 0 ? (
                <p className="t-sm t-faint" style={{ padding: 'var(--s-4)' }}>
                  Nothing yet. Add a member, record a payment or log an expense and it appears here.
                </p>
              ) : (
                <ul className="cardlist">
                  {audit.map((a) => (
                    <li key={a.id} className="cardlist__item" style={{ cursor: 'default' }}>
                      <Badge>{a.action}</Badge>
                      <span className="u-grow t-sm u-truncate">{a.entity}</span>
                      <span className="t-xs t-faint u-nowrap">{dateShort(a.at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHead title="Data" subtitle="This build persists to your browser, not a server" />
            <CardBody>
              <p className="t-sm t-muted" style={{ lineHeight: 1.65 }}>
                Everything you do is written to local storage under one versioned key, so changes
                survive a refresh.
                {gym.dataMode === 'demo'
                  ? ' This is a demonstration workspace — it is separate from every live gym, and it can be removed from the platform console.'
                  : ' This is your own workspace and nothing in it was generated for you.'}
              </p>
              {gym.dataMode === 'live' && (
                <Button className="u-mt-4" icon="route" onClick={reopenSetup}>
                  Reopen the setup checklist
                </Button>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );

  function StudioProfile() {
    const [name, setName] = useState(gym!.name);
    const [phone, setPhone] = useState(gym!.phone);
    const [email, setEmail] = useState(gym!.email);
    const [address, setAddress] = useState(gym!.address);
    const [hours, setHours] = useState(gym!.hours);
    const [editingHours, setEditingHours] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [busy, setBusy] = useState(false);

    const save = async () => {
      setBusy(true); setErrors({});
      try {
        await api.gyms.update(session!, { name, phone, email, address, hours });
        toast('success', 'Studio profile saved');
      } catch (e) {
        setErrors(fieldErrors(e));
        if (!Object.keys(fieldErrors(e)).length) toast('error', 'Could not save', errorMessage(e));
      } finally { setBusy(false); }
    };

    return (
      <Card>
        <CardHead
          title="Studio profile"
          subtitle="The tenant every record in this workspace belongs to"
          action={(
            <Button size="sm" variant="ghost" icon="clock" onClick={() => setEditingHours((v) => !v)}>
              {editingHours ? 'Hide hours' : 'Hours'}
            </Button>
          )}
        />
        <CardBody>
          <div className="u-col u-gap-4">
            <TextField label="Gym name" value={name} error={errors.name}
              onChange={(e) => setName(e.target.value)} />
            <TextField label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <TextField label="Email" type="email" value={email} error={errors.email}
              onChange={(e) => setEmail(e.target.value)} />
            <TextareaField label="Address" rows={2} value={address}
              onChange={(e) => setAddress(e.target.value)} />

            {editingHours && (
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
                      <Switch checked={!h.closed} hideLabel label={`${DAYS[i]} open`}
                        onChange={(open) => setHours(hours.map((x, j) => (j === i ? { ...x, closed: !open } : x)))} />
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <Button variant="primary" loading={busy} onClick={save}>Save profile</Button>
          </div>
        </CardBody>
      </Card>
    );
  }

  function PaymentSettings() {
    const [methods, setMethods] = useState<PaymentMethod[]>(gym!.payment.methods);
    const [upiId, setUpiId] = useState(gym!.payment.upiId);
    const [invoicePrefix, setPrefix] = useState(gym!.payment.invoicePrefix);
    const [taxNote, setTaxNote] = useState(gym!.payment.taxNote);
    const [busy, setBusy] = useState(false);

    const save = async () => {
      setBusy(true);
      try {
        await api.gyms.updatePayment(session!, {
          methods: methods.length ? methods : ['cash'], upiId, invoicePrefix, taxNote,
        });
        toast('success', 'Payment settings saved');
      } catch (e) { toast('error', 'Could not save', errorMessage(e)); } finally { setBusy(false); }
    };

    return (
      <Card>
        <CardHead title="Payments" subtitle="How you take money at the studio" />
        <CardBody>
          <div className="chiprow u-mb-4">
            {METHODS.map((m) => {
              const on = methods.includes(m.value);
              return (
                <button
                  key={m.value}
                  className={`togglechip ${on ? 'togglechip--on' : ''}`}
                  aria-pressed={on}
                  onClick={() => setMethods((prev) => (on
                    ? prev.filter((x) => x !== m.value)
                    : [...prev, m.value]))}
                >
                  <Icon name={on ? 'check' : 'plus'} size={12} strokeWidth={2.6} />
                  {m.label}
                </button>
              );
            })}
          </div>

          <div className="u-col u-gap-4">
            {methods.includes('upi') && (
              <TextField label="UPI ID" value={upiId} onChange={(e) => setUpiId(e.target.value)}
                placeholder="yourgym@bank" />
            )}
            <TextField label="Receipt prefix" value={invoicePrefix}
              onChange={(e) => setPrefix(e.target.value)} hint="Receipt numbers look like INV-1001." />
            <TextField label="Tax note" value={taxNote} onChange={(e) => setTaxNote(e.target.value)}
              placeholder="Optional — printed on receipts later" />
            <Button variant="primary" loading={busy} onClick={save}>Save payment settings</Button>
          </div>

          <div className="inline-alert u-mt-4">
            <Icon name="info" size={16} style={{ flex: 'none', marginTop: 1, color: 'var(--text-2)' }} />
            <span className="t-xs t-muted">
              No payment gateway is connected. These settings describe how you take money today;
              nothing here charges a card.
            </span>
          </div>
        </CardBody>
      </Card>
    );
  }
}

function IntegrationRow({ icon, title, desc, entitled, onClick }: {
  icon: 'fingerprint' | 'card' | 'whatsapp' | 'mail';
  title: string; desc: string; entitled: boolean; onClick: () => void;
}) {
  return (
    <div className="u-row u-gap-3" style={{ padding: 'var(--s-3) 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{
        width: 38, height: 38, flex: 'none', display: 'grid', placeItems: 'center',
        borderRadius: 'var(--r-md)', background: 'var(--surface-inset)', color: 'var(--text-3)',
      }}>
        <Icon name={icon} size={18} />
      </span>
      <span className="u-grow" style={{ minWidth: 0 }}>
        <span className="t-sm" style={{ fontWeight: 560 }}>{title}</span>
        <span className="t-xs t-faint" style={{ display: 'block' }}>{desc}</span>
      </span>
      <Badge dot>{entitled ? 'Not connected' : 'Not in your plan'}</Badge>
      {entitled && <Button size="sm" onClick={onClick}>Details</Button>}
    </div>
  );
}
