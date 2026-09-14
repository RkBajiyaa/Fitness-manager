import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Badge, Button, Card, CardBody, EmptyState, Modal, PageHead, Segmented,
} from '../../components/ui/primitives';
import { SearchInput, SelectField, TextField, fieldErrors, errorMessage } from '../../components/ui/forms';
import { DataTable, type Column } from '../../components/data/DataTable';
import { Icon } from '../../components/ui/Icon';
import { useApp, useData } from '../../state/app';
import * as api from '../../lib/api';
import type { GymRow } from '../../lib/platform/api';
import { count, relativeDay } from '../../lib/format';
import { dayOf } from '../../lib/date';

type StatusFilter = 'all' | 'active' | 'suspended';

export default function PlatformGyms() {
  const { session, toast } = useApp();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [mode, setMode] = useState<'all' | 'live' | 'demo'>('all');
  const [sortKey, setSortKey] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const creating = params.get('new') === '1';
  const closeCreate = () => { params.delete('new'); setParams(params, { replace: true }); };

  const rows = useData(
    () => (session ? api.platform.gyms.list(session, { q, status, dataMode: mode }) : []),
    [session?.userId, q, status, mode],
  );
  const total = useData(() => (session ? api.platform.gyms.list(session).length : 0), [session?.userId]);

  if (!session) return null;

  const SORTERS: Record<string, (r: GymRow) => string | number> = {
    name: (r) => r.gym.name.toLowerCase(),
    members: (r) => r.memberCount,
    package: (r) => r.pkg?.name ?? '',
    status: (r) => r.gym.status,
    activity: (r) => r.lastActivityAt ?? '',
  };
  const pick = SORTERS[sortKey] ?? SORTERS.name;
  const sorted = rows.slice().sort((a, b) => {
    const av = pick(a); const bv = pick(b);
    const cmp = typeof av === 'number' && typeof bv === 'number'
      ? av - bv
      : String(av).localeCompare(String(bv));
    return sortOrder === 'asc' ? cmp : -cmp;
  });

  const columns: Column<GymRow>[] = [
    {
      key: 'name', header: 'Customer', sortable: true,
      render: (r) => (
        <span className="u-row u-gap-3">
          <span style={{
            width: 32, height: 32, flex: 'none', display: 'grid', placeItems: 'center',
            borderRadius: 'var(--r-md)', background: 'var(--surface-3)', color: 'var(--text-2)',
          }}>
            <Icon name="building" size={15} />
          </span>
          <span style={{ minWidth: 0 }}>
            <span className="u-row u-gap-2">
              <span className="t-sm u-truncate" style={{ fontWeight: 570 }}>{r.gym.name}</span>
              {r.gym.dataMode === 'demo' && <span className="tag">Demo</span>}
              {r.gym.kind === 'personal' && <span className="tag tag--quiet">Personal</span>}
            </span>
            <span className="t-xs t-faint u-truncate" style={{ display: 'block' }}>
              {r.gym.email || 'No email'}
            </span>
          </span>
        </span>
      ),
    },
    {
      key: 'owner', header: 'Owner',
      render: (r) => (r.owner
        ? <span className="t-sm">{r.owner.name}</span>
        : <span className="t-sm t-faint">None</span>),
    },
    {
      key: 'members', header: 'Members', align: 'right', sortable: true,
      render: (r) => <span className="u-num">{count(r.memberCount)}</span>,
    },
    {
      key: 'package', header: 'Package', sortable: true,
      render: (r) => (r.pkg
        ? (
          <span className="u-col" style={{ gap: 2 }}>
            <span className="t-sm">{r.pkg.name}</span>
            <span className="t-xs t-faint">
              {r.featureCount} features
              {r.overrideCount > 0 && ` · ${r.overrideCount} override${r.overrideCount === 1 ? '' : 's'}`}
            </span>
          </span>
        )
        : <Badge tone="warning">No package</Badge>),
    },
    {
      key: 'status', header: 'Status', sortable: true,
      render: (r) => (
        <Badge tone={r.gym.status === 'active' ? 'good' : 'warning'} dot>
          {r.gym.status === 'active' ? 'Active' : 'Suspended'}
        </Badge>
      ),
    },
    {
      key: 'activity', header: 'Last activity', sortable: true, hideBelow: 1280,
      render: (r) => (r.lastActivityAt
        ? <span className="t-sm t-muted">{relativeDay(dayOf(r.lastActivityAt))}</span>
        : <span className="t-sm t-faint">None</span>),
    },
  ];

  return (
    <div className="anim-page">
      <PageHead
        title="Customers"
        subtitle={total === 0 ? 'No gyms on the platform yet.' : `${total} gym${total === 1 ? '' : 's'} on the platform.`}
        actions={(
          <Button variant="primary" icon="plus"
            onClick={() => { params.set('new', '1'); setParams(params, { replace: true }); }}>
            Add customer
          </Button>
        )}
      />

      {total > 0 && (
        <Card className="u-mb-4">
          <CardBody>
            <div className="filterbar">
              <SearchInput value={q} onChange={setQ} placeholder="Search by gym, owner or email" />
              <Segmented
                ariaLabel="Status" value={status} onChange={setStatus}
                options={[
                  { value: 'all', label: 'All' },
                  { value: 'active', label: 'Active' },
                  { value: 'suspended', label: 'Suspended' },
                ]}
              />
              <Segmented
                ariaLabel="Data mode" value={mode} onChange={setMode}
                options={[
                  { value: 'all', label: 'Any data' },
                  { value: 'live', label: 'Live' },
                  { value: 'demo', label: 'Demo' },
                ]}
              />
            </div>
          </CardBody>
        </Card>
      )}

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={total === 0 ? 'building' : 'search'}
            title={total === 0 ? 'No customers yet' : 'Nothing matches those filters'}
            message={total === 0
              ? 'Add your first gym. It starts completely empty — the owner fills it in through setup.'
              : 'Try a different search, status or data mode.'}
            action={total === 0
              ? (
                <Button variant="primary" icon="plus"
                  onClick={() => { params.set('new', '1'); setParams(params, { replace: true }); }}>
                  Add a customer
                </Button>
              )
              : <Button onClick={() => { setQ(''); setStatus('all'); setMode('all'); }}>Clear filters</Button>}
          />
        </Card>
      ) : (
        <DataTable
          rows={sorted}
          columns={columns}
          keyOf={(r) => r.gym.id}
          caption="Customers on the platform"
          sortKey={sortKey}
          sortOrder={sortOrder}
          onSort={(key) => {
            if (key === sortKey) setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
            else { setSortKey(key); setSortOrder('asc'); }
          }}
          onRowClick={(r) => nav(`/platform/gyms/${r.gym.id}`)}
          empty={null}
          mobile={(r) => (
            <span className="u-grow" style={{ minWidth: 0 }}>
              <span className="u-row u-gap-2">
                <span className="t-sm u-truncate" style={{ fontWeight: 570 }}>{r.gym.name}</span>
                {r.gym.dataMode === 'demo' && <span className="tag">Demo</span>}
              </span>
              <span className="t-xs t-faint" style={{ display: 'block', marginTop: 2 }}>
                {r.owner?.name ?? 'No owner'} · {count(r.memberCount)} members
              </span>
              <span className="u-row u-gap-2 u-mt-2">
                <Badge tone={r.gym.status === 'active' ? 'good' : 'warning'}>
                  {r.gym.status === 'active' ? 'Active' : 'Suspended'}
                </Badge>
                <span className="t-xs t-faint">{r.pkg?.name ?? 'No package'}</span>
              </span>
            </span>
          )}
        />
      )}

      {creating && (
        <CreateGymDialog
          onClose={closeCreate}
          onCreated={(id, name) => {
            closeCreate();
            toast('success', 'Customer added', `${name} starts with no data at all.`);
            nav(`/platform/gyms/${id}`);
          }}
        />
      )}
    </div>
  );
}

function CreateGymDialog({ onClose, onCreated }: {
  onClose: () => void;
  onCreated: (gymId: string, name: string) => void;
}) {
  const { session, toast } = useApp();
  const packages = useData(() => (session ? api.platform.packages.list(session) : []), [session?.userId]);
  const [name, setName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [packageId, setPackageId] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const visible = packages.filter((p) => !p.isSystem);
  const chosen = packageId || visible.find((p) => p.isDefault)?.id || visible[0]?.id || '';

  const submit = async () => {
    if (!session) return;
    setBusy(true); setErrors({});
    try {
      const res = await api.platform.gyms.create(session, {
        name, ownerName, ownerEmail, phone, packageId: chosen, status: 'trial',
      });
      onCreated(res.gym.id, res.gym.name);
    } catch (e) {
      setErrors(fieldErrors(e));
      if (!Object.keys(fieldErrors(e)).length) toast('error', 'Could not add customer', errorMessage(e));
    } finally { setBusy(false); }
  };

  return (
    <Modal
      title="Add a customer"
      subtitle="A new gym starts empty — no members, no payments, no demo data."
      onClose={onClose}
      footer={(
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={busy} onClick={submit}>Create customer</Button>
        </>
      )}
    >
      <div className="u-col u-gap-4">
        <TextField label="Gym name" required autoFocus value={name} error={errors.name}
          onChange={(e) => setName(e.target.value)} placeholder="e.g. Iron Yard Strength" />
        <TextField label="Owner name" required value={ownerName} error={errors.ownerName}
          onChange={(e) => setOwnerName(e.target.value)} placeholder="Who runs it" />
        <TextField label="Owner email" type="email" required value={ownerEmail} error={errors.ownerEmail}
          onChange={(e) => setOwnerEmail(e.target.value)} placeholder="owner@example.com"
          hint="This is the address they will sign in with." />
        <TextField label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)}
          placeholder="Optional" />
        <SelectField
          label="Package" value={chosen} onChange={(e) => setPackageId(e.target.value)}
          hint="You can override individual features afterwards."
          options={visible.map((p) => ({
            value: p.id,
            label: `${p.name} — ${p.features.length} features${p.isDefault ? ' (default)' : ''}`,
          }))}
        />
      </div>
    </Modal>
  );
}
