import { ArrowDownLeft, ArrowUpRight, Check, ChevronRight, Plus, Sprout, X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cad } from '../../../shared/finance';

export function Brand({ light = false }: { light?: boolean }) {
  return (
    <div className={`brand ${light ? 'light' : ''}`}>
      <span className="brand-symbol">
        <Plus size={23} strokeWidth={2.5} />
      </span>
      <span>
        surplus<span className="brand-dot">.</span>
      </span>
    </div>
  );
}
export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'green' | 'amber' | 'red' | 'blue';
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function Button({
  children,
  variant = 'primary',
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost';
  children: ReactNode;
}) {
  return (
    <button className={`button ${variant} ${className}`} {...props}>
      {children}
    </button>
  );
}
export function PageHead({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}
export function SectionTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-title">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
export function Progress({
  value,
  tone = 'green',
  label,
}: {
  value: number;
  tone?: string;
  label: string;
}) {
  return (
    <div
      className={`progress ${tone}`}
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.min(100, Math.max(0, Math.round(value)))}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}
export function Empty({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <Sprout size={30} />
      <h3>{title}</h3>
      <p>{detail}</p>
      {action}
    </div>
  );
}
export function Field({
  label,
  hint,
  children,
  className = '',
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`field ${className}`}>
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function MoneyInput({
  value,
  onChange,
  label,
  min = 0,
  max = 10000000,
}: {
  value: number;
  onChange: (v: number) => void;
  label?: string;
  min?: number;
  max?: number;
}) {
  const [text, setText] = useState(value === 0 ? '' : String(value));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(value === 0 ? '' : String(value));
  }, [value]);
  return (
    <span className="money-input">
      <span>$</span>
      <input
        type="number"
        inputMode="decimal"
        placeholder="0"
        min={min}
        max={max}
        step="0.01"
        value={text}
        aria-label={label}
        onFocus={(e) => {
          focused.current = true;
          e.target.select();
        }}
        onBlur={() => {
          focused.current = false;
          setText(value === 0 ? '' : String(value));
        }}
        onChange={(e) => {
          const next = e.target.value.replace(/^0+(?=\d)/, '');
          setText(next);
          const amount = Number(next);
          if (Number.isFinite(amount)) onChange(amount);
        }}
      />
      <small>CAD</small>
    </span>
  );
}
export function Amount({ value, flow = false }: { value: number; flow?: boolean }) {
  return (
    <span className={`amount ${flow && value > 0 ? 'positive' : ''}`}>
      {flow && value > 0 ? '+' : ''}
      {cad(value, true)}
    </span>
  );
}
export function TransactionIcon({ income, transfer }: { income?: boolean; transfer?: boolean }) {
  return (
    <span className={`transaction-icon ${income ? 'income' : ''}`}>
      {transfer ? (
        <ArrowUpRight size={17} />
      ) : income ? (
        <ArrowDownLeft size={17} />
      ) : (
        <span>↗</span>
      )}
    </span>
  );
}
export function TextLink({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button className="text-link" onClick={onClick}>
      {children}
      <ChevronRight size={15} />
    </button>
  );
}
export function CheckList({ children }: { children: ReactNode }) {
  return (
    <div className="check-line">
      <Check size={16} />
      <span>{children}</span>
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const active = document.activeElement as HTMLElement;
    dialog?.showModal();
    return () => {
      dialog?.close();
      active?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-label={title}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-heading">
        <h2>{title}</h2>
        <button className="icon-button" aria-label="Close dialog" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
