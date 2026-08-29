import { useState } from 'react';
import { Button, Modal } from '../../components/ui/primitives';
import { DateField, NumberStepper, TextField, fieldErrors, errorMessage } from '../../components/ui/forms';
import { useApp, useData } from '../../state/app';
import * as api from '../../lib/api';
import { todayISO } from '../../lib/date';

/**
 * The one-tap weigh-in. Full body measurements live behind "More measurements"
 * so the fast path stays a single number.
 */
export function RecordWeightSheet({ onClose, expanded }: { onClose: () => void; expanded?: boolean }) {
  const { session, toast } = useApp();
  const memberId = session?.memberId ?? '';
  const rows = useData(() => (session && memberId ? api.measurements.list(session, memberId) : []), [memberId]);
  const last = rows[rows.length - 1];

  const [takenAt, setTakenAt] = useState(todayISO());
  const [weight, setWeight] = useState(last?.weightKg ?? 70);
  const [more, setMore] = useState(Boolean(expanded));
  const [chest, setChest] = useState(last?.chestCm ?? 0);
  const [waist, setWaist] = useState(last?.waistCm ?? 0);
  const [arms, setArms] = useState(last?.armsCm ?? 0);
  const [thighs, setThighs] = useState(last?.thighsCm ?? 0);
  const [bodyFat, setBodyFat] = useState(last?.bodyFatPct ?? 0);
  const [height, setHeight] = useState(String(last?.heightCm ?? ''));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const delta = last ? weight - last.weightKg : 0;

  const submit = async () => {
    if (!session || !memberId) return;
    setBusy(true); setErrors({});
    try {
      await api.measurements.create(session, memberId, {
        takenAt,
        weightKg: weight,
        heightCm: height ? Number(height) : last?.heightCm,
        chestCm: chest || undefined,
        waistCm: waist || undefined,
        armsCm: arms || undefined,
        thighsCm: thighs || undefined,
        bodyFatPct: bodyFat || undefined,
      });
      toast('success', 'Weight recorded',
        last ? `${weight} kg · ${delta === 0 ? 'no change' : `${delta > 0 ? '+' : '−'}${Math.abs(delta).toFixed(1)} kg`} since last time`
          : `${weight} kg logged.`);
      onClose();
    } catch (e) {
      setErrors(fieldErrors(e));
      if (!Object.keys(fieldErrors(e)).length) toast('error', 'Could not save', errorMessage(e));
    } finally { setBusy(false); }
  };

  return (
    <Modal
      title="Record weight"
      subtitle={last ? `Last recorded ${last.weightKg} kg` : 'Your first weigh-in'}
      onClose={onClose}
      footer={<>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={submit} loading={busy}>Save</Button>
      </>}
    >
      <div className="u-col u-gap-4">
        <NumberStepper label="Weight (kg)" value={weight} onChange={setWeight}
          step={0.1} min={20} max={400} error={errors.weightKg}
          hint={last ? `${delta === 0 ? 'Same as' : `${delta > 0 ? '+' : '−'}${Math.abs(delta).toFixed(1)} kg vs`} last entry` : undefined} />

        <DateField label="Date" value={takenAt} max={todayISO()} error={errors.takenAt}
          onChange={(e) => setTakenAt(e.target.value)} />

        {!more ? (
          <Button variant="ghost" icon="ruler" onClick={() => setMore(true)}>
            Add body measurements
          </Button>
        ) : (
          <div className="u-col u-gap-4">
            <hr className="divider" />
            <div className="form-grid">
              <NumberStepper label="Chest (cm)" value={chest} onChange={setChest} step={0.5} max={250} />
              <NumberStepper label="Waist (cm)" value={waist} onChange={setWaist} step={0.5} max={250} />
              <NumberStepper label="Arms (cm)" value={arms} onChange={setArms} step={0.5} max={100} />
              <NumberStepper label="Thighs (cm)" value={thighs} onChange={setThighs} step={0.5} max={150} />
              <NumberStepper label="Body fat (%)" value={bodyFat} onChange={setBodyFat} step={0.1} max={70} />
              <TextField label="Height (cm)" inputMode="numeric" value={height}
                onChange={(e) => setHeight(e.target.value.replace(/[^\d]/g, ''))} />
            </div>
            <p className="t-xs t-faint">Leave anything at zero to skip it — measurements are stored sparsely.</p>
          </div>
        )}
      </div>
    </Modal>
  );
}
