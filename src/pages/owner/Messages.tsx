import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Avatar, Badge, Button, Card, CardBody, CardHead, EmptyState, PageHead, Segmented, StatTile,
} from '../../components/ui/primitives';
import { SearchInput } from '../../components/ui/forms';
import { Icon } from '../../components/ui/Icon';
import { MessageDialog } from '../../components/dialogs/communication';
import { useApp, useData } from '../../state/app';
import * as api from '../../lib/api';
import type { MessageChannel } from '../../lib/types';
import { MESSAGE_TEMPLATES, anyProviderConfigured } from '../../lib/integrations/messaging';
import { count, dateShort, time, titleCase } from '../../lib/format';

const CHANNEL_ICON: Record<MessageChannel, 'whatsapp' | 'mail' | 'bell'> = {
  whatsapp: 'whatsapp', email: 'mail', in_app: 'bell',
};

export default function Messages() {
  const { session } = useApp();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [channel, setChannel] = useState<MessageChannel | 'all'>('all');
  const [compose, setCompose] = useState<string | null>(null);

  const messages = useData(() => (session ? api.messages.list(session) : []), [session?.gymId]);
  const rows = useData(() => (session ? api.members.rows(session) : []), [session?.gymId]);

  if (!session) return null;

  const names = new Map(rows.map((r) => [r.member.id, r.member.name]));
  const filtered = messages
    .filter((m) => (channel === 'all' ? true : m.channel === channel))
    .filter((m) => {
      const needle = q.toLowerCase().trim();
      if (!needle) return true;
      return (names.get(m.memberId) ?? '').toLowerCase().includes(needle)
        || m.subject.toLowerCase().includes(needle)
        || m.body.toLowerCase().includes(needle);
    });

  const configured = anyProviderConfigured();

  return (
    <div className="anim-page">
      <PageHead
        title="Communication"
        subtitle="Everything sent to members, and the templates behind it."
        actions={<Button variant="primary" icon="message" onClick={() => nav('/owner/members')}>
          Message a member
        </Button>}
      />

      {!configured && (
        <div className="inline-alert u-mb-5">
          <Icon name="info" size={17} style={{ flex: 'none', marginTop: 1, color: 'var(--text-2)' }} />
          <span className="t-sm t-muted">
            <strong>No delivery provider is connected.</strong> Messages are composed from real member
            data and written to this log, but nothing is delivered. That is deliberate — the product
            will not tell you a message was sent when it was not. Connecting WhatsApp Business or an
            email provider is a configuration change; the templates and this log stay as they are.
          </span>
        </div>
      )}

      <div className="grid-stats u-mb-5">
        <StatTile label="Messages logged" icon="message" value={count(messages.length)} />
        <StatTile label="Templates" icon="layers" value={count(Object.keys(MESSAGE_TEMPLATES).length)} />
        <StatTile label="Delivery" icon="send" value={configured ? 'Connected' : 'Not connected'}
          hint={configured ? undefined : 'composed and logged only'} />
      </div>

      <div className="grid-2:1">
        <Card>
          <div className="card__body" style={{ paddingBottom: 'var(--s-4)' }}>
            <div className="toolbar">
              <div className="toolbar__search">
                <SearchInput value={q} onChange={setQ} placeholder="Search member, subject or text" />
              </div>
              <Segmented ariaLabel="Channel" value={channel} onChange={setChannel}
                options={[
                  { value: 'all', label: 'All' },
                  { value: 'whatsapp', label: 'WhatsApp' },
                  { value: 'email', label: 'Email' },
                  { value: 'in_app', label: 'In-app' },
                ]} />
            </div>
          </div>
          <CardBody flush>
            {filtered.length === 0 ? (
              <EmptyState icon="message" title="Nothing here yet"
                message="Messages you send from a member's profile appear here with their status."
                action={<Button variant="primary" icon="users" onClick={() => nav('/owner/members')}>
                  Go to members</Button>} />
            ) : (
              <ul className="cardlist">
                {filtered.map((m) => (
                  <li key={m.id}>
                    <button className="cardlist__item" style={{ alignItems: 'flex-start' }}
                      onClick={() => nav(`/owner/members/${m.memberId}`)}>
                      <Avatar name={names.get(m.memberId) ?? 'Member'} size="sm" />
                      <span className="u-grow" style={{ minWidth: 0 }}>
                        <span className="u-between u-gap-2">
                          <span className="t-sm" style={{ fontWeight: 580 }}>
                            {names.get(m.memberId) ?? 'Removed member'}
                          </span>
                          <span className="u-row u-gap-2">
                            <Icon name={CHANNEL_ICON[m.channel]} size={13} className="t-faint" />
                            <Badge tone={m.status === 'sent' ? 'good' : 'neutral'}>
                              {m.status === 'simulated' ? 'Logged' : titleCase(m.status)}
                            </Badge>
                          </span>
                        </span>
                        <span className="t-sm" style={{ display: 'block', marginTop: 3, fontWeight: 520 }}>
                          {m.subject || titleCase(m.kind)}
                        </span>
                        <span className="t-xs t-muted" style={{ display: 'block', marginTop: 2, lineHeight: 1.5 }}>
                          {m.body.slice(0, 140)}{m.body.length > 140 ? '…' : ''}
                        </span>
                        <span className="t-xs t-faint" style={{ display: 'block', marginTop: 4 }}>
                          {dateShort(m.createdAt)} · {time(m.createdAt)} · {MESSAGE_TEMPLATES[m.kind].label}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHead title="Templates" subtitle="Composed from each member's real data" />
          <CardBody flush>
            <ul className="cardlist">
              {(Object.keys(MESSAGE_TEMPLATES) as Array<keyof typeof MESSAGE_TEMPLATES>).map((k) => (
                <li key={k} className="cardlist__item" style={{ cursor: 'default' }}>
                  <span className="u-grow" style={{ minWidth: 0 }}>
                    <span className="t-sm" style={{ fontWeight: 560 }}>{MESSAGE_TEMPLATES[k].label}</span>
                    <span className="t-xs t-faint" style={{ display: 'block' }}>
                      {MESSAGE_TEMPLATES[k].description}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>

      {compose && <MessageDialog memberId={compose} onClose={() => setCompose(null)} />}
    </div>
  );
}
