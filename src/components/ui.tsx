import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, X } from 'lucide-react'

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ')
}

/* ---------------- Buton ---------------- */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft'
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-white hover:brightness-95 active:brightness-90 shadow-sm',
  secondary: 'bg-white text-ink border border-line hover:bg-stone-50 active:bg-stone-100',
  soft: 'bg-accent-soft text-accent-ink hover:brightness-[0.97]',
  ghost: 'text-ink hover:bg-stone-100 active:bg-stone-200',
  danger: 'bg-white text-red-700 border border-red-200 hover:bg-red-50',
}

export function Button({
  variant = 'secondary',
  size = 'md',
  className,
  icon,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md'; icon?: ReactNode }) {
  return (
    <button
      type="button"
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-xl font-medium transition disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap',
        size === 'sm' ? 'h-8 px-3 text-sm' : 'h-11 px-4 text-[15px]',
        VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  )
}

export function LinkButton({
  to,
  variant = 'secondary',
  size = 'md',
  icon,
  children,
  className,
}: {
  to: string
  variant?: Variant
  size?: 'sm' | 'md'
  icon?: ReactNode
  children?: ReactNode
  className?: string
}) {
  return (
    <Link
      to={to}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-xl font-medium transition whitespace-nowrap',
        size === 'sm' ? 'h-8 px-3 text-sm' : 'h-11 px-4 text-[15px]',
        VARIANTS[variant],
        className,
      )}
    >
      {icon}
      {children}
    </Link>
  )
}

export function IconButton({
  label,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-ink hover:bg-stone-100 active:bg-stone-200 transition',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}

/* ---------------- Kart ve başlıklar ---------------- */

export function Card({ className, children, ...rest }: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx('rounded-2xl border border-line bg-white shadow-[0_1px_2px_rgba(58,42,37,0.04)]', className)} {...rest}>
      {children}
    </div>
  )
}

export function CardHeader({ title, action, icon }: { title: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-2">
      <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
        {icon && <span className="text-accent">{icon}</span>}
        {title}
      </h2>
      {action}
    </div>
  )
}

export function PageHeader({
  title,
  subtitle,
  actions,
  back,
}: {
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  back?: boolean | string
}) {
  const nav = useNavigate()
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-1">
        {back && (
          <IconButton
            label="Geri"
            className="-ml-2 mt-0.5"
            onClick={() => (typeof back === 'string' ? nav(back) : nav(-1))}
          >
            <ArrowLeft size={20} />
          </IconButton>
        )}
        <div className="min-w-0">
          <h1 className="font-display text-2xl leading-tight text-ink md:text-[28px]">{title}</h1>
          {subtitle && <div className="mt-0.5 text-sm text-muted">{subtitle}</div>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Badge({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap', className)}>
      {children}
    </span>
  )
}

export function EmptyState({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
      {icon && <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent">{icon}</div>}
      <div className="font-medium text-ink">{title}</div>
      {text && <p className="mt-1 max-w-sm text-sm text-muted">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

/* ---------------- Form ---------------- */

export function Field({
  label,
  hint,
  children,
  className,
  required,
  group,
}: {
  label: ReactNode
  hint?: ReactNode
  children: ReactNode
  className?: string
  required?: boolean
  /** Birden fazla buton içeren alanlar için <label> yerine grup */
  group?: boolean
}) {
  const Tag = group ? 'div' : 'label'
  return (
    <Tag className={cx('block', className)} role={group ? 'group' : undefined} aria-label={group && typeof label === 'string' ? label : undefined}>
      <span className="mb-1 block text-[13px] font-medium text-muted">
        {label}
        {required && <span className="text-accent"> *</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </Tag>
  )
}

/** Genişlik verilmediyse tam genişlik */
const wFull = (c?: string) => (c && /(^|\s)w-/.test(c) ? '' : 'w-full')

const inputCls =
  'rounded-xl border border-line bg-white px-3 text-ink placeholder:text-stone-400 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-soft disabled:bg-stone-50'

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(inputCls, wFull(className), 'h-11', className)} {...rest} />
}

export function NumberInput({
  value,
  onChange,
  className,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: number | undefined
  onChange: (v: number | undefined) => void
}) {
  return (
    <input
      type="number"
      inputMode="decimal"
      className={cx(inputCls, wFull(className), 'h-11', className)}
      value={value ?? ''}
      onChange={(e) => {
        const v = e.target.value
        onChange(v === '' ? undefined : Number(v.replace(',', '.')))
      }}
      onFocus={(e) => e.target.select()}
      {...rest}
    />
  )
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(inputCls, 'w-full min-h-[88px] py-2.5', className)} {...rest} />
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx(inputCls, wFull(className), 'h-11 appearance-none bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-9', className)}
      style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' stroke='%238a766f' stroke-width='2' viewBox='0 0 24 24'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")` }}
      {...rest}
    >
      {children}
    </select>
  )
}

/** Serbest yazılabilen, önerili metin alanı */
export function ComboInput({
  options,
  value,
  onChange,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  options: string[]
  value: string | undefined
  onChange: (v: string) => void
}) {
  const id = useId()
  return (
    <>
      <Input list={id} value={value ?? ''} onChange={(e) => onChange(e.target.value)} autoComplete="off" {...rest} />
      <datalist id={id}>
        {options.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
    </>
  )
}

/** Hızlı seçim çipleri + serbest metin */
export function ChipSelect({
  options,
  value,
  onChange,
  allowCustom = true,
  placeholder,
}: {
  options: string[]
  value: string | undefined
  onChange: (v: string) => void
  allowCustom?: boolean
  placeholder?: string
}) {
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            type="button"
            key={o}
            onClick={() => onChange(value === o ? '' : o)}
            className={cx(
              'rounded-full border px-3 py-1.5 text-sm transition',
              value === o ? 'border-accent bg-accent text-white' : 'border-line bg-white text-ink hover:bg-stone-50',
            )}
          >
            {o}
          </button>
        ))}
      </div>
      {allowCustom && (
        <Input
          className="mt-2"
          placeholder={placeholder ?? 'veya yazın…'}
          value={value && !options.includes(value) ? value : ''}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  )
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: T; label: ReactNode }[]
  value: T
  onChange: (v: T) => void
  className?: string
}) {
  return (
    <div className={cx('inline-flex rounded-xl border border-line bg-white p-1', className)}>
      {options.map((o) => (
        <button
          type="button"
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'rounded-lg px-3 py-1.5 text-sm font-medium transition whitespace-nowrap',
            value === o.value ? 'bg-accent-soft text-accent-ink' : 'text-muted hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { value: T; label: ReactNode; count?: number }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="no-scrollbar -mx-4 mb-4 flex gap-1 overflow-x-auto border-b border-line px-4 md:mx-0 md:px-0">
      {tabs.map((t) => (
        <button
          type="button"
          key={t.value}
          onClick={() => onChange(t.value)}
          className={cx(
            '-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition',
            value === t.value ? 'border-accent text-accent-ink' : 'border-transparent text-muted hover:text-ink',
          )}
        >
          {t.label}
          {t.count !== undefined && t.count > 0 && (
            <span className="rounded-full bg-stone-100 px-1.5 text-xs text-muted">{t.count}</span>
          )}
        </button>
      ))}
    </div>
  )
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 select-none">
      <span
        className={cx('relative h-6 w-10 shrink-0 rounded-full transition', checked ? 'bg-accent' : 'bg-stone-300')}
      >
        <span className={cx('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition', checked ? 'left-[18px]' : 'left-0.5')} />
      </span>
      <input type="checkbox" className="sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="text-sm text-ink">{label}</span>
    </label>
  )
}

/* ---------------- Modal ---------------- */

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}) {
  useEffect(() => {
    if (!open) return
    const fn = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', fn)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', fn)
      document.body.style.overflow = prev
    }
  }, [open, onClose])
  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className={cx(
          'animate-sheet relative flex max-h-[92dvh] w-full flex-col rounded-t-3xl bg-white shadow-xl md:rounded-3xl',
          wide ? 'md:max-w-3xl' : 'md:max-w-lg',
        )}
      >
        <div className="flex items-center justify-between gap-2 border-b border-line px-5 py-3">
          <h3 className="font-display text-lg text-ink">{title}</h3>
          <IconButton label="Kapat" onClick={onClose} className="-mr-2">
            <X size={20} />
          </IconButton>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="pb-safe flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

/* ---------------- Bildirim (toast) ---------------- */

const ToastCtx = createContext<(msg: string) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<{ text: string; key: number } | null>(null)
  const show = useCallback((text: string) => setMsg({ text, key: Date.now() }), [])
  useEffect(() => {
    if (!msg) return
    const t = setTimeout(() => setMsg(null), 2400)
    return () => clearTimeout(t)
  }, [msg])
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {msg &&
        createPortal(
          <div
            key={msg.key}
            className="animate-toast fixed bottom-24 left-1/2 z-[60] -translate-x-1/2 rounded-full bg-ink px-4 py-2.5 text-sm text-white shadow-lg md:bottom-8"
          >
            {msg.text}
          </div>,
          document.body,
        )}
    </ToastCtx.Provider>
  )
}

export function useToast() {
  return useContext(ToastCtx)
}

/* ---------------- Diğer ---------------- */

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <div className="text-[13px] text-muted">{label}</div>
      <div className={cx('mt-1 text-xl font-semibold tabular-nums text-ink', tone)}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  )
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toLocaleUpperCase('tr-TR'))
    .join('')
  return (
    <div className={cx('flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent-ink', className)}>
      {letters}
    </div>
  )
}
