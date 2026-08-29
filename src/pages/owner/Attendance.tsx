import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Avatar, Badge, Button, Card, CardBody, CardHead, EmptyState, PageHead, StatTile,
} from '../../components/ui/primitives';
import { DateField, SearchInput } from '../../components/ui/forms';
import { Icon } from '../../components/ui/Icon';
import { ChartFrame, LineChart, SERIES } from '../../components/charts';
import { MarkAttendanceDialog } from '../../components/dialogs';
import { useApp, useData } from '../../state/app';
import * as api from '../../lib/api';
import { count, dateLong, dayLabel, pct, time } from '../../lib/format';
import { addDays, todayISO } from '../../lib/date';

export default function Attendance() {
  const { session, toast } = useApp();
  const nav = useNavigate();
  const today = todayISO();

  const [date, setDate] = useState(today);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);

  const sessions = useData(() => (session ? api.attendance.onDate(session, date) : []), [session?.gymId, date]);
  const trend = useData(
    () => (session ? api.attendance.trend(session, addDays(today, -29), today) : []),
    [session?.gymId],
  );
  const counts = useData(() => (session ? api.members.counts(session) : null), [session?.gymId]);
  const devices = api.attendance.devices();

  if (!session || !counts) return null;

  const withCheckout = sessions.filter((s) => s.lastOut !== null);
  const insideNow = date === today
    ? (withCheckout.length === 0 ? null : sessions.filter((s) => !s.lastOut).length)
    : null;

  const filtered = q.trim()
    ? sessions.filter((s) => s.member.name.toLowerCase().includes(q.toLowerCase().trim())
      || s.member.memberCode.toLowerCase().includes(q.toLowerCase().trim()))
    : sessions;

  const avg = trend.length ? trend.reduce((s, p) => s + p.y, 0) / trend.length : 0;
  const activeBase = Math.max(1, counts.active + counts.expiring);

  const checkOut = async (memberId: string, name: string) => {
    try {
      await api.attendance.mark(session, memberId, 'check_out');
      toast('success', 'Checked out', name);
    } catch { toast('error', 'Could not record check-out'); }
  };

  return (
    <div className="anim-page">
      <PageHead
        title="Attendance"
        subtitle="Built on an event log, so who came today and who is inside right now are two different questions."
        actions={<Button variant="primary" icon="calendarCheck" onClick={() => setOpen(true)}>Mark attendance</Button>}
      />

      <div className="grid-stats u-mb-5">
        <StatTile label="Check-ins" icon="calendarCheck" value={count(sessions.length)}
          hint={date === today ? 'today' : dateLong(date)} />
        <StatTile
          label="Inside now" icon="users"
          value={insideNow == null ? 'Unknown' : count(insideNow)}
          hint={insideNow == null
            ? (date === today ? 'no check-out data yet' : 'only meaningful for today')
            : 'checked in, not yet out'}
        />
        <StatTile label="Attendance rate" icon="target"
          value={pct((sessions.length / activeBase) * 100)}
          hint={`of ${activeBase} active members`} />
        <StatTile label="Daily average" icon="activity" value={count(Math.round(avg))}
          hint="last 30 days" />
      </div>

      <div className="grid-2:1 u-mb-5">
        <Card>
          <CardBody>
            <ChartFrame title="Attendance trend" subtitle="Distinct members checking in each day, last 30 days">
              <LineChart
                area height={240}
                format={(v) => String(Math.round(v))}
                xLabel={(p) => dayLabel(p.label)}
                series={[{ key: 'a', label: 'Check-ins', color: SERIES.s1, points: trend }]}
              />
            </ChartFrame>
          </CardBody>
        </Card>

        {/* ---- Device integration: architected, deliberately not wired ---- */}
        <Card>
          <CardHead
            title="Attendance device"
            subtitle="Biometric or QR reader at the entrance"
          />
          <CardBody>
            {devices.map((d) => (
              <div key={d.id}>
                <div className="u-row u-gap-3 u-mb-4">
                  <span style={{
                    width: 44, height: 44, flex: 'none', display: 'grid', placeItems: 'center',
                    borderRadius: 'var(--r-md)', background: 'var(--surface-inset)', color: 'var(--text-3)',
                  }}>
                    <Icon name="fingerprint" size={22} />
                  </span>
                  <div className="u-grow">
                    <div className="t-sm" style={{ fontWeight: 580 }}>{d.label}</div>
                    <div className="u-mt-2"><Badge tone="neutral" dot>Not connected</Badge></div>
                  </div>
                </div>

                <p className="t-sm t-muted">
                  Attendance is being recorded manually. When a reader is connected it will post
                  the same <code style={{ fontSize: '0.92em' }}>check_in</code> /
                  <code style={{ fontSize: '0.92em' }}> check_out</code> events into this log —
                  no screen or report changes.
                </p>

                <Button
                  className="u-mt-4" block icon="zap"
                  onClick={() => toast('info', 'Not available yet',
                    'Device integration is enabled once the gym’s hardware and API are chosen.')}
                >
                  Connect attendance device
                </Button>

                <ul className="u-col u-gap-2 u-mt-4">
                  {[
                    'Event source is already stored (manual / device / QR)',
                    'Replay-safe: events de-duplicate on device event id',
                    'Occupancy needs check-out data — the UI says so when it is missing',
                  ].map((t) => (
                    <li key={t} className="u-row u-gap-2 t-xs t-faint">
                      <Icon name="check" size={12} style={{ color: 'var(--good)', flex: 'none', marginTop: 3 }} />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>

      <Card>
        <div className="card__body" style={{ paddingBottom: 'var(--s-4)' }}>
          <div className="toolbar">
            <div className="toolbar__search">
              <SearchInput value={q} onChange={setQ} placeholder="Find a member in today's list" />
            </div>
            <DateField aria-label="Attendance date" value={date} max={today}
              onChange={(e) => setDate(e.target.value)} />
            {date !== today && <Button size="sm" variant="ghost" onClick={() => setDate(today)}>Back to today</Button>}
          </div>
        </div>

        <CardBody flush>
          {filtered.length === 0 ? (
            <EmptyState
              icon="calendarCheck"
              title={q ? 'Nobody matches that search' : 'No check-ins recorded'}
              message={q
                ? 'Try a different name or member ID.'
                : `Nothing recorded for ${dateLong(date)}. Mark attendance manually until a device is connected.`}
              action={!q ? <Button variant="primary" icon="plus" onClick={() => setOpen(true)}>Mark attendance</Button> : undefined}
            />
          ) : (
            <ul className="cardlist">
              {filtered.map((s) => (
                <li key={s.memberId} className="cardlist__item" style={{ cursor: 'default' }}>
                  <Avatar name={s.member.name} size="sm" />
                  <span className="u-grow" style={{ minWidth: 0 }}>
                    <button
                      className="t-sm u-truncate"
                      style={{ fontWeight: 560, background: 'none', border: 0, padding: 0, cursor: 'pointer', color: 'inherit', display: 'block' }}
                      onClick={() => nav(`/owner/members/${s.memberId}`)}
                    >
                      {s.member.name}
                    </button>
                    <span className="t-xs t-faint">{s.member.memberCode}</span>
                  </span>
                  <span className="u-right u-nowrap">
                    <span className="t-sm u-num" style={{ display: 'block' }}>
                      {time(s.firstIn)}{s.lastOut ? ` → ${time(s.lastOut)}` : ''}
                    </span>
                    <span className="t-xs t-faint">{s.lastOut ? 'in → out' : 'no check-out'}</span>
                  </span>
                  {!s.lastOut && date === today && (
                    <Button size="sm" onClick={() => checkOut(s.memberId, s.member.name)}>Check out</Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {open && <MarkAttendanceDialog onClose={() => setOpen(false)} />}
    </div>
  );
}
