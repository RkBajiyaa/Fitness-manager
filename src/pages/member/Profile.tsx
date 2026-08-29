import { useNavigate } from 'react-router-dom';
import {
  Avatar, Badge, Button, Card, CardBody, CardHead, EmptyState, KV, Meter, StatusBadge,
} from '../../components/ui/primitives';
import { Icon } from '../../components/ui/Icon';
import { useApp, useData } from '../../state/app';
import * as api from '../../lib/api';
import { dateShort, money, phoneMask, time, titleCase } from '../../lib/format';
import { age } from '../../lib/date';

export default function MemberProfilePage() {
  const { session, theme, toggleTheme } = useApp();
  const nav = useNavigate();
  const memberId = session?.memberId ?? '';

  const me = useData(() => (session && memberId ? api.members.get(session, memberId) : null), [memberId]);
  const gym = useData(() => (session ? api.gyms.current(session) : null), [session?.gymId]);
  const payments = useData(() => (session && memberId ? api.payments.forMember(session, memberId) : []), [memberId]);
  const history = useData(() => (session && memberId ? api.memberships.forMember(session, memberId) : []), [memberId]);

  if (!session || !me || !gym) return null;
  const { member, membership, status, daysLeft, dues } = me;

  return (
    <div className="anim-page u-col u-gap-4">
      <Card>
        <CardBody>
          <div className="u-col u-gap-3" style={{ alignItems: 'center', textAlign: 'center' }}>
            <Avatar name={member.name} size="xl" />
            <div>
              <h1 className="t-h2">{member.name}</h1>
              <div className="t-xs t-faint u-mt-2">
                {member.memberCode}
                {age(member.dob) != null && ` · ${age(member.dob)} yrs`}
              </div>
            </div>
            <StatusBadge status={status} daysLeft={daysLeft} />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHead title="Membership" />
        <CardBody>
          {membership ? (
            <>
              <KV k="Plan">{membership.planNameSnapshot}</KV>
              <KV k="Started">{dateShort(membership.startDate)}</KV>
              <KV k="Expires">{dateShort(membership.endDate)}</KV>
              <KV k="Days remaining">{daysLeft >= 0 ? daysLeft : 'Expired'}</KV>
              <KV k="Amount">{money(dues.billed)}</KV>
              <KV k="Paid">{money(dues.paid)}</KV>
              {dues.due > 0 && (
                <>
                  <KV k="Balance"><span style={{ color: 'var(--critical)' }}>{money(dues.due)}</span></KV>
                  <div className="u-mt-3">
                    <Meter value={dues.paid} max={dues.billed} tone="warning"
                      label={`${Math.round((dues.paid / dues.billed) * 100)}% paid`} />
                    <p className="t-xs t-faint u-mt-3">
                      Settle the balance at the front desk — online payment is coming later.
                    </p>
                  </div>
                </>
              )}
            </>
          ) : (
            <EmptyState icon="card" title="No active membership"
              message="Visit the front desk to activate a plan." />
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHead title="Personal details" />
        <CardBody>
          <KV k="Phone">{phoneMask(member.phone)}</KV>
          {member.email && <KV k="Email">{member.email}</KV>}
          {member.dob && <KV k="Date of birth">{dateShort(member.dob)}</KV>}
          <KV k="Gender">{titleCase(member.gender)}</KV>
          {member.address && <KV k="Address"><span style={{ maxWidth: 220, display: 'inline-block' }}>{member.address}</span></KV>}
          <KV k="Member since">{dateShort(member.joinedAt)}</KV>
          {member.emergencyContact.name && (
            <KV k="Emergency contact">
              {member.emergencyContact.name}
              {member.emergencyContact.relation ? ` (${member.emergencyContact.relation})` : ''}
            </KV>
          )}
          <p className="t-xs t-faint u-mt-4">
            Ask the front desk to update these — members cannot edit their own record in this version.
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHead title="Payment history" subtitle={`${payments.length} payments`} />
        <CardBody flush>
          {payments.length === 0 ? (
            <EmptyState icon="wallet" title="No payments yet" />
          ) : (
            <ul className="cardlist">
              {payments.slice(0, 12).map((p) => (
                <li key={p.id} className="cardlist__item" style={{ cursor: 'default' }}>
                  <span style={{
                    width: 34, height: 34, flex: 'none', display: 'grid', placeItems: 'center',
                    borderRadius: 'var(--r-md)', background: 'var(--good-soft)', color: 'var(--good)',
                  }}>
                    <Icon name="check" size={16} />
                  </span>
                  <span className="u-grow" style={{ minWidth: 0 }}>
                    <span className="u-between u-gap-2">
                      <span className="t-sm" style={{ fontWeight: 560 }}>{money(p.amount)}</span>
                      <span className="t-xs t-faint">{dateShort(p.paidAt)}</span>
                    </span>
                    <span className="t-xs t-faint" style={{ display: 'block', marginTop: 2 }}>
                      {titleCase(p.method)} · {time(p.paidAt)} · {p.receiptNo}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {history.length > 1 && (
        <Card>
          <CardHead title="Membership history" />
          <CardBody flush>
            <ul className="cardlist">
              {history.map((m) => (
                <li key={m.id} className="cardlist__item" style={{ cursor: 'default' }}>
                  <span className="u-grow" style={{ minWidth: 0 }}>
                    <span className="t-sm" style={{ fontWeight: 550 }}>{m.planNameSnapshot}</span>
                    <span className="t-xs t-faint" style={{ display: 'block' }}>
                      {dateShort(m.startDate)} → {dateShort(m.endDate)}
                    </span>
                  </span>
                  <Badge tone={m.kind === 'new' ? 'brand' : 'neutral'}>
                    {m.kind === 'new' ? 'Joined' : 'Renewal'}
                  </Badge>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHead title={gym.name} subtitle="Your gym" />
        <CardBody>
          <KV k="Phone"><a href={`tel:${gym.phone}`}>{gym.phone}</a></KV>
          <KV k="Email"><a href={`mailto:${gym.email}`}>{gym.email}</a></KV>
          <KV k="Address"><span style={{ maxWidth: 220, display: 'inline-block' }}>{gym.address}</span></KV>
        </CardBody>
      </Card>

      <div className="u-col u-gap-2">
        <Button icon={theme === 'dark' ? 'sun' : 'moon'} block onClick={toggleTheme}>
          {theme === 'dark' ? 'Light theme' : 'Dark theme'}
        </Button>
        <Button icon="calendarCheck" block onClick={() => nav('/member/attendance')}>
          View attendance
        </Button>
        <Button icon="logout" block onClick={() => nav('/')}>Switch role</Button>
      </div>

      <p className="t-xs t-faint u-center u-mb-4">
        Gym Software Setup · prototype. Sign-in arrives in the next phase — this screen already
        only ever shows your own record.
      </p>
    </div>
  );
}
