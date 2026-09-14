import { useId } from 'react';
import type { ReactNode } from 'react';
import { Icon } from './Icon';

interface Base {
  label?: string;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  className?: string;
}

function Wrapper({
  id, label, hint, error, required, className = '', children,
}: Base & { id: string; children: ReactNode }) {
  return (
    <div className={`field ${className}`}>
      {label && (
        <label className="field__label" htmlFor={id}>
          {label}{required && <span className="field__req" aria-hidden="true">*</span>}
        </label>
      )}
      {children}
      {error
        ? <span className="field__error" id={`${id}-err`}><Icon name="alert" size={12} strokeWidth={2.2} />{error}</span>
        : hint ? <span className="field__hint" id={`${id}-hint`}>{hint}</span> : null}
    </div>
  );
}

type InputProps = Base & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'className'> & { prefix?: string; suffix?: string };

export function TextField({ label, hint, error, required, className, prefix, suffix, ...rest }: InputProps) {
  const auto = useId();
  const id = rest.id ?? auto;
  return (
    <Wrapper id={id} label={label} hint={hint} error={error} required={required} className={className}>
      <span className="field__wrap">
        {prefix && <span className="field__prefix">{prefix}</span>}
        <input
          {...rest}
          id={id}
          className={`input ${prefix ? 'input--prefix' : ''}`}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
        />
        {suffix && <span className="field__suffix">{suffix}</span>}
      </span>
    </Wrapper>
  );
}

export function MoneyField(props: InputProps) {
  return <TextField inputMode="numeric" prefix="₹" {...props} />;
}

export function DateField(props: InputProps) {
  return <TextField type="date" {...props} />;
}

export function SelectField({
  label, hint, error, required, className, options, ...rest
}: Base & Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'className'> & {
  options: Array<{ value: string; label: string; disabled?: boolean }>;
}) {
  const auto = useId();
  const id = rest.id ?? auto;
  return (
    <Wrapper id={id} label={label} hint={hint} error={error} required={required} className={className}>
      <select
        {...rest}
        id={id}
        className="select"
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>
        ))}
      </select>
    </Wrapper>
  );
}

export function TextareaField({
  label, hint, error, required, className, ...rest
}: Base & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'className'>) {
  const auto = useId();
  const id = rest.id ?? auto;
  return (
    <Wrapper id={id} label={label} hint={hint} error={error} required={required} className={className}>
      <textarea
        {...rest}
        id={id}
        className="textarea"
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
      />
    </Wrapper>
  );
}

/** Thumb-sized +/- control — the member app's primary numeric input. */
export function NumberStepper({
  label, value, onChange, step = 1, min = 0, max = 9999, suffix, hint, error,
}: Base & {
  value: number; onChange: (v: number) => void;
  step?: number; min?: number; max?: number; suffix?: string;
}) {
  const auto = useId();
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v * 100) / 100));
  return (
    <Wrapper id={auto} label={label} hint={hint} error={error}>
      <div className="stepper">
        <button type="button" onClick={() => onChange(clamp(value - step))} aria-label={`Decrease ${label ?? 'value'}`}>
          <Icon name="minus" size={17} />
        </button>
        <input
          id={auto}
          className="input"
          inputMode="decimal"
          value={Number.isFinite(value) ? value : ''}
          onChange={(e) => onChange(clamp(Number(e.target.value.replace(/[^\d.]/g, '')) || 0))}
          aria-label={label}
        />
        <button type="button" onClick={() => onChange(clamp(value + step))} aria-label={`Increase ${label ?? 'value'}`}>
          <Icon name="plus" size={17} />
        </button>
      </div>
      {suffix && <span className="field__hint">{suffix}</span>}
    </Wrapper>
  );
}

export function SearchInput({
  value, onChange, placeholder = 'Search', className = '',
}: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  const id = useId();
  return (
    <div className={`field__wrap ${className}`}>
      <span className="field__prefix" aria-hidden="true"><Icon name="search" size={16} /></span>
      <input
        id={id}
        type="search"
        className="input input--prefix"
        value={value}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export function Switch({ checked, onChange, label, hideLabel, disabled }: {
  checked: boolean; onChange: (v: boolean) => void; label: string;
  /** Keeps the label for screen readers while the row itself carries the name. */
  hideLabel?: boolean;
  disabled?: boolean;
}) {
  return (
    <label className={`switch ${disabled ? 'switch--disabled' : ''}`}>
      <input
        type="checkbox" checked={checked} disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={hideLabel ? label : undefined}
      />
      <span className="switch__track"><span className="switch__thumb" /></span>
      <span className={hideLabel ? 'sr-only' : 't-sm'}>{label}</span>
    </label>
  );
}

/** Pulls field errors out of a ValidationError thrown by lib/api. */
export function fieldErrors(err: unknown): Record<string, string> {
  if (err && typeof err === 'object' && 'fields' in err) {
    return (err as { fields: Record<string, string> }).fields ?? {};
  }
  return {};
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return 'Something went wrong. Please try again.';
}
