import { useMemo, useState } from 'react';
import { Modal, Button, Avatar, Badge } from '../ui/primitives';
import {
  MoneyField, SelectField, TextField, TextareaField, DateField, SearchInput,
  fieldErrors, errorMessage, Switch,
} from '../ui/forms';
import { Icon } from '../ui/Icon';
import { useApp, useData } from '../../state/app';
import * as api from '../../lib/api';
import type { ExpenseCategory, PaymentMethod } from '../../lib/types';
import { CATEGORY_LABEL } from '../../lib/derive';
import { money, dateShort } from '../../lib/format';
import { todayISO } from '../../lib/date';

const METHODS: Array<{ value: PaymentMethod; label: string }> = [
  { value: 'upi', label: 'UPI' },
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'bank_transfer', label: 'Bank transfer' },
];

/* ============================================================
   Record a payment
   ============================================================ */
export function RecordPaymentDialog({
  memberId: fixedMemberId, onClose,
}: { memberId?: string; onClose: () => void }) {
  const { session, toast } = useApp();
  const [memberId, setMemberId] = useState(fixedMemberId ?? '');
  const [q, setQ] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('upi');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const candidates = useData(
    () => (session && !fixedMemberId ? api.payments.outstanding(session) : []),
    [session?.gymId, fixedMemberId],
  );

  const filtered = useMemo(() => {
    const n = q.toLowerCase().trim();
    const rows = n
      ? candidates.filter((c) => c.member.name.toLowerCase().includes(n) || c.member.memberCode.toLowerCase().includes(n))
      : candidates;
    return rows.slice(0, 8);
  }, [candidates, q]);

  const isWalkIn = memberId === 'walkin';
  const selected = useData(() => {
    if (!session || !memberId || isWalkIn) return null;
    try { return api.members.get(session, memberId); } catch { return null; }
  }, [session?.gymId, memberId]);

  const due = selected?.dues.due ?? 0;

  const submit = async () => {
    if (!session) return;
    setBusy(true); setErrors({});
    try {
      await api.payments.create(session, {
        memberId: isWalkIn ? null : memberId || null,
        amount: Number(amount),
        method,
        note,
        source: !isWalkIn && due > 0 ? undefined : 'other',
      });
      toast('success', 'Payment recorded',
        `${money(Number(amount))} from ${selected?.member.name ?? 'a walk-in service'}.`);
      onClose();
    } catch (e) {
      setErrors(fieldErrors(e));
      if (!Object.keys(fieldErrors(e)).length) toast('error', 'Could not record payment', errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Record payment"
      subtitle="Money received at the desk. Online payments will write the same record later."
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit} loading={busy} disabled={!amount || Number(amount) <= 0}>
            Record {amount ? money(Number(amount)) : 'payment'}
          </Button>
        </>
      }
    >
      {!fixedMemberId && !memberId && (
        <div className="u-col u-gap-3">
          <SearchInput value={q} onChange={setQ} placeholder="Find a member with a balance" />
          {filtered.length === 0 ? (
            <p className="t-sm t-faint">
              {candidates.length === 0
                ? 'Nobody has a pending balance right now.'
                : `No member matches “${q}”.`}
            </p>
          ) : (
            <ul className="cardlist" style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
              {filtered.map((c) => (
                <li key={c.member.id}>
                  <button className="cardlist__item" onClick={() => { setMemberId(c.member.id); setAmount(String(c.dues.due)); }}>
                    <Avatar name={c.member.name} size="sm" />
                    <span className="u-grow u-truncate">
                      <span className="t-sm" style={{ fontWeight: 560 }}>{c.member.name}</span>
                      <span className="t-xs t-faint" style={{ display: 'block' }}>{c.member.memberCode}</span>
                    </span>
                    <span className="t-sm u-num" style={{ color: 'var(--critical)', fontWeight: 600 }}>
                      {money(c.dues.due)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="t-xs t-faint">
            Taking money for something other than a membership? Skip the search and
            <button className="btn btn--ghost btn--sm" onClick={() => setMemberId('walkin')} style={{ marginLeft: 4 }}>
              record a service payment
            </button>
          </p>
        </div>
      )}

      {(memberId || fixedMemberId) && (
        <div className="u-col u-gap-4">
          {selected && (
            <div className="card" style={{ background: 'var(--surface-2)' }}>
              <div className="card__body u-between u-gap-3" style={{ padding: 'var(--s-3) var(--s-4)' }}>
                <span className="u-row u-gap-3">
                  <Avatar name={selected.member.name} size="sm" />
                  <span>
                    <span className="t-sm" style={{ fontWeight: 580 }}>{selected.member.name}</span>
                    <span className="t-xs t-faint" style={{ display: 'block' }}>
                      {selected.membership?.planNameSnapshot ?? 'No active plan'}
                    </span>
                  </span>
                </span>
                <span className="u-right">
                  <span className="t-xs t-faint" style={{ display: 'block' }}>Balance due</span>
                  <span className="t-sm u-num" style={{ fontWeight: 620, color: due > 0 ? 'var(--critical)' : 'var(--good)' }}>
                    {money(due)}
                  </span>
                </span>
              </div>
            </div>
          )}

          <MoneyField
            label="Amount received" required autoFocus
            value={amount} error={errors.amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))}
            hint={due > 0 ? `Full balance is ${money(due)}.` : 'Recorded as a service payment.'}
          />
          <SelectField
            label="Payment method" value={method} options={METHODS}
            onChange={(e) => setMethod(e.target.value as PaymentMethod)}
          />
          <TextField label="Note" placeholder="Optional — e.g. paid at the desk"
            value={note} onChange={(e) => setNote(e.target.value)} />

          {!fixedMemberId && (
            <Button variant="ghost" size="sm" icon="arrowLeft" onClick={() => { setMemberId(''); setAmount(''); }}>
              Choose a different member
            </Button>
          )}
        </div>
      )}
    </Modal>
  );
}

/* ============================================================
   Add an expense
   ============================================================ */
export function AddExpenseDialog({ onClose }: { onClose: () => void }) {
  const { session, toast } = useApp();
  const [category, setCategory] = useState<ExpenseCategory>('maintenance');
  const [amount, setAmount] = useState('');
  const [spentAt, setSpentAt] = useState(todayISO());
  const [description, setDescription] = useState('');
  const [vendor, setVendor] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('upi');
  const [isRecurring, setIsRecurring] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!session) return;
    setBusy(true); setErrors({});
    try {
      await api.expenses.create(session, {
        category, amount: Number(amount), spentAt, description, vendor, method, isRecurring,
      });
      toast('success', 'Expense added', `${money(Number(amount))} recorded under ${CATEGORY_LABEL[category]}.`);
      onClose();
    } catch (e) {
      setErrors(fieldErrors(e));
      if (!Object.keys(fieldErrors(e)).length) toast('error', 'Could not add expense', errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Add expense"
      subtitle="Money out. This immediately affects operating profit."
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit} loading={busy}>Add expense</Button>
        </>
      }
    >
      <div className="form-grid">
        <MoneyField
          label="Amount" required autoFocus className="span-2"
          value={amount} error={errors.amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))}
        />
        <SelectField
          label="Category" required value={category}
          onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
          options={(Object.keys(CATEGORY_LABEL) as ExpenseCategory[]).map((k) => ({ value: k, label: CATEGORY_LABEL[k] }))}
        />
        <DateField label="Date" required value={spentAt} max={todayISO()} error={errors.spentAt}
          onChange={(e) => setSpentAt(e.target.value)} />
        <TextField label="Description" required className="span-2" placeholder="What was this for?"
          value={description} error={errors.description} onChange={(e) => setDescription(e.target.value)} />
        <TextField label="Vendor" placeholder="Optional" value={vendor} onChange={(e) => setVendor(e.target.value)} />
        <SelectField label="Paid by" value={method} options={METHODS}
          onChange={(e) => setMethod(e.target.value as PaymentMethod)} />
        <div className="span-2">
          <Switch checked={isRecurring} onChange={setIsRecurring} label="This is a recurring monthly expense" />
        </div>
        <div className="span-2 t-xs t-faint u-row u-gap-2">
          <Icon name="info" size={13} />
          Receipt upload arrives with object storage — the field is already on the record.
        </div>
      </div>
    </Modal>
  );
}

/* ============================================================
   Renew / start a membership
   ============================================================ */
export function RenewMembershipDialog({
  memberId, onClose,
}: { memberId: string; onClose: () => void }) {
  const { session, toast } = useApp();
  const plans = useData(() => (session ? api.plans.list(session) : []), [session?.gymId]);
  const summary = useData(() => (session ? api.members.get(session, memberId) : null), [session?.gymId, memberId]);

  const [planId, setPlanId] = useState(plans[0]?.id ?? '');
  const [discount, setDiscount] = useState('0');
  const [amountPaid, setAmountPaid] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('upi');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const plan = plans.find((p) => p.id === planId);
  const net = Math.max(0, (plan?.price ?? 0) - Number(discount || 0));
  const startsOn = summary?.membership && summary.daysLeft >= 0
    ? new Date(new Date(summary.membership.endDate).getTime() + 86400000).toISOString().slice(0, 10)
    : todayISO();

  const submit = async () => {
    if (!session || !plan) return;
    setBusy(true); setErrors({});
    try {
      await api.memberships.create(session, memberId, {
        planId, discount: Number(discount || 0),
        amountPaid: amountPaid === '' ? net : Number(amountPaid),
        method,
      });
      toast('success', 'Membership renewed', `${plan.name} · valid from ${dateShort(startsOn)}.`);
      onClose();
    } catch (e) {
      setErrors(fieldErrors(e));
      if (!Object.keys(fieldErrors(e)).length) toast('error', 'Could not renew', errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={summary?.membership ? 'Renew membership' : 'Start membership'}
      subtitle={summary ? summary.member.name : undefined}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit} loading={busy} disabled={!plan}>
            {summary?.membership ? 'Renew' : 'Activate'} · {money(net)}
          </Button>
        </>
      }
    >
      <div className="u-col u-gap-4">
        <SelectField
          label="Plan" required value={planId} onChange={(e) => setPlanId(e.target.value)}
          options={plans.map((p) => ({ value: p.id, label: `${p.name} · ${money(p.price)} · ${p.durationDays} days` }))}
        />
        <div className="form-grid">
          <MoneyField label="Discount" value={discount} error={errors.discount}
            onChange={(e) => setDiscount(e.target.value.replace(/[^\d]/g, ''))} />
          <MoneyField
            label="Amount paid now" placeholder={String(net)} value={amountPaid} error={errors.amountPaid}
            onChange={(e) => setAmountPaid(e.target.value.replace(/[^\d]/g, ''))}
            hint={`Leave blank to take the full ${money(net)}.`}
          />
        </div>
        <SelectField label="Payment method" value={method} options={METHODS}
          onChange={(e) => setMethod(e.target.value as PaymentMethod)} />

        <div className="card" style={{ background: 'var(--surface-2)' }}>
          <div className="card__body" style={{ padding: 'var(--s-3) var(--s-4)' }}>
            <div className="u-between t-sm">
              <span className="t-muted">Starts</span>
              <span style={{ fontWeight: 560 }}>{dateShort(startsOn)}</span>
            </div>
            <div className="u-between t-sm u-mt-2">
              <span className="t-muted">Payable</span>
              <span className="u-num" style={{ fontWeight: 620 }}>{money(net)}</span>
            </div>
            {summary?.membership && summary.daysLeft >= 0 && (
              <p className="t-xs t-faint u-mt-3">
                The current plan still has {summary.daysLeft} day{summary.daysLeft === 1 ? '' : 's'} left,
                so the renewal begins the day after it ends — no gap in access.
              </p>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* ============================================================
   Mark attendance manually
   ============================================================ */
export function MarkAttendanceDialog({ onClose }: { onClose: () => void }) {
  const { session, toast } = useApp();
  const [q, setQ] = useState('');

  const rows = useData(
    () => (session && q.trim().length >= 1 ? api.members.list(session, { q, limit: 8 }).data : []),
    [session?.gymId, q],
  );
  const todaySessions = useData(
    () => (session ? api.attendance.onDate(session, todayISO()) : []),
    [session?.gymId],
  );
  const insideIds = new Set(todaySessions.filter((s) => !s.lastOut).map((s) => s.memberId));

  const mark = async (memberId: string, name: string, type: 'check_in' | 'check_out') => {
    if (!session) return;
    try {
      await api.attendance.mark(session, memberId, type);
      toast('success', type === 'check_in' ? 'Checked in' : 'Checked out', name);
    } catch (e) {
      toast('error', 'Could not record attendance', errorMessage(e));
    }
  };

  return (
    <Modal
      title="Mark attendance"
      subtitle="Manual entry. A connected device will post the same events automatically."
      onClose={onClose}
      footer={<Button variant="primary" onClick={onClose}>Done</Button>}
    >
      <div className="u-col u-gap-3">
        <SearchInput value={q} onChange={setQ} placeholder="Search a member to check in or out" />
        {q.trim().length === 0 ? (
          <p className="t-sm t-faint">Start typing a name, phone number or member ID.</p>
        ) : rows.length === 0 ? (
          <p className="t-sm t-faint">No member matches “{q}”.</p>
        ) : (
          <ul className="cardlist" style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
            {rows.map((r) => {
              const inside = insideIds.has(r.member.id);
              return (
                <li key={r.member.id} className="cardlist__item" style={{ cursor: 'default' }}>
                  <Avatar name={r.member.name} size="sm" />
                  <span className="u-grow u-truncate">
                    <span className="t-sm" style={{ fontWeight: 560 }}>{r.member.name}</span>
                    <span className="t-xs t-faint" style={{ display: 'block' }}>
                      {r.member.memberCode}
                      {inside && <> · <span style={{ color: 'var(--good)' }}>inside now</span></>}
                    </span>
                  </span>
                  {inside ? (
                    <Button size="sm" icon="arrowRight" onClick={() => mark(r.member.id, r.member.name, 'check_out')}>
                      Check out
                    </Button>
                  ) : (
                    <Button size="sm" variant="primary" icon="check"
                      onClick={() => mark(r.member.id, r.member.name, 'check_in')}>
                      Check in
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <div className="u-between u-gap-3 u-mt-2">
          <span className="t-xs t-faint">
            <Badge icon="fingerprint">Device not connected</Badge>
          </span>
          <span className="t-xs t-faint">{todaySessions.length} check-ins today</span>
        </div>
      </div>
    </Modal>
  );
}

/* ============================================================
   Add an internal note
   ============================================================ */
export function AddNoteDialog({ memberId, onClose }: { memberId: string; onClose: () => void }) {
  const { session, toast } = useApp();
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!session) return;
    setBusy(true); setError('');
    try {
      await api.members.addNote(session, memberId, body);
      toast('success', 'Note added');
      onClose();
    } catch (e) {
      setError(fieldErrors(e).body ?? errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Add internal note"
      subtitle="Visible to gym staff only — never to the member."
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit} loading={busy} disabled={!body.trim()}>Save note</Button>
        </>
      }
    >
      <TextareaField
        label="Note" autoFocus value={body} error={error}
        placeholder="e.g. Recovering from a shoulder niggle — no heavy overhead work for two weeks."
        onChange={(e) => setBody(e.target.value)}
      />
    </Modal>
  );
}
