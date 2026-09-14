import { useState } from 'react';
import {
  Badge, Button, Card, CardBody, CardHead, KV, PageHead,
} from '../../components/ui/primitives';
import { SelectField, Switch, TextField } from '../../components/ui/forms';
import { Icon } from '../../components/ui/Icon';
import { useApp, useData } from '../../state/app';
import * as api from '../../lib/api';
import { count } from '../../lib/format';
import { ROLE_DEFS } from '../../lib/platform/permissions';
import { IS_DEMO_AUTH } from '../../lib/auth';

/**
 * Platform settings. Kept small deliberately — with a handful of
 * customers, a giant configuration surface is cost without benefit.
 */
export default function PlatformSettings() {
  const { session, toast, confirm, hardReset } = useApp();

  const settings = useData(() => (session ? api.platform.settings.get(session) : null), [session?.userId]);
  const packages = useData(() => (session ? api.platform.packages.list(session) : []), [session?.userId]);
  const demo = useData(() => (session ? api.platform.demo.status(session) : null), [session?.userId]);
  const metrics = useData(() => (session ? api.platform.metrics.get(session) : null), [session?.userId]);

  const [name, setName] = useState('');
  const [supportEmail, setSupportEmail] = useState('');
  const [busy, setBusy] = useState('');

  if (!session || !settings || !demo || !metrics) return null;

  const save = async (patch: Parameters<typeof api.platform.settings.update>[1]) => {
    await api.platform.settings.update(session, patch);
    toast('success', 'Settings saved');
  };

  const loadDemo = async () => {
    setBusy('demo');
    try {
      await api.platform.demo.load(session);
      toast('success', 'Demo data loaded', 'Two example studios are now on the platform.');
    } finally { setBusy(''); }
  };

  const clearDemo = async () => {
    const ok = await confirm({
      title: 'Remove the demo data?',
      tone: 'danger',
      confirmLabel: 'Remove demo data',
      message: `The ${demo.gyms} demonstration workspace${demo.gyms === 1 ? '' : 's'} and their ${count(demo.members)} members are deleted. Live customers are not touched.`,
    });
    if (!ok) return;
    setBusy('demo');
    try {
      await api.platform.demo.clear(session);
      toast('success', 'Demo data removed');
    } finally { setBusy(''); }
  };

  const wipe = async () => {
    const ok = await confirm({
      title: 'Reset the entire store?',
      tone: 'danger',
      confirmLabel: 'Delete everything',
      message: `Every customer, member, payment and record is destroyed — ${metrics.totalGyms} gyms and ${count(metrics.totalMembers)} members. Only the feature catalog and packages are rebuilt. This cannot be undone.`,
    });
    if (ok) hardReset();
  };

  return (
    <div className="anim-page">
      <PageHead title="Platform settings" subtitle="Defaults, demo mode and the role model." />

      <div className="grid-2">
        <div className="u-col u-gap-4">
          <Card>
            <CardHead title="Platform" />
            <CardBody>
              <div className="u-col u-gap-4">
                <TextField
                  label="Platform name"
                  value={name || settings.platformName}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={() => name && name !== settings.platformName && save({ platformName: name })}
                />
                <TextField
                  label="Support email" type="email"
                  value={supportEmail || settings.supportEmail}
                  onChange={(e) => setSupportEmail(e.target.value)}
                  onBlur={() => supportEmail && supportEmail !== settings.supportEmail
                    && save({ supportEmail })}
                />
                <SelectField
                  label="Default package for new customers"
                  value={settings.defaultPackageKey}
                  onChange={(e) => save({ defaultPackageKey: e.target.value })}
                  options={packages.filter((p) => !p.isSystem)
                    .map((p) => ({ value: p.key, label: `${p.name} — ${p.features.length} features` }))}
                />
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHead title="Sign-up behaviour" subtitle="What the sign-in screens offer" />
            <CardBody>
              <div className="u-col u-gap-4">
                <div className="u-between u-gap-4">
                  <span>
                    <span className="t-sm" style={{ fontWeight: 550 }}>Offer demo data</span>
                    <span className="t-xs t-muted" style={{ display: 'block', marginTop: 2, maxWidth: '44ch' }}>
                      Shows “Explore with demo data” on the owner and member sign-in screens.
                    </span>
                  </span>
                  <Switch checked={settings.demoModeEnabled} label="Offer demo data"
                    onChange={(v) => save({ demoModeEnabled: v })} />
                </div>
                <div className="u-between u-gap-4">
                  <span>
                    <span className="t-sm" style={{ fontWeight: 550 }}>Self-serve sign-up</span>
                    <span className="t-xs t-muted" style={{ display: 'block', marginTop: 2, maxWidth: '44ch' }}>
                      Lets anyone create their own empty workspace. Turn this off to make the
                      platform invite-only, provisioned from this console.
                    </span>
                  </span>
                  <Switch checked={settings.selfServeSignupEnabled} label="Self-serve sign-up"
                    onChange={(v) => save({ selfServeSignupEnabled: v })} />
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHead title="Demonstration data" subtitle="Isolated from every live customer" />
            <CardBody>
              {demo.loaded ? (
                <>
                  <KV k="Workspaces">{demo.gyms}</KV>
                  <KV k="Members">{count(demo.members)}</KV>
                  <p className="t-xs t-muted u-mt-4" style={{ maxWidth: '52ch' }}>
                    Demo gyms are flagged <code>dataMode: demo</code> and separated by the same
                    tenant gate that separates two real customers — there is no second isolation
                    mechanism that could disagree with the first.
                  </p>
                  <Button className="u-mt-4" icon="trash" loading={busy === 'demo'} onClick={clearDemo}>
                    Remove demo data
                  </Button>
                </>
              ) : (
                <>
                  <p className="t-sm t-muted" style={{ maxWidth: '52ch' }}>
                    Not loaded. Real customers never see it; it exists for demonstrations, QA and
                    development, and is built on request rather than on first boot.
                  </p>
                  <Button className="u-mt-4" variant="primary" icon="compass"
                    loading={busy === 'demo'} onClick={loadDemo}>
                    Load demo data
                  </Button>
                </>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="u-col u-gap-4">
          <Card>
            <CardHead title="Roles" subtitle="Permissions are role-level and separate from entitlements" />
            <CardBody flush>
              <ul className="cardlist">
                {ROLE_DEFS.map((r) => (
                  <li key={r.role} className="cardlist__item" style={{ cursor: 'default', alignItems: 'flex-start' }}>
                    <span className="u-grow" style={{ minWidth: 0 }}>
                      <span className="u-row u-gap-2">
                        <span className="t-sm" style={{ fontWeight: 560 }}>{r.name}</span>
                        {!r.exposed && <span className="tag tag--quiet">Modelled, not exposed</span>}
                      </span>
                      <span className="t-xs t-muted" style={{ display: 'block', marginTop: 3, lineHeight: 1.55 }}>
                        {r.description}
                      </span>
                      <span className="t-xs t-faint" style={{ display: 'block', marginTop: 4 }}>
                        {r.capabilities.join('  ·  ')}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>

          <Card>
            <CardHead title="Authentication" subtitle="What is running today" />
            <CardBody>
              <div className="u-row u-gap-3 u-mb-4">
                <span style={{
                  width: 38, height: 38, flex: 'none', display: 'grid', placeItems: 'center',
                  borderRadius: 'var(--r-md)', background: 'var(--warning-soft)', color: 'var(--warning)',
                }}>
                  <Icon name="lock" size={18} />
                </span>
                <div className="u-grow">
                  <div className="t-sm" style={{ fontWeight: 580 }}>
                    {IS_DEMO_AUTH ? 'Development adapter' : 'Firebase Authentication'}
                  </div>
                  <p className="t-xs t-muted u-mt-2">
                    {IS_DEMO_AUTH
                      ? 'No hashing, no tokens, no expiry. This is not security — it exists so the flow can be demonstrated, and is built to be deleted in one commit.'
                      : 'Tokens verified server-side; role and tenant resolved from stored data.'}
                  </p>
                </div>
              </div>
              <KV k="Console access"><code className="t-xs">admin@fitnessmanager.demo</code></KV>
              <KV k="Production plan">Firebase identity + Neon PostgreSQL, verified server-side</KV>
            </CardBody>
          </Card>

          <Card>
            <CardHead title="Store" />
            <CardBody>
              <KV k="Customers">{metrics.totalGyms}</KV>
              <KV k="Members">{count(metrics.totalMembers)}</KV>
              <KV k="Overrides">{metrics.totalOverrides}</KV>
              <KV k="Storage">Browser localStorage <Badge>Prototype</Badge></KV>
              <hr className="divider u-mt-4 u-mb-4" />
              <div className="t-sm" style={{ fontWeight: 560, color: 'var(--critical)' }}>Reset everything</div>
              <p className="t-xs t-muted u-mt-2">
                Destroys every customer and rebuilds a bare platform. Development only.
              </p>
              <Button className="u-mt-3" variant="danger" icon="trash" onClick={wipe}>
                Reset the store
              </Button>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
