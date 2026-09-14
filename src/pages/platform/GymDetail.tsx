import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Badge, Button, Card, CardBody, CardHead, EmptyState, KV, Tabs,
} from '../../components/ui/primitives';
import { Switch, TextField, TextareaField } from '../../components/ui/forms';
import { Icon } from '../../components/ui/Icon';
import { useApp, useData } from '../../state/app';
import * as api from '../../lib/api';
import { count, dateShort, money, relativeDay } from '../../lib/format';
import { dayOf } from '../../lib/date';
import {
  CATEGORY_LABEL, CATEGORY_ORDER, type FeatureCategory,
} from '../../lib/platform/catalog';
import type { Entitlement } from '../../lib/platform/entitlements';
import type { SubscriptionStatus } from '../../lib/types';

type Tab = 'overview' | 'owner' | 'members' | 'features' | 'package' | 'usage' | 'activity' | 'settings';

export default function GymDetail() {
  const { id = '' } = useParams();
  const { session, toast, confirm } = useApp();
  const nav = useNavigate();
  const [tab, setTab] = useState<Tab>('overview');

  const detail = useData(() => {
    if (!session) return null;
    try { return api.platform.gyms.get(session, id); } catch { return null; }
  }, [session?.userId, id]);

  if (!session) return null;
  if (!detail) {
    return (
      <Card>
        <EmptyState icon="building" title="Customer not found"
          message="That gym is not on the platform."
          action={<Button variant="primary" onClick={() => nav('/platform/gyms')}>Back to customers</Button>} />
      </Card>
    );
  }

  const { gym, owner, pkg, subscription } = detail;

  const toggleStatus = async () => {
    const next = gym.status === 'active' ? 'suspended' : 'active';
    const ok = await confirm({
      title: next === 'suspended' ? `Suspend ${gym.name}?` : `Reactivate ${gym.name}?`,
      tone: next === 'suspended' ? 'danger' : 'default',
      confirmLabel: next === 'suspended' ? 'Suspend' : 'Reactivate',
      message: next === 'suspended'
        ? 'Everyone at this gym is signed out of the app until you reactivate it. No data is deleted.'
        : 'The owner and their members can sign in again immediately.',
    });
    if (!ok) return;
    await api.platform.gyms.update(session, gym.id, { status: next });
    toast('success', next === 'suspended' ? 'Customer suspended' : 'Customer reactivated');
  };

  return (
    <div className="anim-page">
      <div className="u-row u-gap-3 u-mb-4">
        <Button size="sm" variant="ghost" icon="arrowLeft" onClick={() => nav('/platform/gyms')}>
          Customers
        </Button>
      </div>

      <div className="detailhead">
        <span className="detailhead__icon"><Icon name="building" size={22} /></span>
        <div className="u-grow" style={{ minWidth: 0 }}>
          <div className="u-row u-gap-2 u-wrap">
            <h1 className="t-h1 u-truncate">{gym.name}</h1>
            <Badge tone={gym.status === 'active' ? 'good' : 'warning'} dot>
              {gym.status === 'active' ? 'Active' : 'Suspended'}
            </Badge>
            {gym.dataMode === 'demo' && <Badge>Demo data</Badge>}
            {gym.kind === 'personal' && <Badge>Personal workspace</Badge>}
          </div>
          <p className="t-sm t-muted u-mt-2">
            {owner ? `${owner.name} · ${owner.email}` : 'No owner account'}
            {' · '}{count(detail.memberCount)} members
            {' · '}{pkg?.name ?? 'No package'}
          </p>
        </div>
        <div className="u-row u-gap-2">
          <Button icon={gym.status === 'active' ? 'ban' : 'checkCircle'} onClick={toggleStatus}>
            {gym.status === 'active' ? 'Suspend' : 'Reactivate'}
          </Button>
        </div>
      </div>

      <Tabs
        ariaLabel="Customer sections"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'overview', label: 'Overview' },
          { value: 'owner', label: 'Owner' },
          { value: 'members', label: 'Members', count: detail.memberCount },
          { value: 'features', label: 'Features', count: detail.featureCount },
          { value: 'package', label: 'Package' },
          { value: 'usage', label: 'Usage' },
          { value: 'activity', label: 'Activity', count: detail.activity.length },
          { value: 'settings', label: 'Settings' },
        ]}
      />

      <div className="u-mt-4">
        {tab === 'overview' && <Overview detail={detail} onTab={setTab} />}
        {tab === 'owner' && <OwnerTab detail={detail} />}
        {tab === 'members' && <MembersTab detail={detail} />}
        {tab === 'features' && <FeaturesTab gymId={gym.id} />}
        {tab === 'package' && <PackageTab detail={detail} />}
        {tab === 'usage' && <UsageTab detail={detail} />}
        {tab === 'activity' && <ActivityTab detail={detail} />}
        {tab === 'settings' && <SettingsTab detail={detail} />}
      </div>

      {subscription && tab === 'overview' && (
        <p className="quiet-note u-center u-mt-4">
          Subscription started {dateShort(subscription.startedAt)}
          {subscription.renewsAt ? ` · renews ${dateShort(subscription.renewsAt)}` : ' · no renewal date set'}
        </p>
      )}
    </div>
  );
}

type Detail = NonNullable<ReturnType<typeof api.platform.gyms.get>>;

/* ============================================================
   Overview
   ============================================================ */
function Overview({ detail, onTab }: { detail: Detail; onTab: (t: Tab) => void }) {
  const { gym, usage } = detail;
  const overridden = detail.entitlements.filter((e) => e.override !== null);

  return (
    <div className="grid-2">
      <div className="u-col u-gap-4">
        <Card>
          <CardHead title="At a glance" />
          <CardBody>
            <KV k="Members">{count(detail.memberCount)} ({count(detail.activeMemberCount)} active)</KV>
            <KV k="Features enabled">{detail.featureCount}</KV>
            <KV k="Individual overrides">
              {overridden.length === 0 ? <span className="t-faint">None — following the package</span> : overridden.length}
            </KV>
            <KV k="Payments recorded">{count(usage.payments)}</KV>
            <KV k="Training sessions">{count(usage.sessions)}</KV>
            <KV k="Last activity">
              {detail.lastActivityAt ? relativeDay(dayOf(detail.lastActivityAt)) : <span className="t-faint">None yet</span>}
            </KV>
          </CardBody>
        </Card>

        <Card>
          <CardHead title="Workspace" />
          <CardBody>
            <KV k="Tenant ID"><code className="t-xs">{gym.id}</code></KV>
            <KV k="Created">{dateShort(gym.createdAt)}</KV>
            <KV k="Data">{gym.dataMode === 'demo' ? 'Demonstration data' : 'Live customer data'}</KV>
            <KV k="Type">{gym.kind === 'personal' ? 'Personal workspace' : 'Studio'}</KV>
            <KV k="Setup">
              {gym.setup.completedAt
                ? `Completed ${dateShort(gym.setup.completedAt)}`
                : <span style={{ color: 'var(--warning)' }}>Still in progress</span>}
            </KV>
          </CardBody>
        </Card>
      </div>

      <div className="u-col u-gap-4">
        {overridden.length > 0 && (
          <Card>
            <CardHead
              title="Individual overrides"
              subtitle="These beat the package for this customer"
              action={<Button size="sm" variant="ghost" iconRight="arrowRight" onClick={() => onTab('features')}>Manage</Button>}
            />
            <CardBody flush>
              <ul className="cardlist">
                {overridden.map((e) => (
                  <li key={e.key} className="cardlist__item" style={{ cursor: 'default' }}>
                    <span className="u-grow" style={{ minWidth: 0 }}>
                      <span className="t-sm" style={{ fontWeight: 550 }}>{e.def.name}</span>
                      <span className="t-xs t-faint" style={{ display: 'block', marginTop: 2 }}>{e.reason}</span>
                    </span>
                    <Badge tone={e.effective ? 'good' : 'neutral'}>{e.effective ? 'On' : 'Off'}</Badge>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        )}

        <Card>
          <CardHead title="Contact" />
          <CardBody>
            <KV k="Phone">{gym.phone || <span className="t-faint">Not set</span>}</KV>
            <KV k="Email">{gym.email || <span className="t-faint">Not set</span>}</KV>
            <KV k="Address">
              {gym.address
                ? <span style={{ maxWidth: 260, display: 'inline-block' }}>{gym.address}</span>
                : <span className="t-faint">Not set</span>}
            </KV>
            <KV k="Timezone">{gym.timezone}</KV>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

/* ============================================================
   Owner
   ============================================================ */
function OwnerTab({ detail }: { detail: Detail }) {
  const { owner, users } = detail;
  if (!owner) {
    return (
      <Card>
        <EmptyState icon="user" title="No owner account"
          message="This workspace has no owner user. Members can still sign in if they have accounts." />
      </Card>
    );
  }
  return (
    <div className="grid-2">
      <Card>
        <CardHead title="Owner" subtitle="The account that administers this gym" />
        <CardBody>
          <KV k="Name">{owner.name}</KV>
          <KV k="Email">{owner.email}</KV>
          <KV k="Phone">{owner.phone || <span className="t-faint">Not set</span>}</KV>
          <KV k="Sign-in">{owner.authProvider === 'demo' ? 'Development adapter' : 'Firebase'}</KV>
          <KV k="User ID"><code className="t-xs">{owner.id}</code></KV>
        </CardBody>
      </Card>

      <Card>
        <CardHead title="All accounts" subtitle={`${users.length} in this workspace`} />
        <CardBody flush>
          <ul className="cardlist">
            {users.map((u) => (
              <li key={u.id} className="cardlist__item" style={{ cursor: 'default' }}>
                <span className="u-grow" style={{ minWidth: 0 }}>
                  <span className="t-sm u-truncate" style={{ fontWeight: 550 }}>{u.name}</span>
                  <span className="t-xs t-faint u-truncate" style={{ display: 'block' }}>{u.email}</span>
                </span>
                <Badge>{u.role === 'owner' ? 'Owner' : u.role === 'member' ? 'Member' : u.role}</Badge>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}

/* ============================================================
   Members — roster facts only, never their training data
   ============================================================ */
function MembersTab({ detail }: { detail: Detail }) {
  const [q, setQ] = useState('');
  const rows = detail.members.filter(
    (m) => !q.trim() || m.name.toLowerCase().includes(q.toLowerCase().trim())
      || m.memberCode.toLowerCase().includes(q.toLowerCase().trim()));

  if (!detail.members.length) {
    return (
      <Card>
        <EmptyState icon="users" title="No members yet"
          message="This gym has not added anyone. That is expected for a customer still in setup." />
      </Card>
    );
  }

  return (
    <Card>
      <CardHead
        title="Members"
        subtitle={`${count(detail.members.length)} on the roster`}
        action={(
          <input className="input" style={{ minHeight: 34, maxWidth: 220 }} value={q}
            onChange={(e) => setQ(e.target.value)} placeholder="Search" aria-label="Search members" />
        )}
      />
      <CardBody flush>
        {rows.length === 0 ? (
          <div style={{ padding: 'var(--s-5)' }}>
            <p className="t-sm t-faint">No member matches “{q}”.</p>
          </div>
        ) : (
          <ul className="cardlist">
            {rows.slice(0, 100).map((m) => (
              <li key={m.id} className="cardlist__item" style={{ cursor: 'default' }}>
                <span className="u-grow" style={{ minWidth: 0 }}>
                  <span className="t-sm u-truncate" style={{ fontWeight: 550 }}>{m.name}</span>
                  <span className="t-xs t-faint" style={{ display: 'block', marginTop: 2 }}>
                    {m.memberCode} · joined {dateShort(m.joinedAt)}
                  </span>
                </span>
                <Badge tone={m.lifecycle === 'active' ? 'good' : 'neutral'}>
                  {m.lifecycle === 'active' ? 'Active' : m.lifecycle === 'frozen' ? 'Frozen' : 'Inactive'}
                </Badge>
              </li>
            ))}
          </ul>
        )}
        <div style={{ padding: 'var(--s-4)' }}>
          <p className="quiet-note">
            The console shows roster facts only. A customer’s training logs, measurements and
            internal notes are theirs — administration is not surveillance.
          </p>
        </div>
      </CardBody>
    </Card>
  );
}

/* ============================================================
   FEATURES — individual, per-customer assignment (§M.6)

   The whole point of the console. For every feature the admin
   sees three separate facts and one switch:
     what the package says · what we decided · what is actually true
   ============================================================ */
function FeaturesTab({ gymId }: { gymId: string }) {
  const { session, toast, confirm } = useApp();
  const [busy, setBusy] = useState('');
  const [showAll, setShowAll] = useState(true);

  const rows = useData(
    () => (session ? api.platform.entitlements.for(session, gymId) : []),
    [session?.userId, gymId],
  );
  const plan = useData(() => {
    if (!session) return null;
    const d = api.platform.gyms.get(session, gymId);
    return { pkg: d.pkg, sub: d.subscription };
  }, [session?.userId, gymId]);

  if (!session) return null;

  const overrides = rows.filter((r) => r.override !== null);
  const visible = showAll ? rows : rows.filter((r) => r.effective || r.override !== null);

  const setOverride = async (e: Entitlement, enabled: boolean) => {
    setBusy(e.key);
    try {
      await api.platform.entitlements.setOverride(session, gymId, e.key, enabled);
      toast('success',
        `${e.def.name} ${enabled ? 'enabled' : 'disabled'}`,
        enabled === e.inPackage
          ? 'This matches the package, and is recorded as a deliberate override.'
          : `Overrides the ${plan?.pkg?.name ?? 'package'} default.`);
    } catch { toast('error', 'Could not save', 'Try again.'); } finally { setBusy(''); }
  };

  const revert = async (e: Entitlement) => {
    setBusy(e.key);
    try {
      await api.platform.entitlements.clearOverride(session, gymId, e.key);
      toast('success', `${e.def.name} follows the package again`,
        e.inPackage ? 'Back on, inherited.' : 'Back off, not included.');
    } catch { toast('error', 'Could not revert', 'Try again.'); } finally { setBusy(''); }
  };

  const revertAll = async () => {
    const ok = await confirm({
      title: 'Remove every override?',
      confirmLabel: 'Remove all',
      message: `All ${overrides.length} individual decisions are dropped and this customer follows ${plan?.pkg?.name ?? 'their package'} exactly.`,
    });
    if (!ok) return;
    await api.platform.entitlements.clearAll(session, gymId);
    toast('success', 'Overrides cleared');
  };

  const byCategory = CATEGORY_ORDER
    .map((cat) => ({ cat, rows: visible.filter((r) => r.def.category === cat) }))
    .filter((g) => g.rows.length > 0);

  return (
    <div className="u-col u-gap-4">
      <Card>
        <CardBody>
          <div className="u-between u-gap-4 u-wrap">
            <div>
              <div className="t-sm" style={{ fontWeight: 580 }}>
                {plan?.pkg ? `On ${plan.pkg.name}` : 'No package assigned'}
              </div>
              <p className="t-xs t-muted u-mt-2" style={{ maxWidth: '52ch' }}>
                {plan?.pkg
                  ? `${plan.pkg.features.length} features come from the package. Anything you switch below is an individual decision for this customer only.`
                  : 'Without a package this customer has no features at all. Assign one on the Package tab.'}
              </p>
            </div>
            <div className="u-row u-gap-2 u-wrap">
              <Switch checked={showAll} onChange={setShowAll} label="Show unavailable" />
              {overrides.length > 0 && (
                <Button size="sm" icon="undo" onClick={revertAll}>
                  Clear {overrides.length} override{overrides.length === 1 ? '' : 's'}
                </Button>
              )}
            </div>
          </div>
        </CardBody>
      </Card>

      {byCategory.map(({ cat, rows: group }) => (
        <Card key={cat}>
          <CardHead title={CATEGORY_LABEL[cat as FeatureCategory]}
            subtitle={`${group.filter((r) => r.effective).length} of ${group.length} enabled`} />
          <CardBody flush>
            <ul className="featurelist">
              {group.map((e) => (
                <FeatureRow
                  key={e.key} e={e} busy={busy === e.key}
                  packageName={plan?.pkg?.name ?? 'no package'}
                  onSet={(on) => setOverride(e, on)}
                  onRevert={() => revert(e)}
                />
              ))}
            </ul>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}

function FeatureRow({ e, busy, packageName, onSet, onRevert }: {
  e: Entitlement;
  busy: boolean;
  packageName: string;
  onSet: (on: boolean) => void;
  onRevert: () => void;
}) {
  const blocked = e.source === 'blocked';
  return (
    <li className={`featurerow ${e.effective ? 'featurerow--on' : ''}`}>
      <div className="featurerow__main">
        <div className="u-row u-gap-2 u-wrap">
          <span className="t-sm" style={{ fontWeight: 570 }}>{e.def.name}</span>
          {e.override !== null && (
            <span className={`tag ${e.override ? 'tag--on' : 'tag--off'}`}>
              Override {e.override ? 'on' : 'off'}
            </span>
          )}
          {e.def.delivery === 'designed' && <span className="tag tag--quiet">Not built yet</span>}
          {e.def.foundational && <span className="tag tag--quiet">Foundational</span>}
        </div>
        <p className="t-xs t-muted u-mt-2" style={{ maxWidth: '64ch' }}>{e.def.description}</p>

        <div className="featurerow__why">
          <span>
            <span className="featurerow__whylabel">Package</span>
            <span className={e.inPackage ? 'featurerow__on' : 'featurerow__off'}>
              {packageName} → {e.inPackage ? 'ON' : 'OFF'}
            </span>
          </span>
          <span>
            <span className="featurerow__whylabel">Override</span>
            <span className={e.override === null ? 'featurerow__none' : e.override ? 'featurerow__on' : 'featurerow__off'}>
              {e.override === null ? 'None' : e.override ? 'ON' : 'OFF'}
            </span>
          </span>
          <span>
            <span className="featurerow__whylabel">Effective</span>
            <span className={e.effective ? 'featurerow__on' : 'featurerow__off'} style={{ fontWeight: 680 }}>
              {e.effective ? 'ON' : 'OFF'}
            </span>
          </span>
        </div>

        {(blocked || e.override !== null) && (
          <p className="t-xs u-mt-2" style={{ color: blocked ? 'var(--warning)' : 'var(--text-3)' }}>
            {e.reason}
          </p>
        )}
      </div>

      <div className="featurerow__controls">
        <Switch
          checked={e.effective}
          onChange={(on) => onSet(on)}
          disabled={busy}
          hideLabel
          label={`${e.def.name} — currently ${e.effective ? 'enabled' : 'disabled'}`}
        />
        {e.override !== null && (
          <button className="auth__link t-xs" onClick={onRevert} disabled={busy}>
            Revert to package
          </button>
        )}
      </div>
    </li>
  );
}

/* ============================================================
   Package
   ============================================================ */
function PackageTab({ detail }: { detail: Detail }) {
  const { session, toast } = useApp();
  const packages = useData(() => (session ? api.platform.packages.list(session) : []), [session?.userId]);
  const [busy, setBusy] = useState(false);
  const [renewal, setRenewal] = useState(detail.subscription?.renewsAt ?? '');
  const [notes, setNotes] = useState(detail.subscription?.notes ?? '');

  if (!session) return null;

  const move = async (packageId: string) => {
    setBusy(true);
    try {
      await api.platform.subscriptions.setPackage(session, detail.gym.id, packageId);
      toast('success', 'Package changed', 'Individual overrides are kept and still apply on top.');
    } finally { setBusy(false); }
  };

  const setStatus = async (status: SubscriptionStatus) => {
    await api.platform.subscriptions.setStatus(session, detail.gym.id, status);
    toast('success', `Subscription set to ${status}`);
  };

  return (
    <div className="grid-2">
      <Card>
        <CardHead title="Package" subtitle="The default set of features this customer inherits" />
        <CardBody flush>
          <ul className="cardlist">
            {packages.map((p) => {
              const current = detail.subscription?.packageId === p.id;
              return (
                <li key={p.id}>
                  <button className="cardlist__item" disabled={busy || current}
                    onClick={() => move(p.id)}
                    style={current ? { background: 'var(--surface-2)', cursor: 'default' } : undefined}>
                    <span style={{
                      width: 26, height: 26, flex: 'none', display: 'grid', placeItems: 'center',
                      borderRadius: '50%',
                      background: current ? 'var(--brand)' : 'var(--surface-3)',
                      color: current ? 'var(--brand-ink)' : 'var(--text-3)',
                    }}>
                      <Icon name={current ? 'check' : 'card'} size={13} strokeWidth={2.4} />
                    </span>
                    <span className="u-grow" style={{ minWidth: 0 }}>
                      <span className="u-row u-gap-2">
                        <span className="t-sm" style={{ fontWeight: 560 }}>{p.name}</span>
                        {p.isDefault && <span className="tag tag--quiet">Default</span>}
                        {p.isSystem && <span className="tag tag--quiet">System</span>}
                      </span>
                      <span className="t-xs t-faint" style={{ display: 'block', marginTop: 2 }}>
                        {p.features.length} features · {p.gyms} customer{p.gyms === 1 ? '' : 's'}
                      </span>
                    </span>
                    {current && <Badge tone="brand">Current</Badge>}
                  </button>
                </li>
              );
            })}
          </ul>
        </CardBody>
      </Card>

      <Card>
        <CardHead title="Subscription" subtitle="Commercial state — separate from what the app allows" />
        <CardBody>
          {detail.subscription ? (
            <>
              <KV k="Status">
                <Badge tone={detail.subscription.status === 'active' ? 'good'
                  : detail.subscription.status === 'trial' ? 'brand' : 'warning'}>
                  {detail.subscription.status}
                </Badge>
              </KV>
              <KV k="Started">{dateShort(detail.subscription.startedAt)}</KV>
              <KV k="Renews">
                {detail.subscription.renewsAt ? dateShort(detail.subscription.renewsAt) : <span className="t-faint">Not set</span>}
              </KV>

              <div className="u-row u-gap-2 u-wrap u-mt-5">
                {(['trial', 'active', 'suspended', 'cancelled'] as SubscriptionStatus[]).map((s) => (
                  <Button key={s} size="sm"
                    variant={detail.subscription!.status === s ? 'primary' : 'secondary'}
                    onClick={() => setStatus(s)}>
                    {s}
                  </Button>
                ))}
              </div>

              <hr className="divider u-mt-5 u-mb-4" />

              <div className="u-col u-gap-3">
                <TextField label="Renewal date" type="date" value={renewal}
                  onChange={(e) => setRenewal(e.target.value)} />
                <TextareaField label="Notes" value={notes} rows={3}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Anything worth remembering about this account" />
                <Button onClick={async () => {
                  await api.platform.subscriptions.setRenewal(session, detail.gym.id, renewal || null, notes);
                  toast('success', 'Subscription updated');
                }}>
                  Save
                </Button>
              </div>
            </>
          ) : (
            <EmptyState icon="card" title="No subscription"
              message="Pick a package on the left. Until then this customer has no features at all." />
          )}
        </CardBody>
      </Card>
    </div>
  );
}

/* ============================================================
   Usage
   ============================================================ */
function UsageTab({ detail }: { detail: Detail }) {
  const u = detail.usage;
  const rows: Array<[string, string]> = [
    ['Membership plans', count(u.plans)],
    ['Memberships sold', count(u.memberships)],
    ['Payments recorded', count(u.payments)],
    ['Revenue, all time', money(u.revenueAllTime)],
    ['Attendance events', count(u.attendanceEvents)],
    ['Training sessions', count(u.sessions)],
    ['Programs', count(u.programs)],
    ['Custom exercises', count(u.customExercises)],
    ['Member-built workouts', count(u.memberWorkouts)],
    ['Diet plans', count(u.dietPlans)],
    ['Expenses', count(u.expenses)],
    ['Messages logged', count(u.messages)],
  ];
  return (
    <Card>
      <CardHead title="Usage" subtitle="Row counts for this tenant — what they have actually put in." />
      <CardBody>
        <div className="kvgrid">
          {rows.map(([label, value]) => (
            <div key={label}>
              <div className="kvgrid__value u-num">{value}</div>
              <div className="kvgrid__label">{label}</div>
            </div>
          ))}
        </div>
        <p className="quiet-note u-mt-5">
          Approximately {count(u.storageEstimateKb)} KB of stored data. In this prototype every
          tenant shares one browser store, which is why the seeded demo is sized to fit.
        </p>
      </CardBody>
    </Card>
  );
}

/* ============================================================
   Activity
   ============================================================ */
function ActivityTab({ detail }: { detail: Detail }) {
  if (!detail.activity.length) {
    return (
      <Card>
        <EmptyState icon="note" title="No platform changes yet"
          message="Feature and package changes for this customer will be listed here." />
      </Card>
    );
  }
  return (
    <Card>
      <CardHead title="Change history" subtitle="Platform configuration for this customer" />
      <CardBody flush>
        <ul className="cardlist">
          {detail.activity.map((a) => (
            <li key={a.id} className="cardlist__item" style={{ cursor: 'default', alignItems: 'flex-start' }}>
              <span style={{
                width: 30, height: 30, flex: 'none', display: 'grid', placeItems: 'center',
                borderRadius: 'var(--r-md)', background: 'var(--surface-3)', color: 'var(--text-2)',
              }}>
                <Icon name={a.action.startsWith('feature') ? 'layers'
                  : a.action.startsWith('subscription') ? 'card' : 'building'} size={14} />
              </span>
              <span className="u-grow" style={{ minWidth: 0 }}>
                <span className="t-sm" style={{ fontWeight: 540 }}>{a.summary}</span>
                <span className="t-xs t-faint" style={{ display: 'block', marginTop: 2 }}>
                  {new Date(a.at).toLocaleString('en-IN', {
                    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
                  })} · {a.actorName}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}

/* ============================================================
   Settings
   ============================================================ */
function SettingsTab({ detail }: { detail: Detail }) {
  const { session, toast, confirm } = useApp();
  const nav = useNavigate();
  const [name, setName] = useState(detail.gym.name);
  const [phone, setPhone] = useState(detail.gym.phone);
  const [email, setEmail] = useState(detail.gym.email);
  const [address, setAddress] = useState(detail.gym.address);
  const [busy, setBusy] = useState(false);

  if (!session) return null;

  const save = async () => {
    setBusy(true);
    try {
      await api.platform.gyms.update(session, detail.gym.id, { name, phone, email, address });
      toast('success', 'Customer updated');
    } finally { setBusy(false); }
  };

  const remove = async () => {
    const ok = await confirm({
      title: `Delete ${detail.gym.name}?`,
      tone: 'danger',
      confirmLabel: 'Delete permanently',
      message: `Every member, payment, session and record in this workspace is removed. ${count(detail.memberCount)} members and ${count(detail.usage.payments)} payments will be lost. This cannot be undone.`,
    });
    if (!ok) return;
    await api.platform.gyms.remove(session, detail.gym.id);
    toast('success', 'Customer deleted');
    nav('/platform/gyms', { replace: true });
  };

  return (
    <div className="grid-2">
      <Card>
        <CardHead title="Customer details" subtitle="Edited here or by the owner in their own settings" />
        <CardBody>
          <div className="u-col u-gap-4">
            <TextField label="Gym name" value={name} onChange={(e) => setName(e.target.value)} />
            <TextField label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <TextField label="Address" value={address} onChange={(e) => setAddress(e.target.value)} />
            <Button variant="primary" loading={busy} onClick={save}>Save changes</Button>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHead title="Danger zone" />
        <CardBody>
          <div className="u-col u-gap-4">
            <div>
              <div className="t-sm" style={{ fontWeight: 560 }}>
                {detail.gym.status === 'active' ? 'Suspend access' : 'Reactivate access'}
              </div>
              <p className="t-xs t-muted u-mt-2">
                Suspension blocks sign-in for everyone at this gym. Nothing is deleted and it is
                instantly reversible.
              </p>
              <Button className="u-mt-3" icon={detail.gym.status === 'active' ? 'ban' : 'checkCircle'}
                onClick={async () => {
                  await api.platform.gyms.update(session, detail.gym.id, {
                    status: detail.gym.status === 'active' ? 'suspended' : 'active',
                  });
                  toast('success', 'Status changed');
                }}>
                {detail.gym.status === 'active' ? 'Suspend customer' : 'Reactivate customer'}
              </Button>
            </div>

            <hr className="divider" />

            <div>
              <div className="t-sm" style={{ fontWeight: 560, color: 'var(--critical)' }}>Delete customer</div>
              <p className="t-xs t-muted u-mt-2">
                Removes the workspace and every row inside it. There is no recovery.
              </p>
              <Button className="u-mt-3" variant="danger" icon="trash" onClick={remove}>
                Delete permanently
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
