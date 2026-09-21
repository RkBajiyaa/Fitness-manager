/* ============================================================
   THE PLAN CATALOGUE (§4, §5).

   Deliberately secondary to starting today's workout. A member
   changes their plan a handful of times a year and trains a
   hundred times, so this lives one tap away rather than on the
   Workout screen itself.

   The promise this screen has to make honestly: switching plans
   does not lose anything. It is stated in the confirm dialog
   because it is the thing people are afraid of, and it is true —
   enrolment clones a template into a new Program and never touches
   a WorkoutSession row.
   ============================================================ */
import { useNavigate } from 'react-router-dom';
import {
  Badge, Button, Card, CardBody, EmptyState, PageHead,
} from '../../components/ui/primitives';
import { Icon } from '../../components/ui/Icon';
import { useApp, useData } from '../../state/app';
import * as api from '../../lib/api';
import { errorMessage } from '../../components/ui/forms';
import type { PlanTemplate } from '../../lib/types';

const FAMILY_LABEL: Record<string, string> = {
  ppl: 'Push / Pull / Legs',
  body_part_split: 'Body-part split',
  beginner: 'Beginner',
  cardio: 'Cardio',
  hybrid: 'Hybrid',
};

export default function Plans() {
  const { session, toast, confirm } = useApp();
  const nav = useNavigate();
  const memberId = session?.memberId ?? '';

  const catalog = useData(() => {
    if (!session) return [];
    try { return api.planLibrary.catalog(session); } catch { return []; }
  }, [memberId]);

  const current = useData(
    () => (session && memberId ? api.planLibrary.current(session, memberId) : null),
    [memberId],
  );

  if (!session || !memberId) return null;

  const enroll = async (plan: PlanTemplate) => {
    if (current?.templateSlug === plan.slug) {
      toast('info', 'Already on this plan', plan.name);
      return;
    }
    const ok = await confirm({
      title: current ? `Switch to ${plan.name}?` : `Start ${plan.name}?`,
      message: current
        ? `You are currently on ${current.name}. Switching starts ${plan.name} from today. `
          + 'Every workout you have already logged is kept — your history, records and progress are not affected.'
        : `${plan.name} will start from today.`,
      confirmLabel: current ? 'Switch plan' : 'Start plan',
    });
    if (!ok) return;

    try {
      await api.planLibrary.enroll(session, memberId, plan.slug);
      toast('success', current ? 'Plan switched' : 'Plan started', `${plan.name} starts today.`);
      nav('/member/workout');
    } catch (e) {
      toast('error', 'Could not change your plan', errorMessage(e));
    }
  };

  const leave = async () => {
    const ok = await confirm({
      title: 'Stop following this plan?',
      message: 'You can still train and log whatever you like — nothing you have logged is removed. '
        + 'You just will not have a scheduled workout waiting each day.',
      confirmLabel: 'Stop the plan',
      tone: 'danger',
    });
    if (!ok) return;
    await api.planLibrary.leave(session, memberId);
    toast('info', 'Plan stopped', 'Your history is untouched.');
  };

  return (
    <div className="anim-page u-col u-gap-4">
      <PageHead
        title="Training plans"
        subtitle={current ? `You are on ${current.name}` : 'Pick a plan and your workouts are scheduled for you'}
      />

      {catalog.length === 0 ? (
        <Card>
          <EmptyState
            icon="route"
            title="No plans available"
            message="Training plans are not enabled for your gym yet. You can still build your own workouts and log freely."
            action={<Button variant="primary" onClick={() => nav('/member/workout')}>Back to workout</Button>}
          />
        </Card>
      ) : (
        <div className="u-col u-gap-3">
          {catalog.map((plan) => {
            const isCurrent = current?.templateSlug === plan.slug;
            return (
              <button
                key={plan.id}
                className={`plancard ${isCurrent ? 'is-current' : ''}`}
                onClick={() => enroll(plan)}
                aria-current={isCurrent ? 'true' : undefined}
              >
                <div className="u-between u-gap-3">
                  <span className="plancard__name">{plan.name}</span>
                  {isCurrent
                    ? <Badge tone="brand" dot>Current</Badge>
                    : <Badge>{api.exercises.label.difficulty(plan.difficulty)}</Badge>}
                </div>

                <p className="plancard__summary">{plan.summary}</p>

                <div className="plancard__meta">
                  <span className="u-row u-gap-1">
                    <Icon name="calendar" size={13} />
                    {plan.daysPerWeek} days a week
                  </span>
                  <span className="u-row u-gap-1">
                    <Icon name="route" size={13} />
                    {plan.schedule === 'numbered'
                      ? `${plan.days.length} days`
                      : `${plan.durationWeeks} weeks`}
                  </span>
                  <span className="u-row u-gap-1">
                    <Icon name="layers" size={13} />
                    {FAMILY_LABEL[plan.family] ?? plan.family}
                  </span>
                </div>

                <ul className="plancard__highlights">
                  {plan.highlights.map((h) => (
                    <li key={h}>
                      <Icon name="check" size={13} className="t-faint" />
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>
      )}

      {current && (
        <Card>
          <CardBody>
            <div className="u-between u-gap-3 u-wrap">
              <div style={{ minWidth: 0 }}>
                <div className="t-sm" style={{ fontWeight: 580 }}>Train without a plan</div>
                <p className="t-xs t-muted u-mt-2">
                  Stop following {current.name} and log whatever you train. Nothing is deleted.
                </p>
              </div>
              <Button size="sm" onClick={leave}>Stop the plan</Button>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
