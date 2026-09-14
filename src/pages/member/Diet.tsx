import { useState } from 'react';
import {
  Badge, Button, Card, CardBody, CardHead, EmptyState, Meter, Modal, Segmented,
} from '../../components/ui/primitives';
import {
  NumberStepper, SelectField, TextField, fieldErrors, errorMessage,
} from '../../components/ui/forms';
import { Icon } from '../../components/ui/Icon';
import { Ring } from '../../components/ui/Ring';
import { useApp, useData } from '../../state/app';
import * as api from '../../lib/api';
import { titleCase } from '../../lib/format';
import { todayISO } from '../../lib/date';
import type { DietItem, MealSlot } from '../../lib/types';

const MEALS: MealSlot[] = ['breakfast', 'lunch', 'snack', 'dinner'];
const MEAL_TIME: Record<MealSlot, string> = {
  breakfast: '7:00 – 9:00 AM',
  lunch: '1:00 – 2:00 PM',
  snack: '5:00 – 6:00 PM',
  dinner: '8:00 – 9:30 PM',
};

type View = 'assigned' | 'mine';

export default function Diet() {
  const { session, toast, confirm } = useApp();
  const memberId = session?.memberId ?? '';
  const today = todayISO();

  const me = useData(() => (session && memberId ? api.members.get(session, memberId) : null), [memberId]);
  const bundle = useData(
    () => (session && memberId ? api.diet.forMember(session, memberId) : null),
    [memberId],
  );
  const done = useData(
    () => (session && memberId ? api.diet.completions(session, memberId, today) : new Set<string>()),
    [memberId],
  );
  const waterMl = useData(
    () => (session && memberId ? api.water.today(session, memberId) : 0),
    [memberId],
  );

  // Default to whichever plan the member actually has.
  const [view, setView] = useState<View | null>(null);
  const [editing, setEditing] = useState<DietItem | null>(null);
  const [addingTo, setAddingTo] = useState<MealSlot | null>(null);

  if (!session || !me || !bundle) return null;
  const target = me.member.fitness.waterTargetMl;
  const resolved: View = view ?? (bundle.assigned ? 'assigned' : 'mine');
  const plan = resolved === 'assigned' ? bundle.assigned : bundle.personal;
  const editable = resolved === 'mine';

  const addWater = async (ml: number) => {
    const total = await api.water.add(session, memberId, ml);
    if (ml > 0 && total >= target && total - ml < target) {
      toast('success', 'Hydration target reached', `${(total / 1000).toFixed(1)} L today.`);
    }
  };

  const createPersonal = async () => {
    await api.diet.ensurePersonal(session, memberId);
    toast('success', 'Your plan is ready', 'Add meals to it whenever you like.');
    setView('mine');
  };

  const copyAssigned = async () => {
    const ok = await confirm({
      title: 'Copy your coach’s plan?',
      confirmLabel: 'Copy it',
      message: bundle.personal
        ? 'This replaces your own plan with a copy of the assigned one. Your coach’s plan is not affected either way.'
        : 'You get an editable copy to adapt. Your coach’s original stays exactly as it is.',
    });
    if (!ok) return;
    await api.diet.copyAssignedToPersonal(session, memberId);
    toast('success', 'Copied', 'Edit it however you like — the assigned plan is untouched.');
    setView('mine');
  };

  const removeItem = async (item: DietItem) => {
    await api.diet.removeItem(session, memberId, item.id);
    toast('success', 'Removed', `${item.item} is off your plan.`);
  };

  const glasses = Math.max(8, Math.ceil(target / 250));
  const eatenCals = plan ? plan.items.filter((i) => done.has(i.id)).reduce((s, i) => s + i.calories, 0) : 0;
  const totalCals = plan ? plan.items.reduce((s, i) => s + i.calories, 0) : 0;

  return (
    <div className="anim-page u-col u-gap-4">
      <div className="u-between">
        <div>
          <h1 className="t-h1">Diet</h1>
          <p className="t-sm t-muted u-mt-2">
            {plan ? plan.name : resolved === 'assigned' ? 'No plan assigned' : 'No plan of your own yet'}
          </p>
        </div>
        {editable && bundle.personal && (
          <Button size="sm" icon="plus" onClick={() => setAddingTo('breakfast')}>Add food</Button>
        )}
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

      {/*
        Assigned and personal plans are separate rows in the store, and
        separate tabs here. Editing one can never rewrite the other.
      */}
      <Segmented
        ariaLabel="Which diet plan"
        value={resolved}
        onChange={setView}
        options={[
          { value: 'assigned', label: 'From my coach', count: bundle.assigned?.items.length },
          { value: 'mine', label: 'My diet', count: bundle.personal?.items.length },
        ]}
      />

      {!plan ? (
        <Card>
          {resolved === 'assigned' ? (
            <EmptyState
              icon="utensils"
              title="No plan assigned"
              message="Your coach has not assigned one yet. You can still build your own — it will not be overwritten if they assign something later."
              action={<Button variant="primary" icon="plus" onClick={createPersonal}>Build my own</Button>}
            />
          ) : (
            <EmptyState
              icon="utensils"
              title="No plan of your own"
              message="Write down what you actually eat, meal by meal, and tick it off as you go. Only you can see it."
              action={(
                <div className="u-row u-gap-2 u-wrap" style={{ justifyContent: 'center' }}>
                  <Button variant="primary" icon="plus" onClick={createPersonal}>Start a plan</Button>
                  {bundle.assigned && (
                    <Button icon="layers" onClick={copyAssigned}>Copy my coach’s</Button>
                  )}
                </div>
              )}
            />
          )}
        </Card>
      ) : (
        <>
          <Card>
            <CardBody>
              <div className="u-between u-mb-3">
                <span className="t-sm t-muted">Today's intake</span>
                <span className="t-sm u-num" style={{ fontWeight: 620 }}>
                  {eatenCals}
                  <span className="t-faint"> / {totalCals} kcal</span>
                </span>
              </div>
              <Meter value={eatenCals} max={Math.max(1, totalCals)} label="Calories eaten today" />
              <div className="u-row u-gap-2 u-wrap u-mt-4">
                <Badge tone="brand">{plan.items.reduce((s, i) => s + i.protein, 0)} g protein</Badge>
                <Badge>{plan.items.reduce((s, i) => s + i.carbs, 0)} g carbs</Badge>
                <Badge>{plan.items.reduce((s, i) => s + i.fat, 0)} g fat</Badge>
                {!editable && <Badge>Assigned by your coach</Badge>}
              </div>
            </CardBody>
          </Card>

          {MEALS.map((meal) => {
            const items = plan.items
              .filter((i) => i.meal === meal)
              .sort((a, b) => a.order - b.order);
            if (!items.length && !editable) return null;
            const eaten = items.filter((i) => done.has(i.id)).length;
            return (
              <Card key={meal}>
                <CardHead
                  title={titleCase(meal)}
                  subtitle={`${MEAL_TIME[meal]}${items.length ? ` · ${items.reduce((s, i) => s + i.calories, 0)} kcal` : ''}`}
                  action={items.length
                    ? <Badge tone={eaten === items.length ? 'good' : 'neutral'}>{eaten}/{items.length}</Badge>
                    : undefined}
                />
                <CardBody flush>
                  {items.length === 0 ? (
                    <div style={{ padding: 'var(--s-4)' }}>
                      <p className="t-sm t-faint">Nothing here yet.</p>
                    </div>
                  ) : (
                    <ul className="cardlist">
                      {items.map((i, idx) => {
                        const isDone = done.has(i.id);
                        return (
                          <li key={i.id} className="dietrow">
                            <button
                              className="dietrow__tick"
                              onClick={() => api.diet.toggleMeal(session, memberId, i.id, today)}
                              aria-pressed={isDone}
                              aria-label={`Mark ${i.item} ${isDone ? 'not eaten' : 'eaten'}`}
                            >
                              <span style={{
                                width: 26, height: 26, display: 'grid', placeItems: 'center',
                                borderRadius: '50%',
                                background: isDone ? 'var(--good-soft)' : 'var(--surface-3)',
                                color: isDone ? 'var(--good)' : 'var(--text-3)',
                              }}>
                                <Icon name={isDone ? 'check' : 'utensils'} size={13} strokeWidth={2.4} />
                              </span>
                            </button>

                            <span className="u-grow" style={{ minWidth: 0 }}>
                              <span className="t-sm" style={{
                                fontWeight: 550, display: 'block',
                                textDecoration: isDone ? 'line-through' : undefined,
                                color: isDone ? 'var(--text-3)' : undefined,
                              }}>{i.item}</span>
                              <span className="t-xs t-faint">
                                {[i.qty, `${i.calories} kcal`, i.protein ? `${i.protein}g protein` : null]
                                  .filter(Boolean).join(' · ')}
                              </span>
                            </span>

                            {editable && (
                              <span className="u-row" style={{ gap: 2 }}>
                                <Button size="sm" variant="ghost" icon="chevronUp" disabled={idx === 0}
                                  onClick={() => api.diet.moveItem(session, memberId, i.id, -1)}
                                  aria-label={`Move ${i.item} up`} />
                                <Button size="sm" variant="ghost" icon="chevronDown"
                                  disabled={idx === items.length - 1}
                                  onClick={() => api.diet.moveItem(session, memberId, i.id, 1)}
                                  aria-label={`Move ${i.item} down`} />
                                <Button size="sm" variant="ghost" icon="edit"
                                  onClick={() => setEditing(i)} aria-label={`Edit ${i.item}`} />
                                <Button size="sm" variant="ghost" icon="trash"
                                  onClick={() => removeItem(i)} aria-label={`Remove ${i.item}`} />
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  {editable && (
                    <div style={{ padding: 'var(--s-3) var(--s-4)' }}>
                      <Button size="sm" icon="plus" block onClick={() => setAddingTo(meal)}>
                        Add to {meal}
                      </Button>
                    </div>
                  )}
                </CardBody>
              </Card>
            );
          })}

          {!editable && (
            <div className="inline-alert">
              <Icon name="info" size={17} style={{ flex: 'none', marginTop: 1, color: 'var(--text-2)' }} />
              <span className="t-sm t-muted">
                This plan is your coach's, so it is read-only here.{' '}
                <button className="auth__link" onClick={copyAssigned}>Take an editable copy</button>{' '}
                if you want to adapt it — the original will not change.
              </span>
            </div>
          )}

          <p className="quiet-note u-center">
            Meals you tick are saved to your record{editable ? '' : ', so your coach can see how the plan is going'}.
          </p>
        </>
      )}

      {(addingTo || editing) && (
        <ItemDialog
          meal={addingTo ?? editing!.meal}
          item={editing}
          onClose={() => { setAddingTo(null); setEditing(null); }}
        />
      )}
    </div>
  );
}

/* ---------------- Add / edit a food item ---------------- */
function ItemDialog({ meal, item, onClose }: {
  meal: MealSlot;
  item: DietItem | null;
  onClose: () => void;
}) {
  const { session, toast } = useApp();
  const memberId = session?.memberId ?? '';
  const [slot, setSlot] = useState<MealSlot>(item?.meal ?? meal);
  const [text, setText] = useState(item?.item ?? '');
  const [qty, setQty] = useState(item?.qty ?? '');
  const [calories, setCalories] = useState(item?.calories ?? 0);
  const [protein, setProtein] = useState(item?.protein ?? 0);
  const [carbs, setCarbs] = useState(item?.carbs ?? 0);
  const [fat, setFat] = useState(item?.fat ?? 0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!session || !memberId) return;
    setBusy(true); setErrors({});
    try {
      if (item) {
        await api.diet.updateItem(session, memberId, item.id, {
          meal: slot, item: text, qty, calories, protein, carbs, fat,
        });
        toast('success', 'Updated');
      } else {
        await api.diet.addItem(session, memberId, {
          meal: slot, item: text, qty, calories, protein, carbs, fat,
        });
        toast('success', 'Added to your plan');
      }
      onClose();
    } catch (e) {
      setErrors(fieldErrors(e));
      if (!Object.keys(fieldErrors(e)).length) toast('error', 'Could not save', errorMessage(e));
    } finally { setBusy(false); }
  };

  return (
    <Modal
      title={item ? 'Edit food' : 'Add food'}
      subtitle="Only calories matter for the daily total — the rest is optional."
      onClose={onClose}
      footer={(
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={busy} onClick={submit}>
            {item ? 'Save' : 'Add'}
          </Button>
        </>
      )}
    >
      <div className="u-col u-gap-4">
        <TextField label="What is it?" required autoFocus value={text} error={errors.item}
          onChange={(e) => setText(e.target.value)} placeholder="e.g. Oats with milk and banana" />
        <TextField label="How much" value={qty} onChange={(e) => setQty(e.target.value)}
          placeholder="e.g. 1 bowl, 180 g, 2 pieces" />
        <SelectField label="Meal" value={slot} onChange={(e) => setSlot(e.target.value as MealSlot)}
          options={MEALS.map((m) => ({ value: m, label: titleCase(m) }))} />
        <NumberStepper label="Calories" value={calories} step={10} min={0} max={5000}
          suffix="kcal" error={errors.calories} onChange={setCalories} />

        <details className="macros">
          <summary className="t-sm t-muted">Macros (optional)</summary>
          <div className="u-col u-gap-3 u-mt-4">
            <NumberStepper label="Protein" value={protein} step={1} min={0} max={500} suffix="g"
              onChange={setProtein} />
            <NumberStepper label="Carbs" value={carbs} step={1} min={0} max={1000} suffix="g"
              onChange={setCarbs} />
            <NumberStepper label="Fat" value={fat} step={1} min={0} max={500} suffix="g"
              onChange={setFat} />
          </div>
        </details>
      </div>
    </Modal>
  );
}
