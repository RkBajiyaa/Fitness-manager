import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Point } from '../../lib/derive';

/* ============================================================
   Hand-built SVG charts.
   Rules held throughout (see docs/ARCHITECTURE.md G):
   - one y-axis, ever; two measures of different scale = two charts
   - marks <= 24px thick, 2px lines, 4px rounded data-end, square baseline
   - 2px surface gap between adjacent/stacked fills
   - hairline solid gridlines one step off the surface
   - legend whenever there are >= 2 series; selective direct labels
   - text always wears text tokens, never the series colour
   - every chart ships a visually-hidden data table
   ============================================================ */

export const SERIES = {
  s1: 'var(--series-1)',
  s2: 'var(--series-2)',
  s3: 'var(--series-3)',
  pos: 'var(--diverge-pos)',
  neg: 'var(--diverge-neg)',
} as const;

export interface Series {
  key: string;
  label: string;
  color: string;
  points: Point[];
}

/* ---------------- sizing ---------------- */

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setW(entry.contentRect.width));
    ro.observe(el);
    setW(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/* ---------------- scales ---------------- */

function niceCeil(v: number): number {
  if (v <= 0) return 1;
  const mag = 10 ** Math.floor(Math.log10(v));
  const n = v / mag;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * mag;
}

function ticksFor(max: number, min = 0, count = 4): number[] {
  const span = niceCeil((max - min) / count);
  const out: number[] = [];
  for (let v = min; v <= max + span * 0.001; v += span) out.push(Math.round(v * 1000) / 1000);
  return out;
}

/* ---------------- shared chrome ---------------- */

export function ChartFrame({
  title, subtitle, legend, children, action,
}: { title?: string; subtitle?: string; legend?: ReactNode; children: ReactNode; action?: ReactNode }) {
  return (
    <figure style={{ margin: 0 }}>
      {(title || legend || action) && (
        <figcaption className="u-between u-wrap u-gap-3" style={{ marginBottom: 'var(--s-3)' }}>
          <div>
            {title && <div className="t-h3">{title}</div>}
            {subtitle && <div className="t-xs t-faint u-mt-2">{subtitle}</div>}
          </div>
          <div className="u-row u-gap-4">{legend}{action}</div>
        </figcaption>
      )}
      {children}
    </figure>
  );
}

export function Legend({ series }: { series: Array<{ label: string; color: string }> }) {
  if (series.length < 2) return null;   // one series needs no box — the title names it
  return (
    <ul className="u-row u-wrap u-gap-4">
      {series.map((s) => (
        <li key={s.label} className="u-row u-gap-2 t-xs t-muted">
          <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color, flex: 'none' }} aria-hidden="true" />
          {s.label}
        </li>
      ))}
    </ul>
  );
}

function DataTable({ series, xLabel, format }: {
  series: Series[]; xLabel: (p: Point) => string; format: (v: number) => string;
}) {
  const xs = series[0]?.points ?? [];
  return (
    <table className="sr-only">
      <caption>Chart data</caption>
      <thead>
        <tr><th scope="col">Period</th>{series.map((s) => <th scope="col" key={s.key}>{s.label}</th>)}</tr>
      </thead>
      <tbody>
        {xs.map((p, i) => (
          <tr key={p.x}>
            <th scope="row">{xLabel(p)}</th>
            {series.map((s) => <td key={s.key}>{format(s.points[i]?.y ?? 0)}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Tooltip({ x, y, width, children }: { x: number; y: number; width: number; children: ReactNode }) {
  const left = Math.min(Math.max(8, x - 70), Math.max(8, width - 148));
  return (
    <div
      style={{
        position: 'absolute', left, top: Math.max(4, y - 12), pointerEvents: 'none',
        background: 'var(--surface-1)', border: '1px solid var(--border)',
        borderRadius: 'var(--r-md)', boxShadow: 'var(--shadow-2)',
        padding: '8px 10px', minWidth: 132, zIndex: 5,
      }}
    >
      {children}
    </div>
  );
}

/* ============================================================
   Line / area chart (change over time)
   ============================================================ */
export function LineChart({
  series, height = 230, format = (v) => String(v), xLabel = (p) => p.label,
  area, yMinZero = true, directLabels = true,
}: {
  series: Series[]; height?: number;
  format?: (v: number) => string; xLabel?: (p: Point) => string;
  area?: boolean; yMinZero?: boolean; directLabels?: boolean;
}) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const n = series[0]?.points.length ?? 0;

  const padL = 54, padR = directLabels && series.length === 1 ? 8 : 12, padT = 14, padB = 26;
  const plotW = Math.max(10, w - padL - padR);
  const plotH = height - padT - padB;

  const values = series.flatMap((s) => s.points.map((p) => p.y));
  const rawMax = values.length ? Math.max(...values) : 1;
  const rawMin = yMinZero ? 0 : Math.min(...values, 0);
  const lo = yMinZero ? 0 : Math.floor(rawMin);
  const ticks = ticksFor(Math.max(rawMax, lo + 1), lo);
  const hi = ticks[ticks.length - 1];

  const X = (i: number) => padL + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const Y = (v: number) => padT + plotH - ((v - lo) / Math.max(1e-9, hi - lo)) * plotH;

  const onMove = (e: React.MouseEvent | React.TouchEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const cx = ('touches' in e ? e.touches[0].clientX : e.clientX) - rect.left;
    const i = Math.round(((cx - padL) / Math.max(1, plotW)) * (n - 1));
    setHover(Math.min(n - 1, Math.max(0, i)));
  };

  const labelEvery = Math.max(1, Math.ceil(n / (plotW < 380 ? 4 : plotW < 640 ? 6 : 9)));

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {w > 0 && (
        <svg
          width={w} height={height} role="img"
          aria-label={`Line chart: ${series.map((s) => s.label).join(', ')}`}
          onMouseMove={onMove} onMouseLeave={() => setHover(null)}
          onTouchStart={onMove} onTouchMove={onMove} onTouchEnd={() => setHover(null)}
          style={{ touchAction: 'pan-y', display: 'block' }}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={padL} x2={w - padR} y1={Y(t)} y2={Y(t)} stroke="var(--grid)" strokeWidth={1} />
              <text
                x={padL - 8} y={Y(t) + 4} textAnchor="end"
                fill="var(--text-3)" fontSize={11} style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {format(t)}
              </text>
            </g>
          ))}

          {series[0]?.points.map((p, i) =>
            i % labelEvery === 0 || i === n - 1 ? (
              <text key={p.x} x={X(i)} y={height - 8} textAnchor={i === n - 1 ? 'end' : i === 0 ? 'start' : 'middle'}
                fill="var(--text-3)" fontSize={11}>
                {xLabel(p)}
              </text>
            ) : null)}

          {area && series.map((s) => (
            <path
              key={`a-${s.key}`}
              d={`M${X(0)},${Y(lo)} ${s.points.map((p, i) => `L${X(i)},${Y(p.y)}`).join(' ')} L${X(n - 1)},${Y(lo)} Z`}
              fill={s.color} opacity={0.1}
            />
          ))}

          {series.map((s) => (
            <path
              key={s.key}
              d={s.points.map((p, i) => `${i ? 'L' : 'M'}${X(i)},${Y(p.y)}`).join(' ')}
              fill="none" stroke={s.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
            />
          ))}

          {/* end markers carry a 2px surface ring so they stay legible where lines cross */}
          {series.map((s) => (
            <circle
              key={`e-${s.key}`} cx={X(n - 1)} cy={Y(s.points[n - 1]?.y ?? 0)} r={4}
              fill={s.color} stroke="var(--chart-surface)" strokeWidth={2}
            />
          ))}

          {hover != null && (
            <g>
              <line x1={X(hover)} x2={X(hover)} y1={padT} y2={padT + plotH} stroke="var(--border-strong)" strokeWidth={1} />
              {series.map((s) => (
                <circle
                  key={`h-${s.key}`} cx={X(hover)} cy={Y(s.points[hover]?.y ?? 0)} r={4.5}
                  fill={s.color} stroke="var(--chart-surface)" strokeWidth={2}
                />
              ))}
            </g>
          )}
        </svg>
      )}

      {hover != null && series[0]?.points[hover] && (
        <Tooltip x={X(hover)} y={0} width={w}>
          <div className="t-xs t-faint">{xLabel(series[0].points[hover])}</div>
          {series.map((s) => (
            <div key={s.key} className="u-between u-gap-3" style={{ marginTop: 4 }}>
              <span className="u-row u-gap-2 t-xs t-muted">
                <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color }} />
                {s.label}
              </span>
              <span className="t-xs u-num" style={{ fontWeight: 600 }}>{format(s.points[hover]?.y ?? 0)}</span>
            </div>
          ))}
        </Tooltip>
      )}

      <DataTable series={series} xLabel={xLabel} format={format} />
    </div>
  );
}

/* ============================================================
   Column chart — one or two series, grouped
   ============================================================ */
export function BarChart({
  series, height = 230, format = (v) => String(v), xLabel = (p) => p.label,
}: {
  series: Series[]; height?: number;
  format?: (v: number) => string; xLabel?: (p: Point) => string;
}) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const n = series[0]?.points.length ?? 0;

  const padL = 54, padR = 12, padT = 14, padB = 26;
  const plotW = Math.max(10, w - padL - padR);
  const plotH = height - padT - padB;

  const max = Math.max(1, ...series.flatMap((s) => s.points.map((p) => p.y)));
  const ticks = ticksFor(max);
  const hi = ticks[ticks.length - 1];

  const band = plotW / Math.max(1, n);
  const groupW = Math.min(24 * series.length + 2 * (series.length - 1), band * 0.66);
  const barW = (groupW - 2 * (series.length - 1)) / series.length;   // 2px surface gap between neighbours
  const Y = (v: number) => padT + plotH - (v / hi) * plotH;
  const labelEvery = Math.max(1, Math.ceil(n / (plotW < 380 ? 4 : plotW < 640 ? 6 : 10)));

  /** square at the baseline, 4px rounded at the data end */
  const barPath = (x: number, y: number, bw: number, y0: number) => {
    const h = Math.max(0, y0 - y);
    const r = Math.min(4, bw / 2, h);
    return `M${x},${y0} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + bw - r},${y} Q${x + bw},${y} ${x + bw},${y + r} L${x + bw},${y0} Z`;
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {w > 0 && (
        <svg
          width={w} height={height} role="img"
          aria-label={`Bar chart: ${series.map((s) => s.label).join(', ')}`}
          onMouseLeave={() => setHover(null)} style={{ display: 'block' }}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={padL} x2={w - padR} y1={Y(t)} y2={Y(t)} stroke="var(--grid)" strokeWidth={1} />
              <text x={padL - 8} y={Y(t) + 4} textAnchor="end" fill="var(--text-3)" fontSize={11}
                style={{ fontVariantNumeric: 'tabular-nums' }}>{format(t)}</text>
            </g>
          ))}

          {series[0]?.points.map((p, i) => {
            const cx = padL + band * i + band / 2;
            return (
              <g key={p.x}>
                <rect
                  x={padL + band * i} y={padT} width={band} height={plotH} fill="transparent"
                  onMouseEnter={() => setHover(i)}
                />
                {series.map((s, si) => {
                  const x = cx - groupW / 2 + si * (barW + 2);
                  const v = s.points[i]?.y ?? 0;
                  return (
                    <path
                      key={s.key} d={barPath(x, Y(v), barW, padT + plotH)}
                      fill={s.color} opacity={hover == null || hover === i ? 1 : 0.45}
                      style={{ transition: 'opacity 120ms' }}
                    />
                  );
                })}
                {(i % labelEvery === 0 || i === n - 1) && (
                  <text x={cx} y={height - 8} textAnchor="middle" fill="var(--text-3)" fontSize={11}>
                    {xLabel(p)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}

      {hover != null && series[0]?.points[hover] && (
        <Tooltip x={padL + band * hover + band / 2} y={0} width={w}>
          <div className="t-xs t-faint">{xLabel(series[0].points[hover])}</div>
          {series.map((s) => (
            <div key={s.key} className="u-between u-gap-3" style={{ marginTop: 4 }}>
              <span className="u-row u-gap-2 t-xs t-muted">
                <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color }} />
                {s.label}
              </span>
              <span className="t-xs u-num" style={{ fontWeight: 600 }}>{format(s.points[hover]?.y ?? 0)}</span>
            </div>
          ))}
        </Tooltip>
      )}

      <DataTable series={series} xLabel={xLabel} format={format} />
    </div>
  );
}

/* ============================================================
   Diverging columns — polarity data (profit / loss by month).
   Blue above zero, red below, neutral zero rule. Never a ramp.
   ============================================================ */
export function DivergingBarChart({
  points, height = 210, format = (v) => String(v), xLabel = (p) => p.label,
}: { points: Point[]; height?: number; format?: (v: number) => string; xLabel?: (p: Point) => string }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const n = points.length;

  const padL = 58, padR = 12, padT = 14, padB = 26;
  const plotW = Math.max(10, w - padL - padR);
  const plotH = height - padT - padB;

  const maxAbs = Math.max(1, ...points.map((p) => Math.abs(p.y)));
  const hi = niceCeil(maxAbs);
  const zeroY = padT + plotH / 2;
  const Y = (v: number) => zeroY - (v / hi) * (plotH / 2);

  const band = plotW / Math.max(1, n);
  const barW = Math.min(24, band * 0.55);
  const labelEvery = Math.max(1, Math.ceil(n / (plotW < 380 ? 4 : 8)));

  const barPath = (x: number, v: number) => {
    const y = Y(v);
    const h = Math.abs(y - zeroY);
    const r = Math.min(4, barW / 2, h);
    return v >= 0
      ? `M${x},${zeroY} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + barW - r},${y} Q${x + barW},${y} ${x + barW},${y + r} L${x + barW},${zeroY} Z`
      : `M${x},${zeroY} L${x},${y - r} Q${x},${y} ${x + r},${y} L${x + barW - r},${y} Q${x + barW},${y} ${x + barW},${y - r} L${x + barW},${zeroY} Z`;
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {w > 0 && (
        <svg width={w} height={height} role="img" aria-label="Operating profit by month"
          onMouseLeave={() => setHover(null)} style={{ display: 'block' }}>
          {[hi, 0, -hi].map((t) => (
            <g key={t}>
              <line x1={padL} x2={w - padR} y1={Y(t)} y2={Y(t)}
                stroke={t === 0 ? 'var(--border-strong)' : 'var(--grid)'} strokeWidth={1} />
              <text x={padL - 8} y={Y(t) + 4} textAnchor="end" fill="var(--text-3)" fontSize={11}
                style={{ fontVariantNumeric: 'tabular-nums' }}>{format(t)}</text>
            </g>
          ))}
          {points.map((p, i) => {
            const cx = padL + band * i + band / 2;
            return (
              <g key={p.x}>
                <rect x={padL + band * i} y={padT} width={band} height={plotH} fill="transparent"
                  onMouseEnter={() => setHover(i)} />
                <path
                  d={barPath(cx - barW / 2, p.y)}
                  fill={p.y >= 0 ? SERIES.pos : SERIES.neg}
                  opacity={hover == null || hover === i ? 1 : 0.45}
                  style={{ transition: 'opacity 120ms' }}
                />
                {(i % labelEvery === 0 || i === n - 1) && (
                  <text x={cx} y={height - 8} textAnchor="middle" fill="var(--text-3)" fontSize={11}>{xLabel(p)}</text>
                )}
              </g>
            );
          })}
        </svg>
      )}
      {hover != null && points[hover] && (
        <Tooltip x={padL + band * hover + band / 2} y={0} width={w}>
          <div className="t-xs t-faint">{xLabel(points[hover])}</div>
          <div className="t-sm u-num" style={{ fontWeight: 620, marginTop: 2 }}>{format(points[hover].y)}</div>
          <div className="t-xs t-faint">{points[hover].y >= 0 ? 'Operating profit' : 'Operating loss'}</div>
        </Tooltip>
      )}
      <table className="sr-only">
        <caption>Operating profit by month</caption>
        <thead><tr><th scope="col">Month</th><th scope="col">Operating profit</th></tr></thead>
        <tbody>{points.map((p) => <tr key={p.x}><th scope="row">{xLabel(p)}</th><td>{format(p.y)}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

/* ============================================================
   Horizontal category bars — one measure across nominal
   categories, so ONE colour with direct value labels.
   (A value-ramp here would double-encode length as hue.)
   ============================================================ */
export function CategoryBars({
  rows, format, color = SERIES.s1, emptyLabel = 'Nothing recorded in this period.',
}: {
  rows: Array<{ key: string; label: string; amount: number }>;
  format: (v: number) => string; color?: string; emptyLabel?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.amount));
  const total = rows.reduce((s, r) => s + r.amount, 0);
  if (!rows.length) return <p className="t-sm t-faint">{emptyLabel}</p>;
  return (
    <ul className="u-col u-gap-4">
      {rows.map((r) => (
        <li key={r.key}>
          <div className="u-between u-gap-3" style={{ marginBottom: 6 }}>
            <span className="t-sm u-truncate">{r.label}</span>
            <span className="t-sm u-num u-nowrap" style={{ fontWeight: 580 }}>
              {format(r.amount)}
              <span className="t-xs t-faint" style={{ marginLeft: 6 }}>
                {total ? Math.round((r.amount / total) * 100) : 0}%
              </span>
            </span>
          </div>
          <div style={{ height: 8, borderRadius: 4, background: 'var(--surface-inset)', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%', width: `${(r.amount / max) * 100}%`, background: color,
                borderRadius: '0 4px 4px 0', transition: 'width var(--dur-slow) var(--ease)',
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ============================================================
   Sparkline — the stat-tile trend, no axes, no chrome
   ============================================================ */
export function Sparkline({ points, color = 'var(--series-1)', height = 30 }: {
  points: Point[]; color?: string; height?: number;
}) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const n = points.length;
  if (n < 2) return <div ref={ref} style={{ height }} />;
  const max = Math.max(...points.map((p) => p.y), 1);
  const min = Math.min(...points.map((p) => p.y), 0);
  const X = (i: number) => (i / (n - 1)) * Math.max(1, w - 6) + 3;
  const Y = (v: number) => height - 4 - ((v - min) / Math.max(1e-9, max - min)) * (height - 8);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${X(i)},${Y(p.y)}`).join(' ');
  return (
    <div ref={ref} style={{ height }}>
      {w > 0 && (
        <svg width={w} height={height} aria-hidden="true" style={{ display: 'block' }}>
          <path d={`${d} L${X(n - 1)},${height} L${X(0)},${height} Z`} fill={color} opacity={0.1} />
          <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <circle cx={X(n - 1)} cy={Y(points[n - 1].y)} r={3} fill={color}
            stroke="var(--chart-surface)" strokeWidth={2} />
        </svg>
      )}
    </div>
  );
}

/* ============================================================
   Attendance heat strip — ordinal magnitude on ONE hue
   ============================================================ */
export function HeatStrip({ days, format }: {
  days: Array<{ date: string; value: number; label: string }>;
  format?: (v: number) => string;
}) {
  const [tip, setTip] = useState<number | null>(null);
  const max = Math.max(1, ...days.map((d) => d.value));
  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }} onMouseLeave={() => setTip(null)}>
        {days.map((d, i) => {
          const t = d.value / max;
          return (
            <span
              key={d.date}
              onMouseEnter={() => setTip(i)}
              title={`${d.label}: ${format ? format(d.value) : d.value}`}
              style={{
                width: 13, height: 13, borderRadius: 3, flex: 'none',
                background: d.value === 0
                  ? 'var(--surface-inset)'
                  : `color-mix(in srgb, var(--series-1) ${Math.round(22 + t * 78)}%, var(--surface-1))`,
                outline: tip === i ? '2px solid var(--brand)' : 'none', outlineOffset: 1,
              }}
            />
          );
        })}
      </div>
      {tip != null && (
        <div className="t-xs t-muted u-mt-3">
          <strong>{days[tip].label}</strong> · {format ? format(days[tip].value) : days[tip].value}
        </div>
      )}
    </div>
  );
}

/** Keeps a chart from animating in on every keystroke of an unrelated filter. */
export function useDelayedMount(ms = 0) {
  const [ready, setReady] = useState(ms === 0);
  useEffect(() => {
    if (ms === 0) return;
    const t = window.setTimeout(() => setReady(true), ms);
    return () => window.clearTimeout(t);
  }, [ms]);
  return ready;
}
