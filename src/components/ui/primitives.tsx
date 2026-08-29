import { useEffect, useRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import type { MembershipStatus } from '../../lib/types';
import { initials } from '../../lib/format';

/* ================= Button ================= */
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  variant = 'secondary', size, block, icon, iconRight, loading, children, className = '', ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant; size?: 'sm' | 'lg'; block?: boolean;
  icon?: IconName; iconRight?: IconName; loading?: boolean;
}) {
  return (
    <button
      className={[
        'btn', `btn--${variant}`,
        size ? `btn--${size}` : '', block ? 'btn--block' : '',
        !children ? 'btn--icon' : '', className,
      ].filter(Boolean).join(' ')}
      disabled={rest.disabled || loading}
      {...rest}
    >
      {loading ? <span className="btn__spinner" /> : icon ? <Icon name={icon} size={16} /> : null}
      {children}
      {iconRight && !loading && <Icon name={iconRight} size={16} />}
    </button>
  );
}

/* ================= Card ================= */
export function Card({
  children, className = '', ...rest
}: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`card ${className}`} {...rest}>{children}</div>;
}

export function CardHead({
  title, subtitle, action, id,
}: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; id?: string }) {
  return (
    <div className="card__head">
      <div className="u-grow" style={{ minWidth: 0 }}>
        <h2 className="t-h3" id={id}>{title}</h2>
        {subtitle && <div className="t-xs t-faint u-mt-2">{subtitle}</div>}
      </div>
      {action}
    </div>
  );
}

export function CardBody({ children, flush, className = '' }: { children: ReactNode; flush?: boolean; className?: string }) {
  return <div className={`card__body ${flush ? 'card__body--flush' : ''} ${className}`}>{children}</div>;
}

/* ================= Badge ================= */
type Tone = 'neutral' | 'good' | 'warning' | 'serious' | 'critical' | 'brand';

export function Badge({ tone = 'neutral', dot, icon, children }: {
  tone?: Tone; dot?: boolean; icon?: IconName; children: ReactNode;
}) {
  return (
    <span className={`badge ${tone !== 'neutral' ? `badge--${tone}` : ''}`}>
      {dot && <span className="badge__dot" />}
      {icon && <Icon name={icon} size={12} strokeWidth={2.2} />}
      {children}
    </span>
  );
}

/* Status colour never travels alone — every one carries its own word. */
const STATUS: Record<MembershipStatus, { tone: Tone; label: string; icon: IconName }> = {
  active:   { tone: 'good',     label: 'Active',       icon: 'checkCircle' },
  expiring: { tone: 'warning',  label: 'Expiring',     icon: 'clock' },
  expired:  { tone: 'critical', label: 'Expired',      icon: 'alert' },
  none:     { tone: 'neutral',  label: 'No membership', icon: 'ban' },
};

export function StatusBadge({ status, daysLeft }: { status: MembershipStatus; daysLeft?: number }) {
  const s = STATUS[status];
  const suffix =
    status === 'expiring' && daysLeft != null
      ? ` · ${daysLeft === 0 ? 'today' : `${daysLeft}d`}`
      : '';
  return <Badge tone={s.tone} icon={s.icon}>{s.label}{suffix}</Badge>;
}

/* ================= Stat tile ================= */
export function StatTile({
  label, value, delta, deltaTone, hint, icon, accent, onClick, children,
}: {
  label: string; value: ReactNode;
  delta?: string; deltaTone?: 'good' | 'bad' | 'neutral';
  hint?: ReactNode; icon?: IconName; accent?: string;
  onClick?: () => void; children?: ReactNode;
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag className={`stat ${onClick ? 'stat--link' : ''}`} onClick={onClick} type={onClick ? 'button' : undefined}>
      {accent && <span className="stat__accent" style={{ background: accent }} />}
      <span className="stat__label">
        {icon && <Icon name={icon} size={14} />}
        {label}
      </span>
      <span className="stat__value u-truncate">{value}</span>
      {delta && (
        <span
          className="stat__delta"
          style={{
            color: deltaTone === 'good' ? 'var(--good)'
              : deltaTone === 'bad' ? 'var(--critical)' : 'var(--text-3)',
          }}
        >
          {delta}
        </span>
      )}
      {hint && <span className="t-xs t-faint">{hint}</span>}
      {children}
    </Tag>
  );
}

/* ================= Avatar ================= */
export function Avatar({ name, size = 'md', src }: {
  name: string; size?: 'sm' | 'md' | 'lg' | 'xl'; src?: string;
}) {
  return (
    <span className={`avatar ${size !== 'md' ? `avatar--${size}` : ''}`} aria-hidden="true">
      {src ? <img src={src} alt="" /> : initials(name)}
    </span>
  );
}

/* ================= Empty / error / loading ================= */
export function EmptyState({ icon = 'inbox', title, message, action }: {
  icon?: IconName; title: string; message?: string; action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty__art"><Icon name={icon} size={22} /></span>
      <span className="empty__title">{title}</span>
      {message && <span className="empty__msg">{message}</span>}
      {action && <span className="u-mt-2">{action}</span>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="empty">
      <span className="empty__art" style={{ background: 'var(--critical-soft)', color: 'var(--critical)' }}>
        <Icon name="alert" size={22} />
      </span>
      <span className="empty__title">Something went wrong</span>
      <span className="empty__msg">{message}</span>
      {onRetry && <Button className="u-mt-2" icon="refresh" onClick={onRetry}>Try again</Button>}
    </div>
  );
}

export function Skeleton({ w = '100%', h = 14, radius }: { w?: number | string; h?: number; radius?: number }) {
  return <span className="skeleton" style={{ display: 'block', width: w, height: h, borderRadius: radius }} />;
}

export function SkeletonRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="u-col u-gap-3" style={{ padding: 'var(--s-4)' }} aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="u-row u-gap-3">
          <Skeleton w={36} h={36} radius={999} />
          <div className="u-grow u-col u-gap-2">
            <Skeleton w={`${45 + ((i * 13) % 35)}%`} h={12} />
            <Skeleton w={`${25 + ((i * 7) % 20)}%`} h={10} />
          </div>
          <Skeleton w={64} h={22} radius={999} />
        </div>
      ))}
    </div>
  );
}

/* ================= Meter ================= */
export function Meter({ value, max = 100, tone, label }: {
  value: number; max?: number; tone?: 'good' | 'warning' | 'critical'; label?: string;
}) {
  const pctVal = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div
      className={`meter ${tone ? `meter--${tone}` : ''}`}
      role="progressbar" aria-valuenow={Math.round(pctVal)} aria-valuemin={0} aria-valuemax={100}
      aria-label={label}
    >
      <div className="meter__fill" style={{ width: `${pctVal}%` }} />
    </div>
  );
}

/* ================= Segmented control ================= */
export function Segmented<T extends string>({ value, onChange, options, ariaLabel }: {
  value: T; onChange: (v: T) => void;
  options: Array<{ value: T; label: string; count?: number }>;
  ariaLabel?: string;
}) {
  return (
    <div className="segmented" role="group" aria-label={ariaLabel}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
          {o.count != null && <span className="t-faint u-num" style={{ marginLeft: 5 }}>{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

/* ================= Tabs ================= */
export function Tabs<T extends string>({ value, onChange, tabs, ariaLabel }: {
  value: T; onChange: (v: T) => void;
  tabs: Array<{ value: T; label: string; count?: number }>;
  ariaLabel?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const onKey = (e: React.KeyboardEvent) => {
    const i = tabs.findIndex((t) => t.value === value);
    if (e.key === 'ArrowRight') { e.preventDefault(); onChange(tabs[(i + 1) % tabs.length].value); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); onChange(tabs[(i - 1 + tabs.length) % tabs.length].value); }
  };

  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [value]);

  return (
    <div className="tabs" role="tablist" aria-label={ariaLabel} ref={ref} onKeyDown={onKey}>
      {tabs.map((t) => (
        <button
          key={t.value} role="tab" type="button"
          aria-selected={value === t.value}
          tabIndex={value === t.value ? 0 : -1}
          onClick={() => onChange(t.value)}
        >
          {t.label}
          {t.count != null && <span className="t-faint u-num" style={{ marginLeft: 6 }}>{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

/* ================= Modal / bottom sheet ================= */
export function Modal({ title, subtitle, onClose, children, footer, wide }: {
  title: string; subtitle?: string; onClose: () => void;
  children: ReactNode; footer?: ReactNode; wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const first = ref.current?.querySelector<HTMLElement>(
      'input,select,textarea,button:not([data-close]),[tabindex]:not([tabindex="-1"])');
    first?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab' || !ref.current) return;
      const nodes = Array.from(ref.current.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'))
        .filter((n) => n.offsetParent !== null);
      if (!nodes.length) return;
      const firstNode = nodes[0], lastNode = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === firstNode) { e.preventDefault(); lastNode.focus(); }
      else if (!e.shiftKey && document.activeElement === lastNode) { e.preventDefault(); firstNode.focus(); }
    };
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      prev?.focus();
    };
  }, [onClose]);

  return (
    <div className="scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal ${wide ? 'modal--wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className="modal__grabber" />
        <div className="modal__head">
          <div className="u-grow">
            <h2 className="t-h2">{title}</h2>
            {subtitle && <div className="t-sm t-muted u-mt-2">{subtitle}</div>}
          </div>
          <button className="btn btn--ghost btn--sm btn--icon" onClick={onClose} aria-label="Close" data-close>
            <Icon name="x" size={17} />
          </button>
        </div>
        <div className="modal__body">{children}</div>
        {footer && <div className="modal__foot">{footer}</div>}
      </div>
    </div>
  );
}

/* ================= Key/value list ================= */
export function KV({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="kv">
      <span className="kv__k">{k}</span>
      <span className="kv__v">{children}</span>
    </div>
  );
}

/* ================= Page header ================= */
export function PageHead({ title, subtitle, actions }: {
  title: string; subtitle?: ReactNode; actions?: ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        <h1 className="page-head__title">{title}</h1>
        {subtitle && <div className="page-head__sub">{subtitle}</div>}
      </div>
      {actions && <div className="page-head__actions">{actions}</div>}
    </div>
  );
}

/* ================= Pagination ================= */
export function Pagination({ page, totalPages, total, limit, onPage, unit = 'records' }: {
  page: number; totalPages: number; total: number; limit: number;
  onPage: (p: number) => void; unit?: string;
}) {
  if (total === 0) return null;
  const from = (page - 1) * limit + 1;
  const to = Math.min(total, page * limit);
  return (
    <div className="pagination">
      <span className="t-xs t-faint u-num">
        {from.toLocaleString('en-IN')}–{to.toLocaleString('en-IN')} of {total.toLocaleString('en-IN')} {unit}
      </span>
      {totalPages > 1 && (
        <div className="u-row u-gap-2">
          <Button size="sm" icon="chevronLeft" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page" />
          <span className="t-xs u-num t-muted" style={{ minWidth: 62, textAlign: 'center' }}>
            Page {page} / {totalPages}
          </span>
          <Button size="sm" icon="chevronRight" disabled={page >= totalPages} onClick={() => onPage(page + 1)} aria-label="Next page" />
        </div>
      )}
    </div>
  );
}
