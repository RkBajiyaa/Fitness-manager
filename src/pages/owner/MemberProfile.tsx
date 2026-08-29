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
import { LevelChip } from '../../components/owner/AttentionQueue';
import { AddNoteDialog, RecordPaymentDialog, RenewMembershipDialog } from '../../components/dialogs';
import { AssignProgramDialog, MessageDialog } from '../../components/dialogs/communication';
import { useApp, useData } from '../../state/app';
import * as api from '../../lib/api';
import type { Gender, MessageKind } from '../../lib/types';
import { bmi, bmiBand, sessionVolume } from '../../lib/derive';
import {
  count, dateLong, dateShort, dayLabel, money, phoneMask, pct, relativeDay, time, titleCase,
} from '../../lib/format';
import { addDays, age, rangeDays, todayISO } from '../../lib/date';

type TabKey =
  | 'overview' | 'membership' | 'payments' | 'attendance' | 'program'
  | 'workout' | 'diet' | 'progress' | 'notes' | 'communication';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function MemberProfile() {
  const { id = '' } = useParams();
  const { session, confirm, toast } = useApp();
  const nav = useNavigate();
  const [tab, setTab] = useState<TabKey>('overview');
  const [dialog, setDialog] = useState<'renew' | 'payment' | 'note' | 'edit' | 'program' | null>(null);
  const [messageKind, setMessageKind] = useState<MessageKind | null>(null);

  const summary = useData(() => {
    if (!session) return null;
    try { return api.members.get(session, id); } catch { return 'missing' as const; }
  }, [session?.gymId, id]);
  const engagement = useData(() => (session ? api.engagement.forMember(session, id) : null), [session?.gymId, id]);

  if (!session) return null;
  if (summary === 'missing' || !summary) {
    return (
      <Card>
        <ErrorState message="That member does not exist in this studio, or has been removed." />
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
          <p>This permanently removes their profile, membership history, attendance, training
            sessions, measurements, goals and notes.</p>
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
    { value: 'program', label: 'Program' },
    { value: 'workout', label: 'Training' },
    { value: 'progress', label: 'Progress' },
    { value: 'diet', label: 'Diet' },
    { value: 'communication', label: 'Communication' },
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
                <div className="u-row u-gap-2 u-wrap" style={{ justifyContent: 'center' }}>
                  <StatusBadge status={status} daysLeft={daysLeft} />
                  {engagement && <LevelChip level={engagement.level} />}
                </div>
              </div>

              {engagement && engagement.signals.length > 0 && (
                <div className="inline-alert u-mt-5" style={{ display: 'block' }}>
                  <div className="t-label u-mb-2">Why they need attention</div>
                  <div className="signals">
                    {engagement.signals.map((s) => (
                      <span key={s.code} className="signal">
                        <span className="signal__dot" style={{
                          background: engagement.level === 'attention' ? 'var(--critical)' : 'var(--warning-mark)',
                        }} />
                        {s.reason}
                      </span>
                    ))}
                  </div>
                </div>
              )}

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
                <Button icon="message" block onClick={() => setMessageKind('custom')}>
                  Send a message
                </Button>
                <div className="u-row u-gap-2">
                  <Button icon="edit" className="u-grow" onClick={() => setDialog('edit')}>Edit</Button>
                  <Button icon="note" className="u-grow" onClick={() => setDialog('note')}>Note</Button>
                </div>
                <Button variant="ghost" icon="trash" block onClick={remove} style={{ color: 'var(--critical)' }}>
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
              {tab === 'payments' && <PaymentsTab id={id} onRecord={() => setDialog('payment')}
                onReceipt={() => setMessageKind('payment_receipt')} />}
              {tab === 'attendance' && <AttendanceTab id={id} />}
              {tab === 'program' && <ProgramTab id={id} onAssign={() => setDialog('program')} />}
              {tab === 'workout' && <TrainingTab id={id} />}
              {tab === 'progress' && <ProgressTab id={id} />}
              {tab === 'diet' && <DietTab id={id} />}
              {tab === 'communication' && <CommunicationTab id={id} onCompose={setMessageKind} />}
              {tab === 'notes' && <NotesTab id={id} onAdd={() => setDialog('note')} />}
            </CardBody>
          </Card>
        </div>
      </div>

      {dialog === 'renew' && <RenewMembershipDialog memberId={id} onClose={() => setDialog(null)} />}
      {dialog === 'payment' && <RecordPaymentDialog memberId={id} onClose={() => setDialog(null)} />}
      {dialog === 'note' && <AddNoteDialog memberId={id} onClose={() => setDialog(null)} />}
      {dialog === 'edit' && <EditMemberDialog memberId={id} onClose={() => setDialog(null)} />}
      {dialog === 'program' && <AssignProgramDialog memberId={id} onClose={() => setDialog(null)} />}
      {messageKind && (
        <MessageDialog memberId={id} initialKind={messageKind} onClose={() => setMessageKind(null)} />
      )}
    </div>
  );
}

function ContactRow({ icon, label, href }: {
  icon: 'phone' | 'mail' | 'pin' | 'calendar'; label: string; href?: string;
}) {
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
  const streaks = useData(() => (session ? api.streaks.forMember(session, id) : null), [session?.gymId, id]);
  const sessions = useData(() => (session ? api.sessions.completed(session, id).slice(0, 4) : []), [session?.gymId, id]);
  const records = useData(() => (session ? api.records.forMember(session, id) : []), [session?.gymId, id]);
  const measures = useData(() => (session ? api.measurements.list(session, id) : []), [session?.gymId, id]);
  const program = useData(() => (session ? api.programs.forMember(session, id) : null), [session?.gymId, id]);

  if (!s || !streaks) return null;
  const latest = measures[measures.length - 1];
  const first = measures[0];

  return (
    <div className="u-col u-gap-5">
      <div className="grid-stats">
        <StatTile label="Training streak" icon="flame" value={`${streaks.training.current}d`}
          accent="var(--accent)" hint={`best ${streaks.training.longest}`} />
        <StatTile label="Sessions this month" icon="dumbbell" value={count(streaks.sessionsThisMonth)}
          hint={`${streaks.weekly.hit} of 8 weeks on target`} />
        <StatTile label="Gym visits (30d)" icon="calendarCheck" value={count(streaks.visitStats.visits)}
          hint={pct(streaks.visitStats.percentage)} />
        <StatTile label="Balance due" icon="wallet"
          value={s.dues.due > 0 ? money(s.dues.due) : 'Nil'}
          hint={`paid ${money(s.dues.paid)} of ${money(s.dues.billed)}`}
          accent={s.dues.due > 0 ? 'var(--critical)' : undefined} />
      </div>

      <div className="grid-2">
        <div>
          <h3 className="t-label u-mb-3">Fitness profile</h3>
          <Card><CardBody>
            <KV k="Goal">{titleCase(s.member.fitness.goal)}</KV>
            <KV k="Experience">{titleCase(s.member.fitness.experience)}</KV>
            <KV k="Height">{s.member.fitness.heightCm ? `${s.member.fitness.heightCm} cm` : '—'}</KV>
            <KV k="Current weight">{latest ? `${latest.weightKg} kg` : '—'}</KV>
            <KV k="Target weight">{s.member.fitness.targetWeightKg ? `${s.member.fitness.targetWeightKg} kg` : '—'}</KV>
            <KV k="Weekly target">{s.member.fitness.weeklySessionTarget} sessions</KV>
            <KV k="Program">{program ? program.name : 'None assigned'}</KV>
            {first && latest && latest.weightKg !== first.weightKg && (
              <KV k="Weight change">
                <span style={{ color: latest.weightKg < first.weightKg ? 'var(--good)' : 'var(--text-2)' }}>
                  {latest.weightKg < first.weightKg ? '−' : '+'}
                  {Math.abs(latest.weightKg - first.weightKg).toFixed(1)} kg since joining
                </span>
              </KV>
            )}
          </CardBody></Card>
          {s.member.fitness.notes && (
            <p className="quiet-note u-mt-3">“{s.member.fitness.notes}”</p>
          )}
        </div>

        <div>
          <h3 className="t-label u-mb-3">Best lifts</h3>
          {records.length ? (
            <Card><CardBody flush>
              <ul className="cardlist">
                {records.slice(0, 5).map((r) => (
                  <li key={r.exerciseId} className="cardlist__item" style={{ cursor: 'default' }}>
                    <span className="u-grow u-truncate">
                      <span className="t-sm" style={{ fontWeight: 550 }}>{r.exerciseName}</span>
                      <span className="t-xs t-faint" style={{ display: 'block' }}>
                        {r.heaviestKg} kg × {r.bestReps}
                        {r.heaviestAt ? ` · ${dateShort(r.heaviestAt)}` : ''}
                      </span>
                    </span>
                    <span className="prbadge">
                      <Icon name="trophy" size={11} />{r.best1RM.toFixed(0)} kg
                    </span>
                  </li>
                ))}
              </ul>
            </CardBody></Card>
          ) : (
            <EmptyState icon="trophy" title="No records yet"
              message="Nothing logged from the member app so far." />
          )}
        </div>
      </div>

      <div>
        <h3 className="t-label u-mb-3">Recent sessions</h3>
        {sessions.length ? (
          <Card><CardBody flush>
            <ul className="cardlist">
              {sessions.map((l) => (
                <li key={l.id} className="cardlist__item" style={{ cursor: 'default' }}>
                  <span className="u-grow">
                    <span className="t-sm" style={{ fontWeight: 560 }}>{l.title}</span>
                    <span className="t-xs t-faint" style={{ display: 'block' }}>
                      {dateShort(l.date)} · {l.sets.filter((x) => x.kind !== 'warmup').length} sets ·
                      {' '}{Math.round(sessionVolume(l)).toLocaleString('en-IN')} kg
                    </span>
                  </span>
                  <Badge>{new Set(l.sets.map((x) => x.exerciseId)).size} exercises</Badge>
                </li>
              ))}
            </ul>
          </CardBody></Card>
        ) : (
          <EmptyState icon="dumbbell" title="No sessions logged"
            message="Nothing recorded from the member app yet." />
        )}
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
      <p className="quiet-note">
        Plan name and price are stored on each membership as sold — later price changes never
        rewrite this history.
      </p>
    </div>
  );
}

/* ================= Payments ================= */
function PaymentsTab({ id, onRecord, onReceipt }: {
  id: string; onRecord: () => void; onReceipt: () => void;
}) {
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
        <div className="u-row u-gap-2">
          <Button size="sm" icon="send" onClick={onReceipt}>Send receipt</Button>
          <Button size="sm" icon="plus" onClick={onRecord}>Record</Button>
        </div>
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
      <p className="quiet-note">
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
  const streaks = useData(() => (session ? api.streaks.forMember(session, id) : null), [session?.gymId, id]);
  const today = todayISO();

  if (!events.length || !streaks) {
    return <EmptyState icon="calendarCheck" title="No attendance recorded"
      message="This member has not checked in yet." />;
  }

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
    .slice(0, 20);

  return (
    <div className="u-col u-gap-5">
      <div className="grid-stats">
        <StatTile label="Visits (30 days)" icon="calendarCheck" value={count(streaks.visitStats.visits)} />
        <StatTile label="Attendance rate" icon="target" value={pct(streaks.visitStats.percentage)} />
        <StatTile label="Visit streak" icon="flame" value={`${streaks.attendance.current}d`} />
        <StatTile label="Best streak" icon="trophy" value={`${streaks.attendance.longest}d`} />
      </div>

      <div>
        <h3 className="t-label u-mb-3">Last 12 weeks</h3>
        <HeatStrip days={strip} format={(v) => (v ? 'Attended' : 'No visit')} />
      </div>

      <div>
        <h3 className="t-label u-mb-3">Recent visits</h3>
        <ul className="cardlist" style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
          {visits.map((s) => (
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

/* ================= Program ================= */
function ProgramTab({ id, onAssign }: { id: string; onAssign: () => void }) {
  const { session, confirm, toast } = useApp();
  const program = useData(() => (session ? api.programs.forMember(session, id) : null), [session?.gymId, id]);
  const sessions = useData(() => (session ? api.sessions.completed(session, id) : []), [session?.gymId, id]);

  if (!session) return null;

  if (!program) {
    return (
      <EmptyState icon="route" title="No program assigned"
        message="Assign a program and this member will open the app to a clear plan for today — the single biggest difference between a premium studio and a gym membership."
        action={<Button variant="primary" icon="plus" onClick={onAssign}>Assign a program</Button>} />
    );
  }

  const sessionDays = new Set(sessions.map((s) => s.date));
  const adh = api.adherence(program, sessionDays, 14);

  const unassign = async () => {
    const ok = await confirm({
      title: 'Remove this program?',
      message: 'The member will no longer see a planned session. Their completed history is untouched.',
      confirmLabel: 'Remove program',
      tone: 'danger',
    });
    if (!ok) return;
    await api.programs.unassign(session, id);
    toast('success', 'Program removed');
  };

  return (
    <div className="u-col u-gap-4">
      <Card>
        <CardBody>
          <div className="u-between u-gap-3 u-wrap">
            <div>
              <div className="u-row u-gap-2">
                <span className="t-h3">{program.name}</span>
                {program.kind === 'onboarding' && <Badge tone="brand">Onboarding</Badge>}
              </div>
              <p className="t-sm t-muted u-mt-2">{program.description}</p>
              {program.startedAt && (
                <p className="t-xs t-faint u-mt-2">Started {dateShort(program.startedAt)}</p>
              )}
            </div>
            <div className="u-row u-gap-2">
              <Button size="sm" icon="refresh" onClick={onAssign}>Change</Button>
              <Button size="sm" variant="ghost" icon="trash" onClick={unassign}
                aria-label="Remove program" style={{ color: 'var(--critical)' }} />
            </div>
          </div>

          <div className="u-mt-5">
            <div className="u-between u-mb-2">
              <span className="t-sm t-muted">Adherence, last 14 days</span>
              <span className="t-sm u-num" style={{ fontWeight: 620 }}>
                {adh.completed} of {adh.expected} planned sessions
              </span>
            </div>
            <Meter value={adh.completed} max={Math.max(1, adh.expected)}
              tone={adh.ratio >= 0.75 ? 'good' : adh.ratio >= 0.5 ? 'warning' : 'critical'}
              label={`${Math.round(adh.ratio * 100)}% adherence`} />
          </div>
        </CardBody>
      </Card>

      {[1, 2, 3, 4, 5, 6, 0].map((d) => {
        const pd = program.days.find((x) => x.dayIndex === d);
        if (!pd) return null;
        return (
          <Card key={pd.id}>
            <CardHead
              title={pd.title}
              subtitle={pd.isRest ? pd.focus : `${DAYS[d]} · ${pd.exercises.length} exercises`}
              action={pd.isRest ? <Badge>Rest</Badge> : undefined}
            />
            {pd.exercises.length > 0 && (
              <CardBody flush>
                <ul>
                  {pd.exercises.map((x, i) => (
                    <li key={x.id} className="exline">
                      <span className="exline__idx">{i + 1}</span>
                      <span className="u-grow" style={{ minWidth: 0 }}>
                        <span className="exline__name">{api.exercises.name(x.exerciseId)}</span>
                        {x.notes && (
                          <span className="t-xs t-faint" style={{ display: 'block' }}>{x.notes}</span>
                        )}
                      </span>
                      <span className="exline__target u-nowrap">
                        {x.sets} × {x.reps}{x.targetWeightKg ? ` · ${x.targetWeightKg}kg` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardBody>
            )}
            {pd.isRest && pd.notes && (
              <CardBody><p className="t-sm t-muted">{pd.notes}</p></CardBody>
            )}
          </Card>
        );
      })}
    </div>
  );
}

/* ================= Training ================= */
function TrainingTab({ id }: { id: string }) {
  const { session } = useApp();
  const sessions = useData(() => (session ? api.sessions.completed(session, id) : []), [session?.gymId, id]);
  const records = useData(() => (session ? api.records.forMember(session, id) : []), [session?.gymId, id]);

  if (!sessions.length) {
    return <EmptyState icon="dumbbell" title="No training logged"
      message="Nothing recorded from the member app yet." />;
  }

  const volume = sessions.reduce((s, x) => s + sessionVolume(x), 0);

  return (
    <div className="u-col u-gap-5">
      <div className="grid-stats">
        <StatTile label="Sessions" icon="dumbbell" value={count(sessions.length)} hint="all time" />
        <StatTile label="Total volume" icon="zap"
          value={`${Math.round(volume / 1000).toLocaleString('en-IN')}k kg`} hint="reps × weight" />
        <StatTile label="Exercises tracked" icon="library" value={count(records.length)} />
      </div>

      <div>
        <h3 className="t-label u-mb-3">Personal records</h3>
        <ul className="cardlist" style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
          {records.slice(0, 10).map((r) => (
            <li key={r.exerciseId} className="cardlist__item" style={{ cursor: 'default' }}>
              <span className="u-grow u-truncate">
                <span className="t-sm" style={{ fontWeight: 550 }}>{r.exerciseName}</span>
                <span className="t-xs t-faint" style={{ display: 'block' }}>
                  {r.muscleGroup} · {r.totalSets} working sets
                </span>
              </span>
              <span className="u-right u-nowrap">
                <span className="t-sm u-num" style={{ fontWeight: 620 }}>{r.heaviestKg} kg</span>
                <span className="t-xs t-faint" style={{ display: 'block' }}>
                  est. 1RM {r.best1RM.toFixed(0)} kg
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="t-label u-mb-3">Session history</h3>
        <ul className="cardlist" style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
          {sessions.slice(0, 15).map((l) => (
            <li key={l.id} className="cardlist__item" style={{ cursor: 'default' }}>
              <span className="u-grow" style={{ minWidth: 0 }}>
                <span className="t-sm" style={{ fontWeight: 560 }}>{l.title}</span>
                <span className="t-xs t-faint" style={{ display: 'block' }}>
                  {dateShort(l.date)} · {l.sets.filter((s) => s.kind !== 'warmup').length} sets ·
                  {' '}{Math.round(sessionVolume(l)).toLocaleString('en-IN')} kg
                </span>
              </span>
              <span className="t-xs t-faint u-nowrap">{relativeDay(l.date)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ================= Progress ================= */
function ProgressTab({ id }: { id: string }) {
  const { session } = useApp();
  const rows = useData(() => (session ? api.measurements.list(session, id) : []), [session?.gymId, id]);
  const s = useData(() => (session ? api.members.get(session, id) : null), [session?.gymId, id]);
  const goals = useData(() => (session ? api.goals.progress(session, id) : []), [session?.gymId, id]);

  if (!rows.length) {
    return <EmptyState icon="ruler" title="No progress data"
      message="Weight and body measurements recorded by the member will appear here." />;
  }

  const points = rows.map((r) => ({ x: r.takenAt, label: r.takenAt, y: r.weightKg }));
  const first = rows[0], last = rows[rows.length - 1];
  const change = last.weightKg - first.weightKg;
  const bmiValue = bmi(last.weightKg, s?.member.fitness.heightCm ?? last.heightCm);

  return (
    <div className="u-col u-gap-5">
      <div className="grid-stats">
        <StatTile label="Current weight" icon="scale" value={`${last.weightKg} kg`} hint={dateShort(last.takenAt)} />
        <StatTile label="Change" icon="trendingUp"
          value={`${change > 0 ? '+' : change < 0 ? '−' : ''}${Math.abs(change).toFixed(1)} kg`}
          hint={`since ${dateShort(first.takenAt)}`} />
        {bmiValue && <StatTile label="BMI" icon="activity" value={bmiValue.toFixed(1)}
          hint={bmiBand(bmiValue).label} />}
        {last.bodyFatPct != null && <StatTile label="Body fat" icon="target" value={`${last.bodyFatPct}%`} />}
      </div>

      {points.length > 1 && (
        <div>
          <h3 className="t-label u-mb-3">Body weight</h3>
          <LineChart area height={220} yMinZero={false}
            format={(v) => `${v.toFixed(1)} kg`} xLabel={(p) => dayLabel(p.label)}
            series={[{ key: 'w', label: 'Weight', color: SERIES.s1, points }]} />
        </div>
      )}

      {goals.length > 0 && (
        <div>
          <h3 className="t-label u-mb-3">Goals</h3>
          <ul className="u-col u-gap-3">
            {goals.map((g) => (
              <li key={g.goal.id}>
                <div className="u-between u-mb-2">
                  <span className="t-sm">{g.goal.label}</span>
                  <span className="t-xs t-faint u-num">
                    {g.current.toFixed(g.goal.unit === 'kg' ? 1 : 0)} / {g.target} {g.goal.unit}
                  </span>
                </div>
                <Meter value={g.ratio * 100} max={100} tone={g.achieved ? 'good' : undefined}
                  label={`${Math.round(g.ratio * 100)}% of goal`} />
              </li>
            ))}
          </ul>
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

/* ================= Diet ================= */
function DietTab({ id }: { id: string }) {
  const { session, toast } = useApp();
  const plan = useData(() => (session ? api.diet.planFor(session, id) : null), [session?.gymId, id]);
  const templates = useData(() => (session ? api.diet.templates(session) : []), [session?.gymId]);
  const done = useData(() => (session ? api.diet.completions(session, id) : new Set<string>()), [session?.gymId, id]);
  const [busy, setBusy] = useState(false);

  const assign = async () => {
    if (!session || !templates[0]) return;
    setBusy(true);
    try {
      await api.diet.assignTemplate(session, id, templates[0].id);
      toast('success', 'Diet plan assigned', templates[0].name);
    } catch (e) { toast('error', 'Could not assign the plan', errorMessage(e)); }
    finally { setBusy(false); }
  };

  if (!plan) {
    return (
      <EmptyState icon="utensils" title="No diet plan assigned"
        message="Assign a plan and the member will see it in their app, meal by meal."
        action={templates[0]
          ? <Button variant="primary" icon="plus" onClick={assign} loading={busy}>
              Assign “{templates[0].name}”
            </Button>
          : undefined} />
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
          <Badge icon="droplet">{plan.waterTargetL} L</Badge>
          <Badge tone={done.size > 0 ? 'good' : 'neutral'}>{done.size}/{plan.items.length} eaten today</Badge>
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
                    <span style={{
                      width: 22, height: 22, flex: 'none', display: 'grid', placeItems: 'center',
                      borderRadius: '50%',
                      background: done.has(i.id) ? 'var(--good-soft)' : 'var(--surface-3)',
                      color: done.has(i.id) ? 'var(--good)' : 'var(--text-3)',
                    }}>
                      <Icon name="check" size={11} strokeWidth={2.6} />
                    </span>
                    <span className="u-grow" style={{ minWidth: 0 }}>
                      <span className="t-sm" style={{ fontWeight: 550 }}>{i.item}</span>
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
      <p className="quiet-note">Ticks reflect what the member marked as eaten today.</p>
    </div>
  );
}

/* ================= Communication ================= */
function CommunicationTab({ id, onCompose }: { id: string; onCompose: (k: MessageKind) => void }) {
  const { session } = useApp();
  const rows = useData(() => (session ? api.messages.list(session, id) : []), [session?.gymId, id]);
  const s = useData(() => (session ? api.members.get(session, id) : null), [session?.gymId, id]);
  if (!s) return null;

  const quick: Array<{ kind: MessageKind; label: string; icon: 'wallet' | 'clock' | 'trophy' | 'route' }> = [
    { kind: 'payment_receipt', label: 'Payment receipt', icon: 'wallet' },
    { kind: 'renewal_reminder', label: 'Renewal reminder', icon: 'clock' },
    { kind: 'congratulations', label: 'Congratulations', icon: 'trophy' },
    { kind: 'program_assigned', label: 'Program update', icon: 'route' },
  ];

  return (
    <div className="u-col u-gap-5">
      <div>
        <h3 className="t-label u-mb-3">Send</h3>
        <div className="quickgrid">
          {quick.map((q) => (
            <button key={q.kind} className="quickaction" onClick={() => onCompose(q.kind)}>
              <span className="quickaction__icon"><Icon name={q.icon} size={18} /></span>
              {q.label}
            </button>
          ))}
        </div>
        <Button className="u-mt-3" block icon="message" onClick={() => onCompose('custom')}>
          Write a custom message
        </Button>
      </div>

      <div>
        <h3 className="t-label u-mb-3">History</h3>
        {rows.length === 0 ? (
          <EmptyState icon="message" title="Nothing sent yet"
            message="Messages you send appear here, with their delivery status." />
        ) : (
          <ul className="cardlist" style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
            {rows.map((m) => (
              <li key={m.id} className="cardlist__item" style={{ cursor: 'default', alignItems: 'flex-start' }}>
                <span style={{
                  width: 32, height: 32, flex: 'none', display: 'grid', placeItems: 'center',
                  borderRadius: 'var(--r-md)', background: 'var(--surface-3)', color: 'var(--text-2)',
                }}>
                  <Icon name={m.channel === 'whatsapp' ? 'whatsapp' : m.channel === 'email' ? 'mail' : 'bell'} size={15} />
                </span>
                <span className="u-grow" style={{ minWidth: 0 }}>
                  <span className="u-between u-gap-2">
                    <span className="t-sm" style={{ fontWeight: 560 }}>{m.subject || titleCase(m.kind)}</span>
                    <Badge tone={m.status === 'sent' ? 'good' : 'neutral'}>
                      {m.status === 'simulated' ? 'Logged' : titleCase(m.status)}
                    </Badge>
                  </span>
                  <span className="t-xs t-muted" style={{ display: 'block', marginTop: 3, lineHeight: 1.5 }}>
                    {m.body.slice(0, 160)}{m.body.length > 160 ? '…' : ''}
                  </span>
                  <span className="t-xs t-faint" style={{ display: 'block', marginTop: 4 }}>
                    {titleCase(m.channel)} · {dateShort(m.createdAt)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="inline-alert">
        <Icon name="info" size={16} style={{ flex: 'none', marginTop: 1, color: 'var(--text-2)' }} />
        <span className="t-sm t-muted">
          No delivery provider is connected yet, so messages are composed and logged rather than
          sent. Templates, the log and this screen are already the real thing — connecting WhatsApp
          Business or email is a configuration change.
        </span>
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
      message="Internal notes are visible to studio staff only — never to the member."
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
    <Modal title="Edit member" wide onClose={onClose}
      footer={<>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={submit} loading={busy}>Save changes</Button>
      </>}>
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
