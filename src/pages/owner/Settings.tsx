import { Badge, Button, Card, CardBody, CardHead, KV, PageHead } from '../../components/ui/primitives';
import { Switch } from '../../components/ui/forms';
import { Icon } from '../../components/ui/Icon';
import { useApp, useData } from '../../state/app';
import * as api from '../../lib/api';
import { getDb } from '../../lib/db';
import { IS_DEMO_AUTH } from '../../lib/auth';
import { anyProviderConfigured } from '../../lib/integrations/messaging';
import { count, dateShort } from '../../lib/format';

const ROLE_MATRIX: Array<[string, string, string, string, string]> = [
  ['Manage gyms & subscriptions', '✓', '—', '—', '—'],
  ['Studio settings & plans', '—', '✓', '—', '—'],
  ['Members: create, edit, delete', '—', '✓', 'assigned', 'own fields'],
  ['Memberships, payments, dues', '—', '✓', '—', 'view own'],
  ['Expenses, revenue, P&L', '—', '✓', '—', '—'],
  ['Attendance', '—', '✓', 'assigned', 'own'],
  ['Exercise library (studio)', 'write', 'write', 'write', 'read'],
  ['Member custom exercises', '—', 'read', 'read', 'write own'],
  ['Programs: build & assign', '—', '✓', '✓', 'view own'],
  ['Training sessions & sets', '—', 'read', 'read', 'write own'],
  ['Fitness profile & goals', '—', 'read', 'read', 'write own'],
  ['Internal notes', '—', '✓', 'assigned', 'never'],
  ['Messages', '—', 'send', '—', 'read own'],
];

export default function Settings() {
  const { session, reseed, confirm, theme, toggleTheme, toast } = useApp();

  const gym = useData(() => (session ? api.gyms.current(session) : null), [session?.gymId]);
  const counts = useData(() => (session ? api.members.counts(session) : null), [session?.gymId]);
  const audit = useData(() => {
    if (!session) return [];
    return getDb().audit.filter((a) => a.gymId === session.gymId).slice(0, 8);
  }, [session?.gymId]);
  const tenants = useData(() => getDb().gyms.length, []);

  if (!session || !gym || !counts) return null;

  const reset = async () => {
    const ok = await confirm({
      title: 'Rebuild the demo dataset?',
      tone: 'danger',
      confirmLabel: 'Rebuild data',
      message: 'Everything added in this session — members, payments, expenses, training sessions — will be discarded and replaced with a freshly generated dataset.',
    });
    if (ok) reseed();
  };

  return (
    <div className="anim-page">
      <PageHead title="Settings" subtitle="Studio profile, roles, integrations and data." />

      <div className="grid-2">
        <div className="u-col u-gap-4">
          <Card>
            <CardHead title="Studio profile" subtitle="The tenant every record in this workspace belongs to" />
            <CardBody>
              <KV k="Name">{gym.name}</KV>
              <KV k="Tenant ID"><code className="t-xs">{gym.id}</code></KV>
              <KV k="Phone">{gym.phone}</KV>
              <KV k="Email">{gym.email}</KV>
              <KV k="Address"><span style={{ maxWidth: 260, display: 'inline-block' }}>{gym.address}</span></KV>
              <KV k="Currency">{gym.currency} · {gym.timezone}</KV>
              <KV k="Members">{count(counts.all)}</KV>
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
                → tenant, role and ownership gates run<br />
                → Neon PostgreSQL, every query scoped by gym
              </div>

              <p className="quiet-note u-mt-4">
                The browser never supplies a role or a studio id. It supplies an identity; the
                server decides everything else.
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHead title="Multi-tenant isolation" subtitle="Why more than one studio is seeded" />
            <CardBody>
              <p className="t-sm t-muted" style={{ lineHeight: 1.65 }}>
                There are <strong>{tenants} studios</strong> in the local database. You are signed
                into one, and nothing here can see the other — every query leads with the session's
                <code className="t-xs"> gymId</code>, and no screen supplies a tenant key of its own.
              </p>
              <ul className="u-col u-gap-2 u-mt-4">
                {[
                  'Every studio-owned row carries gym_id',
                  'Cross-tenant reads return 404, never 403 — another studio\'s id is never confirmed',
                  'A studio switcher, branches and a platform console reuse this one rule',
                ].map((t) => (
                  <li key={t} className="u-row u-gap-2 t-xs t-faint">
                    <Icon name="shield" size={12} style={{ color: 'var(--good)', flex: 'none', marginTop: 3 }} />{t}
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </div>

        <div className="u-col u-gap-4">
          <Card>
            <CardHead title="Integrations" subtitle="What is connected, stated honestly" />
            <CardBody>
              <IntegrationRow icon="whatsapp" title="WhatsApp Business"
                desc="Receipts, renewal reminders, congratulations"
                status={anyProviderConfigured() ? 'Connected' : 'Not connected'}
                onClick={() => toast('info', 'Not available yet',
                  'Messages are composed and logged. Connecting a provider is a configuration change.')} />
              <IntegrationRow icon="mail" title="Email"
                desc="Invoices and receipts" status="Not connected"
                onClick={() => toast('info', 'Planned', 'Same seam as WhatsApp — one provider implementation.')} />
              <IntegrationRow icon="fingerprint" title="Attendance device"
                desc="Biometric or QR reader at the entrance" status="Not connected"
                onClick={() => toast('info', 'Not available yet',
                  'Enabled once the studio\'s hardware and API are chosen.')} />
              <IntegrationRow icon="card" title="Online payments"
                desc="Collect renewals without the desk" status="Not connected"
                onClick={() => toast('info', 'Planned', 'A gateway will write into the same payment ledger.')} />
            </CardBody>
          </Card>

          <Card>
            <CardHead title="Roles & permissions"
              subtitle="Owner and Member are live; Trainer and Platform Admin are designed for" />
            <CardBody flush>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th scope="col">Capability</th>
                      <th scope="col">Platform</th>
                      <th scope="col">Owner</th>
                      <th scope="col">Trainer</th>
                      <th scope="col">Member</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ROLE_MATRIX.map((row) => (
                      <tr key={row[0]}>
                        <td className="t-sm">{row[0]}</td>
                        {row.slice(1).map((cell, i) => (
                          <td key={i} className="t-xs t-muted"
                            style={{ color: cell === '✓' ? 'var(--good)' : undefined, textAlign: 'center' }}>
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
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
            <CardHead title="Recent activity" subtitle="A preview of the audit log every write produces" />
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
              <p className="t-sm t-muted">
                Everything you do is written to local storage under one versioned key, so changes
                survive a refresh. Rebuilding regenerates the whole dataset from the seed.
              </p>
              <Button className="u-mt-4" icon="refresh" onClick={reset} style={{ color: 'var(--critical)' }}>
                Rebuild demo data
              </Button>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

function IntegrationRow({ icon, title, desc, status, onClick }: {
  icon: 'fingerprint' | 'card' | 'whatsapp' | 'mail';
  title: string; desc: string; status: string; onClick: () => void;
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
      <Badge dot>{status}</Badge>
      <Button size="sm" onClick={onClick}>Connect</Button>
    </div>
  );
}
