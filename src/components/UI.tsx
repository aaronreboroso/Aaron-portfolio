import {
  AlertCircle,
  ArrowUpRight,
  Check,
  ChevronRight,
  Layers3,
  LoaderCircle,
  X,
  type LucideIcon,
} from 'lucide-react';
import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  type ReactElement,
  type ReactNode,
} from 'react';
import { go } from '../lib/client';
export function Mark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <path
        fill="currentColor"
        d="M2 34 18.8 5h6.6L12.8 27.2h10.6l3.9 6.8zm21.3-16.5 4.1-7.1L40 34h-8.2z"
      />
    </svg>
  );
}
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="brand-lockup">
      <Mark size={34} />
      {!compact && (
        <span className="wordmark">
          <svg viewBox="0 0 135 25" width="97" height="20" role="img" aria-label="ATROX">
            <path
              fill="currentColor"
              fillRule="evenodd"
              d="M0 23 9 2h5l9 21h-5.5l-1.8-4.8H7.4L5.5 23Zm9.2-9.1h4.9l-2.4-6.2ZM26 2h23v4.9h-8.9V23h-5.3V6.9H26Zm28 0h15.4L75 7v5.1l-4.3 4.1L76 23h-6.7l-5.4-6.7h-4.5V23H54Zm5.4 4.7v5.1h8.2l1.9-1.7V8.3l-1.9-1.6ZM86 2h13l5.4 5.3v10.4L99 23H86l-5.4-5.3V7.3Zm2 4.7-2.2 2.2v6.9l2.2 2.4h8.8l2.1-2.4V8.9l-2.1-2.2ZM109 2h6.6l6 7.2 6-7.2h6.6l-9.4 10.4L134 23h-6.6l-6-7.1-6 7.1h-6.6l9.4-10.5Z"
            />
          </svg>
        </span>
      )}
    </span>
  );
}
export function Link({ href = '/', onClick, ...p }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a
      href={href}
      {...p}
      onClick={(e) => {
        onClick?.(e);
        if (
          !e.defaultPrevented &&
          href.startsWith('/') &&
          !e.ctrlKey &&
          !e.metaKey &&
          !e.shiftKey &&
          e.button === 0
        ) {
          e.preventDefault();
          go(href);
        }
      }}
    />
  );
}
export function Button({
  children,
  variant = 'normal',
  busy = false,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'normal' | 'ghost' | 'danger';
  busy?: boolean;
}) {
  return (
    <button {...props} disabled={busy || props.disabled} className={`btn ${variant} ${className}`}>
      {busy && <LoaderCircle size={15} className="spin" />}
      {children}
    </button>
  );
}
export function IconButton({
  label,
  children,
  className = '',
  ...p
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={'icon-button ' + className}
      {...p}
    >
      {children}
    </button>
  );
}
export function ErrorLine({ text }: { text?: string }) {
  return text ? (
    <div className="error-line" role="alert">
      <AlertCircle size={16} />
      <span>{text}</span>
    </div>
  ) : null;
}
export function Modal({
  title,
  kicker,
  children,
  close,
  wide = false,
}: {
  title: string;
  kicker?: string;
  children: ReactNode;
  close: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    const old = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = old;
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={'modal ' + (wide ? 'wide' : '')}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === ref.current) {
          const r = ref.current!.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            close();
        }
      }}
    >
      <div className="modal-head">
        <div>
          {kicker && <div className="eyebrow red">{kicker}</div>}
          <h2>{title}</h2>
        </div>
        <IconButton label="Close dialog" onClick={close}>
          <X size={18} />
        </IconButton>
      </div>
      {children}
    </dialog>
  );
}
export function PageTitle({
  kicker,
  title,
  subtitle,
  action,
}: {
  kicker: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-heading">
      <div>
        <div className="eyebrow">
          <span className="dash" />
          {kicker}
        </div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}
export function SectionHead({
  title,
  kicker,
  children,
  count,
}: {
  title: string;
  kicker?: string;
  children?: ReactNode;
  count?: number;
}) {
  return (
    <div className="section-head">
      <div>
        {kicker && <div className="eyebrow">{kicker}</div>}
        <h2>
          {title}
          {count !== undefined && <span className="count">{String(count).padStart(2, '0')}</span>}
        </h2>
      </div>
      {children}
    </div>
  );
}
export function Empty({
  icon: Icon = Layers3,
  title,
  children,
}: {
  icon?: LucideIcon;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-symbol">
        <Icon size={23} />
      </span>
      <h3>{title}</h3>
      {children}
    </div>
  );
}
export function Loading({ text = 'Opening workspace…' }: { text?: string }) {
  return (
    <div className="loading-state">
      <span className="brand-pulse">
        <Mark size={40} />
      </span>
      <p>{text}</p>
    </div>
  );
}
export function Status({ children, tone = 'green' }: { children: ReactNode; tone?: string }) {
  return (
    <span className={'status ' + tone}>
      <i />
      {children}
    </span>
  );
}
export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  const uid = useId();
  return (
    <label className="field">
      <span id={uid + '-label'}>{label}</span>
      {Children.map(children, (c) =>
        isValidElement(c) &&
        typeof c.type === 'string' &&
        ['input', 'textarea', 'select'].includes(c.type)
          ? cloneElement(c as ReactElement<Record<string, unknown>>, {
              'aria-labelledby': uid + '-label',
              'aria-describedby': hint ? uid + '-hint' : undefined,
            })
          : c,
      )}
      {hint && <small id={uid + '-hint'}>{hint}</small>}
    </label>
  );
}
export function ViewLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link className="view-link" href={to}>
      {children}
      <ChevronRight size={14} />
    </Link>
  );
}
export const Arrow = () => <ArrowUpRight size={15} />;
export function Saved({ text }: { text: string }) {
  return (
    <span className="saved">
      <Check size={14} />
      {text}
    </span>
  );
}
