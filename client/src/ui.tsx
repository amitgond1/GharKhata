import { useEffect, useRef, type ReactNode } from 'react';
import { X, ArrowUpRight, FolderOpen, LoaderCircle, Paperclip } from 'lucide-react';
import { useUi } from './context';
import { formatMoney } from '@gharkhata/shared';
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current!;
    d.showModal();
    const before = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = before;
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? 'wide' : ''}`}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-labelledby="dialog-title"
    >
      <div className="modal-head">
        <h2 id="dialog-title">{title}</h2>
        <button className="icon-btn" onClick={onClose} aria-label="Close dialog">
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Money({ value, compact = false }: { value: number; compact?: boolean }) {
  return <span className="money">{formatMoney(value, compact)}</span>;
}
export function Badge({ status }: { status: string }) {
  const { t } = useUi();
  return (
    <span className={`badge ${status}`}>
      {status === 'credited'
        ? 'Settled by credit'
        : status === 'paid'
          ? t('paid')
          : status === 'partial'
            ? t('partial')
            : status === 'unpaid'
              ? t('unpaid')
              : status}
    </span>
  );
}
export function Empty({
  title,
  body,
  action,
}: {
  title?: string;
  body?: string;
  action?: ReactNode;
}) {
  const { t } = useUi();
  return (
    <div className="empty">
      <span className="empty-icon">
        <FolderOpen size={29} />
      </span>
      <h3>{title || t('noResults')}</h3>
      <p>{body || t('noData')}</p>
      {action}
    </div>
  );
}
export function Loading() {
  const { t } = useUi();
  return (
    <div className="loading" aria-label={t('loading')} role="status">
      <div className="skeleton skeleton-heading" />
      <div className="stats-grid">
        {[1, 2, 3, 4].map((n) => (
          <div className="skeleton skeleton-card" key={n} />
        ))}
      </div>
      <div className="skeleton skeleton-chart" />
    </div>
  );
}
export function Submit({ pending, label }: { pending: boolean; label?: string }) {
  const { t } = useUi();
  return (
    <button className="btn primary" type="submit" disabled={pending}>
      {pending ? <LoaderCircle size={17} className="spin" /> : <ArrowUpRight size={17} />}{' '}
      {label || t('save')}
    </button>
  );
}
export function dateLabel(date: string, lang = 'en', short = false) {
  if (!date) return '—';
  return new Intl.DateTimeFormat(lang === 'hi' ? 'hi-IN' : 'en-IN', {
    day: 'numeric',
    month: short ? 'short' : 'long',
    ...(short ? {} : { year: 'numeric' }),
    timeZone: 'Asia/Kolkata',
  }).format(new Date(`${date}T06:30:00Z`));
}
export function Attachments({
  ids,
  project,
  files,
}: {
  ids: string[];
  project: string;
  files: any[];
}) {
  return (
    <div className="attachments">
      {ids?.map((id) => {
        const f = files.find((f) => f._id === id);
        return (
          <a
            key={id}
            href={`/api/projects/${project}/attachments/${id}`}
            target="_blank"
            rel="noreferrer"
            className="attachment"
          >
            <Paperclip size={15} />
            {f?.name || 'Attachment'}
          </a>
        );
      })}
    </div>
  );
}
