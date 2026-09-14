import { Link } from 'react-router-dom';
import { Avatar, Button, EmptyState } from '../ui/primitives';
import { Icon } from '../ui/Icon';
import type { MemberRow } from '../../lib/api';
import type { EngagementLevel } from '../../lib/derive';

const LEVEL_COLOR: Record<EngagementLevel, string> = {
  attention: 'var(--critical)',
  watch: 'var(--warning-mark)',
  healthy: 'var(--good)',
};

export function LevelChip({ level }: { level: EngagementLevel }) {
  const label = level === 'attention' ? 'Needs attention' : level === 'watch' ? 'Watch' : 'Healthy';
  return <span className={`levelchip levelchip--${level}`}>{label}</span>;
}

/**
 * The owner's work queue. Every row carries the reason it is here, written out
 * in words — a score with no explanation is not a tool, it is a horoscope.
 */
export function AttentionQueue({
  rows, limit, onAct, emptyTitle = 'Everyone is on track',
  emptyMessage = 'No member is lapsing, overdue or falling behind their program right now.',
}: {
  rows: MemberRow[];
  limit?: number;
  onAct?: (row: MemberRow, action: 'renew' | 'payment' | 'message') => void;
  emptyTitle?: string;
  emptyMessage?: string;
}) {
  const shown = limit ? rows.slice(0, limit) : rows;

  if (!rows.length) {
    return <EmptyState icon="checkCircle" title={emptyTitle} message={emptyMessage} />;
  }

  return (
    <ul>
      {shown.map((row) => {
        const e = row.engagement;
        const primary = e.signals[0];
        return (
          /*
            The whole row is clickable, but it is NOT a <button>: the actions
            inside it are buttons too, and a button inside a button is invalid
            HTML that browsers resolve unpredictably. The member's name is the
            one real link, stretched over the row by CSS; the actions sit above
            it. Same target area, valid markup, sane tab order.
          */
          <li key={row.member.id} className="attnrow">
            <span className="attnrow__bar" style={{ background: LEVEL_COLOR[e.level] }} />
            <Avatar name={row.member.name} size="sm" />

            <span className="u-grow" style={{ minWidth: 0 }}>
              <span className="u-between u-gap-2">
                <Link className="attnrow__name attnrow__link u-truncate" to={`/owner/members/${row.member.id}`}>
                  {row.member.name}
                </Link>
                <LevelChip level={e.level} />
              </span>

              <span className="signals">
                {e.signals.slice(0, 3).map((s) => (
                  <span key={s.code} className="signal">
                    <span className="signal__dot" style={{ background: LEVEL_COLOR[e.level] }} />
                    {s.reason}
                  </span>
                ))}
                {e.signals.length > 3 && (
                  <span className="signal t-faint">+{e.signals.length - 3} more</span>
                )}
              </span>

              {onAct && (
                <span className="u-row u-gap-2 u-wrap attnrow__actions" style={{ marginTop: 'var(--s-3)' }}>
                  {primary?.code === 'payment_due' && (
                    <Button size="sm" variant="primary" onClick={() => onAct(row, 'payment')}>
                      Collect payment
                    </Button>
                  )}
                  {e.signals.some((s) => s.code === 'expiring') && (
                    <Button size="sm" variant={primary?.code === 'expiring' ? 'primary' : 'secondary'}
                      onClick={() => onAct(row, 'renew')}>
                      Renew
                    </Button>
                  )}
                  <Button size="sm" icon="message" onClick={() => onAct(row, 'message')}>
                    Message
                  </Button>
                </span>
              )}
            </span>

            <Icon name="chevronRight" size={16} className="t-faint" style={{ marginTop: 4 }} />
          </li>
        );
      })}
    </ul>
  );
}
