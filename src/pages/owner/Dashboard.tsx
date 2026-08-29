import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Avatar, Button, Card, CardBody, CardHead, EmptyState, PageHead, StatTile, StatusBadge,
} from '../../components/ui/primitives';
import { Icon } from '../../components/ui/Icon';
import {
  BarChart, ChartFrame, DivergingBarChart, Legend, LineChart, SERIES,
} from '../../components/charts';
import { AttentionQueue } from '../../components/owner/AttentionQueue';
import {
  AddExpenseDialog, MarkAttendanceDialog, RecordPaymentDialog, RenewMembershipDialog,
} from '../../components/dialogs';
import { MessageDialog } from '../../components/dialogs/communication';
import { useApp, useData } from '../../state/app';
import * as api from '../../lib/api';
import type { MemberRow } from '../../lib/api';
import { count, dateLong, dayLabel, money, moneyCompact, monthLabel, pct } from '../../lib/format';
import { addDays, addMonths, monthKey, todayISO } from '../../lib/date';

export default function Dashboard() {
  const { session } = useApp();
  const nav = useNavigate();
  const [dialog, setDialog] = useState<'payment' | 'expense' | 'attendance' | null>(null);
  const [renew, setRenew] = useState<string | null>(null);
  const [pay, setPay] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const today = todayISO();

  const k = useData(() => (session ? api.dashboard.get(session) : null), [session?.gymId]);
  const queue = useData(() => (session ? api.engagement.queue(session) : []), [session?.gymId]);
  const highlights = useData(() => (session ? api.engagement.highlights(session, 4) : []), [session?.gymId]);
  const counts = useData(() => (session ? api.members.counts(session) : null), [session?.gymId]);
  const revenue = useData(() => (session ? api.dashboard.revenueTrend(session, 6) : []), [session?.gymId]);
  const spend = useData(() => (session ? api.dashboard.expenseTrend(session, 6) : []), [session?.gymId]);
  const sessionTrend = useData(
    () => (session ? api.dashboard.sessionTrend(session, addDays(today, -29), today) : []),
    [session?.gymId],
  );
  const growth = useData(() => (session ? api.dashboard.memberGrowth(session, 6) : []), [session?.gymId]);
  const expiring = useData(() => (session ? api.dashboard.expiring(session, 14) : []), [session?.gymId]);
  const dues = useData(() => (session ? api.payments.outstanding(session) : []), [session?.gymId]);

  if (!session || !k || !counts) return null;

  const profitSeries = revenue.map((p, i) => ({ ...p, y: p.y - (spend[i]?.y ?? 0) }));
  const prevMonth = monthKey(addMonths(today, -1));
  const prevRevenue = revenue.find((p) => p.x === prevMonth)?.y ?? 0;
  const revenueDelta = prevRevenue > 0 ? ((k.revenueMonth - prevRevenue) / prevRevenue) * 100 : 0;
  const activeBase = Math.max(1, k.activeMembers);
  const sessionsPerMember = k.sessionsWeek / activeBase;

  const act = (row: MemberRow, action: 'renew' | 'payment' | 'message') => {
    if (action === 'renew') setRenew(row.member.id);
    if (action === 'payment') setPay(row.member.id);
    if (action === 'message') setMessage(row.member.id);
  };

  return (
    <div className="anim-page">
      <PageHead
        title={`Good ${greeting()}, ${session.name.split(' ')[0]}`}
        subtitle={dateLong(today)}
        actions={
          <>
            <Button icon="calendarCheck" onClick={() => setDialog('attendance')}>
              <span className="hide-mobile">Mark attendance</span>
              <span className="only-mobile">Attendance</span>
            </Button>
            <Button icon="receipt" onClick={() => setDialog('expense')}>
              <span className="hide-mobile">Add expense</span>
              <span className="only-mobile">Expense</span>
            </Button>
            <Button variant="primary" icon="wallet" onClick={() => setDialog('payment')}>
              <span className="hide-mobile">Record payment</span>
              <span className="only-mobile">Payment</span>
            </Button>
          </>
        }
      />

      {/* ================= THE QUEUE THAT MATTERS AT 50 MEMBERS ================= */}
      <Card className="u-mb-5">
        <CardHead
          title="Needs attention"
          subtitle={queue.length
            ? `${counts.attention} to act on, ${counts.watch} to watch`
            : 'Nothing needs chasing today'}
          action={queue.length > 0
            ? <Button size="sm" variant="ghost" iconRight="arrowRight" onClick={() => nav('/owner/attention')}>
                See all
              </Button>
            : undefined}
        />
        <CardBody flush>
          <AttentionQueue rows={queue} limit={4} onAct={act} />
        </CardBody>
      </Card>

      {/* ================= TODAY ================= */}
      <h2 className="t-label u-mb-3">Today</h2>
      <div className="grid-stats grid-stats--6 u-mb-5">
        <StatTile label="Sessions logged" icon="dumbbell" value={count(k.sessionsToday)}
          hint="training recorded" onClick={() => nav('/owner/members')} />
        <StatTile label="Check-ins" icon="calendarCheck" value={count(k.attendanceToday)}
          hint="members in" onClick={() => nav('/owner/attendance')} />
        <StatTile label="Inside now" icon="users"
          value={k.insideNow == null ? '—' : count(k.insideNow)}
          hint={k.insideNow == null ? 'no check-out data yet' : 'not yet checked out'}
          onClick={() => nav('/owner/attendance')} />
        <StatTile label="Revenue" icon="wallet" value={money(k.revenueToday)}
          hint="received today" onClick={() => nav('/owner/payments')} />
        <StatTile label="Expenses" icon="receipt" value={money(k.expensesToday)}
          hint="spent today" onClick={() => nav('/owner/expenses')} />
        <StatTile label="New / renewals" icon="userPlus" value={`${k.newToday} / ${k.renewalsToday}`}
          hint="signed today" onClick={() => nav('/owner/memberships')} />
      </div>

      {/* ================= ENGAGEMENT ================= */}
      <h2 className="t-label u-mb-3">Engagement</h2>
      <div className="grid-stats u-mb-5">
        <StatTile label="Active members" icon="users" value={count(k.activeMembers)}
          hint={`of ${k.totalMembers} on the roster`} onClick={() => nav('/owner/members')} />
        <StatTile label="Sessions this week" icon="activity" value={count(k.sessionsWeek)}
          hint={`${sessionsPerMember.toFixed(1)} per active member`} />
        <StatTile label="Training rate" icon="target"
          value={pct((k.sessionsWeek / (activeBase * 3)) * 100)}
          hint="against a 3-a-week benchmark" />
        <StatTile label="Expiring in 14 days" icon="clock" value={count(k.expiringSoon)}
          accent="var(--warning-mark)" hint="renewal conversations"
          onClick={() => nav('/owner/memberships')} />
      </div>

      {highlights.length > 0 && (
        <Card className="u-mb-5">
          <CardHead title="Worth mentioning" subtitle="Real milestones your members hit this month" />
          <CardBody flush>
            <ul className="cardlist">
              {highlights.map((h, i) => (
                <li key={`${h.memberId}-${i}`}>
                  <button className="cardlist__item" onClick={() => nav(`/owner/members/${h.memberId}`)}>
                    <span style={{
                      width: 32, height: 32, flex: 'none', display: 'grid', placeItems: 'center',
                      borderRadius: 'var(--r-md)', background: 'var(--accent-soft)', color: 'var(--accent)',
                    }}>
                      <Icon name={h.kind === 'pr' ? 'trophy' : 'flame'} size={16} />
                    </span>
                    <span className="u-grow" style={{ minWidth: 0 }}>
                      <span className="t-sm" style={{ fontWeight: 580 }}>{h.memberName}</span>
                      <span className="t-xs t-muted" style={{ display: 'block' }}>{h.text}</span>
                    </span>
                    <Button size="sm" icon="message"
                      onClick={(e) => { e.stopPropagation(); setMessage(h.memberId); }}>
                      Congratulate
                    </Button>
                  </button>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      {/* ================= THE MONTH, AS ONE NUMBER ================= */}
      <Card className="u-mb-5">
        <div className="card__body">
          <div className="grid-3" style={{ alignItems: 'center' }}>
            <div>
              <div className="t-label">Operating profit · {monthLabel(monthKey(today))}</div>
              <div
                className="u-mt-2"
                style={{
                  fontSize: 'var(--fs-44)', fontWeight: 680, letterSpacing: '-0.035em', lineHeight: 1.05,
                  color: k.profitMonth >= 0 ? 'var(--text-1)' : 'var(--critical)',
                }}
              >
                {money(k.profitMonth)}
              </div>
              <div className="t-xs t-faint u-mt-2">
                Revenue received minus expenses recorded, month to date.
              </div>
            </div>
            <div className="u-col u-gap-4">
              <MiniLine label="Revenue this month" value={money(k.revenueMonth)}
                delta={prevRevenue > 0
                  ? `${revenueDelta >= 0 ? '+' : '−'}${Math.abs(revenueDelta).toFixed(0)}% vs last month`
                  : undefined}
                tone={revenueDelta >= 0 ? 'good' : 'bad'} color={SERIES.s1} />
              <MiniLine label="Expenses this month" value={money(k.expensesMonth)} color={SERIES.s2} />
            </div>
            <div className="u-col u-gap-3">
              <div className="u-between">
                <span className="t-sm t-muted">Margin</span>
                <span className="t-sm u-num" style={{ fontWeight: 620 }}>
                  {k.revenueMonth > 0 ? `${((k.profitMonth / k.revenueMonth) * 100).toFixed(1)}%` : '—'}
                </span>
              </div>
              <div style={{ height: 8, borderRadius: 4, background: 'var(--surface-inset)', overflow: 'hidden', display: 'flex' }}>
                <div style={{ width: `${barShare(k.expensesMonth, k.revenueMonth)}%`, background: SERIES.s2 }} />
                <div style={{ width: 2, background: 'var(--surface-1)' }} />
                <div style={{ flex: 1, background: k.profitMonth >= 0 ? SERIES.s1 : 'var(--critical)' }} />
              </div>
              <div className="u-row u-gap-4 t-xs t-faint">
                <span className="u-row u-gap-2">
                  <span style={{ width: 9, height: 9, borderRadius: 2, background: SERIES.s2 }} />Expenses
                </span>
                <span className="u-row u-gap-2">
                  <span style={{ width: 9, height: 9, borderRadius: 2, background: SERIES.s1 }} />Profit
                </span>
              </div>
              <Button size="sm" variant="ghost" iconRight="arrowRight" onClick={() => nav('/owner/profit-loss')}
                style={{ alignSelf: 'flex-start', paddingLeft: 0 }}>
                Full profit &amp; loss
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* ================= CHARTS ================= */}
      <div className="grid-2 u-mb-5">
        <Card>
          <CardBody>
            <ChartFrame
              title="Revenue vs expenses"
              subtitle="Last 6 months, money actually received and spent"
              legend={<Legend series={[{ label: 'Revenue', color: SERIES.s1 }, { label: 'Expenses', color: SERIES.s2 }]} />}
            >
              <BarChart
                height={250} format={moneyCompact} xLabel={(p) => monthLabel(p.label)}
                series={[
                  { key: 'rev', label: 'Revenue', color: SERIES.s1, points: revenue },
                  { key: 'exp', label: 'Expenses', color: SERIES.s2, points: spend },
                ]}
              />
            </ChartFrame>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <ChartFrame title="Operating profit" subtitle="Revenue minus expenses, by month">
              <DivergingBarChart points={profitSeries} height={250}
                format={moneyCompact} xLabel={(p) => monthLabel(p.label)} />
            </ChartFrame>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <ChartFrame title="Training volume" subtitle="Sessions logged across the studio, last 30 days">
              <LineChart area height={230} format={(v) => String(Math.round(v))}
                xLabel={(p) => dayLabel(p.label)}
                series={[{ key: 's', label: 'Sessions', color: SERIES.s1, points: sessionTrend }]} />
            </ChartFrame>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <ChartFrame title="Member growth" subtitle="Roster size at each month end">
              <LineChart area height={230} format={(v) => String(Math.round(v))}
                xLabel={(p) => monthLabel(p.label)}
                series={[{ key: 'g', label: 'Members', color: SERIES.s1, points: growth }]} />
            </ChartFrame>
          </CardBody>
        </Card>
      </div>

      {/* ================= WORK QUEUES ================= */}
      <div className="grid-2">
        <Card>
          <CardHead
            title="Renewals due"
            subtitle={expiring.length ? `${expiring.length} within 14 days` : undefined}
            action={<Button size="sm" variant="ghost" iconRight="arrowRight"
              onClick={() => nav('/owner/memberships')}>All</Button>}
          />
          <CardBody flush>
            {expiring.length === 0 ? (
              <EmptyState icon="checkCircle" title="Nothing expiring"
                message="Every active membership has more than two weeks left." />
            ) : (
              <ul className="cardlist">
                {expiring.slice(0, 6).map((r) => (
                  <li key={r.member.id} className="cardlist__item" style={{ cursor: 'default' }}>
                    <Avatar name={r.member.name} size="sm" />
                    <span className="u-grow u-truncate">
                      <span className="t-sm u-truncate" style={{ fontWeight: 560, display: 'block' }}>
                        {r.member.name}
                      </span>
                      <span className="t-xs t-faint">{r.membership?.planNameSnapshot}</span>
                    </span>
                    <StatusBadge status={r.status} daysLeft={r.daysLeft} />
                    <Button size="sm" variant="primary" onClick={() => setRenew(r.member.id)}>Renew</Button>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHead
            title="Outstanding payments"
            subtitle={dues.length ? `${money(k.pendingTotal)} across ${dues.length} members` : undefined}
            action={<Button size="sm" variant="ghost" iconRight="arrowRight"
              onClick={() => nav('/owner/payments')}>All</Button>}
          />
          <CardBody flush>
            {dues.length === 0 ? (
              <EmptyState icon="checkCircle" title="Everyone is paid up"
                message="No member currently has a pending balance." />
            ) : (
              <ul className="cardlist">
                {dues.slice(0, 6).map((r) => (
                  <li key={r.member.id} className="cardlist__item" style={{ cursor: 'default' }}>
                    <Avatar name={r.member.name} size="sm" />
                    <span className="u-grow u-truncate">
                      <span className="t-sm u-truncate" style={{ fontWeight: 560, display: 'block' }}>
                        {r.member.name}
                      </span>
                      <span className="t-xs t-faint">
                        paid {money(r.dues.paid)} of {money(r.dues.billed)}
                      </span>
                    </span>
                    <span className="t-sm u-num u-nowrap" style={{ fontWeight: 620, color: 'var(--critical)' }}>
                      {money(r.dues.due)}
                    </span>
                    <Button size="sm" variant="primary" onClick={() => setPay(r.member.id)}>Collect</Button>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      {dialog === 'payment' && <RecordPaymentDialog onClose={() => setDialog(null)} />}
      {dialog === 'expense' && <AddExpenseDialog onClose={() => setDialog(null)} />}
      {dialog === 'attendance' && <MarkAttendanceDialog onClose={() => setDialog(null)} />}
      {renew && <RenewMembershipDialog memberId={renew} onClose={() => setRenew(null)} />}
      {pay && <RecordPaymentDialog memberId={pay} onClose={() => setPay(null)} />}
      {message && <MessageDialog memberId={message} initialKind="congratulations" onClose={() => setMessage(null)} />}
    </div>
  );
}

function MiniLine({ label, value, delta, tone, color }: {
  label: string; value: string; delta?: string; tone?: 'good' | 'bad'; color: string;
}) {
  return (
    <div>
      <div className="t-xs t-muted u-row u-gap-2">
        <span style={{ width: 9, height: 9, borderRadius: 2, background: color }} />
        {label}
      </div>
      <div className="t-h2 u-num u-mt-2">{value}</div>
      {delta && (
        <div className="t-xs u-mt-2" style={{ color: tone === 'good' ? 'var(--good)' : 'var(--critical)' }}>
          {delta}
        </div>
      )}
    </div>
  );
}

function barShare(expense: number, revenue: number): number {
  if (revenue <= 0) return 100;
  return Math.min(100, Math.max(0, (expense / revenue) * 100));
}

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
}
