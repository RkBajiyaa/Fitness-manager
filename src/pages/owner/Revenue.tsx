import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Avatar, Button, Card, CardBody, CardHead, EmptyState, PageHead, StatTile,
} from '../../components/ui/primitives';
import { PeriodPicker, periodRange, type Period } from '../../components/ui/PeriodPicker';
import { BarChart, CategoryBars, ChartFrame, SERIES } from '../../components/charts';
import { useApp, useData } from '../../state/app';
import * as api from '../../lib/api';
import { count, dateShort, money, moneyCompact, monthLabel } from '../../lib/format';
import { rangeMonths } from '../../lib/date';

export default function Revenue() {
  const { session } = useApp();
  const nav = useNavigate();
  const [period, setPeriod] = useState<Period>(() => ({ key: 'last_6', ...periodRange('last_6') }));

  const pl = useData(
    () => (session ? api.dashboard.profitLoss(session, period.from, period.to) : null),
    [session?.gymId, period.from, period.to],
  );
  const byMonth = useData(
    () => (session ? api.reports.revenueByMonth(session, period.from, period.to) : []),
    [session?.gymId, period.from, period.to],
  );
  const payments = useData(
    () => (session ? api.payments.list(session, { from: period.from, to: period.to, limit: 1000 }).data : []),
    [session?.gymId, period.from, period.to],
  );
  const k = useData(() => (session ? api.dashboard.get(session) : null), [session?.gymId]);

  if (!session || !pl || !k) return null;

  const months = rangeMonths(period.from, period.to).length;
  const avgMonth = months > 0 ? pl.totalRevenue / months : 0;

  const byMember = new Map<string, { name: string; id: string; total: number }>();
  payments.forEach((p) => {
    if (!p.memberId) return;
    const cur = byMember.get(p.memberId) ?? { name: p.memberName, id: p.memberId, total: 0 };
    cur.total += p.amount;
    byMember.set(p.memberId, cur);
  });
  const top = [...byMember.values()].sort((a, b) => b.total - a.total).slice(0, 8);

  const recurringShare = pl.revenueBySource.find((r) => r.key === 'renewal')?.amount ?? 0;

  return (
    <div className="anim-page">
      <PageHead
        title="Revenue"
        subtitle="Money actually received, grouped by what it was for."
      />

      <div className="u-mb-5"><PeriodPicker value={period} onChange={setPeriod} /></div>

      <div className="grid-stats u-mb-5">
        <StatTile label="Revenue in period" icon="trendingUp" value={money(pl.totalRevenue)}
          accent={SERIES.s1} hint={`${dateShort(period.from)} → ${dateShort(period.to)}`} />
        <StatTile label="Monthly average" icon="chart" value={money(Math.round(avgMonth))}
          hint={`over ${months} month${months === 1 ? '' : 's'}`} />
        <StatTile label="From renewals" icon="refresh" value={money(recurringShare)}
          hint={pl.totalRevenue > 0 ? `${Math.round((recurringShare / pl.totalRevenue) * 100)}% of revenue` : undefined} />
        <StatTile label="Received today" icon="wallet" value={money(k.revenueToday)} />
      </div>

      <div className="grid-2:1 u-mb-5">
        <Card>
          <CardBody>
            <ChartFrame title="Revenue by month" subtitle="Payments received, grouped by the month they landed">
              {byMonth.length ? (
                <BarChart
                  height={260} format={moneyCompact} xLabel={(p) => monthLabel(p.label)}
                  series={[{ key: 'rev', label: 'Revenue', color: SERIES.s1, points: byMonth }]}
                />
              ) : <EmptyState icon="chart" title="No revenue in this period" />}
            </ChartFrame>
          </CardBody>
        </Card>

        <Card>
          <CardHead title="Revenue by source" subtitle="Where the money comes from" />
          <CardBody>
            <CategoryBars rows={pl.revenueBySource} format={money}
              emptyLabel="No payments received in this period." />
            <p className="t-xs t-faint u-mt-5">
              New sources — day passes, merchandise, events — become rows here without a schema change:
              revenue is the payment ledger grouped by source, not a separate table.
            </p>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHead title="Top members by spend" subtitle="Within the selected period" />
        <CardBody flush>
          {top.length === 0 ? (
            <EmptyState icon="users" title="No member payments in this period" />
          ) : (
            <ul className="cardlist">
              {top.map((m, i) => (
                <li key={m.id}>
                  <button className="cardlist__item" onClick={() => nav(`/owner/members/${m.id}`)}>
                    <span className="t-xs t-faint u-num" style={{ width: 20 }}>{i + 1}</span>
                    <Avatar name={m.name} size="sm" />
                    <span className="u-grow u-truncate t-sm" style={{ fontWeight: 550 }}>{m.name}</span>
                    <span className="t-sm u-num" style={{ fontWeight: 620 }}>{money(m.total)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <div className="u-row u-gap-3 u-mt-4">
        <Button variant="ghost" iconRight="arrowRight" onClick={() => nav('/owner/profit-loss')}>
          See what is left after expenses
        </Button>
      </div>

      <p className="t-xs t-faint u-mt-4">
        {count(payments.length)} payments in this period. Revenue is recognised when the money is
        received — a future accounting module can add accrual treatment without changing this ledger.
      </p>
    </div>
  );
}
