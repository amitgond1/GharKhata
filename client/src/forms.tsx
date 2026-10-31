import { useEffect, useRef, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, Upload, ChevronDown, CloudOff, Check, X } from 'lucide-react';
import {
  categories,
  stages,
  units,
  paise,
  lineTotal,
  wageAmount,
  billSchema,
  schemas,
  projectSchema,
  type Kind,
} from '@gharkhata/shared';
import { api, type Snapshot } from './api';
import { useUi, type TranslationKey } from './context';
import { Money, Submit } from './ui';
export type Save = (kind: string, data: any, key?: string) => Promise<void>;
const cash = (value: string) => paise(value || '0');
const rupees = (n: number) => String((n || 0) / 100);
export function Uploads({
  project,
  value,
  onChange,
  onBusy,
}: {
  project: string;
  value: string[];
  onChange: (v: string[]) => void;
  onBusy?: (v: boolean) => void;
}) {
  const { t, toast } = useUi();
  const [busy, setBusy] = useState(false);
  const [names, setNames] = useState<Record<string, string>>({});
  return (
    <div className="field full">
      <span className="label">{t('receipt')}</span>
      <label className={`upload-zone ${busy ? 'disabled' : ''}`}>
        <Upload size={20} />
        <span>{busy ? 'Uploading…' : t('receiptHelp')}</span>
        <input
          aria-label={t('receipt')}
          disabled={busy || value.length >= 10}
          type="file"
          capture="environment"
          accept="image/jpeg,image/png,application/pdf"
          multiple
          onChange={async (e) => {
            const files = Array.from(e.target.files || []);
            setBusy(true);
            onBusy?.(true);
            try {
              const added = [];
              for (const f of files) {
                if (f.size > 10 * 1024 * 1024) throw new Error('Files must be under 10 MB');
                const fd = new FormData();
                fd.append('file', f);
                const a = await api(`/projects/${project}/attachments`, {
                  method: 'POST',
                  body: fd,
                });
                added.push(a._id);
                setNames((n) => ({ ...n, [a._id]: a.name }));
                onChange([...value, ...added].slice(0, 10));
              }
              onChange([...value, ...added].slice(0, 10));
              toast(`${added.length} private attachment(s) uploaded`);
            } catch (e) {
              toast((e as Error).message, true);
            } finally {
              setBusy(false);
              onBusy?.(false);
              e.target.value = '';
            }
          }}
        />
      </label>
      {value.length > 0 && (
        <div className="upload-file-list">
          {value.map((id, i) => (
            <div key={id}>
              <a
                target="_blank"
                rel="noreferrer"
                href={`/api/projects/${project}/attachments/${id}`}
              >
                <Check size={13} /> {names[id] || `Attachment ${i + 1}`}
              </a>
              <button
                type="button"
                className="icon-btn"
                aria-label={`Remove attachment ${i + 1}`}
                onClick={() => onChange(value.filter((v) => v !== id))}
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
export function BillForm({
  snapshot,
  onSave,
  project,
  user,
}: {
  snapshot: Snapshot;
  onSave: Save;
  project: string;
  user: string;
}) {
  const { t, toast } = useUi();
  const draftKey = `gharkhata:draft:${user}:${project}`;
  const defaults = {
    description: '',
    date: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date()),
    vendor: '',
    invoice: '',
    dueDate: '',
    floor: '',
    room: '',
    stage: '',
    notes: '',
    status: 'paid',
    paid: '',
    method: 'UPI',
    historical: false,
    lines: [
      {
        description: '',
        category: 'Cement',
        quantity: '1',
        unit: 'Fixed amount',
        rate: '',
        discount: '0',
        tax: '0',
        transport: '0',
        other: '0',
      },
    ],
  };
  const [cached] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(draftKey) || 'null');
    } catch {
      return null;
    }
  });
  const {
    register,
    control,
    watch,
    handleSubmit,
    formState: { errors },
  } = useForm<any>({ defaultValues: cached || defaults });
  const { fields, append, remove } = useFieldArray({ control, name: 'lines' });
  const values = watch();
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [attachments, setAttachments] = useState<string[]>(cached?._attachments || []);
  const [advanced, setAdvanced] = useState(false);
  const saved = useRef(false);
  const submission = useRef(
    (() => {
      try {
        return (
          JSON.parse(localStorage.getItem(draftKey + ':request') || 'null') || {
            body: '',
            key: crypto.randomUUID(),
          }
        );
      } catch {
        return { body: '', key: crypto.randomUUID() };
      }
    })(),
  );
  useEffect(() => {
    const sub = watch((v) => {
      if (!saved.current)
        localStorage.setItem(draftKey, JSON.stringify({ ...v, _attachments: attachments }));
    });
    return () => sub.unsubscribe();
  }, [watch, draftKey, attachments]);
  useEffect(() => {
    if (!saved.current)
      localStorage.setItem(draftKey, JSON.stringify({ ...watch(), _attachments: attachments }));
  }, [attachments]);
  const lines = () =>
    values.lines.map((l: any) => ({
      ...l,
      description: l.description || values.description,
      rate: cash(l.rate),
      discount: cash(l.discount),
      tax: cash(l.tax),
      transport: cash(l.transport),
      other: cash(l.other),
    }));
  let total = 0;
  try {
    total = lines().reduce((s: number, l: any) => s + lineTotal(l), 0);
  } catch {}
  const paid =
    values.status === 'paid'
      ? total
      : values.status === 'partial'
        ? (() => {
            try {
              return cash(values.paid);
            } catch {
              return 0;
            }
          })()
        : 0;
  return (
    <form
      onSubmit={handleSubmit(async (v) => {
        setBusy(true);
        try {
          const data = billSchema.parse({
            ...v,
            description: v.description,
            lines: lines(),
            vendor: v.vendor || undefined,
            dueDate: v.dueDate || undefined,
            paid,
            attachments,
          });
          if (values.status === 'partial' && (paid <= 0 || paid >= total))
            throw new Error(
              'Partial payment must be greater than zero and less than the bill total',
            );
          const body = JSON.stringify(data);
          if (submission.current.body !== body)
            submission.current = { body, key: crypto.randomUUID() };
          localStorage.setItem(draftKey + ':request', JSON.stringify(submission.current));
          await onSave('bill', data, submission.current.key);
          saved.current = true;
          localStorage.removeItem(draftKey);
          localStorage.removeItem(draftKey + ':request');
        } catch (e) {
          toast((e as Error).message, true);
        } finally {
          setBusy(false);
        }
      })}
    >
      <div className="form-body">
        <p className="form-intro">A little expense today. A clearer picture tomorrow.</p>
        {cached && (
          <div className="notice">
            <CloudOff size={16} />
            {t('draft')}
          </div>
        )}
        <div className="form-grid">
          <label className="field full">
            {t('description')}
            <input
              autoFocus
              placeholder="e.g. Cement for first-floor slab"
              {...register('description', { required: 'Add a description' })}
            />
            {errors.description && <span className="field-error">Add a description</span>}
          </label>
          <label className="field">
            {t('date')}
            <input type="date" {...register('date', { required: true })} />
          </label>
          <label className="field">
            {t('vendor')}
            <select {...register('vendor')}>
              <option value="">Cash purchase / no vendor</option>
              {snapshot.vendors.map((v) => (
                <option value={v._id} key={v._id}>
                  {v.data.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="line-items">
          {fields.map((f, index) => (
            <div className="invoice-line" key={f.id}>
              <div className="line-heading">
                <span>ITEM {String(index + 1).padStart(2, '0')}</span>
                {fields.length > 1 && (
                  <button
                    type="button"
                    className="icon-btn danger"
                    aria-label="Remove item"
                    onClick={() => remove(index)}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
              <div className="form-grid">
                {fields.length > 1 && (
                  <label className="field full">
                    Item description
                    <input {...register(`lines.${index}.description`)} />
                  </label>
                )}
                <label className="field">
                  {t('category')}
                  <input
                    list="category-options"
                    {...register(`lines.${index}.category`, { required: true })}
                  />
                  <datalist id="category-options">
                    {categories.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </datalist>
                </label>
                <label className="field">
                  {t('unit')}
                  <select {...register(`lines.${index}.unit`)}>
                    {units.map((u) => (
                      <option key={u}>{u}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  {t('quantity')}
                  <input
                    inputMode="decimal"
                    {...register(`lines.${index}.quantity`, {
                      required: true,
                      pattern: /^\d+(\.\d{1,3})?$/,
                    })}
                  />
                </label>
                <label className="field">
                  {values.lines[index]?.unit === 'Fixed amount' ? t('amount') : t('rate')}
                  <input
                    placeholder="0.00"
                    inputMode="decimal"
                    {...register(`lines.${index}.rate`, {
                      required: true,
                      pattern: /^\d+(\.\d{1,2})?$/,
                    })}
                  />
                </label>
                {advanced &&
                  (['discount', 'tax', 'transport', 'other'] as const).map((k) => (
                    <label className="field" key={k}>
                      {t(k)}
                      <input inputMode="decimal" {...register(`lines.${index}.${k}`)} />
                    </label>
                  ))}
              </div>
            </div>
          ))}
        </div>
        <button type="button" className="text-btn" onClick={() => append({ ...defaults.lines[0] })}>
          <Plus size={15} />
          Add another item
        </button>
        <div className="form-grid payment-fields">
          <label className="field">
            {t('status')}
            <select {...register('status')}>
              <option value="paid">{t('paid')}</option>
              <option value="partial">{t('partial')}</option>
              <option value="unpaid">{t('unpaid')}</option>
            </select>
          </label>
          {values.status === 'partial' && (
            <label className="field">
              {t('paidAmount')}
              <input
                inputMode="decimal"
                placeholder="0.00"
                {...register('paid', { required: true })}
              />
            </label>
          )}
          {values.status !== 'unpaid' && (
            <label className="field">
              {t('method')}
              <select {...register('method')}>
                {['UPI', 'cash', 'bank transfer', 'cheque', 'other'].map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </label>
          )}
        </div>
        <button
          type="button"
          className="expand-btn"
          onClick={() => setAdvanced(!advanced)}
          aria-expanded={advanced}
        >
          <ChevronDown size={16} className={advanced ? 'rotate' : ''} />
          {t('advanced')} <span>Invoice, tax, floor & notes</span>
        </button>
        {advanced && (
          <div className="form-grid expanded">
            {(['invoice', 'dueDate', 'floor', 'room'] as const).map((k) => (
              <label key={k} className="field">
                {k === 'room' ? 'Room / location' : t(k)}
                <input type={k === 'dueDate' ? 'date' : 'text'} {...register(k)} />
              </label>
            ))}
            <label className="field full">
              {t('stage')}
              <select {...register('stage')}>
                <option value="">Select stage</option>
                {stages.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className="field full">
              {t('notes')}
              <textarea rows={2} {...register('notes')} />
            </label>
            <label className="checkbox full">
              <input type="checkbox" {...register('historical')} />
              {t('historical')}
            </label>
          </div>
        )}
        <Uploads
          project={project}
          value={attachments}
          onChange={setAttachments}
          onBusy={setUploading}
        />
        <div className="calculation">
          <div>
            <span>{t('billTotal')}</span>
            <Money value={total} />
          </div>
          <div>
            <span>{t('payment')}</span>
            <Money value={paid} />
          </div>
          <div>
            <span>{t('pending')}</span>
            <Money value={total - paid} />
          </div>
        </div>
        <p className="fine-print">{t('expenseNote')}</p>
      </div>
      <div className="form-footer">
        <span className="muted small">Securely saved to your project</span>
        <Submit pending={busy || uploading} label={t('addExpense')} />
      </div>
    </form>
  );
}
type Field = {
  key: string;
  label: string;
  type?: string;
  options?: { value: string; label: string }[];
  optional?: boolean;
  value?: string;
  full?: boolean;
};
export function RecordForm({
  kind,
  snapshot,
  onSave,
  initial = {},
}: {
  kind: string;
  snapshot: Snapshot;
  onSave: Save;
  initial?: any;
}) {
  const { t, toast } = useUi();
  const live = snapshot.records.filter((r) => !r.voided);
  const [attachments, setAttachments] = useState<string[]>(initial.attachments || []);
  const [cover, setCover] = useState<string[]>(initial.cover ? [initial.cover] : []);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [allocationRows, setAllocationRows] = useState<{ bill: string; amount: string }[]>(
    initial.bill ? [{ bill: initial.bill, amount: rupees(initial.amount) }] : [],
  );
  const opts = (rows: any[], label: (r: any) => string) =>
    rows.map((r) => ({ value: r._id, label: label(r) }));
  const vendors = opts(snapshot.vendors, (v) => v.data.name);
  const bills = opts(
    snapshot.summary.bills.filter((b) => b.outstanding > 0),
    (b) => `${b.data.description} · ₹${rupees(b.outstanding)} due`,
  );
  const payments = opts(
    snapshot.summary.payments.filter((p) => p.available > 0),
    (p) => `${p.data.payee} · ₹${rupees(p.available)} available`,
  );
  const workers = opts(
    live.filter((r) => r.kind === 'worker'),
    (r) => r.data.name,
  );
  const field = (key: string, label: TranslationKey, type = 'text', optional = false): Field => ({
    key,
    label: t(label),
    type,
    optional,
  });
  const select = (
    key: string,
    label: TranslationKey,
    options: { value: string; label: string }[],
    optional = false,
  ): Field => ({ key, label: t(label), options, optional });
  const names = (items: readonly string[]) => items.map((s) => ({ value: s, label: s }));
  const amount = field('amount', 'amount', 'money');
  const date = field('date', 'date', 'date');
  const notes = { ...field('notes', 'notes', 'textarea', true), full: true };
  const vendor = select('vendor', 'vendor', vendors);
  const configs: Record<string, Field[]> = {
    vendor: [
      field('name', 'name'),
      field('phone', 'phone', 'tel', true),
      field('business', 'business', 'text', true),
      select('type', 'vendor', names(['supplier', 'contractor', 'labour', 'other'])),
      field('address', 'address', 'text', true),
      { key: 'tax', label: 'GST / tax details', optional: true },
      notes,
    ],
    payment: [
      vendor,
      { key: 'payee', label: 'Payee name' },
      amount,
      date,
      select('method', 'method', names(['UPI', 'cash', 'bank transfer', 'cheque', 'other'])),
      field('reference', 'reference', 'text', true),
      field('paidBy', 'paidBy', 'text', true),
      notes,
    ],
    allocation: [
      select('payment', 'payment', payments),
      select('bill', 'bill', bills),
      amount,
      date,
    ],
    credit: [select('bill', 'bill', bills), amount, date, field('reason', 'reason'), notes],
    refund: [
      select('payment', 'payment', payments),
      amount,
      date,
      field('reason', 'reason'),
      notes,
    ],
    worker: [
      field('name', 'name'),
      field('trade', 'trade'),
      field('phone', 'phone', 'tel', true),
      { ...field('rate', 'dailyRate', 'money') },
      vendor,
    ],
    attendance: [
      select('worker', 'name', workers),
      date,
      select('units', 'attendance', [
        { value: '1', label: 'Full day' },
        { value: '0.5', label: 'Half day' },
        { value: '0', label: 'Absent' },
        { value: '1.5', label: '1.5 approved days' },
        { value: '2', label: '2 approved days' },
        { value: 'custom', label: 'Custom approved day units' },
      ]),
      { key: 'customUnits', label: 'Custom approved day units (e.g. 1.125)', optional: true },
      notes,
    ],
    wage: [select('worker', 'name', workers), date, field('description', 'description')],
    log: [
      field('title', 'workCompleted'),
      date,
      select('stage', 'stage', names(stages), true),
      field('floor', 'floor', 'text', true),
      notes,
      field('problems', 'problems', 'textarea', true),
      field('labourCount', 'labourCount', 'number', true),
      { key: 'captions', label: 'Photo captions (one per line)', type: 'textarea', optional: true },
    ],
    task: [
      field('title', 'title'),
      field('dueDate', 'dueDate', 'date'),
      field('assignee', 'assignee', 'text', true),
      select('priority', 'priority', names(['normal', 'high', 'low'])),
      select('stage', 'stage', names(stages), true),
      {
        key: 'checklist',
        label: 'Checklist (one item per line)',
        type: 'textarea',
        optional: true,
      },
    ],
    budget: [
      { key: 'dimension', label: 'Budget by', options: names(['category', 'stage']) },
      { key: 'label', label: 'Category / stage name' },
      amount,
    ],
    stock: [
      { key: 'material', label: 'Material name' },
      date,
      select('unit', 'unit', names(units)),
      {
        key: 'type',
        label: 'Movement',
        options: names(['received', 'used', 'wastage', 'returned', 'adjustment']),
      },
      field('quantity', 'quantity'),
      { key: 'threshold', label: 'Low-stock threshold', optional: true },
      select(
        'bill',
        'bill',
        opts(snapshot.summary.bills, (b) => b.data.description),
        true,
      ),
      { key: 'line', label: 'Purchase line number (starts at 1)', type: 'number', optional: true },
      notes,
    ],
    contract: [
      vendor,
      field('title', 'title'),
      field('scope', 'scope', 'textarea'),
      field('amount', 'agreedAmount', 'money'),
      field('startDate', 'startDate', 'date'),
      field('endDate', 'endDate', 'date'),
      {
        key: 'milestones',
        label: 'Milestones: title | rupees | YYYY-MM-DD (one per line)',
        type: 'textarea',
        optional: true,
      },
      { key: 'changes', label: 'Approved changes', type: 'textarea', optional: true },
    ],
    project: [
      field('name', 'projectName'),
      field('location', 'location', 'text', true),
      select('type', 'projectDetails', names(['construction', 'renovation'])),
      field('startDate', 'startDate', 'date'),
      field('endDate', 'endDate', 'date', true),
      { key: 'floors', label: 'Number of floors', type: 'number', value: '2' },
      { ...field('budget', 'plannedBudget', 'money', true), value: '0' },
      { key: 'area', label: 'Built-up area', type: 'number', optional: true },
      { key: 'plotArea', label: 'Plot area', type: 'number', optional: true },
      { key: 'areaUnit', label: 'Area unit', options: names(['sq ft', 'sq m']) },
      select('status', 'status', names(['active', 'planned', 'paused', 'completed'])),
      field('estimate', 'estimate', 'money', true),
      { key: 'threshold', label: 'Budget alert threshold (%)', type: 'number', value: '90' },
    ],
  };
  const fields = configs[kind] || [];
  const schema = z.object(
    Object.fromEntries(
      fields.map((f) => [
        f.key,
        f.optional ? z.string() : z.string().min(1, `${f.label} is required`),
      ]),
    ),
  );
  const values = Object.fromEntries(
    fields.map((f) => [
      f.key,
      initial[f.key] !== undefined
        ? f.type === 'money'
          ? rupees(initial[f.key])
          : f.key === 'milestones'
            ? initial[f.key]
                .map((m: any) => `${m.title} | ${rupees(m.amount)} | ${m.date}`)
                .join('\n')
            : f.key === 'captions'
              ? initial[f.key].join('\n')
              : String(initial[f.key])
        : (f.value ??
          (f.type === 'date'
            ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())
            : (f.options?.[0]?.value ?? ''))),
    ]),
  );
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<Record<string, string>>({
    resolver: zodResolver(schema) as any,
    defaultValues: values,
  });
  const worker = watch('worker');
  const selectedVendor = watch('vendor');
  const attendances = live.filter(
    (r) =>
      r.kind === 'attendance' &&
      r.data.worker === worker &&
      !live.some((w) => w.kind === 'wage' && w.data.attendance.includes(r._id)),
  );
  const [selectedAttendance, setSelectedAttendance] = useState<string[]>([]);
  useEffect(() => {
    setSelectedAttendance([]);
  }, [worker]);
  const last = useRef({ body: '', key: crypto.randomUUID() });
  return (
    <form
      onSubmit={handleSubmit(async (values) => {
        setBusy(true);
        try {
          const d: any = { ...values };
          if (kind === 'attendance' && d.units === 'custom') d.units = d.customUnits;
          for (const f of fields) {
            if (f.type === 'money') d[f.key] = cash(d[f.key]);
            else if (f.type === 'number') d[f.key] = d[f.key] === '' ? undefined : Number(d[f.key]);
            else if (f.type === 'date' && f.optional && !d[f.key]) delete d[f.key];
          }
          d.attachments = attachments;
          if (kind === 'project' && cover[0]) d.cover = cover[0];
          if (kind === 'payment')
            d.allocations = allocationRows
              .filter((a) => a.bill)
              .map((a) => ({ bill: a.bill, amount: cash(a.amount) }));
          if (kind === 'wage')
            d.attendance = attendances
              .filter((entry) => selectedAttendance.includes(entry._id))
              .map((entry) => entry._id);
          if (kind === 'log')
            d.captions = String(d.captions || '')
              .split('\n')
              .filter(Boolean);
          if (kind === 'task')
            d.checklist = String(d.checklist || '')
              .split('\n')
              .filter(Boolean)
              .map((title) => ({ title, done: false }));
          if (kind === 'contract')
            d.milestones = String(d.milestones || '')
              .split('\n')
              .filter(Boolean)
              .map((row) => {
                const [title, amount, date] = row.split('|').map((s) => s.trim());
                return { title, amount: cash(amount), date };
              });
          if (kind === 'stock') {
            if (!d.threshold) delete d.threshold;
            if (!d.bill) delete d.bill;
            if (d.line !== undefined) d.line -= 1;
          }
          const validated =
            kind === 'project'
              ? projectSchema.parse(d)
              : kind === 'vendor'
                ? d
                : schemas[kind as Kind].parse(d);
          const body = JSON.stringify(validated);
          if (last.current.body !== body) last.current = { body, key: crypto.randomUUID() };
          await onSave(kind, validated, last.current.key);
        } catch (e) {
          toast((e as Error).message, true);
        } finally {
          setBusy(false);
        }
      })}
    >
      <div className="form-body">
        <div className="form-grid">
          {fields.map((f) => (
            <label className={`field ${f.full || f.type === 'textarea' ? 'full' : ''}`} key={f.key}>
              {f.label}
              {f.optional && <span className="optional"> Optional</span>}
              {f.options ? (
                <select {...register(f.key)}>
                  {f.optional && <option value="">—</option>}
                  {f.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : f.type === 'textarea' ? (
                <textarea rows={3} {...register(f.key)} />
              ) : (
                <input
                  list={
                    kind === 'budget' && f.key === 'label'
                      ? 'budget-labels'
                      : kind === 'stock' && f.key === 'material'
                        ? 'stock-materials'
                        : undefined
                  }
                  inputMode={f.type === 'money' ? 'decimal' : undefined}
                  type={f.type === 'money' ? 'text' : f.type || 'text'}
                  step={f.key === 'area' || f.key === 'plotArea' ? 'any' : undefined}
                  {...register(f.key)}
                />
              )}{' '}
              {errors[f.key] && (
                <span className="field-error">{String(errors[f.key]?.message)}</span>
              )}
            </label>
          ))}
        </div>
        {kind === 'stock' && (
          <datalist id="stock-materials">
            {[...new Set(live.filter((r) => r.kind === 'stock').map((r) => r.data.material))].map(
              (m) => (
                <option key={m}>{m}</option>
              ),
            )}
          </datalist>
        )}
        {kind === 'budget' && (
          <datalist id="budget-labels">
            {[...categories, ...stages].map((c, i) => (
              <option key={i}>{c}</option>
            ))}
          </datalist>
        )}
        {kind === 'payment' && (
          <div className="allocation-editor">
            <h4>
              Apply to bills <span className="optional">Optional · remainder stays as advance</span>
            </h4>
            {allocationRows.map((a, i) => (
              <div className="allocation-row" key={i}>
                <select
                  aria-label="Bill allocation"
                  value={a.bill}
                  onChange={(e) =>
                    setAllocationRows((rows) =>
                      rows.map((r, j) => (j === i ? { ...r, bill: e.target.value } : r)),
                    )
                  }
                >
                  <option value="">Select bill</option>
                  {snapshot.summary.bills
                    .filter((b) => b.outstanding > 0 && b.data.vendor === selectedVendor)
                    .map((b) => (
                      <option key={b._id} value={b._id}>
                        {b.data.description} · ₹{rupees(b.outstanding)}
                      </option>
                    ))}
                </select>
                <input
                  aria-label="Allocation amount"
                  inputMode="decimal"
                  placeholder="Amount ₹"
                  value={a.amount}
                  onChange={(e) =>
                    setAllocationRows((rows) =>
                      rows.map((r, j) => (j === i ? { ...r, amount: e.target.value } : r)),
                    )
                  }
                />
                <button
                  type="button"
                  className="icon-btn danger"
                  onClick={() => setAllocationRows((rows) => rows.filter((_, j) => j !== i))}
                  aria-label="Remove allocation"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            <button
              type="button"
              className="text-btn"
              onClick={() => setAllocationRows((rows) => [...rows, { bill: '', amount: '' }])}
            >
              <Plus size={15} />
              Allocate to a bill
            </button>
          </div>
        )}
        {kind === 'wage' && (
          <div className="wage-preview">
            <h4>Unbilled attendance</h4>
            {attendances.length ? (
              attendances.map((a) => (
                <label className="checkbox" key={a._id}>
                  <input
                    type="checkbox"
                    checked={selectedAttendance.includes(a._id)}
                    onChange={(e) =>
                      setSelectedAttendance((s) =>
                        e.target.checked ? [...s, a._id] : s.filter((id) => id !== a._id),
                      )
                    }
                  />
                  {a.data.date} · {a.data.units} day ·{' '}
                  <Money value={wageAmount(a.data.rate, a.data.units)} />
                </label>
              ))
            ) : (
              <p className="muted">Select a worker with unbilled attendance.</p>
            )}
            <div className="calculation">
              <span>Wages to approve</span>
              <Money
                value={attendances
                  .filter((a) => selectedAttendance.includes(a._id))
                  .reduce((n, a) => n + wageAmount(a.data.rate, a.data.units), 0)}
              />
            </div>
            <p className="fine-print">
              Approval creates one linked labour bill. Payment is recorded separately.
            </p>
          </div>
        )}
        {kind === 'project' && snapshot.project._id && (
          <div>
            <h4>Project cover image</h4>
            <p className="fine-print">
              Upload an image and the first selected attachment becomes the cover.
            </p>
            <Uploads
              project={snapshot.project._id}
              value={cover}
              onChange={(values) => setCover(values.slice(-1))}
              onBusy={setUploading}
            />
          </div>
        )}
        {['payment', 'log', 'task', 'contract'].includes(kind) && (
          <Uploads
            project={snapshot.project._id}
            value={attachments}
            onChange={setAttachments}
            onBusy={setUploading}
          />
        )}
        {['payment', 'allocation', 'credit', 'refund'].includes(kind) && (
          <p className="fine-print">{t('expenseNote')}</p>
        )}
        {kind === 'contract' && (
          <p className="notice">
            An agreement is a commitment. It becomes cost only when you record a bill.
          </p>
        )}
        {kind === 'project' && <p className="fine-print">{t('projectComplete')}</p>}
      </div>
      <div className="form-footer">
        <Submit pending={busy || uploading} />
      </div>
    </form>
  );
}
