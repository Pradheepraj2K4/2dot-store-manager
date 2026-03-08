import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ledgerApi, ledgerTypeApi, interestApi } from '../../api';
import toast from 'react-hot-toast';
import { BookOpenIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

// Prevent mouse-wheel from changing number input values
const noWheel = (e) => e.target.blur();

const GST_REGEX   = /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z0-9]{1}Z[A-Z0-9]{1}$/;
const PHONE_REGEX = /^\d{10}$/;
const STATE_REGEX = /^\d{2}$/;

function validate(form) {
  const errors = {};
  if (!form.ledger_type_id) errors.ledger_type_id = 'Please select a ledger type.';
  if (!form.name.trim()) errors.name = 'Name is required.';
  else if (form.name.trim().length < 2) errors.name = 'Name must be at least 2 characters.';
  if (form.phone && !PHONE_REGEX.test(form.phone.replace(/\s/g, ''))) errors.phone = 'Enter a valid 10-digit mobile number.';
  if (form.gst_no && !GST_REGEX.test(form.gst_no.trim().toUpperCase())) errors.gst_no = 'Invalid GST number. Expected format: 27AAAAA0000A1Z5';
  if (form.state_code && !STATE_REGEX.test(form.state_code.trim())) errors.state_code = 'State code must be a 2-digit number (e.g. 27).';
  if (form.gst_no && !form.state_code) errors.state_code = 'State code is required when GST number is provided.';
  const bal = parseFloat(form.opening_balance);
  if (form.opening_balance !== '' && (isNaN(bal) || bal < 0)) errors.opening_balance = 'Must be a non-negative number.';
  return errors;
}

function FieldError({ msg }) {
  if (!msg) return null;
  return <p className="text-xs text-red-500 mt-1">{msg}</p>;
}

const EMPTY_FORM = {
  ledger_type_id: '',
  name: '',
  phone: '',
  place: '',
  address: '',
  gst_no: '',
  state_code: '',
  igst_status: 'NO',
  opening_balance: '',
  interest_rate: '',
  interest_scheme: 'NONE',
  notes: '',
};

export default function LedgerCreationPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [ledgerTypes, setLedgerTypes] = useState([]);
  const [interestEnabled, setInterestEnabled] = useState(false);

  // Refs — order matches Enter-key chain
  const ledgerTypeRef    = useRef(null);
  const nameRef          = useRef(null);
  const phoneRef         = useRef(null);
  const placeRef         = useRef(null);
  const gstNoRef         = useRef(null);
  const stateCodeRef     = useRef(null);
  const openingBalRef    = useRef(null);
  const addressRef       = useRef(null);
  const interestRateRef  = useRef(null);
  const notesRef         = useRef(null);
  const submitRef        = useRef(null);

  useEffect(() => {
    ledgerTypeApi.getAll().then((res) => setLedgerTypes(res.data)).catch(() => {});
    interestApi.isEnabled().then((res) => setInterestEnabled(res.data.enabled)).catch(() => {});
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    const next = { ...form, [name]: value };
    setForm(next);
    if (touched[name]) setErrors(validate(next));
  };

  const handleBlur = (e) => {
    const { name } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    setErrors(validate(form));
  };

  // On Enter: move to nextRef.
  const focusNext = (e, nextRef) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    nextRef?.current?.focus();
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
      const res = await ledgerApi.create({
        ...form,
        ledger_type_id: parseInt(form.ledger_type_id),
        name: form.name.trim(),
        gst_no: form.gst_no.trim().toUpperCase(),
        state_code: form.state_code.trim(),
        opening_balance: form.opening_balance ? parseFloat(form.opening_balance) : 0,
        interest_rate: form.interest_rate ? parseFloat(form.interest_rate) : 0,
      });
      toast.success('Ledger created successfully');
      const newId = res.data?.id || res.data?.ledger?.id;
      if (newId) {
        navigate(`/ledger/${newId}`);
      } else {
        setForm(EMPTY_FORM);
        setErrors({});
        setTouched({});
        nameRef.current?.focus();
      }
    } catch (err) {
      toast.error(err.message || 'Failed to create ledger');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-trust-blue/10">
          <BookOpenIcon className="h-5 w-5 text-trust-blue" />
        </div>
        <div>
          <h1 className="page-title">Ledger Creation</h1>
          <p className="text-sm text-slate-500 mt-0.5">Create a new ledger account</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <div className="card space-y-5">

          {/* Row 1: Ledger Type | Name */}
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="label">Ledger Type *</label>
              <select
                ref={ledgerTypeRef}
                name="ledger_type_id"
                value={form.ledger_type_id}
                onChange={handleChange}
                onBlur={handleBlur}
                onKeyDown={(e) => focusNext(e, nameRef)}
                className={`input-field ${errors.ledger_type_id ? 'border-red-400 focus:ring-red-400' : ''}`}
                autoFocus
              >
                <option value="">— Select type —</option>
                {ledgerTypes.map((t) => (
                  <option key={t.id} value={t.id}>{t.name} ({t.behaviour})</option>
                ))}
              </select>
              <FieldError msg={errors.ledger_type_id} />
            </div>
            <div>
              <label className="label">Name *</label>
              <input
                ref={nameRef}
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                onBlur={handleBlur}
                onKeyDown={(e) => focusNext(e, phoneRef)}
                className={`input-field ${errors.name ? 'border-red-400 focus:ring-red-400' : ''}`}
                placeholder="Full name"
              />
              <FieldError msg={errors.name} />
            </div>
          </div>

          {/* Row 2: Phone | Place */}
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="label">Phone</label>
              <input
                ref={phoneRef}
                type="text"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                onBlur={handleBlur}
                onKeyDown={(e) => focusNext(e, placeRef)}
                className={`input-field ${errors.phone ? 'border-red-400 focus:ring-red-400' : ''}`}
                placeholder="10-digit mobile number"
                maxLength={10}
                inputMode="numeric"
              />
              <FieldError msg={errors.phone} />
            </div>
            <div>
              <label className="label">Place</label>
              <input
                ref={placeRef}
                type="text"
                name="place"
                value={form.place}
                onChange={handleChange}
                onKeyDown={(e) => focusNext(e, gstNoRef)}
                className="input-field"
                placeholder="City / Town"
              />
            </div>
          </div>

          {/* Row 3: GST | State Code */}
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="label">GST Number</label>
              <input
                ref={gstNoRef}
                type="text"
                name="gst_no"
                value={form.gst_no}
                onChange={handleChange}
                onBlur={handleBlur}
                onKeyDown={(e) => focusNext(e, stateCodeRef)}
                className={`input-field uppercase ${errors.gst_no ? 'border-red-400 focus:ring-red-400' : ''}`}
                placeholder="27AAAAA0000A1Z5"
                maxLength={15}
              />
              <FieldError msg={errors.gst_no} />
            </div>
            <div>
              <label className="label">State Code</label>
              <input
                ref={stateCodeRef}
                type="text"
                name="state_code"
                value={form.state_code}
                onChange={handleChange}
                onBlur={handleBlur}
                onKeyDown={(e) => focusNext(e, openingBalRef)}
                className={`input-field ${errors.state_code ? 'border-red-400 focus:ring-red-400' : ''}`}
                placeholder="e.g. 27"
                maxLength={2}
                inputMode="numeric"
              />
              <FieldError msg={errors.state_code} />
            </div>
          </div>

          {/* Row 4: Opening Balance | IGST Applicable */}
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="label">Opening Balance</label>
              <input
                ref={openingBalRef}
                type="number"
                name="opening_balance"
                value={form.opening_balance}
                onChange={handleChange}
                onBlur={handleBlur}
                onKeyDown={(e) => focusNext(e, addressRef)}
                onWheel={noWheel}
                className={`input-field ${errors.opening_balance ? 'border-red-400 focus:ring-red-400' : ''}`}
                placeholder="0.00"
                min="0"
                step="0.01"
              />
              <FieldError msg={errors.opening_balance} />
            </div>
            <div>
              <label className="label">IGST Applicable</label>
              <div className="flex gap-6 mt-2">
                {['YES', 'NO'].map((opt) => (
                  <label key={opt} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="igst_status"
                      value={opt}
                      checked={form.igst_status === opt}
                      onChange={handleChange}
                      className="text-trust-blue focus:ring-trust-blue"
                    />
                    <span className="text-sm text-slate-700">{opt}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Row 5: Address (full width) */}
          <div>
            <label className="label">Address</label>
            <input
              ref={addressRef}
              type="text"
              name="address"
              value={form.address}
              onChange={handleChange}
              onKeyDown={(e) => focusNext(e, interestEnabled ? interestRateRef : notesRef)}
              className="input-field"
              placeholder="Street address"
            />
          </div>

          {/* Row 6: Interest Configuration (conditional) */}
          {interestEnabled && (
            <div className="border-t border-slate-200 pt-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-4">Interest Configuration</h3>
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="label">Interest Rate (%)</label>
                  <input
                    ref={interestRateRef}
                    type="number"
                    name="interest_rate"
                    value={form.interest_rate}
                    onChange={handleChange}
                    onKeyDown={(e) => focusNext(e, notesRef)}
                    onWheel={noWheel}
                    className="input-field"
                    placeholder="0"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="label">Interest Scheme</label>
                  <select
                    name="interest_scheme"
                    value={form.interest_scheme}
                    onChange={handleChange}
                    className="input-field"
                  >
                    <option value="NONE">None</option>
                    <option value="DAILY">Daily (monthly rate)</option>
                    <option value="MONTHLY">Monthly (annual rate)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Row 7: Notes (full width) */}
          <div>
            <label className="label">Notes</label>
            <input
              ref={notesRef}
              type="text"
              name="notes"
              value={form.notes}
              onChange={handleChange}
              onKeyDown={(e) => focusNext(e, submitRef)}
              className="input-field"
              placeholder="Optional notes"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between gap-3 mt-4">
          <button
            type="button"
            onClick={() => navigate('/ledgers')}
            className="btn-secondary"
          >
            View Ledgers
          </button>
          <button
            ref={submitRef}
            type="submit"
            disabled={submitting}
            className="btn-primary gap-2"
          >
            <CheckCircleIcon className="h-4 w-4" />
            {submitting ? 'Saving…' : 'Save Ledger'}
          </button>
        </div>
      </form>
    </div>
  );
}
