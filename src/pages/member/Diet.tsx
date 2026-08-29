import { useState } from 'react';
import {
  Badge, Card, CardBody, CardHead, EmptyState, Meter,
} from '../../components/ui/primitives';
import { Icon } from '../../components/ui/Icon';
import { useApp, useData } from '../../state/app';
import * as api from '../../lib/api';
import { titleCase } from '../../lib/format';

const MEALS = ['breakfast', 'lunch', 'snack', 'dinner'] as const;
const MEAL_TIME: Record<(typeof MEALS)[number], string> = {
  breakfast: '7:00 – 9:00 AM',
  lunch: '1:00 – 2:00 PM',
  snack: '5:00 – 6:00 PM',
  dinner: '8:00 – 9:30 PM',
};

export default function Diet() {
  const { session } = useApp();
  const memberId = session?.memberId ?? '';
  const plan = useData(() => (session && memberId ? api.diet.planFor(session, memberId) : null), [memberId]);

  // Ticking off a meal is a per-viewer convenience, not gym data.
  const [eaten, setEaten] = useState<Record<string, boolean>>({});
  const [water, setWater] = useState(0);

  if (!session) return null;

  if (!plan) {
    return (
      <div className="anim-page">
        <h1 className="t-h1 u-mb-4">Diet</h1>
        <Card>
          <EmptyState
            icon="utensils" title="No diet plan assigned"
            message="Your trainer has not assigned a diet plan yet. Ask at the front desk and it will appear here, meal by meal."
          />
        </Card>
      </div>
    );
  }

  const totals = plan.items.reduce((a, i) => ({
    kcal: a.kcal + i.calories, p: a.p + i.protein, c: a.c + i.carbs, f: a.f + i.fat,
  }), { kcal: 0, p: 0, c: 0, f: 0 });

  const eatenKcal = plan.items.filter((i) => eaten[i.id]).reduce((s, i) => s + i.calories, 0);

  return (
    <div className="anim-page u-col u-gap-4">
      <div>
        <h1 className="t-h1">Diet</h1>
        <p className="t-sm t-muted u-mt-2">{plan.name}</p>
      </div>

      <Card>
        <CardBody>
          <div className="u-between u-mb-3">
            <span className="t-sm t-muted">Today's intake</span>
            <span className="t-sm u-num" style={{ fontWeight: 620 }}>
              {eatenKcal} <span className="t-faint">/ {totals.kcal} kcal</span>
            </span>
          </div>
          <Meter value={eatenKcal} max={totals.kcal} label="Calories eaten today"
            tone={eatenKcal >= totals.kcal ? 'good' : undefined} />
          <div className="u-row u-gap-2 u-wrap u-mt-4">
            <Badge tone="brand">{totals.p} g protein</Badge>
            <Badge>{totals.c} g carbs</Badge>
            <Badge>{totals.f} g fat</Badge>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHead title="Water" subtitle={`Target ${plan.waterTargetL} L`} />
        <CardBody>
          <div className="u-row u-gap-2 u-wrap u-mb-4">
            {Array.from({ length: Math.ceil(plan.waterTargetL * 2) }, (_, i) => (
              <button
                key={i}
                onClick={() => setWater(water === i + 1 ? i : i + 1)}
                aria-label={`${(i + 1) * 0.5} litres`}
                aria-pressed={i < water}
                style={{
                  width: 34, height: 44, borderRadius: 'var(--r-sm)', cursor: 'pointer',
                  border: `1px solid ${i < water ? 'var(--brand)' : 'var(--border-strong)'}`,
                  background: i < water ? 'var(--brand-soft)' : 'var(--surface-1)',
                  color: i < water ? 'var(--brand)' : 'var(--text-3)',
                  display: 'grid', placeItems: 'center',
                  transition: 'all var(--dur-fast) var(--ease)',
                }}
              >
                <Icon name="droplet" size={16} />
              </button>
            ))}
          </div>
          <span className="t-sm t-muted u-num">{(water * 0.5).toFixed(1)} L of {plan.waterTargetL} L</span>
        </CardBody>
      </Card>

      {MEALS.map((meal) => {
        const items = plan.items.filter((i) => i.meal === meal);
        if (!items.length) return null;
        const kcal = items.reduce((s, i) => s + i.calories, 0);
        return (
          <Card key={meal}>
            <CardHead
              title={titleCase(meal)}
              subtitle={`${MEAL_TIME[meal]} · ${kcal} kcal`}
              action={<Badge>{items.filter((i) => eaten[i.id]).length}/{items.length}</Badge>}
            />
            <CardBody flush>
              <ul className="cardlist">
                {items.map((i) => {
                  const done = Boolean(eaten[i.id]);
                  return (
                    <li key={i.id}>
                      <button
                        className="cardlist__item"
                        onClick={() => setEaten((e) => ({ ...e, [i.id]: !done }))}
                        aria-pressed={done}
                      >
                        <span style={{
                          width: 26, height: 26, flex: 'none', display: 'grid', placeItems: 'center',
                          borderRadius: '50%',
                          background: done ? 'var(--good-soft)' : 'var(--surface-inset)',
                          color: done ? 'var(--good)' : 'var(--text-3)',
                        }}>
                          <Icon name={done ? 'check' : 'utensils'} size={13} strokeWidth={2.4} />
                        </span>
                        <span className="u-grow" style={{ minWidth: 0 }}>
                          <span className="t-sm" style={{
                            fontWeight: 550, display: 'block',
                            textDecoration: done ? 'line-through' : undefined,
                            color: done ? 'var(--text-3)' : undefined,
                          }}>{i.item}</span>
                          <span className="t-xs t-faint">{i.qty} · {i.calories} kcal · {i.protein}g protein</span>
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

      <p className="t-xs t-faint u-center">
        Ticking a meal is just for you today — it is not sent to the gym.
      </p>
    </div>
  );
}
