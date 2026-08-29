import { useState } from 'react';
import { Card, CardBody, CardHead, PageHead, StatTile, Badge } from '../../components/ui/primitives';
import { PeriodPicker, periodRange, type Period } from '../../components/ui/PeriodPicker';
import { BarChart, ChartFrame, DivergingBarChart, Legend, SERIES } from '../../components/charts';
import { Icon } from '../../components/ui/Icon';
import { useApp, useData } from '../../state/app';
import * as api from '../../lib/api';
import { dateShort, money, moneyCompact, monthLabel, pct } from '../../lib/format';

export default function ProfitLoss() {
  const { session } = useApp();
  const [period, setPeriod] = useState<Period>(() => ({ key: 'last_6', ...periodRange('last_6') }));

  const pl = useData(
    () => (session ? api.dashboard.profitLoss(session, period.from, period.to) : null),
    [session?.gymId, period.from, period.to],
  );
  const revenueMonths = useData(
    () => (session ? api.reports.revenueByMonth(session, period.from, period.to) : []),
    [session?.gymId, period.from, period.to],
  );
  const expenseMonths = useData(
    () => (session ? api.reports.expenseByMonth(session, period.from, period.to) : []),
    [session?.gymId, period.from, period.to],
  );

  if (!session || !pl) return null;

  const profitMonths = revenueMonths.map((p, i) => ({ ...p, y: p.y - (expenseMonths[i]?.y ?? 0) }));
  const profitable = pl.operatingProfit >= 0;

  return (
    <div className="anim-page">
      <PageHead
        title="Profit &amp; loss"
        subtitle="Revenue received, expenses recorded, and what is actually left — operating profit."
      />

      <div className="u-mb-5"><PeriodPicker value={period} onChange={setPeriod} /></div>

      <div className="grid-stats u-mb-5">
        <StatTile label="Total revenue" icon="trendingUp" value={money(pl.totalRevenue)} accent={SERIES.s1} />
        <StatTile label="Total expenses" icon="receipt" value={money(pl.totalExpenses)} accent={SERIES.s2} />
        <StatTile
          label={profitable ? 'Operating profit' : 'Operating loss'}
          icon="chart"
          value={money(Math.abs(pl.operatingProfit))}
          accent={profitable ? 'var(--good)' : 'var(--critical)'}
          hint={`${dateShort(pl.from)} → ${dateShort(pl.to)}`}
        />
        <StatTile label="Operating margin" icon="target"
          value={pl.totalRevenue > 0 ? pct(pl.margin, 1) : '—'}
          hint="operating profit ÷ revenue" />
      </div>

      <div className="grid-2 u-mb-5">
        <Card>
          <CardBody>
            <ChartFrame
              title="Revenue vs expenses by month"
              subtitle="Both measures share one axis — they are the same unit"
              legend={<Legend series={[{ label: 'Revenue', color: SERIES.s1 }, { label: 'Expenses', color: SERIES.s2 }]} />}
            >
              <BarChart
                height={260} format={moneyCompact} xLabel={(p) => monthLabel(p.label)}
                series={[
                  { key: 'rev', label: 'Revenue', color: SERIES.s1, points: revenueMonths },
                  { key: 'exp', label: 'Expenses', color: SERIES.s2, points: expenseMonths },
                ]}
              />
            </ChartFrame>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <ChartFrame title="Operating profit by month" subtitle="Above the line is profit, below it is loss">
              <DivergingBarChart points={profitMonths} height={260}
                format={moneyCompact} xLabel={(p) => monthLabel(p.label)} />
            </ChartFrame>
          </CardBody>
        </Card>
      </div>

      {/* ---- The statement ---- */}
      <Card>
        <CardHead
          title="Statement"
          subtitle={`${dateShort(pl.from)} to ${dateShort(pl.to)}`}
          action={<Badge tone={profitable ? 'good' : 'critical'} icon={profitable ? 'trendingUp' : 'alert'}>
            {profitable ? 'Profitable period' : 'Loss-making period'}
          </Badge>}
        />
        <CardBody>
          <div className="grid-2">
            <section>
              <h3 className="t-label u-mb-3">Revenue</h3>
              {pl.revenueBySource.length === 0
                ? <p className="t-sm t-faint">No revenue recorded in this period.</p>
                : pl.revenueBySource.map((r) => (
                  <div key={r.key} className="kv">
                    <span className="kv__k">{r.label}</span>
                    <span className="kv__v u-num">{money(r.amount)}</span>
                  </div>
                ))}
              <div className="kv" style={{ borderTop: '2px solid var(--border-strong)', borderBottom: 0 }}>
                <span className="t-sm" style={{ fontWeight: 620 }}>Total revenue</span>
                <span className="u-num" style={{ fontWeight: 660 }}>{money(pl.totalRevenue)}</span>
              </div>
            </section>

            <section>
              <h3 className="t-label u-mb-3">Expenses</h3>
              {pl.expenseByCategory.length === 0
                ? <p className="t-sm t-faint">No expenses recorded in this period.</p>
                : pl.expenseByCategory.map((r) => (
                  <div key={r.key} className="kv">
                    <span className="kv__k">{r.label}</span>
                    <span className="kv__v u-num">{money(r.amount)}</span>
                  </div>
                ))}
              <div className="kv" style={{ borderTop: '2px solid var(--border-strong)', borderBottom: 0 }}>
                <span className="t-sm" style={{ fontWeight: 620 }}>Total expenses</span>
                <span className="u-num" style={{ fontWeight: 660 }}>{money(pl.totalExpenses)}</span>
              </div>
            </section>
          </div>

          <div
            className="u-mt-6"
            style={{
              padding: 'var(--s-5)', borderRadius: 'var(--r-lg)',
              background: profitable ? 'var(--good-soft)' : 'var(--critical-soft)',
            }}
          >
            <div className="u-between u-wrap u-gap-4">
              <div>
                <div className="t-label" style={{ color: profitable ? 'var(--good)' : 'var(--critical)' }}>
                  {profitable ? 'Operating profit' : 'Operating loss'}
                </div>
                <div className="u-mt-2" style={{ fontSize: 'var(--fs-34)', fontWeight: 680, letterSpacing: '-0.03em' }}>
                  {money(Math.abs(pl.operatingProfit))}
                </div>
              </div>
              <div className="t-sm t-muted u-right" style={{ maxWidth: 380 }}>
                Total revenue {money(pl.totalRevenue)} − total expenses {money(pl.totalExpenses)}.
                <br />
                Margin {pl.totalRevenue > 0 ? pct(pl.margin, 1) : '—'}.
              </div>
            </div>
          </div>

          <p className="t-xs t-faint u-mt-5 u-row u-gap-2">
            <Icon name="info" size={13} style={{ flex: 'none', marginTop: 2 }} />
            This is <strong>operating profit</strong> — not gross profit and not net profit. It excludes
            depreciation, interest and tax, which belong to a future accounting module. Revenue is
            recognised on receipt, expenses on the date recorded.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
