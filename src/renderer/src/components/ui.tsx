import type { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes } from 'react'
import { LoaderCircle } from 'lucide-react'

export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ')
}

type ButtonVariant = 'primary' | 'ghost' | 'outline' | 'accent'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  pending?: boolean
}

export function Button({ variant = 'ghost', pending, className, children, disabled, ...rest }: ButtonProps) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded px-4 h-9 text-sm font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none'
  const variants: Record<ButtonVariant, string> = {
    primary: 'bg-ink text-base hover:opacity-90',
    ghost: 'text-ink hover:bg-elevated',
    outline: 'border border-line text-ink hover:bg-elevated',
    accent: 'text-accent-ink'
  }
  const style = variant === 'accent' ? { backgroundColor: 'var(--att-accent)' } : undefined
  return (
    <button
      className={cx(base, variants[variant], className)}
      style={style}
      disabled={disabled || pending}
      {...rest}
    >
      {pending && <LoaderCircle size={14} className="animate-spin" aria-hidden />}
      {children}
    </button>
  )
}

export function TextInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cx(
        'h-9 w-full rounded border border-line bg-surface px-3 text-sm text-ink placeholder:text-ink-faint focus:border-ink-faint focus:outline-none',
        className
      )}
      {...rest}
    />
  )
}

export function Spinner({ className }: { className?: string }) {
  return <LoaderCircle size={20} className={cx('animate-spin text-ink-faint', className)} aria-label="Loading" />
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <p className="text-sm font-medium text-ink">{title}</p>
      {hint && <p className="max-w-sm text-xs text-ink-muted">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

export function ErrorState({ title, message, retry }: { title: string; message?: string; retry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <p className="text-sm font-medium text-ink">{title}</p>
      {message && <p className="max-w-sm text-xs text-ink-muted">{message}</p>}
      {retry && (
        <Button variant="outline" onClick={retry} className="mt-2">
          Try again
        </Button>
      )}
    </div>
  )
}

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between">
      <h2 className="text-[15px] font-semibold tracking-tight text-ink">{title}</h2>
      {action}
    </div>
  )
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx('relative h-5 w-9 rounded-full border border-line transition-colors', checked ? 'border-transparent' : 'bg-base')}
      style={checked ? { backgroundColor: 'var(--att-accent)' } : undefined}
    >
      <span
        className={cx(
          'absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full bg-base transition-all',
          checked ? 'left-[19px]' : 'left-[3px] bg-ink-muted'
        )}
      />
    </button>
  )
}
