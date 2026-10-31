import { useSearchParams, Link } from 'react-router-dom';
import { Search as SearchIcon, ArrowUpRight } from 'lucide-react';
import { formatMoney } from '@gharkhata/shared';
import { type Snapshot } from './api';
import { PageTitle } from './Records';
import { Empty, Money } from './ui';
export function Search({ data }: { data: Snapshot }) {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || '';
  const routes: Record<string, string> = {
    bill: 'expenses',
    payment: 'payments',
    credit: 'expenses',
    refund: 'payments',
    allocation: 'payments',
    worker: 'labour',
    attendance: 'labour',
    wage: 'labour',
    stock: 'materials',
    log: 'progress',
    task: 'tasks',
    budget: 'budget',
    contract: 'vendors',
  };
  const results = q.trim()
    ? data.records.filter(
        (r) =>
          !r.voided &&
          (
            JSON.stringify(r.data) +
            ' ' +
            data.vendors.find((v) => v._id === r.data.vendor)?.data.name +
            ' ' +
            (r.data.total || r.data.amount ? formatMoney(r.data.total || r.data.amount) : '')
          )
            .toLowerCase()
            .includes(q.toLowerCase()),
      )
    : [];
  const vendors = q.trim()
    ? data.vendors.filter((v) => JSON.stringify(v.data).toLowerCase().includes(q.toLowerCase()))
    : [];
  return (
    <>
      <PageTitle
        title="Search your project"
        subtitle="Find a bill, payment reference, item, vendor or note in this home’s records."
      />
      <label className="search-field global-search-box">
        <SearchIcon size={18} />
        <input
          autoFocus
          aria-label="Search all project records"
          value={q}
          onChange={(e) => setParams({ q: e.target.value })}
          placeholder="Try an invoice number, payment reference or vendor…"
        />
      </label>
      <section className="panel search-results">
        <div className="panel-heading">
          <div>
            <h3>{results.length + vendors.length} matching records</h3>
            <p>Only records from {data.project.name}</p>
          </div>
        </div>
        {vendors.map((v) => (
          <Link className="search-result" to="/app/vendors" key={v._id}>
            <span className="search-kind">Vendor</span>
            <div>
              <strong>{v.data.name}</strong>
              <small>{v.data.business}</small>
            </div>
            <ArrowUpRight size={17} />
          </Link>
        ))}
        {results.slice(0, 100).map((r) => (
          <Link
            key={r._id}
            className="search-result"
            to={`/app/${routes[r.kind] || 'expenses'}${['bill', 'payment'].includes(r.kind) ? '?q=' + encodeURIComponent(r.data.description || r.data.reference || r.data.payee) : ''}`}
          >
            <span className="search-kind">{r.kind}</span>
            <div>
              <strong>
                {r.data.description ||
                  r.data.title ||
                  r.data.name ||
                  r.data.material ||
                  r.data.payee ||
                  r.data.reason ||
                  'Linked record'}
              </strong>
              <small>
                {r.data.date || ''} {r.data.invoice || r.data.reference || ''}{' '}
                {r.data.notes?.slice(0, 100)}
              </small>
            </div>
            {(r.data.total || r.data.amount) && <Money value={r.data.total || r.data.amount} />}
            <ArrowUpRight size={17} />
          </Link>
        ))}
        {!results.length && !vendors.length && (
          <Empty
            title={q ? 'No matching records' : 'What are you looking for?'}
            body="Search an item, a note or a reference. Nothing outside this project is included."
          />
        )}
      </section>
    </>
  );
}
