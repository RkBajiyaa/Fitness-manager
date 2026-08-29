import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Avatar, Badge, Button, Card, CardBody, EmptyState, PageHead, Pagination, StatusBadge,
} from '../../components/ui/primitives';
import { SearchInput, SelectField } from '../../components/ui/forms';
import { DataTable, type Column } from '../../components/data/DataTable';
import { LevelChip } from '../../components/owner/AttentionQueue';
import { useApp, useData } from '../../state/app';
import * as api from '../../lib/api';
import type { MemberRow, MemberSort } from '../../lib/api';
import type { MembershipStatus } from '../../lib/types';
import { dateShort, money, phoneMask, relativeDay } from '../../lib/format';

const LIMIT = 20;

type StatusFilter = MembershipStatus | 'all';

export default function Members() {
  const { session } = useApp();
  const nav = useNavigate();

  const [q, setQ] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [planId, setPlanId] = useState('');
  const [hasDue, setHasDue] = useState(false);
  const [attention, setAttention] = useState(false);
  const [sort, setSort] = useState<MemberSort>('name');
  const [order, setOrder] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);

  const plans = useData(() => (session ? api.plans.list(session) : []), [session?.gymId]);
  const counts = useData(() => (session ? api.members.counts(session) : null), [session?.gymId]);
  const result = useData(
    () => (session
      ? api.members.list(session, {
        q, status, planId: planId || undefined, hasDue, attention,
        sort, order, page, limit: LIMIT,
      })
      : null),
    [session?.gymId, q, status, planId, hasDue, attention, sort, order, page],
  );

  if (!session || !result || !counts) return null;

  const onSort = (key: string) => {
    const k = key as MemberSort;
    if (k === sort) setOrder(order === 'asc' ? 'desc' : 'asc');
    else { setSort(k); setOrder(k === 'due' ? 'desc' : 'asc'); }
    setPage(1);
  };

  const reset = () => {
    setQ(''); setStatus('all'); setPlanId(''); setHasDue(false); setAttention(false); setPage(1);
  };
  const filtered = Boolean(q || status !== 'all' || planId || hasDue || attention);

  const columns: Array<Column<MemberRow>> = [
    {
      key: 'name', header: 'Member', sortable: true, width: '30%',
      render: (r) => (
        <span className="u-row u-gap-3">
          <Avatar name={r.member.name} size="sm" />
          <span style={{ minWidth: 0 }}>
            <span className="t-sm u-truncate" style={{ fontWeight: 560, display: 'block' }}>{r.member.name}</span>
            <span className="t-xs t-faint">{r.member.memberCode} · {phoneMask(r.member.phone)}</span>
          </span>
        </span>
      ),
    },
    {
      key: 'plan', header: 'Plan',
      render: (r) => r.membership
        ? <span className="t-sm">{r.membership.planNameSnapshot}</span>
        : <span className="t-sm t-faint">—</span>,
    },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} daysLeft={r.daysLeft} /> },
    {
      key: 'engagement', header: 'Engagement', sortable: true,
      render: (r) => (
        <span>
          <LevelChip level={r.engagement.level} />
          <span className="t-xs t-faint" style={{ display: 'block', marginTop: 3 }}>
            {r.engagement.recentPerWeek.toFixed(1)}/wk
            {r.engagement.daysSinceVisit != null && r.engagement.daysSinceVisit > 2
              ? ` · ${r.engagement.daysSinceVisit}d ago`
              : ''}
          </span>
        </span>
      ),
    },
    {
      key: 'expiry', header: 'Expires', sortable: true,
      render: (r) => r.membership
        ? (
          <span>
            <span className="t-sm u-num" style={{ display: 'block' }}>{dateShort(r.membership.endDate)}</span>
            <span className="t-xs t-faint">{relativeDay(r.membership.endDate)}</span>
          </span>
        )
        : <span className="t-sm t-faint">—</span>,
    },
    {
      key: 'due', header: 'Balance', sortable: true, align: 'right',
      render: (r) => r.dues.due > 0
        ? <span className="t-sm u-num" style={{ color: 'var(--critical)', fontWeight: 600 }}>{money(r.dues.due)}</span>
        : <span className="t-sm t-faint">Paid</span>,
    },
    {
      key: 'joinedAt', header: 'Joined', sortable: true, align: 'right', hideBelow: 1280,
      render: (r) => <span className="t-sm u-num t-muted">{dateShort(r.member.joinedAt)}</span>,
    },
  ];

  return (
    <div className="anim-page">
      <PageHead
        title="Members"
        subtitle={`${counts.all} members · ${counts.active} active · ${counts.attention} need attention · ${counts.withDues} with a balance`}
        actions={<Button variant="primary" icon="userPlus" onClick={() => nav('/owner/members/new')}>Add member</Button>}
      />

      <Card>
        <div className="card__body" style={{ paddingBottom: 'var(--s-4)' }}>
          <div className="toolbar">
            <div className="toolbar__search">
              <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }}
                placeholder="Search by name, phone, email or member ID" />
            </div>

            <div className="u-row u-gap-2 u-wrap">
              {([
                ['all', 'All', counts.all],
                ['active', 'Active', counts.active],
                ['expiring', 'Expiring', counts.expiring],
                ['expired', 'Expired', counts.expired],
              ] as Array<[StatusFilter, string, number]>).map(([v, label, n]) => (
                <button
                  key={v} className="chip" aria-pressed={status === v}
                  onClick={() => { setStatus(v); setPage(1); }}
                >
                  {label}<span className="u-num t-faint">{n}</span>
                </button>
              ))}
              <button className="chip" aria-pressed={hasDue} onClick={() => { setHasDue(!hasDue); setPage(1); }}>
                Has balance<span className="u-num t-faint">{counts.withDues}</span>
              </button>
              <button className="chip" aria-pressed={attention}
                onClick={() => { setAttention(!attention); setPage(1); }}>
                Needs attention<span className="u-num t-faint">{counts.attention}</span>
              </button>
            </div>

            <SelectField
              aria-label="Filter by plan"
              value={planId}
              onChange={(e) => { setPlanId(e.target.value); setPage(1); }}
              options={[{ value: '', label: 'All plans' }, ...plans.map((p) => ({ value: p.id, label: p.name }))]}
              className="hide-mobile"
            />

            {filtered && (
              <Button size="sm" variant="ghost" icon="x" onClick={reset}>Clear</Button>
            )}
          </div>
        </div>

        <CardBody flush>
          <DataTable
            rows={result.data}
            columns={columns}
            keyOf={(r) => r.member.id}
            onRowClick={(r) => nav(`/owner/members/${r.member.id}`)}
            sortKey={sort}
            sortOrder={order}
            onSort={onSort}
            caption="Gym members"
            mobile={(r) => (
              <>
                <Avatar name={r.member.name} />
                <span className="u-grow" style={{ minWidth: 0 }}>
                  <span className="u-between u-gap-2">
                    <span className="t-sm u-truncate" style={{ fontWeight: 580 }}>{r.member.name}</span>
                    <StatusBadge status={r.status} daysLeft={r.daysLeft} />
                  </span>
                  <span className="t-xs t-faint u-truncate" style={{ display: 'block', marginTop: 2 }}>
                    {r.member.memberCode} · {r.membership?.planNameSnapshot ?? 'No plan'}
                    {r.membership && ` · ends ${dateShort(r.membership.endDate)}`}
                  </span>
                  <span className="u-row u-gap-2 u-wrap" style={{ marginTop: 6 }}>
                    {r.engagement.level !== 'healthy' && <LevelChip level={r.engagement.level} />}
                    {r.dues.due > 0 && <Badge tone="critical" icon="alert">{money(r.dues.due)} due</Badge>}
                  </span>
                </span>
              </>
            )}
            empty={
              filtered ? (
                <EmptyState
                  icon="search" title="No members match those filters"
                  message="Try a different search term, or clear the filters to see the whole roster."
                  action={<Button icon="x" onClick={reset}>Clear filters</Button>}
                />
              ) : (
                <EmptyState
                  icon="users" title="No members yet"
                  message="Add your first member to start tracking memberships, payments and attendance."
                  action={<Button variant="primary" icon="userPlus" onClick={() => nav('/owner/members/new')}>Add member</Button>}
                />
              )
            }
          />
          <Pagination
            page={result.meta.page} totalPages={result.meta.totalPages}
            total={result.meta.total} limit={result.meta.limit}
            onPage={setPage} unit="members"
          />
        </CardBody>
      </Card>
    </div>
  );
}
