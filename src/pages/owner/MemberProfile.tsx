import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Avatar, Badge, Button, Card, CardBody, CardHead, EmptyState, ErrorState, KV,
  Meter, Modal, StatTile, StatusBadge, Tabs,
} from '../../components/ui/primitives';
import {
  DateField, SelectField, TextField, TextareaField, fieldErrors, errorMessage,
} from '../../components/ui/forms';
import { Icon } from '../../components/ui/Icon';
import { HeatStrip, LineChart, SERIES } from '../../components/charts';
import { AddNoteDialog, RecordPaymentDialog, RenewMembershipDialog } from '../../components/dialogs';
import { useApp, useData } from '../../state/app';
import * as api from '../../lib/api';
import type { Gender } from '../../lib/types';
import {
  count, dateLong, dateShort, dayLabel, money, phoneMask, pct, relativeDay, time, titleCase,
} from '../../lib/format';
import { addDays, age, rangeDays, todayISO } from '../../lib/date';

type TabKey = 'overview' | 'membership' | 'payments' | 'attendance' | 'workout' | 'diet' | 'progress' | 'notes';

export default function MemberProfile() {
  const { id = '' } = useParams();
  const { session, confirm, toast } = useApp();
  const nav = useNavigate();
  const [tab, setTab] = useState<TabKey>('overview');
  const [dialog, setDialog] = useState<'renew' | 'payment' | 'note' | 'edit' | null>(null);

  const summary = useData(() => {
    if (!session) return null;
    try { return api.members.get(session, id); } catch { return 'missing' as const; }
  }, [session?.gymId, id]);

  if (!session) return null;
  if (summary === 'missing' || !summary) {
    return (
      <Card>
        <ErrorState message="That member does not exist in this gym, or has been removed." />
        <div className="u-center u-mb-5">
          <Button icon="arrowLeft" onClick={() => nav('/owner/members')}>Back to members</Button>
        </div>
      </Card>
    );
  }

  const { member, membership, status, daysLeft, dues } = summary;

  const remove = async () => {
    const ok = await confirm({
      title: `Delete ${member.name}?`,
      tone: 'danger',
      confirmLabel: 'Delete member',
      message: (
        <>
          <p>This permanently removes their profile, membership history, attendance,
            workout logs, measurements and notes.</p>
          <p className="u-mt-3">
            Payments already collected are <strong>kept</strong> and detached from the member,
            so past revenue and reports stay accurate. This cannot be undone.
          </p>
        </>
      ),
    });
    if (!ok) return;
    try {
      await api.members.remove(session, member.id);
      toast('success', 'Member deleted', `${member.name} has been removed from the roster.`);
      nav('/owner/members');
    } catch (e) {
      toast('error', 'Could not delete member', errorMessage(e));
    }
  };

  const tabs: Array<{ value: TabKey; label: string }> = [
    { value: 'overview', label: 'Overview' },
    { value: 'membership', label: 'Membership' },
    { value: 'payments', label: 'Payments' },
    { value: 'attendance', label: 'Attendance' },
    { value: 'workout', label: 'Workout' },
    { value: 'diet', label: 'Diet' },
    { value: 'progress', label: 'Progress' },
    { value: 'notes', label: 'Notes' },
  ];

  return (
    <div className="anim-page">
      <div className="u-row u-gap-2 u-mb-4">
        <Button size="sm" variant="ghost" icon="arrowLeft" onClick={() => nav('/owner/members')}>
          Members
        </Button>
        <Icon name="chevronRight" size={13} className="t-faint" />
        <span className="t-sm t-muted u-truncate">{member.name}</span>
      </div>

      <div className="grid-profile">
        {/* ---------------- identity column ---------------- */}
        <div className="u-col u-gap-4">
          <Card>
            <CardBody>
              <div className="u-col u-gap-3" style={{ alignItems: 'center', textAlign: 'center' }}>
                <Avatar name={member.name} size="xl" />
                <div>
                  <h1 className="t-h2">{member.name}</h1>
                  <div className="t-xs t-faint u-mt-2">
                    {member.memberCode}
                    {age(member.dob) != null && ` · ${age(member.dob)} yrs`}
                    {` · ${titleCase(member.gender)}`}
                  </div>
                </div>
                <StatusBadge status={status} daysLeft={daysLeft} />
              </div>

              <hr className="divider u-mt-5 u-mb-4" />

              <div className="u-col u-gap-3">
                <ContactRow icon="phone" label={phoneMask(member.phone)} href={`tel:${member.phone}`} />
                {member.email && <ContactRow icon="mail" label={member.email} href={`mailto:${member.email}`} />}
                {member.address && <ContactRow icon="pin" label={member.address} />}
                <ContactRow icon="calendar" label={`Joined ${dateShort(member.joinedAt)}`} />
              </div>

              <hr className="divider u-mt-4 u-mb-4" />

              <div className="u-col u-gap-2">
                <Button variant="primary" icon="refresh" block onClick={() => setDialog('renew')}>
                  {membership ? 'Renew membership' : 'Start membership'}
                </Button>
                <Button icon="wallet" block onClick={() => setDialog('payment')}>
                  Record payment{dues.due > 0 ? ` · ${money(dues.due)} due` : ''}
                </Button>
                <div className="u-row u-gap-2">
                  <Button icon="edit" className="u-grow" onClick={() => setDialog('edit')}>Edit</Button>
                  <Button icon="note" className="u-grow" onClick={() => setDialog('note')}>Note</Button>
                </div>
                <Button variant="ghost" icon="trash" block onClick={remove}
                  style={{ color: 'var(--critical)' }}>
                  Delete member
                </Button>
              </div>
            </CardBody>
          </Card>

          {member.emergencyContact.name && (
            <Card>
              <CardHead title="Emergency contact" />
              <CardBody>
                <KV k="Name">{member.emergencyContact.name}</KV>
                <KV k="Relationship">{member.emergencyContact.relation || '—'}</KV>
                <KV k="Phone">{member.emergencyContact.phone ? phoneMask(member.emergencyContact.phone) : '—'}</KV>
              </CardBody>
            </Card>
          )}
        </div>

        {/* ---------------- detail column ---------------- */}
        <div>
          <Card>
            <div style={{ padding: '0 var(--s-4)' }}>
              <Tabs value={tab} onChange={setTab} tabs={tabs} ariaLabel="Member sections" />
            </div>
            <CardBody>
              {tab === 'overview' && <OverviewTab id={id} />}
              {tab === 'membership' && <MembershipTab id={id} onRenew={() => setDialog('renew')} />}
              {tab === 'payments' && <PaymentsTab id={id} onRecord={() => setDialog('payment')} />}
              {tab === 'attendance' && <AttendanceTab id={id} />}
              {tab === 'workout' && <WorkoutTab id={id} />}
              {tab === 'diet' && <DietTab id={id} />}
              {tab === 'progress' && <ProgressTab id={id} />}
              {tab === 'notes' && <NotesTab id={id} onAdd={() => setDialog('note')} />}
            </CardBody>
          </Card>
        </div>
      </div>

      {dialog === 'renew' && <RenewMembershipDialog memberId={id} onClose={() => setDialog(null)} />}
      {dialog === 'payment' && <RecordPaymentDialog memberId={id} onClose={() => setDialog(null)} />}
      {dialog === 'note' && <AddNoteDialog memberId={id} onClose={() => setDialog(null)} />}
      {dialog === 'edit' && <EditMemberDialog memberId={id} onClose={() => setDialog(null)} />}
    </div>
  );
}

function ContactRow({ icon, label, href }: { icon: 'phone' | 'mail' | 'pin' | 'calendar'; label: string; href?: string }) {
  const body = (
    <span className="u-row u-gap-3 t-sm" style={{ minWidth: 0 }}>
      <Icon name={icon} size={15} className="t-faint" />
      <span className="u-truncate">{label}</span>
    </span>
  );
  return href ? <a href={href} style={{ color: 'inherit' }}>{body}</a> : body;
}

/* ================= Overview ================= */
function OverviewTab({ id }: { id: string }) {
  const { session } = useApp();
  const s = useData(() => (session ? api.members.get(session, id) : null), [session?.gymId, id]);
  const stats = useData(() => (session ? api.attendance.stats(session, id, 30) : null), [session?.gymId, id]);
  const logs = useData(() => (session ? api.workouts.logs(session, id, 3) : []), [session?.gymId, id]);
  const measures = useData(() => (session ? api.measurements.list(session, id) : []), [session?.gymId, id]);

  if (!s || !stats) return null;
  const latest = measures[measures.length - 1];
  const first = measures[0];

  return (
    <div className="u-col u-gap-5">
      <div className="grid-stats">
        <StatTile label="Days remaining" icon="clock"
          value={s.membership ? (s.daysLeft >= 0 ? count(s.daysLeft) : 'Expired') : '—'}
          hint={s.membership ? `until ${dateShort(s.membership.endDate)}` : 'no active plan'} />
        <StatTile label="Balance due" icon="wallet"
          value={s.dues.due > 0 ? money(s.dues.due) : 'Nil'}
          hint={`paid ${money(s.dues.paid)} of ${money(s.dues.billed)}`}
          accent={s.dues.due > 0 ? 'var(--critical)' : undefined} />
        <StatTile label="Visits (30 days)" icon="calendarCheck" value={count(stats.visits)}
          hint={`${pct(stats.percentage)} attendance`} />
        <StatTile label="Current streak" icon="flame" value={`${stats.streak}d`}
          hint={`best ${stats.best} days`} />
      </div>

      <div className="grid-2">
        <div>
          <h3 className="t-label u-mb-3">Latest measurements</h3>
          {latest ? (
            <Card><CardBody>
              <KV k="Weight">
                {latest.weightKg} kg
                {first && latest.weightKg !== first.weightKg && (
                  <span className="t-xs" style={{ marginLeft: 8, color: latest.weightKg < first.weightKg ? 'var(--good)' : 'var(--text-3)' }}>
                    {latest.weightKg < first.weightKg ? '−' : '+'}
                    {Math.abs(latest.weightKg - first.weightKg).toFixed(1)} kg since joining
                  </span>
                )}
              </KV>
              {latest.bodyFatPct != null && <KV k="Body fat">{latest.bodyFatPct}%</KV>}
              {latest.waistCm != null && <KV k="Waist">{latest.waistCm} cm</KV>}
              {latest.chestCm != null && <KV k="Chest">{latest.chestCm} cm</KV>}
              <KV k="Recorded">{dateShort(latest.takenAt)}</KV>
            </CardBody></Card>
          ) : (
            <EmptyState icon="ruler" title="No measurements yet"
              message="The member can record weight and body measurements from their app." />
          )}
        </div>

        <div>
          <h3 className="t-label u-mb-3">Recent workouts</h3>
          {logs.length ? (
            <Card><CardBody flush>
              <ul className="cardlist">
                {logs.map((l) => (
                  <li key={l.id} className="cardlist__item" style={{ cursor: 'default' }}>
                    <span className="u-grow">
                      <span className="t-sm" style={{ fontWeight: 560 }}>{dateShort(l.date)}</span>
                      <span className="t-xs t-faint" style={{ display: 'block' }}>
                        {l.sets.length} sets · {l.durationMin} min
                      </span>
                    </span>
                    <Badge>{new Set(l.sets.map((x) => x.exerciseId)).size} exercises</Badge>
                  </li>
                ))}
              </ul>
            </CardBody></Card>
          ) : (
            <EmptyState icon="dumbbell" title="No workouts logged"
              message="Nothing recorded from the member app yet." />
          )}
        </div>
      </div>
    </div>
  );
}

/* ================= Membership ================= */
function MembershipTab({ id, onRenew }: { id: string; onRenew: () => void }) {
  const { session } = useApp();
  const rows = useData(() => (session ? api.memberships.forMember(session, id) : []), [session?.gymId, id]);
  const pays = useData(() => (session ? api.payments.forMember(session, id) : []), [session?.gymId, id]);
  const today = todayISO();

  if (!rows.length) {
    return (
      <EmptyState icon="card" title="No membership yet"
        message="This member has never been sold a plan."
        action={<Button variant="primary" icon="plus" onClick={onRenew}>Start membership</Button>} />
    );
  }

  return (
    <div className="u-col u-gap-4">
      <div className="u-between">
        <h3 className="t-label">Membership history</h3>
        <Button size="sm" icon="refresh" onClick={onRenew}>Renew</Button>
      </div>
      <ul className="u-col u-gap-3">
        {rows.map((m) => {
          const billed = Math.max(0, m.priceSnapshot - m.discount);
          const paid = pays.filter((p) => p.membershipId === m.id).reduce((s, p) => s + p.amount, 0);
          const current = m.startDate <= today && m.endDate >= today;
          return (
            <li key={m.id}>
              <Card style={current ? { borderColor: 'var(--brand)' } : undefined}>
                <CardBody>
                  <div className="u-between u-gap-3 u-wrap">
                    <div>
                      <div className="u-row u-gap-2">
                        <span className="t-h3">{m.planNameSnapshot}</span>
                        <Badge tone={m.kind === 'new' ? 'brand' : 'neutral'}>
                          {m.kind === 'new' ? 'New' : 'Renewal'}
                        </Badge>
                        {current && <Badge tone="good" dot>Current</Badge>}
                      </div>
                      <div className="t-xs t-faint u-mt-2">
                        {dateShort(m.startDate)} → {dateShort(m.endDate)} · sold {dateShort(m.createdAt)}
                      </div>
                    </div>
                    <div className="u-right">
                      <div className="t-sm u-num" style={{ fontWeight: 620 }}>{money(billed)}</div>
                      <div className="t-xs t-faint">
                        {m.discount > 0 && <>{money(m.priceSnapshot)} − {money(m.discount)} · </>}
                        paid {money(paid)}
                        {paid < billed && <span style={{ color: 'var(--critical)' }}> · {money(billed - paid)} due</span>}
                      </div>
                    </div>
                  </div>
                  {billed > 0 && (
                    <div className="u-mt-4">
                      <Meter value={paid} max={billed} tone={paid >= billed ? 'good' : 'warning'}
                        label={`${Math.round((paid / billed) * 100)}% collected`} />
                    </div>
                  )}
                </CardBody>
              </Card>
            </li>
          );
        })}
      </ul>
      <p className="t-xs t-faint">
        Plan name and price are stored on each membership as sold — later price changes never
        rewrite this history.
      </p>
    </div>
  );
}

/* ================= Payments ================= */
function PaymentsTab({ id, onRecord }: { id: string; onRecord: () => void }) {
  const { session } = useApp();
  const rows = useData(() => (session ? api.payments.forMember(session, id) : []), [session?.gymId, id]);
  const s = useData(() => (session ? api.members.get(session, id) : null), [session?.gymId, id]);

  if (!rows.length) {
    return (
      <EmptyState icon="wallet" title="No payments recorded"
        message="Nothing has been collected from this member yet."
        action={<Button variant="primary" icon="plus" onClick={onRecord}>Record payment</Button>} />
    );
  }

  const total = rows.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="u-col u-gap-4">
      <div className="grid-stats">
        <StatTile label="Lifetime value" icon="trendingUp" value={money(total)} hint={`${rows.length} payments`} />
        <StatTile label="Current balance" icon="wallet"
          value={s && s.dues.due > 0 ? money(s.dues.due) : 'Nil'}
          accent={s && s.dues.due > 0 ? 'var(--critical)' : undefined} hint="on the active plan" />
      </div>
      <div className="u-between">
        <h3 className="t-label">Payment history</h3>
        <Button size="sm" icon="plus" onClick={onRecord}>Record payment</Button>
      </div>
      <ul className="cardlist" style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
        {rows.map((p) => (
          <li key={p.id} className="cardlist__item" style={{ cursor: 'default' }}>
            <span style={{
              width: 34, height: 34, flex: 'none', display: 'grid', placeItems: 'center',
              borderRadius: 'var(--r-md)', background: 'var(--good-soft)', color: 'var(--good)',
            }}>
              <Icon name="arrowDown" size={16} />
            </span>
            <span className="u-grow" style={{ minWidth: 0 }}>
              <span className="t-sm" style={{ fontWeight: 560 }}>{money(p.amount)}</span>
              <span className="t-xs t-faint" style={{ display: 'block' }}>
                {dateShort(p.paidAt)} · {time(p.paidAt)} · {titleCase(p.method)} · {p.receiptNo}
              </span>
              {p.note && <span className="t-xs t-faint">{p.note}</span>}
            </span>
            <Badge>{titleCase(p.source)}</Badge>
          </li>
        ))}
      </ul>
      <p className="t-xs t-faint">
        Payments are immutable. A mistake is corrected with a reversing entry, never an edit —
        that is what keeps every past report reproducible.
      </p>
    </div>
  );
}

/* ================= Attendance ================= */
function AttendanceTab({ id }: { id: string }) {
  const { session } = useApp();
  const events = useData(() => (session ? api.attendance.forMember(session, id) : []), [session?.gymId, id]);
  const stats = useData(() => (session ? api.attendance.stats(session, id, 30) : null), [session?.gymId, id]);
  const today = todayISO();

  if (!events.length || !stats) {
    return <EmptyState icon="calendarCheck" title="No attendance recorded"
      message="This member has not checked in yet. Mark attendance from the Attendance screen." />;
  }

  const attended = new Set(events.filter((e) => e.type === 'check_in').map((e) => e.at.slice(0, 10)));
  const strip = rangeDays(addDays(today, -83), today).map((d) => ({
    date: d, value: attended.has(d) ? 1 : 0, label: dateLong(d),
  }));

  const sessions: Array<{ date: string; inAt: string; outAt: string | null }> = [];
  const byDay = new Map<string, typeof events>();
  events.forEach((e) => {
    const d = e.at.slice(0, 10);
    byDay.set(d, [...(byDay.get(d) ?? []), e]);
  });
  [...byDay.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 20).forEach(([d, list]) => {
    const ins = list.filter((e) => e.type === 'check_in').sort((a, b) => a.at.localeCompare(b.at));
    const outs = list.filter((e) => e.type === 'check_out').sort((a, b) => a.at.localeCompare(b.at));
    if (ins.length) sessions.push({ date: d, inAt: ins[0].at, outAt: outs.length ? outs[outs.length - 1].at : null });
  });

  return (
    <div className="u-col u-gap-5">
      <div className="grid-stats">
        <StatTile label="Visits (30 days)" icon="calendarCheck" value={count(stats.visits)} />
        <StatTile label="Attendance rate" icon="target" value={pct(stats.percentage)} hint="of the last 30 days" />
        <StatTile label="Current streak" icon="flame" value={`${stats.streak}d`} />
        <StatTile label="Best streak" icon="zap" value={`${stats.best}d`} />
      </div>

      <div>
        <h3 className="t-label u-mb-3">Last 12 weeks</h3>
        <HeatStrip days={strip} format={(v) => (v ? 'Attended' : 'No visit')} />
      </div>

      <div>
        <h3 className="t-label u-mb-3">Recent sessions</h3>
        <ul className="cardlist" style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
          {sessions.map((s) => (
            <li key={s.date} className="cardlist__item" style={{ cursor: 'default' }}>
              <span className="u-grow">
                <span className="t-sm" style={{ fontWeight: 560 }}>{dateShort(s.date)}</span>
                <span className="t-xs t-faint" style={{ display: 'block' }}>{relativeDay(s.date)}</span>
              </span>
              <span className="u-right">
                <span className="t-sm u-num">{time(s.inAt)}{s.outAt ? ` → ${time(s.outAt)}` : ''}</span>
                <span className="t-xs t-faint" style={{ display: 'block' }}>
                  {s.outAt ? 'first in → last out' : 'no check-out recorded'}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ================= Workout ================= */
function WorkoutTab({ id }: { id: string }) {
  const { session, toast } = useApp();
  const plan = useData(() => (session ? api.workouts.planFor(session, id) : null), [session?.gymId, id]);
  const templates = useData(() => (session ? api.workouts.templates(session) : []), [session?.gymId]);
  const logs = useData(() => (session ? api.workouts.logs(session, id, 10) : []), [session?.gymId, id]);
  const [busy, setBusy] = useState(false);

  const assign = async () => {
    if (!session || !templates[0]) return;
    setBusy(true);
    try {
      await api.workouts.assignTemplate(session, id, templates[0].id);
      toast('success', 'Workout plan assigned', templates[0].name);
    } catch (e) {
      toast('error', 'Could not assign plan', errorMessage(e));
    } finally { setBusy(false); }
  };

  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return (
    <div className="u-col u-gap-5">
      {plan ? (
        <div>
          <div className="u-between u-mb-3">
            <h3 className="t-label">Assigned plan · {plan.name}</h3>
            <Badge tone="brand">{plan.exercises.length} exercises</Badge>
          </div>
          <div className="u-col u-gap-4">
            {[1, 2, 3, 4, 5, 6, 0].map((d) => {
              const items = plan.exercises.filter((e) => e.dayOfWeek === d).sort((a, b) => a.order - b.order);
              if (!items.length) return null;
              return (
                <Card key={d}>
                  <CardHead title={DAYS[d]} subtitle={`${items.length} exercises`} />
                  <CardBody flush>
                    <ul className="cardlist">
                      {items.map((x) => (
                        <li key={x.id} className="cardlist__item" style={{ cursor: 'default' }}>
                          <span className="u-grow" style={{ minWidth: 0 }}>
                            <span className="t-sm" style={{ fontWeight: 560 }}>{api.workouts.exerciseName(x.exerciseId)}</span>
                            {x.instructions && <span className="t-xs t-faint" style={{ display: 'block' }}>{x.instructions}</span>}
                          </span>
                          <span className="t-xs u-num t-muted u-nowrap">
                            {x.sets} × {x.reps}{x.targetWeight ? ` · ${x.targetWeight} kg` : ''}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </CardBody>
                </Card>
              );
            })}
          </div>
        </div>
      ) : (
        <EmptyState
          icon="dumbbell" title="No workout plan assigned"
          message="Assign a plan so the member sees a structured routine in their app."
          action={templates[0]
            ? <Button variant="primary" icon="plus" onClick={assign} loading={busy}>Assign “{templates[0].name}”</Button>
            : undefined}
        />
      )}

      <div>
        <h3 className="t-label u-mb-3">Completed workouts</h3>
        {logs.length === 0 ? (
          <p className="t-sm t-faint">Nothing logged from the member app yet.</p>
        ) : (
          <ul className="cardlist" style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
            {logs.map((l) => (
              <li key={l.id} className="cardlist__item" style={{ cursor: 'default' }}>
                <span className="u-grow">
                  <span className="t-sm" style={{ fontWeight: 560 }}>{dateShort(l.date)}</span>
                  <span className="t-xs t-faint" style={{ display: 'block' }}>
                    {[...new Set(l.sets.map((s) => api.workouts.exerciseName(s.exerciseId)))].slice(0, 3).join(', ')}
                    {new Set(l.sets.map((s) => s.exerciseId)).size > 3 && '…'}
                  </span>
                </span>
                <span className="t-xs u-num t-muted u-nowrap">{l.sets.length} sets · {l.durationMin} min</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ================= Diet ================= */
function DietTab({ id }: { id: string }) {
  const { session, toast } = useApp();
  const plan = useData(() => (session ? api.diet.planFor(session, id) : null), [session?.gymId, id]);
  const templates = useData(() => (session ? api.diet.templates(session) : []), [session?.gymId]);
  const [busy, setBusy] = useState(false);

  const assign = async () => {
    if (!session || !templates[0]) return;
    setBusy(true);
    try {
      await api.diet.assignTemplate(session, id, templates[0].id);
      toast('success', 'Diet plan assigned', templates[0].name);
    } catch (e) {
      toast('error', 'Could not assign plan', errorMessage(e));
    } finally { setBusy(false); }
  };

  if (!plan) {
    return (
      <EmptyState
        icon="utensils" title="No diet plan assigned"
        message="Assign a diet plan and the member will see it in their app, meal by meal."
        action={templates[0]
          ? <Button variant="primary" icon="plus" onClick={assign} loading={busy}>Assign “{templates[0].name}”</Button>
          : undefined}
      />
    );
  }

  const MEALS = ['breakfast', 'lunch', 'snack', 'dinner'] as const;
  const totals = plan.items.reduce((a, i) => ({
    kcal: a.kcal + i.calories, p: a.p + i.protein, c: a.c + i.carbs, f: a.f + i.fat,
  }), { kcal: 0, p: 0, c: 0, f: 0 });

  return (
    <div className="u-col u-gap-4">
      <div className="u-between u-wrap u-gap-3">
        <h3 className="t-label">{plan.name}</h3>
        <div className="u-row u-gap-2 u-wrap">
          <Badge tone="brand">{totals.kcal} kcal</Badge>
          <Badge>{totals.p} g protein</Badge>
          <Badge>{totals.c} g carbs</Badge>
          <Badge>{totals.f} g fat</Badge>
          <Badge icon="droplet">{plan.waterTargetL} L water</Badge>
        </div>
      </div>
      {MEALS.map((meal) => {
        const items = plan.items.filter((i) => i.meal === meal);
        if (!items.length) return null;
        return (
          <Card key={meal}>
            <CardHead title={titleCase(meal)}
              subtitle={`${items.reduce((s, i) => s + i.calories, 0)} kcal`} />
            <CardBody flush>
              <ul className="cardlist">
                {items.map((i) => (
                  <li key={i.id} className="cardlist__item" style={{ cursor: 'default' }}>
                    <span className="u-grow" style={{ minWidth: 0 }}>
                      <span className="t-sm" style={{ fontWeight: 560 }}>{i.item}</span>
                      <span className="t-xs t-faint" style={{ display: 'block' }}>{i.qty}</span>
                    </span>
                    <span className="t-xs u-num t-muted u-nowrap">{i.calories} kcal · {i.protein}g P</span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}

/* ================= Progress ================= */
function ProgressTab({ id }: { id: string }) {
  const { session } = useApp();
  const rows = useData(() => (session ? api.measurements.list(session, id) : []), [session?.gymId, id]);

  if (rows.length < 1) {
    return <EmptyState icon="ruler" title="No progress data"
      message="Weight and body measurements recorded by the member will appear here." />;
  }

  const points = rows.map((r) => ({ x: r.takenAt, label: r.takenAt, y: r.weightKg }));
  const first = rows[0], last = rows[rows.length - 1];
  const change = last.weightKg - first.weightKg;

  return (
    <div className="u-col u-gap-5">
      <div className="grid-stats">
        <StatTile label="Current weight" icon="scale" value={`${last.weightKg} kg`} hint={dateShort(last.takenAt)} />
        <StatTile label="Change" icon="trendingUp"
          value={`${change > 0 ? '+' : change < 0 ? '−' : ''}${Math.abs(change).toFixed(1)} kg`}
          deltaTone={change <= 0 ? 'good' : 'neutral'} hint={`since ${dateShort(first.takenAt)}`} />
        {last.bodyFatPct != null && <StatTile label="Body fat" icon="activity" value={`${last.bodyFatPct}%`} />}
        {last.waistCm != null && <StatTile label="Waist" icon="ruler" value={`${last.waistCm} cm`} />}
      </div>

      {points.length > 1 && (
        <div>
          <h3 className="t-label u-mb-3">Body weight</h3>
          <LineChart
            area height={220} yMinZero={false}
            format={(v) => `${v.toFixed(1)} kg`}
            xLabel={(p) => dayLabel(p.label)}
            series={[{ key: 'w', label: 'Weight', color: SERIES.s1, points }]}
          />
        </div>
      )}

      <div>
        <h3 className="t-label u-mb-3">Measurement history</h3>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Date</th><th scope="col">Weight</th><th scope="col">Chest</th>
                <th scope="col">Waist</th><th scope="col">Arms</th><th scope="col">Body fat</th>
              </tr>
            </thead>
            <tbody>
              {[...rows].reverse().slice(0, 12).map((r) => (
                <tr key={r.id}>
                  <td className="t-sm">{dateShort(r.takenAt)}</td>
                  <td className="cell-num">{r.weightKg} kg</td>
                  <td className="cell-num">{r.chestCm ?? '—'}</td>
                  <td className="cell-num">{r.waistCm ?? '—'}</td>
                  <td className="cell-num">{r.armsCm ?? '—'}</td>
                  <td className="cell-num">{r.bodyFatPct != null ? `${r.bodyFatPct}%` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ================= Notes ================= */
function NotesTab({ id, onAdd }: { id: string; onAdd: () => void }) {
  const { session } = useApp();
  const notes = useData(() => (session ? api.members.notes(session, id) : []), [session?.gymId, id]);

  if (!notes.length) {
    return <EmptyState icon="note" title="No notes yet"
      message="Internal notes are visible to gym staff only — never to the member."
      action={<Button variant="primary" icon="plus" onClick={onAdd}>Add note</Button>} />;
  }

  return (
    <div className="u-col u-gap-4">
      <div className="u-between">
        <h3 className="t-label">Internal notes</h3>
        <Button size="sm" icon="plus" onClick={onAdd}>Add note</Button>
      </div>
      <ul className="u-col u-gap-3">
        {notes.map((n) => (
          <li key={n.id}>
            <Card><CardBody>
              <p className="t-sm">{n.body}</p>
              <div className="t-xs t-faint u-mt-3">
                {n.authorName} · {titleCase(n.authorRole)} · {dateShort(n.createdAt)}
              </div>
            </CardBody></Card>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ================= Edit dialog ================= */
function EditMemberDialog({ memberId, onClose }: { memberId: string; onClose: () => void }) {
  const { session, toast } = useApp();
  const s = useData(() => (session ? api.members.get(session, memberId) : null), [session?.gymId, memberId]);
  const m = s?.member;

  const [form, setForm] = useState(() => ({
    name: m?.name ?? '', phone: m?.phone ?? '', email: m?.email ?? '', dob: m?.dob ?? '',
    gender: (m?.gender ?? 'male') as Gender, address: m?.address ?? '',
    emergencyName: m?.emergencyContact.name ?? '', emergencyPhone: m?.emergencyContact.phone ?? '',
    emergencyRelation: m?.emergencyContact.relation ?? '',
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!session) return;
    setBusy(true); setErrors({});
    try {
      await api.members.update(session, memberId, form);
      toast('success', 'Member updated');
      onClose();
    } catch (e) {
      setErrors(fieldErrors(e));
      if (!Object.keys(fieldErrors(e)).length) toast('error', 'Could not save changes', errorMessage(e));
    } finally { setBusy(false); }
  };

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Modal
      title="Edit member" wide onClose={onClose}
      footer={<>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={submit} loading={busy}>Save changes</Button>
      </>}
    >
      <div className="form-grid">
        <TextField label="Full name" required className="span-2" value={form.name}
          error={errors.name} onChange={(e) => set('name', e.target.value)} />
        <TextField label="Phone" required value={form.phone} error={errors.phone}
          onChange={(e) => set('phone', e.target.value)} />
        <TextField label="Email" type="email" value={form.email} error={errors.email}
          onChange={(e) => set('email', e.target.value)} />
        <DateField label="Date of birth" value={form.dob} max={todayISO()} error={errors.dob}
          onChange={(e) => set('dob', e.target.value)} />
        <SelectField label="Gender" value={form.gender} onChange={(e) => set('gender', e.target.value)}
          options={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }, { value: 'other', label: 'Other' }]} />
        <TextareaField label="Address" className="span-2" value={form.address}
          onChange={(e) => set('address', e.target.value)} />
        <TextField label="Emergency contact" value={form.emergencyName}
          onChange={(e) => set('emergencyName', e.target.value)} />
        <TextField label="Emergency phone" value={form.emergencyPhone}
          onChange={(e) => set('emergencyPhone', e.target.value)} />
      </div>
    </Modal>
  );
}
