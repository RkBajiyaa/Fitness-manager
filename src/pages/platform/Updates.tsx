import { useState } from 'react';
import {
  Badge, Button, Card, CardBody, EmptyState, Modal, PageHead, Segmented,
} from '../../components/ui/primitives';
import { SelectField, TextField, TextareaField, fieldErrors, errorMessage } from '../../components/ui/forms';
import { Icon } from '../../components/ui/Icon';
import { useApp, useData } from '../../state/app';
import * as api from '../../lib/api';
import { dateShort } from '../../lib/format';
import type { PlatformUpdate, PlatformUpdateKind } from '../../lib/types';

const KIND_LABEL: Record<PlatformUpdateKind, string> = {
  feature: 'New feature',
  maintenance: 'Maintenance',
  product: 'Product update',
  notice: 'Important notice',
};

const KIND_ICON: Record<PlatformUpdateKind, 'sparkles' | 'settings' | 'zap' | 'alert'> = {
  feature: 'sparkles', maintenance: 'settings', product: 'zap', notice: 'alert',
};

/**
 * Platform-level announcements. They appear IN THE APP for the chosen
 * audience — nothing is emailed or messaged, because no provider is
 * connected and the product does not pretend otherwise.
 */
export default function PlatformUpdates() {
  const { session, toast, confirm } = useApp();
  const [composing, setComposing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'published' | 'draft'>('all');

  const rows = useData(() => (session ? api.platform.updates.list(session) : []), [session?.userId]);
  if (!session) return null;

  const visible = rows.filter((r) => filter === 'all'
    || (filter === 'published' ? Boolean(r.publishedAt) : !r.publishedAt));

  const togglePublish = async (row: PlatformUpdate) => {
    await api.platform.updates.publish(session, row.id, !row.publishedAt);
    toast('success', row.publishedAt ? 'Unpublished' : 'Published',
      row.publishedAt ? 'It is no longer shown in the app.'
        : 'It now appears in-app for the chosen audience.');
  };

  const remove = async (row: PlatformUpdate) => {
    const ok = await confirm({
      title: 'Delete this update?', tone: 'danger', confirmLabel: 'Delete',
      message: `“${row.title}” is removed for everyone.`,
    });
    if (!ok) return;
    await api.platform.updates.remove(session, row.id);
    toast('success', 'Update deleted');
  };

  return (
    <div className="anim-page">
      <PageHead
        title="Platform updates"
        subtitle="In-app announcements to owners and members. Nothing is emailed or messaged."
        actions={<Button variant="primary" icon="plus" onClick={() => setComposing(true)}>New update</Button>}
      />

      {rows.length > 0 && (
        <div className="u-mb-4">
          <Segmented
            ariaLabel="Publication state" value={filter} onChange={setFilter}
            options={[
              { value: 'all', label: 'All', count: rows.length },
              { value: 'published', label: 'Published', count: rows.filter((r) => r.publishedAt).length },
              { value: 'draft', label: 'Drafts', count: rows.filter((r) => !r.publishedAt).length },
            ]}
          />
        </div>
      )}

      {visible.length === 0 ? (
        <Card>
          <EmptyState
            icon="bell"
            title={rows.length === 0 ? 'No updates yet' : 'Nothing in this view'}
            message={rows.length === 0
              ? 'Write one when there is something worth telling your customers.'
              : 'Try a different filter.'}
            action={rows.length === 0
              ? <Button variant="primary" icon="plus" onClick={() => setComposing(true)}>Write an update</Button>
              : <Button onClick={() => setFilter('all')}>Show all</Button>}
          />
        </Card>
      ) : (
        <div className="u-col u-gap-3">
          {visible.map((row) => (
            <Card key={row.id}>
              <CardBody>
                <div className="u-row u-gap-3" style={{ alignItems: 'flex-start' }}>
                  <span style={{
                    width: 36, height: 36, flex: 'none', display: 'grid', placeItems: 'center',
                    borderRadius: 'var(--r-md)', background: 'var(--surface-3)', color: 'var(--text-2)',
                  }}>
                    <Icon name={KIND_ICON[row.kind]} size={17} />
                  </span>
                  <div className="u-grow" style={{ minWidth: 0 }}>
                    <div className="u-row u-gap-2 u-wrap">
                      <span className="t-sm" style={{ fontWeight: 600 }}>{row.title}</span>
                      <Badge tone={row.publishedAt ? 'good' : 'neutral'}>
                        {row.publishedAt ? 'Published' : 'Draft'}
                      </Badge>
                      <span className="tag tag--quiet">{KIND_LABEL[row.kind]}</span>
                      <span className="tag tag--quiet">
                        {row.audience === 'everyone' ? 'Everyone'
                          : row.audience === 'owners' ? 'Owners' : 'Members'}
                      </span>
                    </div>
                    <p className="t-sm t-muted u-mt-3" style={{ lineHeight: 1.6 }}>{row.body}</p>
                    <p className="t-xs t-faint u-mt-3">
                      {row.publishedAt
                        ? `Published ${dateShort(row.publishedAt)}`
                        : `Drafted ${dateShort(row.createdAt)}`}
                    </p>
                  </div>
                  <div className="u-col u-gap-2">
                    <Button size="sm" onClick={() => togglePublish(row)}>
                      {row.publishedAt ? 'Unpublish' : 'Publish'}
                    </Button>
                    <Button size="sm" variant="ghost" icon="trash"
                      onClick={() => remove(row)} aria-label={`Delete ${row.title}`} />
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {composing && <Compose onClose={() => setComposing(false)} />}
    </div>
  );
}

function Compose({ onClose }: { onClose: () => void }) {
  const { session, toast } = useApp();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [kind, setKind] = useState<PlatformUpdateKind>('product');
  const [audience, setAudience] = useState<PlatformUpdate['audience']>('owners');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState('');

  const submit = async (publish: boolean) => {
    if (!session) return;
    setBusy(publish ? 'publish' : 'draft'); setErrors({});
    try {
      await api.platform.updates.create(session, { title, body, kind, audience, publish });
      toast('success', publish ? 'Update published' : 'Draft saved');
      onClose();
    } catch (e) {
      setErrors(fieldErrors(e));
      if (!Object.keys(fieldErrors(e)).length) toast('error', 'Could not save', errorMessage(e));
    } finally { setBusy(''); }
  };

  return (
    <Modal
      title="New platform update"
      subtitle="Shown in the app. No email or WhatsApp is sent — no provider is connected."
      onClose={onClose}
      footer={(
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button loading={busy === 'draft'} onClick={() => submit(false)}>Save draft</Button>
          <Button variant="primary" loading={busy === 'publish'} onClick={() => submit(true)}>Publish</Button>
        </>
      )}
    >
      <div className="u-col u-gap-4">
        <TextField label="Title" required autoFocus value={title} error={errors.title}
          onChange={(e) => setTitle(e.target.value)} placeholder="What changed" />
        <TextareaField label="Update" required rows={5} value={body} error={errors.body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write it the way you would say it to a customer." />
        <SelectField label="Type" value={kind}
          onChange={(e) => setKind(e.target.value as PlatformUpdateKind)}
          options={(Object.keys(KIND_LABEL) as PlatformUpdateKind[])
            .map((k) => ({ value: k, label: KIND_LABEL[k] }))} />
        <SelectField label="Audience" value={audience}
          onChange={(e) => setAudience(e.target.value as PlatformUpdate['audience'])}
          options={[
            { value: 'owners', label: 'Gym owners' },
            { value: 'members', label: 'Members' },
            { value: 'everyone', label: 'Everyone' },
          ]} />
      </div>
    </Modal>
  );
}
