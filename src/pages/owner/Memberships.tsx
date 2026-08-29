import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Avatar, Badge, Button, Card, CardBody, EmptyState, PageHead, Segmented, StatTile, StatusBadge,
} from '../../components/ui/primitives';
import { DataTable, type Column } from '../../components/data/DataTable';
import { RenewMembershipDialog } from '../../components/dialogs';
import { useApp, useData } from '../../state/app';
import * as api from '../../lib/api';
import type { MemberSummary } from '../../lib/api';
import { count, dateShort, money, relativeDay } from '../../lib/format';
import { monthKey, todayISO } from '../../lib/date';

type View = 'active' | 'expiring7' | 'expiring30' | 'expired' | 'recent';

export default function Memberships() {
  const { session } = useApp();
  const nav = useNavigate();
  const [view, setView] = useState<View>('expiring7');
  const [renewId, setRenewId] = useState<string | null>(null);

  const all = useData(() => (session ? api.memberships.list(session, { status: 'all' }) : []), [session?.gymId]);
  const kpis = useData(() => (session ? api.dashboard.get(session) : null), [session?.gymId]);
  const thisMonth = monthKey(todayISO());

  if (!session || !kpis) return null;

  const buckets: Record<View, MemberSummary[]> = {
    active: all.filter((r) => r.status === 'active'),
    expiring7: all.filter((r) => r.daysLeft >= 0 && r.daysLeft <= 7).sort((a, b) => a.daysLeft - b.daysLeft),
    expiring30: all.filter((r) => r.daysLeft >= 0 && r.daysLeft <= 30).sort((a, b) => a.daysLeft - b.daysLeft),
    expired: all.filter((r) => r.status === 'expired'),
    recent: all
      .filter((r) => r.membership && r.membership.createdAt.slice(0, 7) === thisMonth)
      .sort((a, b) => (b.membership!.createdAt).localeCompare(a.membership!.createdAt)),
  };

  const rows = buckets[view];
  const monthSold = buckets.recent;
  const monthRevenue = monthSold.reduce((s, r) => s + Math.max(0, r.membership!.priceSnapshot - r.membership!.discount), 0);

  const columns: Array<Column<MemberSummary>> = [
    {
      key: 'member', header: 'Member', width: '28%',
      render: (r) => (
        <span className="u-row u-gap-3">
          <Avatar name={r.member.name} size="sm" />
          <span style={{ minWidth: 0 }}>
            <span className="t-sm u-truncate" style={{ fontWeight: 560, display: 'block' }}>{r.member.name}</span>
            <span className="t-xs t-faint">{r.member.memberCode}</span>
          </span>
        </span>
      ),
    },
    { key: 'plan', header: 'Plan', render: (r) => <span className="t-sm">{r.membership?.planNameSnapshot}</span> },
    {
      key: 'kind', header: 'Type',
      render: (r) => <Badge tone={r.membership?.kind === 'new' ? 'brand' : 'neutral'}>
        {r.membership?.kind === 'new' ? 'New' : 'Renewal'}
      </Badge>,
    },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} daysLeft={r.daysLeft} /> },
    {
      key: 'period', header: 'Period', hideBelow: 1280,
      render: (r) => (
        <span className="t-xs t-muted u-num">
          {dateShort(r.membership!.startDate)} → {dateShort(r.membership!.endDate)}
        </span>
      ),
    },
    {
      key: 'expiry', header: 'Expires', align: 'right',
      render: (r) => (
        <span>
          <span className="t-sm u-num" style={{ display: 'block' }}>{dateShort(r.membership!.endDate)}</span>
          <span className="t-xs t-faint">{relativeDay(r.membership!.endDate)}</span>
        </span>
      ),
    },
    {
      key: 'action', header: '', align: 'right',
      render: (r) => (
        <Button size="sm" variant={r.daysLeft <= 7 ? 'primary' : 'secondary'}
          onClick={(e) => { e.stopPropagation(); setRenewId(r.member.id); }}>
          Renew
        </Button>
      ),
    },
  ];

  return (
    <div className="anim-page">
      <PageHead
        title="Memberships"
        subtitle="Status is derived from the expiry date — it is never typed in by hand."
        actions={<Button icon="layers" onClick={() => nav('/owner/plans')}>Manage plans</Button>}
      />

      <div className="grid-stats u-mb-5">
        <StatTile label="Active memberships" icon="checkCircle" value={count(buckets.active.length)}
          accent="var(--good)" hint="more than 7 days left" />
        <StatTile label="Expiring in 7 days" icon="clock" value={count(buckets.expiring7.length)}
          accent="var(--warning-mark)" hint="call these members" />
        <StatTile label="Expired" icon="alert" value={count(buckets.expired.length)}
          accent="var(--critical)" hint="win-back list" />
        <StatTile label="Sold this month" icon="trendingUp" value={money(monthRevenue)}
          hint={`${monthSold.length} memberships`} />
      </div>

      <Card>
        <div className="card__body" style={{ paddingBottom: 'var(--s-4)' }}>
          <Segmented
            ariaLabel="Membership view"
            value={view} onChange={setView}
            options={[
              { value: 'expiring7', label: 'Expiring · 7d', count: buckets.expiring7.length },
              { value: 'expiring30', label: 'Expiring · 30d', count: buckets.expiring30.length },
              { value: 'active', label: 'Active', count: buckets.active.length },
              { value: 'expired', label: 'Expired', count: buckets.expired.length },
              { value: 'recent', label: 'Sold this month', count: buckets.recent.length },
            ]}
          />
        </div>
        <CardBody flush>
          <DataTable
            rows={rows}
            columns={columns}
            keyOf={(r) => r.member.id}
            onRowClick={(r) => nav(`/owner/members/${r.member.id}`)}
            caption="Memberships"
            mobile={(r) => (
              <>
                <Avatar name={r.member.name} />
                <span className="u-grow" style={{ minWidth: 0 }}>
                  <span className="u-between u-gap-2">
                    <span className="t-sm u-truncate" style={{ fontWeight: 580 }}>{r.member.name}</span>
                    <StatusBadge status={r.status} daysLeft={r.daysLeft} />
                  </span>
                  <span className="t-xs t-faint u-truncate" style={{ display: 'block', marginTop: 2 }}>
                    {r.membership?.planNameSnapshot} · ends {dateShort(r.membership!.endDate)}
                  </span>
                </span>
              </>
            )}
            empty={
              <EmptyState
                icon={view === 'expired' ? 'checkCircle' : 'inbox'}
                title={
                  view === 'expiring7' ? 'Nothing expiring this week'
                    : view === 'expiring30' ? 'Nothing expiring this month'
                    : view === 'expired' ? 'No expired memberships'
                    : view === 'recent' ? 'Nothing sold yet this month'
                    : 'No active memberships'
                }
                message={
                  view === 'recent'
                    ? 'New memberships and renewals recorded this month will appear here.'
                    : 'Nothing needs attention in this bucket right now.'
                }
              />
            }
          />
        </CardBody>
      </Card>

      {renewId && <RenewMembershipDialog memberId={renewId} onClose={() => setRenewId(null)} />}
    </div>
  );
}
