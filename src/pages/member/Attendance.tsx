import { Card, CardBody, CardHead, EmptyState, StatTile } from '../../components/ui/primitives';
import { HeatStrip } from '../../components/charts';
import { useApp, useData } from '../../state/app';
import * as api from '../../lib/api';
import { count, dateLong, dateShort, pct, relativeDay, time } from '../../lib/format';
import { addDays, rangeDays, todayISO } from '../../lib/date';

export default function MemberAttendance() {
  const { session } = useApp();
  const memberId = session?.memberId ?? '';
  const today = todayISO();

  const events = useData(() => (session && memberId ? api.attendance.forMember(session, memberId) : []), [memberId]);
  const streaks = useData(() => (session && memberId ? api.streaks.forMember(session, memberId) : null), [memberId]);

  if (!session || !streaks) return null;

  const attended = new Set(events.filter((e) => e.type === 'check_in').map((e) => e.at.slice(0, 10)));
  const strip = rangeDays(addDays(today, -83), today).map((d) => ({
    date: d, value: attended.has(d) ? 1 : 0, label: dateLong(d),
  }));

  const byDay = new Map<string, typeof events>();
  events.forEach((e) => byDay.set(e.at.slice(0, 10), [...(byDay.get(e.at.slice(0, 10)) ?? []), e]));
  const visits = [...byDay.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, list]) => {
      const ins = list.filter((e) => e.type === 'check_in').sort((a, b) => a.at.localeCompare(b.at));
      const outs = list.filter((e) => e.type === 'check_out').sort((a, b) => a.at.localeCompare(b.at));
      return ins.length ? { date, inAt: ins[0].at, outAt: outs.length ? outs[outs.length - 1].at : null } : null;
    })
    .filter((x): x is { date: string; inAt: string; outAt: string | null } => x !== null)
    .slice(0, 25);

  return (
    <div className="anim-page u-col u-gap-4">
      <div>
        <h1 className="t-h1">Attendance</h1>
        <p className="t-sm t-muted u-mt-2">Your visits, recorded at the studio entrance.</p>
      </div>

      <div className="grid-stats">
        <StatTile label="Visit streak" icon="flame" value={`${streaks.attendance.current}d`}
          accent="var(--accent)" hint="consecutive days in" />
        <StatTile label="Best streak" icon="trophy" value={`${streaks.attendance.longest}d`} />
        <StatTile label="Visits, 30 days" icon="calendarCheck" value={count(streaks.visitStats.visits)} />
        <StatTile label="Consistency" icon="target" value={pct(streaks.visitStats.percentage)}
          hint="of the last 30 days" />
      </div>

      <Card>
        <CardHead title="Last 12 weeks" subtitle="Each square is a day you came in" />
        <CardBody>
          <HeatStrip days={strip} format={(v) => (v ? 'You trained' : 'No visit')} />
        </CardBody>
      </Card>

      <Card>
        <CardHead title="Recent visits" />
        <CardBody flush>
          {visits.length === 0 ? (
            <EmptyState icon="calendarCheck" title="No visits recorded yet"
              message="Your check-ins at the entrance will appear here." />
          ) : (
            <ul className="cardlist">
              {visits.map((s) => (
                <li key={s.date} className="cardlist__item" style={{ cursor: 'default' }}>
                  <span className="u-grow">
                    <span className="t-sm" style={{ fontWeight: 560 }}>{dateShort(s.date)}</span>
                    <span className="t-xs t-faint" style={{ display: 'block' }}>{relativeDay(s.date)}</span>
                  </span>
                  <span className="u-right u-nowrap">
                    <span className="t-sm u-num" style={{ display: 'block' }}>
                      {time(s.inAt)}{s.outAt ? ` → ${time(s.outAt)}` : ''}
                    </span>
                    <span className="t-xs t-faint">{s.outAt ? 'in → out' : 'no check-out'}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
