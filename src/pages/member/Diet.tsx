import {
  Badge, Button, Card, CardBody, CardHead, EmptyState, Meter,
} from '../../components/ui/primitives';
import { Icon } from '../../components/ui/Icon';
import { Ring } from '../../components/ui/Ring';
import { useApp, useData } from '../../state/app';
import * as api from '../../lib/api';
import { titleCase } from '../../lib/format';
import { todayISO } from '../../lib/date';

const MEALS = ['breakfast', 'lunch', 'snack', 'dinner'] as const;
const MEAL_TIME: Record<(typeof MEALS)[number], string> = {
  breakfast: '7:00 – 9:00 AM',
  lunch: '1:00 – 2:00 PM',
  snack: '5:00 – 6:00 PM',
  dinner: '8:00 – 9:30 PM',
};

export default function Diet() {
  const { session, toast } = useApp();
  const memberId = session?.memberId ?? '';
  const today = todayISO();

  const me = useData(() => (session && memberId ? api.members.get(session, memberId) : null), [memberId]);
  const plan = useData(() => (session && memberId ? api.diet.planFor(session, memberId) : null), [memberId]);
  const done = useData(() => (session && memberId ? api.diet.completions(session, memberId, today) : new Set<string>()), [memberId]);
  const waterMl = useData(() => (session && memberId ? api.water.today(session, memberId) : 0), [memberId]);

  if (!session || !me) return null;
  const target = me.member.fitness.waterTargetMl;

  const addWater = async (ml: number) => {
    const total = await api.water.add(session, memberId, ml);
    if (ml > 0 && total >= target && total - ml < target) {
      toast('success', 'Hydration target reached', `${(total / 1000).toFixed(1)} L today.`);
    }
  };

  const toggle = async (itemId: string) => {
    await api.diet.toggleMeal(session, memberId, itemId, today);
  };

  const glasses = Math.max(8, Math.ceil(target / 250));

  return (
    <div className="anim-page u-col u-gap-4">
      <div>
        <h1 className="t-h1">Diet</h1>
        <p className="t-sm t-muted u-mt-2">{plan ? plan.name : 'No plan assigned'}</p>
      </div>

      {/* Hydration is real stored data, not throwaway UI state. */}
      <Card>
        <CardBody>
          <div className="u-row u-gap-5">
            <Ring value={waterMl} max={target} size={78} stroke={7} color="var(--series-1)"
              label={`Hydration ${Math.round((waterMl / target) * 100)} percent`}>
              <span>
                <span className="t-sm u-num" style={{ fontWeight: 660, display: 'block' }}>
                  {(waterMl / 1000).toFixed(1)}
                </span>
                <span className="t-xs t-faint">L</span>
              </span>
            </Ring>
            <div className="u-grow">
              <div className="u-between">
                <span className="t-h3">Hydration</span>
                <span className="t-sm u-num t-muted">
                  {(waterMl / 1000).toFixed(2)} / {(target / 1000).toFixed(1)} L
                </span>
              </div>
              <div className="u-row u-gap-2 u-mt-4 u-wrap">
                <Button size="sm" icon="plus" onClick={() => addWater(250)}>250 ml</Button>
                <Button size="sm" icon="plus" onClick={() => addWater(500)}>500 ml</Button>
                {waterMl > 0 && (
                  <Button size="sm" variant="ghost" icon="undo" onClick={() => addWater(-1)}>Undo</Button>
                )}
              </div>
            </div>
          </div>

          <div className="waterrow u-mt-5">
            {Array.from({ length: glasses }, (_, i) => (
              <span key={i} className={`waterglass ${waterMl >= (i + 1) * 250 ? 'waterglass--full' : ''}`}>
                <Icon name="droplet" size={14} />
              </span>
            ))}
          </div>
        </CardBody>
      </Card>

      {!plan ? (
        <Card>
          <EmptyState icon="utensils" title="No diet plan assigned"
            message="Your coach has not assigned a plan yet. Ask at the studio and it will appear here, meal by meal." />
        </Card>
      ) : (
        <>
          <Card>
            <CardBody>
              <div className="u-between u-mb-3">
                <span className="t-sm t-muted">Today's intake</span>
                <span className="t-sm u-num" style={{ fontWeight: 620 }}>
                  {plan.items.filter((i) => done.has(i.id)).reduce((s, i) => s + i.calories, 0)}
                  <span className="t-faint"> / {plan.items.reduce((s, i) => s + i.calories, 0)} kcal</span>
                </span>
              </div>
              <Meter
                value={plan.items.filter((i) => done.has(i.id)).reduce((s, i) => s + i.calories, 0)}
                max={Math.max(1, plan.items.reduce((s, i) => s + i.calories, 0))}
                label="Calories eaten today"
              />
              <div className="u-row u-gap-2 u-wrap u-mt-4">
                <Badge tone="brand">{plan.items.reduce((s, i) => s + i.protein, 0)} g protein</Badge>
                <Badge>{plan.items.reduce((s, i) => s + i.carbs, 0)} g carbs</Badge>
                <Badge>{plan.items.reduce((s, i) => s + i.fat, 0)} g fat</Badge>
              </div>
            </CardBody>
          </Card>

          {MEALS.map((meal) => {
            const items = plan.items.filter((i) => i.meal === meal);
            if (!items.length) return null;
            const eaten = items.filter((i) => done.has(i.id)).length;
            return (
              <Card key={meal}>
                <CardHead
                  title={titleCase(meal)}
                  subtitle={`${MEAL_TIME[meal]} · ${items.reduce((s, i) => s + i.calories, 0)} kcal`}
                  action={<Badge tone={eaten === items.length ? 'good' : 'neutral'}>{eaten}/{items.length}</Badge>}
                />
                <CardBody flush>
                  <ul className="cardlist">
                    {items.map((i) => {
                      const isDone = done.has(i.id);
                      return (
                        <li key={i.id}>
                          <button className="cardlist__item" onClick={() => toggle(i.id)} aria-pressed={isDone}>
                            <span style={{
                              width: 26, height: 26, flex: 'none', display: 'grid', placeItems: 'center',
                              borderRadius: '50%',
                              background: isDone ? 'var(--good-soft)' : 'var(--surface-3)',
                              color: isDone ? 'var(--good)' : 'var(--text-3)',
                            }}>
                              <Icon name={isDone ? 'check' : 'utensils'} size={13} strokeWidth={2.4} />
                            </span>
                            <span className="u-grow" style={{ minWidth: 0 }}>
                              <span className="t-sm" style={{
                                fontWeight: 550, display: 'block',
                                textDecoration: isDone ? 'line-through' : undefined,
                                color: isDone ? 'var(--text-3)' : undefined,
                              }}>{i.item}</span>
                              <span className="t-xs t-faint">
                                {i.qty} · {i.calories} kcal · {i.protein}g protein
                              </span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </CardBody>
              </Card>
            );
          })}

          <p className="quiet-note u-center">
            Meals you tick are saved to your record, so your coach can see how the plan is going.
          </p>
        </>
      )}
    </div>
  );
}
