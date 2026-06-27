import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  TrashIcon,
  WrenchScrewdriverIcon,
  ChevronRightIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';
import { serviceApi } from '../../api';
import { formatCurrency, formatDate } from '../../utils/helpers';
import LoadingSpinner from '../ui/LoadingSpinner';
import EmptyState from '../ui/EmptyState';
import Modal from '../ui/Modal';

/**
 * Lists services for a given status. `status` is 'pending' or 'closed'.
 *  - pending: clicking a row opens the closing screen.
 *  - closed:  rows expand inline to show the closing breakdown.
 */
export default function ServiceListPage({ status = 'pending' }) {
  const navigate = useNavigate();
  const isPending = status === 'pending';
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState({});
  const [deleteModal, setDeleteModal] = useState({ open: false, service: null });

  const fetchServices = async () => {
    try {
      setLoading(true);
      const res = await serviceApi.getAll({ status });
      setServices(res.data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchServices(); }, [status]);

  const handleDelete = async () => {
    try {
      await serviceApi.delete(deleteModal.service.id);
      toast.success('Service deleted');
      setDeleteModal({ open: false, service: null });
      fetchServices();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const filtered = services.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const itemsMatch = Array.isArray(s.items) && s.items.some(
      (it) => (it.item_name || '').toLowerCase().includes(q) || (it.imei || '').toLowerCase().includes(q)
    );
    return (
      String(s.service_number).includes(q) ||
      (s.ledger_name || '').toLowerCase().includes(q) ||
      (s.customer_name || '').toLowerCase().includes(q) ||
      (s.customer_mobile || '').includes(q) ||
      (s.item_name || '').toLowerCase().includes(q) ||
      (s.imei || '').toLowerCase().includes(q) ||
      itemsMatch
    );
  });

  if (loading) return <LoadingSpinner className="py-20" size="lg" />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-title">{isPending ? 'Pending Services' : 'Closed Services'}</h1>
          <p className="text-sm text-slate-500">
            {isPending
              ? 'Open service jobs awaiting completion. Click a row to close.'
              : 'Completed service jobs with their cost breakdown.'}
          </p>
        </div>
        <button onClick={() => navigate('/services/new')} className="btn-primary flex items-center gap-2">
          <PlusIcon className="h-4 w-4" />
          New Service
        </button>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="p-3 border-b border-slate-200 bg-slate-50">
          <div className="relative">
            <MagnifyingGlassIcon className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by service #, customer, item or IMEI…"
              className="input-field pl-9"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={WrenchScrewdriverIcon}
            title={isPending ? 'No pending services' : 'No closed services'}
            description={isPending ? 'Record a new service to get started' : 'Closed services will appear here'}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm table-zebra">
              <thead>
                <tr className="border-b border-slate-200">
                  {!isPending && <th className="px-4 py-2.5 w-10"></th>}
                  <th className="px-4 py-2.5 text-left font-semibold text-slate-600 w-20">Svc #</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-slate-600">Customer</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-slate-600">Item</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-slate-600">Staff</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-slate-600 w-28">Date</th>
                  <th className="px-4 py-2.5 text-right font-semibold text-slate-600">Advance</th>
                  {isPending ? (
                    <th className="px-4 py-2.5 w-10"></th>
                  ) : (
                    <th className="px-4 py-2.5 text-right font-semibold text-slate-600">Collected</th>
                  )}
                  <th className="px-4 py-2.5 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => {
                  const rowMain = (
                    <tr
                      key={s.id}
                      className={`border-b border-slate-100 ${isPending ? 'cursor-pointer hover:bg-slate-50' : ''}`}
                      onClick={isPending ? () => navigate(`/services/${s.id}/close`) : undefined}
                    >
                      {!isPending && (
                        <td className="px-4 py-2.5">
                          <button
                            onClick={(e) => { e.stopPropagation(); setExpanded((p) => ({ ...p, [s.id]: !p[s.id] })); }}
                            className="text-slate-400 hover:text-slate-700"
                          >
                            {expanded[s.id] ? <ChevronDownIcon className="h-4 w-4" /> : <ChevronRightIcon className="h-4 w-4" />}
                          </button>
                        </td>
                      )}
                      <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{s.service_number}</td>
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-slate-800">{s.customer_name || s.ledger_name}</div>
                        {s.customer_mobile && <div className="text-xs text-slate-400">{s.customer_mobile}</div>}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="text-slate-700">
                          {s.item_name}
                          {Array.isArray(s.items) && s.items.length > 1 && (
                            <span className="ml-1 text-[11px] font-medium text-trust-blue">+{s.items.length - 1} more</span>
                          )}
                        </div>
                        {s.imei && <div className="text-[11px] font-mono text-slate-400">{s.imei}</div>}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">{s.staff_name || '—'}</td>
                      <td className="px-4 py-2.5 text-slate-500 text-xs">{formatDate(s.date)}</td>
                      <td className="px-4 py-2.5 text-right text-slate-600">{formatCurrency(s.advance_amount)}</td>
                      {isPending ? (
                        <td className="px-4 py-2.5 text-slate-300"><ChevronRightIcon className="h-4 w-4" /></td>
                      ) : (
                        <td className="px-4 py-2.5 text-right font-semibold text-slate-800">{formatCurrency(s.collect_amount)}</td>
                      )}
                      <td className="px-4 py-2.5">
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteModal({ open: true, service: s }); }}
                          title="Delete"
                          className="p-1.5 rounded text-debit-red hover:bg-slate-100"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );

                  if (isPending || !expanded[s.id]) return rowMain;

                  return [
                    rowMain,
                    <tr key={`${s.id}-detail`} className="bg-slate-50/60 border-b border-slate-100">
                      <td colSpan={9} className="px-6 py-3">
                        {Array.isArray(s.items) && s.items.length > 0 && (
                          <div className="mb-3">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Items</p>
                            <div className="space-y-0.5">
                              {s.items.map((it) => (
                                <div key={it.id} className="flex items-center gap-2 text-xs text-slate-600">
                                  <span className="font-medium text-slate-700">{it.item_name}</span>
                                  <span className="text-slate-400">× {it.quantity}</span>
                                  {it.imei && <span className="font-mono text-slate-400">{it.imei}</span>}
                                  {it.staff_name && <span className="text-slate-400">• {it.staff_name}</span>}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                          <Detail label="Material Cost" value={formatCurrency(s.material_cost)} />
                          <Detail label="Labour Cost" value={formatCurrency(s.labour_cost)} />
                          <Detail label="Advance" value={formatCurrency(s.advance_amount)} />
                          <Detail label="Amount Collected" value={formatCurrency(s.collect_amount)} />
                          <Detail label="Closed On" value={formatDate(s.closed_at)} />
                          <Detail label="Place" value={s.customer_place || '—'} />
                          <Detail label="Ledger" value={s.ledger_name} />
                        </div>
                        {s.remarks && (
                          <p className="mt-2 text-xs text-slate-500"><span className="font-medium text-slate-600">Service remarks:</span> {s.remarks}</p>
                        )}
                        {s.closing_remarks && (
                          <p className="mt-1 text-xs text-slate-500"><span className="font-medium text-slate-600">Closing remarks:</span> {s.closing_remarks}</p>
                        )}
                      </td>
                    </tr>,
                  ];
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, service: null })}
        title="Delete service"
      >
        <p className="text-sm text-slate-600">
          Delete service <span className="font-semibold">#{deleteModal.service?.service_number}</span>? This cannot be undone.
        </p>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={() => setDeleteModal({ open: false, service: null })} className="btn-secondary">Cancel</button>
          <button onClick={handleDelete} className="btn-danger">Delete</button>
        </div>
      </Modal>
    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className="text-slate-700 font-medium">{value}</div>
    </div>
  );
}
