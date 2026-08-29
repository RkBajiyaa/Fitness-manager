import { useState } from 'react';
import {
  Card, CardBody, CardHead, PageHead, Segmented, StatTile,
} from '../../components/ui/primitives';
import { Icon } from '../../components/ui/Icon';
import { AttentionQueue } from '../../components/owner/AttentionQueue';
import { RecordPaymentDialog, RenewMembershipDialog } from '../../components/dialogs';
import { MessageDialog } from '../../components/dialogs/communication';
import { useApp, useData } from '../../state/app';
import * as api from '../../lib/api';
import type { MemberRow } from '../../lib/api';
import { count, money } from '../../lib/format';

type Filter = 'all' | 'attention' | 'watch' | 'lapsed' | 'drop' | 'new' | 'money';

export default function Attention() {
  const { session } = useApp();
  const [filter, setFilter] = useState<Filter>('all');
  const [renew, setRenew] = useState<string | null>(null);
  const [pay, setPay] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const queue = useData(() => (session ? api.engagement.queue(session) : []), [session?.gymId]);
  const counts = useData(() => (session ? api.members.counts(session) : null), [session?.gymId]);
  const k = useData(() => (session ? api.dashboard.get(session) : null), [session?.gymId]);

  if (!session || !counts || !k) return null;

  const has = (row: MemberRow, code: string) => row.engagement.signals.some((s) => s.code === code);
  const filtered = queue.filter((r) => {
    switch (filter) {
      case 'attention': return r.engagement.level === 'attention';
      case 'watch': return r.engagement.level === 'watch';
      case 'lapsed': return has(r, 'lapsed');
      case 'drop': return has(r, 'frequency_drop');
      case 'new': return has(r, 'new_member_risk');
      case 'money': return has(r, 'payment_due') || has(r, 'expiring');
      default: return true;
    }
  });

  const act = (row: MemberRow, action: 'renew' | 'payment' | 'message') => {
    if (action === 'renew') setRenew(row.member.id);
    if (action === 'payment') setPay(row.member.id);
    if (action === 'message') setMessage(row.member.id);
  };

  return (
    <div className="anim-page">
      <PageHead
        title="Needs attention"
        subtitle="Scored from real attendance, payment and program data — every row says why it is here."
      />

      <div className="grid-stats u-mb-5">
        <StatTile label="Needs attention" icon="bell" value={count(counts.attention)}
          accent="var(--critical)" hint="act this week" />
        <StatTile label="Watching" icon="eye" value={count(counts.watch)}
          accent="var(--warning-mark)" hint="early signals" />
        <StatTile label="Healthy" icon="checkCircle"
          value={count(counts.all - counts.attention - counts.watch)}
          accent="var(--good)" hint={`of ${counts.all} members`} />
        <StatTile label="At stake" icon="wallet" value={money(k.pendingTotal)}
          hint={`${k.pendingCount} with a balance`} />
      </div>

      <Card>
        <div className="card__body" style={{ paddingBottom: 'var(--s-4)' }}>
          <Segmented
            ariaLabel="Filter"
            value={filter} onChange={setFilter}
            options={[
              { value: 'all', label: 'Everyone', count: queue.length },
              { value: 'attention', label: 'Attention', count: counts.attention },
              { value: 'watch', label: 'Watch', count: counts.watch },
              { value: 'lapsed', label: 'Lapsed' },
              { value: 'drop', label: 'Training less' },
              { value: 'new', label: 'New members' },
              { value: 'money', label: 'Money' },
            ]}
          />
        </div>
        <CardBody flush>
          <AttentionQueue
            rows={filtered}
            onAct={act}
            emptyTitle={filter === 'all' ? 'Everyone is on track' : 'Nobody in this group'}
            emptyMessage={filter === 'all'
              ? 'No member is lapsing, overdue or falling behind their program right now.'
              : 'Try a different filter to see the rest of the queue.'}
          />
        </CardBody>
      </Card>

      <Card className="u-mt-5">
        <CardHead title="How this is scored" subtitle="So you can trust it, and argue with it" />
        <CardBody>
          <p className="t-sm t-muted" style={{ lineHeight: 1.7 }}>
            Attendance frequency is measured against each member's <strong>own baseline</strong> —
            their visits per week over the preceding seven weeks — rather than a flat threshold.
            A member who trains four times a week and drops to one is in trouble; a member who has
            always come once a week is not. The first ninety days carry extra weight, because that
            is when most members are lost.
          </p>
          <ul className="u-col u-gap-2 u-mt-4">
            {[
              ['No visit in 10 days or more', 'lapsed'],
              ['Frequency down 50% or more against their own baseline', 'frequency drop'],
              ['Joined under 90 days ago and training less than weekly', 'new member risk'],
              ['Membership ends within 14 days', 'expiring'],
              ['Outstanding balance', 'payment due'],
              ['Under half their planned sessions completed in two weeks', 'adherence'],
              ['Active member with no program assigned', 'no program'],
            ].map(([text, code]) => (
              <li key={code} className="u-row u-gap-2 t-xs t-muted">
                <Icon name="check" size={12} style={{ color: 'var(--good)', flex: 'none', marginTop: 3 }} />
                {text}
              </li>
            ))}
          </ul>
          <p className="quiet-note u-mt-4">
            This is an internal tool. Nothing here is ever shown to the member.
          </p>
        </CardBody>
      </Card>

      {renew && <RenewMembershipDialog memberId={renew} onClose={() => setRenew(null)} />}
      {pay && <RecordPaymentDialog memberId={pay} onClose={() => setPay(null)} />}
      {message && <MessageDialog memberId={message} onClose={() => setMessage(null)} />}
    </div>
  );
}
