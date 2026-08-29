import type { ReactNode } from 'react';

/**
 * Progress ring. Used for today's three member targets — session, hydration,
 * weight logged — where a bar would read as "data" and a ring reads as "today".
 */
export function Ring({
  value, max, size = 62, stroke = 6, color = 'var(--brand)', children, label,
}: {
  value: number; max: number; size?: number; stroke?: number;
  color?: string; children?: ReactNode; label?: string;
}) {
  const pct = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;

  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} role="img"
        aria-label={label ?? `${Math.round(pct * 100)} percent`}>
        <circle
          className="ring__track" cx={size / 2} cy={size / 2} r={r}
          fill="none" strokeWidth={stroke}
        />
        <circle
          className="ring__fill" cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct)}
        />
      </svg>
      {children && <span className="ring__label">{children}</span>}
    </div>
  );
}
