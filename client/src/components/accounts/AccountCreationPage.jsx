import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { accountApi, ledgerApi, settingsApi } from '../../api';
import LoadingSpinner from '../ui/LoadingSpinner';
import toast from 'react-hot-toast';
import { BanknotesIcon } from '@heroicons/react/24/outline';

const EMPTY_FORM = {
  ledger_id: '',
  principal: '',
  interest_rate: '',
  interest_scheme: 'NONE',
  notes: '',
};

export default function AccountCreationPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [ledgers, setLedgers] = useState([]);
  const [interestEnabled, setInterestEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const principalRef = useRef(null);
  const rateRef = useRef(null);
  const notesRef = useRef(null);
  const submitRef = useRef(null);

  useEffect(() => {
    const init = async () => {
      try {
        const [ledgersRes, settingsRes] = await Promise.all([
          ledgerApi.getAll(),
          settingsApi.get('interest_module_enabled'),
        ]);
        setLedgers(ledgersRes.data);
        setInterestEnabled(settingsRes.data?.value === true || settingsRes.data?.value === 'true');
      } catch (err) {
        toast.error(err.message);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const validate = (f) => {
    const errs = {};
    if (!f.ledger_id) errs.ledger_id = 'Please select a ledger.';
    const amt = parseFloat(f.principal);
    if (!f.principal || isNaN(amt) || amt <= 0) errs.principal = 'Principal must be a positive number.';
    if (interestEnabled && f.interest_scheme !== 'NONE') {
      const rate = parseFloat(f.interest_rate);
      if (!f.interest_rate || isNaN(rate) || rate <= 0) errs.interest_rate = 'Interest rate must be a positive number.';
    }
    return errs;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    const next = { ...form, [name]: value };
    setForm(next);
    if (touched[name]) setErrors(validate(next));
  };

  const handleBlur = (e) => {
    const { name } = e.target;
    setTouched((p) => ({ ...p, [name]: true }));
    setErrors(validate(form));
  };

  const handleKeyDown = (e, nextRef) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      nextRef?.current?.focus();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const allTouched = Object.fromEntries(Object.keys(EMPTY_FORM).map((k) => [k, true]));
    setTouched(allTouched);
    const errs = validate(form);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    try {
      setSubmitting(true);
      const res = await accountApi.create({
        ledger_id: parseInt(form.ledger_id),
        principal: parseFloat(form.principal),
        interest_rate: interestEnabled ? parseFloat(form.interest_rate) || 0 : 0,
        interest_scheme: interestEnabled ? form.interest_scheme : 'NONE',
        notes: form.notes,
      });
      toast.success('Account created successfully');
      navigate(`/account/${res.data.id}`);
    } catch (err) {
      toast.error(err.message || 'Failed to create account');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedLedger = ledgers.find((l) => l.id === parseInt(form.ledger_id));

  const filteredLedgers = ledgers.filter((l) =>
    l.name.toLowerCase().includes(search.toLowerCase()) ||
    (l.phone || '').includes(search) ||
    (l.place || '').toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <LoadingSpinner className="py-20" size="lg" />;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-trust-blue/10">
          <BanknotesIcon className="h-5 w-5 text-trust-blue" />
        </div>
        <div>
          <h1 className="page-title">Account Creation</h1>
          <p className="text-sm text-slate-500 mt-0.5">Create a new account for a customer or supplier</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <div className="card space-y-5">

          {/* Ledger Selection */}
          <div>
            <label className="label">Select Ledger *</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search ledger by name, phone, place…"
              className="input-field mb-2"
            />
            <select
              name="ledger_id"
              value={form.ledger_id}
              onChange={handleChange}
              onBlur={handleBlur}
              className={`input-field ${errors.ledger_id ? 'border-red-400 focus:ring-red-400' : ''}`}
              size={Math.min(filteredLedgers.length + 1, 6)}
            >
              <option value="">— Select ledger —</option>
              {filteredLedgers.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.type === 'customer' ? 'Customer' : 'Supplier'}){l.place ? ` · ${l.place}` : ''}
                </option>
              ))}
            </select>
            {errors.ledger_id && <p className="text-xs text-red-500 mt-1">{errors.ledger_id}</p>}
            {selectedLedger && (
              <div className="mt-2 p-2 bg-slate-50 rounded-lg text-sm">
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium mr-2 ${
                  selectedLedger.type === 'customer' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'
                }`}>
                  {selectedLedger.type === 'customer' ? 'Customer' : 'Supplier'}
                </span>
                <strong>{selectedLedger.name}</strong>
                {selectedLedger.phone && <span className="text-slate-400 ml-2">· {selectedLedger.phone}</span>}
                {selectedLedger.place && <span className="text-slate-400 ml-2">· {selectedLedger.place}</span>}
              </div>
            )}
          </div>

          {/* Principal */}
          <div>
            <label className="label">
              Principal Amount *
              {selectedLedger && (
                <span className="text-xs text-slate-400 ml-2">
                  {selectedLedger.type === 'customer'
                    ? '(Amount given to customer)'
                    : '(Amount borrowed from supplier)'}
                </span>
              )}
            </label>
            <input
              ref={principalRef}
              type="number"
              name="principal"
              value={form.principal}
              onChange={handleChange}
              onBlur={handleBlur}
              onKeyDown={(e) => handleKeyDown(e, interestEnabled ? rateRef : notesRef)}
              className={`input-field ${errors.principal ? 'border-red-400 focus:ring-red-400' : ''}`}
              placeholder="Enter principal amount"
              min="0"
              step="0.01"
            />
            {errors.principal && <p className="text-xs text-red-500 mt-1">{errors.principal}</p>}
          </div>

          {/* Interest Settings — only if interest module enabled */}
          {interestEnabled && (
            <div className="border border-slate-200 rounded-lg p-4 space-y-4 bg-slate-50/50">
              <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <BanknotesIcon className="h-4 w-4 text-amber-500" />
                Interest Configuration
              </h3>

              {/* Interest Scheme */}
              <div>
                <label className="label">Interest Scheme</label>
                <select
                  name="interest_scheme"
                  value={form.interest_scheme}
                  onChange={handleChange}
                  className="input-field"
                >
                  <option value="NONE">No Interest</option>
                  <option value="DAILY">Daily</option>
                  <option value="MONTHLY">Monthly</option>
                </select>
              </div>

              {/* Interest Rate — only if scheme is DAILY or MONTHLY */}
              {form.interest_scheme !== 'NONE' && (
                <div>
                  <label className="label">
                    {form.interest_scheme === 'DAILY' ? 'Interest Rate (% per month) *' : 'Interest Rate (% per annum) *'}
                  </label>
                  <input
                    ref={rateRef}
                    type="number"
                    name="interest_rate"
                    value={form.interest_rate}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    onKeyDown={(e) => handleKeyDown(e, notesRef)}
                    className={`input-field ${errors.interest_rate ? 'border-red-400 focus:ring-red-400' : ''}`}
                    placeholder="e.g. 12"
                    min="0"
                    step="0.01"
                  />
                  {errors.interest_rate && <p className="text-xs text-red-500 mt-1">{errors.interest_rate}</p>}
                  <p className="text-xs text-slate-400 mt-1">
                    {form.interest_scheme === 'DAILY'
                      ? 'Interest will be calculated as: Balance × Rate / 100 per month (rate is monthly %)'
                      : 'Interest will be calculated as: Balance × Rate / 100 / 12 per month (rate is annual %)'}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="label">Notes</label>
            <textarea
              ref={notesRef}
              name="notes"
              value={form.notes}
              onChange={handleChange}
              rows={2}
              className="input-field resize-none"
              placeholder="Optional notes about this account"
            />
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate('/ledgers')}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              ref={submitRef}
              type="submit"
              disabled={submitting}
              className="btn-primary"
            >
              {submitting ? 'Creating…' : 'Create Account'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
