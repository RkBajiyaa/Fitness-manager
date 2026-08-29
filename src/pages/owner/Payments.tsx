import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Avatar, Badge, Button, Card, CardBody, EmptyState, Meter, PageHead, Pagination,
  Segmented, StatTile,
} from '../../components/ui/primitives';
import { DateField, SearchInput, SelectField } from '../../components/ui/forms';
import { Icon } from '../../components/ui/Icon';
import { DataTable, type Column } from '../../components/data/DataTable';
import { RecordPaymentDialog } from '../../components/dialogs';
import { useApp, useData } from '../../state/app';
import * as api from '../../lib/api';
import type { MemberSummary } from '../../lib/api';
import type { Payment, PaymentMethod, RevenueSource } from '../../lib/types';
import { count, dateShort, money, time, titleCase } from '../../lib/format';
import { addDays, startOfMonth, todayISO } from '../../lib/date';

type View = 'all' | 'today' | 'outstanding';
const LIMIT = 20;

export default function Payments() {
  const { session } = useApp();
  const nav = useNavigate();
  const today = todayISO();

  const [view, setView] = useState<View>('all');
  const [q, setQ] = useState('');
  const [from, setFrom] = useState(addDays(today, -30));
  const [to, setTo] = useState(today);
  const [method, setMethod] = useState<PaymentMethod | 'all'>('all');
  const [source, setSource] = useState<RevenueSource | 'all'>('all');
  const [page, setPage] = useState(1);
  const [payFor, setPayFor] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const k = useData(() => (session ? api.dashboard.get(session) : null), [session?.gymId]);
  const outstanding = useData(() => (session ? api.payments.outstanding(session) : []), [session?.gymId]);
  const result = useData(
    () => (session
      ? api.payments.list(session, {
        q,
        from: view === 'today' ? today : from,
        to: view === 'today' ? today : to,
        method, source, page, limit: LIMIT,
      })
      : null),
    [session?.gymId, q, from, to, method, source, page, view],
  );

  if (!session || !k || !result) return null;

  const monthRevenue = k.revenueMonth;
  const collected = result.data.reduce((s, p) => s + p.amount, 0);

  const columns: Array<Column<Payment & { memberName: string }>> = [
    {
      key: 'member', header: 'Member', width: '26%',
      render: (p) => (
        <span className="u-row u-gap-3">
          <Avatar name={p.memberName} size="sm" />
          <span className="t-sm u-truncate">{p.memberName}</span>
        </span>
      ),
    },
    { key: 'amount', header: 'Amount', align: 'right',
      render: (p) => <span className="t-sm u-num" style={{ fontWeight: 600 }}>{money(p.amount)}</span> },
    { key: 'source', header: 'For', render: (p) => <Badge>{titleCase(p.source)}</Badge> },
    { key: 'method', header: 'Method', render: (p) => <span className="t-sm t-muted">{titleCase(p.method)}</span> },
    { key: 'receipt', header: 'Receipt', hideBelow: 1280,
      render: (p) => <span className="t-xs t-faint u-num">{p.receiptNo}</span> },
    {
      key: 'paidAt', header: 'Received', align: 'right',
      render: (p) => (
        <span>
          <span className="t-sm u-num" style={{ display: 'block' }}>{dateShort(p.paidAt)}</span>
          <span className="t-xs t-faint">{time(p.paidAt)}</span>
        </span>
      ),
    },
  ];

  const outstandingColumns: Array<Column<MemberSummary & { overdueDays: number }>> = [
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
    { key: 'plan', header: 'Plan', render: (r) => <span className="t-sm">{r.membership?.planNameSnapshot ?? '—'}</span> },
    { key: 'billed', header: 'Billed', align: 'right', render: (r) => <span className="t-sm u-num">{money(r.dues.billed)}</span> },
    { key: 'paid', header: 'Paid', align: 'right', render: (r) => <span className="t-sm u-num t-muted">{money(r.dues.paid)}</span> },
    {
      key: 'due', header: 'Balance', align: 'right',
      render: (r) => <span className="t-sm u-num" style={{ color: 'var(--critical)', fontWeight: 620 }}>{money(r.dues.due)}</span>,
    },
    {
      key: 'progress', header: 'Collected', hideBelow: 1280,
      render: (r) => (
        <span style={{ display: 'block', minWidth: 90 }}>
          <Meter value={r.dues.paid} max={r.dues.billed} tone="warning"
            label={`${Math.round((r.dues.paid / Math.max(1, r.dues.billed)) * 100)}% collected`} />
        </span>
      ),
    },
    {
      key: 'action', header: '', align: 'right',
      render: (r) => (
        <Button size="sm" variant="primary" onClick={(e) => { e.stopPropagation(); setPayFor(r.member.id); }}>
          Collect
        </Button>
      ),
    },
  ];

  return (
    <div className="anim-page">
      <PageHead
        title="Payments"
        subtitle="Every rupee in, and every rupee still owed."
        actions={<Button variant="primary" icon="wallet" onClick={() => setOpen(true)}>Record payment</Button>}
      />

      <div className="grid-stats u-mb-5">
        <StatTile label="Received today" icon="wallet" value={money(k.revenueToday)} accent="var(--series-1)" />
        <StatTile label="This month" icon="trendingUp" value={money(monthRevenue)}
          hint={`since ${dateShort(startOfMonth(today))}`} />
        <StatTile label="Outstanding" icon="alert" value={money(k.pendingTotal)}
          hint={`${k.pendingCount} members`} accent="var(--critical)"
          onClick={() => setView('outstanding')} />
        <StatTile label="Payments in range" icon="receipt" value={count(result.meta.total)}
          hint={money(collected) + ' on this page'} />
      </div>

      <Card>
        <div className="card__body" style={{ paddingBottom: 'var(--s-4)' }}>
          <div className="u-col u-gap-4">
            <Segmented
              ariaLabel="Payments view" value={view}
              onChange={(v) => { setView(v); setPage(1); }}
              options={[
                { value: 'all', label: 'All payments' },
                { value: 'today', label: 'Today' },
                { value: 'outstanding', label: 'Outstanding', count: outstanding.length },
              ]}
            />

            {view !== 'outstanding' && (
              <div className="toolbar">
                <div className="toolbar__search">
                  <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }}
                    placeholder="Search member or receipt number" />
                </div>
                {view === 'all' && (
                  <>
                    <DateField aria-label="From date" value={from} max={to}
                      onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
                    <DateField aria-label="To date" value={to} min={from} max={today}
                      onChange={(e) => { setTo(e.target.value); setPage(1); }} />
                  </>
                )}
                <SelectField aria-label="Method" value={method}
                  onChange={(e) => { setMethod(e.target.value as PaymentMethod | 'all'); setPage(1); }}
                  options={[
                    { value: 'all', label: 'All methods' }, { value: 'upi', label: 'UPI' },
                    { value: 'cash', label: 'Cash' }, { value: 'card', label: 'Card' },
                    { value: 'bank_transfer', label: 'Bank transfer' },
                  ]} />
                <SelectField aria-label="Source" value={source}
                  onChange={(e) => { setSource(e.target.value as RevenueSource | 'all'); setPage(1); }}
                  options={[
                    { value: 'all', label: 'All sources' },
                    { value: 'membership', label: 'New memberships' },
                    { value: 'renewal', label: 'Renewals' },
                    { value: 'personal_training', label: 'Personal training' },
                    { value: 'other', label: 'Other' },
                  ]} />
              </div>
            )}
          </div>
        </div>

        <CardBody flush>
          {view === 'outstanding' ? (
            <DataTable
              rows={outstanding}
              columns={outstandingColumns}
              keyOf={(r) => r.member.id}
              onRowClick={(r) => nav(`/owner/members/${r.member.id}`)}
              caption="Members with a pending balance"
              mobile={(r) => (
                <>
                  <Avatar name={r.member.name} />
                  <span className="u-grow" style={{ minWidth: 0 }}>
                    <span className="u-between u-gap-2">
                      <span className="t-sm u-truncate" style={{ fontWeight: 580 }}>{r.member.name}</span>
                      <span className="t-sm u-num" style={{ color: 'var(--critical)', fontWeight: 620 }}>
                        {money(r.dues.due)}
                      </span>
                    </span>
                    <span className="t-xs t-faint" style={{ display: 'block', marginTop: 2 }}>
                      {r.membership?.planNameSnapshot} · paid {money(r.dues.paid)} of {money(r.dues.billed)}
                    </span>
                  </span>
                </>
              )}
              empty={<EmptyState icon="checkCircle" title="Everyone is paid up"
                message="No member currently owes money on their membership." />}
            />
          ) : (
            <>
              <DataTable
                rows={result.data}
                columns={columns}
                keyOf={(p) => p.id}
                onRowClick={(p) => p.memberId && nav(`/owner/members/${p.memberId}`)}
                caption="Payments received"
                mobile={(p) => (
                  <>
                    <span style={{
                      width: 36, height: 36, flex: 'none', display: 'grid', placeItems: 'center',
                      borderRadius: 'var(--r-md)', background: 'var(--good-soft)', color: 'var(--good)',
                    }}>
                      <Icon name="arrowDown" size={17} />
                    </span>
                    <span className="u-grow" style={{ minWidth: 0 }}>
                      <span className="u-between u-gap-2">
                        <span className="t-sm u-truncate" style={{ fontWeight: 580 }}>{p.memberName}</span>
                        <span className="t-sm u-num" style={{ fontWeight: 620 }}>{money(p.amount)}</span>
                      </span>
                      <span className="t-xs t-faint" style={{ display: 'block', marginTop: 2 }}>
                        {dateShort(p.paidAt)} · {titleCase(p.method)} · {titleCase(p.source)}
                      </span>
                    </span>
                  </>
                )}
                empty={<EmptyState icon="wallet" title="No payments in this range"
                  message="Widen the date range or clear the filters to see more."
                  action={<Button variant="primary" icon="plus" onClick={() => setOpen(true)}>Record payment</Button>} />}
              />
              <Pagination page={result.meta.page} totalPages={result.meta.totalPages}
                total={result.meta.total} limit={result.meta.limit} onPage={setPage} unit="payments" />
            </>
          )}
        </CardBody>
      </Card>

      <p className="t-xs t-faint u-mt-4 u-row u-gap-2">
        <Icon name="shield" size={13} />
        Payments are append-only and idempotency-keyed, so an online gateway can post into the same
        ledger later without duplicating a record.
      </p>

      {open && <RecordPaymentDialog onClose={() => setOpen(false)} />}
      {payFor && <RecordPaymentDialog memberId={payFor} onClose={() => setPayFor(null)} />}
    </div>
  );
}
