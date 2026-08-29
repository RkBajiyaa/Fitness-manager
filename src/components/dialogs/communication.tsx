import { useEffect, useState } from 'react';
import { Badge, Button, Modal } from '../ui/primitives';
import { SelectField, TextField, TextareaField, errorMessage } from '../ui/forms';
import { Icon } from '../ui/Icon';
import { useApp, useData } from '../../state/app';
import * as api from '../../lib/api';
import type { MessageChannel, MessageKind } from '../../lib/types';
import { MESSAGE_TEMPLATES, providerFor } from '../../lib/integrations/messaging';

const CHANNELS: Array<{ value: MessageChannel; label: string; icon: 'whatsapp' | 'mail' | 'bell' }> = [
  { value: 'whatsapp', label: 'WhatsApp', icon: 'whatsapp' },
  { value: 'email', label: 'Email', icon: 'mail' },
  { value: 'in_app', label: 'In-app', icon: 'bell' },
];

/**
 * Composes from a template plus the member's real data, then hands the result
 * to a provider. No provider is connected in this phase, so the dialog says so
 * plainly rather than implying a message was delivered.
 */
export function MessageDialog({
  memberId, initialKind = 'custom', onClose,
}: { memberId: string; initialKind?: MessageKind; onClose: () => void }) {
  const { session, toast } = useApp();
  const [channel, setChannel] = useState<MessageChannel>('whatsapp');
  const [kind, setKind] = useState<MessageKind>(initialKind);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  const summary = useData(() => (session ? api.members.get(session, memberId) : null), [memberId]);

  // Re-compose whenever the template changes; the owner can still edit freely.
  useEffect(() => {
    if (!session || kind === 'custom') return;
    try {
      const composed = api.messages.preview(session, memberId, kind);
      setSubject(composed.subject);
      setBody(composed.body);
    } catch { /* member unavailable */ }
  }, [session, memberId, kind]);

  if (!session || !summary) return null;
  const provider = providerFor(channel);

  const send = async () => {
    setBusy(true);
    try {
      const { result } = await api.messages.send(session, { memberId, channel, kind, subject, body });
      if (result.status === 'simulated') {
        toast('warning', 'Logged, not sent', result.detail);
      } else {
        toast('success', 'Message sent', summary.member.name);
      }
      onClose();
    } catch (e) {
      toast('error', 'Could not send', errorMessage(e));
    } finally { setBusy(false); }
  };

  return (
    <Modal
      title="Send a message"
      subtitle={`${summary.member.name} · ${summary.member.phone}`}
      onClose={onClose}
      wide
      footer={<>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="primary" icon="send" onClick={send} loading={busy} disabled={!body.trim()}>
          {provider.isConfigured() ? 'Send' : 'Compose & log'}
        </Button>
      </>}
    >
      <div className="u-col u-gap-4">
        <div className="field">
          <span className="field__label">Channel</span>
          <div className="u-row u-gap-2 u-wrap">
            {CHANNELS.map((c) => (
              <button key={c.value} className="chip" aria-pressed={channel === c.value}
                onClick={() => setChannel(c.value)}>
                <Icon name={c.icon} size={13} />{c.label}
              </button>
            ))}
          </div>
        </div>

        <SelectField
          label="Template" value={kind}
          onChange={(e) => setKind(e.target.value as MessageKind)}
          options={(Object.keys(MESSAGE_TEMPLATES) as MessageKind[])
            .map((k) => ({ value: k, label: `${MESSAGE_TEMPLATES[k].label} — ${MESSAGE_TEMPLATES[k].description}` }))}
        />

        <TextField label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
        <TextareaField
          label="Message" value={body} onChange={(e) => setBody(e.target.value)}
          style={{ minHeight: 160 }}
          hint={`${body.length} characters`}
        />

        {!provider.isConfigured() && (
          <div className="inline-alert">
            <Icon name="info" size={16} style={{ flex: 'none', marginTop: 1, color: 'var(--text-2)' }} />
            <span className="t-sm t-muted">
              <strong>{CHANNELS.find((c) => c.value === channel)?.label} is not connected.</strong>{' '}
              The message will be composed and saved to this member's communication log, but nothing
              will be delivered. Connecting a provider is a configuration change — the templates,
              the log and this screen stay exactly as they are.
            </span>
          </div>
        )}
      </div>
    </Modal>
  );
}

/* ============================================================
   Assign a program
   ============================================================ */
export function AssignProgramDialog({
  memberId, onClose,
}: { memberId: string; onClose: () => void }) {
  const { session, toast } = useApp();
  const templates = useData(() => (session ? api.programs.templates(session) : []), [session?.gymId]);
  const current = useData(() => (session ? api.programs.forMember(session, memberId) : null), [memberId]);
  const summary = useData(() => (session ? api.members.get(session, memberId) : null), [memberId]);
  const [selected, setSelected] = useState(templates[0]?.id ?? '');
  const [busy, setBusy] = useState(false);

  if (!session || !summary) return null;

  const assign = async () => {
    setBusy(true);
    try {
      const program = await api.programs.assign(session, memberId, selected);
      toast('success', 'Program assigned',
        `${summary.member.name} will see ${program.name} the next time they open the app.`);
      onClose();
    } catch (e) {
      toast('error', 'Could not assign the program', errorMessage(e));
    } finally { setBusy(false); }
  };

  return (
    <Modal
      title={current ? 'Change program' : 'Assign a program'}
      subtitle={summary.member.name}
      onClose={onClose}
      footer={<>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={assign} loading={busy} disabled={!selected}>
          {current ? 'Replace program' : 'Assign'}
        </Button>
      </>}
    >
      <div className="u-col u-gap-3">
        {current && (
          <div className="inline-alert">
            <Icon name="info" size={16} style={{ flex: 'none', marginTop: 1, color: 'var(--text-2)' }} />
            <span className="t-sm t-muted">
              Currently on <strong>{current.name}</strong>. Assigning a new program replaces it.
              Completed sessions are never affected.
            </span>
          </div>
        )}

        {templates.map((t) => (
          <button
            key={t.id}
            className="card card--interactive"
            style={{
              padding: 'var(--s-4)', textAlign: 'left', cursor: 'pointer',
              borderColor: selected === t.id ? 'var(--brand)' : undefined,
              background: selected === t.id ? 'var(--brand-soft)' : undefined,
            }}
            aria-pressed={selected === t.id}
            onClick={() => setSelected(t.id)}
          >
            <div className="u-between u-gap-2">
              <span className="t-h3">{t.name}</span>
              {t.kind === 'onboarding' && <Badge tone="brand">Onboarding</Badge>}
            </div>
            <p className="t-sm t-muted u-mt-2">{t.description}</p>
            <div className="t-xs t-faint u-mt-3">
              {t.days.filter((d) => !d.isRest).length} training days ·
              {' '}{t.days.reduce((s, d) => s + d.exercises.length, 0)} exercises
            </div>
          </button>
        ))}
      </div>
    </Modal>
  );
}
