import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ledgerApi, ledgerTypeApi, settingsApi } from '../../api';
import toast from 'react-hot-toast';
import { BookOpenIcon, CheckCircleIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';

const GST_REGEX = /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z0-9]{1}Z[A-Z0-9]{1}$/;
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
};

export default function LedgerCreationPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('returnTo');
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [ledgerTypes, setLedgerTypes] = useState([]);
  const [gstFieldsEnabled, setGstFieldsEnabled] = useState(false);

  // Refs — order matches Enter-key chain
  const ledgerTypeRef = useRef(null);
  const nameRef = useRef(null);
  const phoneRef = useRef(null);
  const placeRef = useRef(null);
  const gstNoRef = useRef(null);
  const stateCodeRef = useRef(null);
  const addressRef = useRef(null);
  const submitRef = useRef(null);

  useEffect(() => {
    ledgerTypeApi.getAll().then((res) => setLedgerTypes(res.data)).catch(() => { });
    settingsApi.get('gst_fields_enabled').then((res) => {
      const v = res.data?.value;
      setGstFieldsEnabled(v === true || v === 'true');
    }).catch(() => { });
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
      });
      toast.success('Ledger created successfully');
      const newId = res.data?.id || res.data?.ledger?.id;
      if (returnTo) {
        navigate(returnTo, { state: { newLedgerId: newId } });
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
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors"
          title="Go back"
        >
          <ArrowLeftIcon className="h-5 w-5 text-slate-600" />
        </button>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-trust-blue/10">
          <BookOpenIcon className="h-5 w-5 text-trust-blue" />
        </div>
        <div>
          <h1 className="page-title">Ledger Creation</h1>
          <p className="text-sm text-slate-500 mt-0.5">Create a new ledger account</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <div className="card space-y-4">

          {/* Ledger Type */}
          <div className="flex gap-4">
            <label className="w-32 shrink-0 h-9 flex items-center text-sm font-medium text-slate-700">Ledger Type *</label>
            <div className="flex-1">
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
          </div>

          {/* Name */}
          <div className="flex gap-4">
            <label className="w-32 shrink-0 h-9 flex items-center text-sm font-medium text-slate-700">Name *</label>
            <div className="flex-1">
              <input
                ref={nameRef}
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                onBlur={handleBlur}
                onKeyDown={(e) => focusNext(e, phoneRef)}
                className={`input-field ${errors.name ? 'border-red-400 focus:ring-red-400' : ''}`}
              />
              <FieldError msg={errors.name} />
            </div>
          </div>

          {/* Phone */}
          <div className="flex gap-4">
            <label className="w-32 shrink-0 h-9 flex items-center text-sm font-medium text-slate-700">Phone</label>
            <div className="flex-1">
              <input
                ref={phoneRef}
                type="text"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                onBlur={handleBlur}
                onKeyDown={(e) => focusNext(e, placeRef)}
                className={`input-field ${errors.phone ? 'border-red-400 focus:ring-red-400' : ''}`}
                maxLength={10}
                inputMode="numeric"
              />
              <FieldError msg={errors.phone} />
            </div>
          </div>

          {/* Place */}
          <div className="flex gap-4">
            <label className="w-32 shrink-0 h-9 flex items-center text-sm font-medium text-slate-700">Place</label>
            <div className="flex-1">
              <input
                ref={placeRef}
                type="text"
                name="place"
                value={form.place}
                onChange={handleChange}
                onKeyDown={(e) => focusNext(e, gstFieldsEnabled ? gstNoRef : addressRef)}
                className="input-field"
              />
            </div>
          </div>

          {/* GST fields — shown only when enabled in settings */}
          {gstFieldsEnabled && (
            <>
              <div className="flex gap-4">
                <label className="w-32 shrink-0 h-9 flex items-center text-sm font-medium text-slate-700">GST Number</label>
                <div className="flex-1">
                  <input
                    ref={gstNoRef}
                    type="text"
                    name="gst_no"
                    value={form.gst_no}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    onKeyDown={(e) => focusNext(e, stateCodeRef)}
                    className={`input-field uppercase ${errors.gst_no ? 'border-red-400 focus:ring-red-400' : ''}`}
                    maxLength={15}
                  />
                  <FieldError msg={errors.gst_no} />
                </div>
              </div>

              <div className="flex gap-4">
                <label className="w-32 shrink-0 h-9 flex items-center text-sm font-medium text-slate-700">State Code</label>
                <div className="flex-1">
                  <input
                    ref={stateCodeRef}
                    type="text"
                    name="state_code"
                    value={form.state_code}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    onKeyDown={(e) => focusNext(e, addressRef)}
                    className={`input-field ${errors.state_code ? 'border-red-400 focus:ring-red-400' : ''}`}
                    maxLength={2}
                    inputMode="numeric"
                  />
                  <FieldError msg={errors.state_code} />
                </div>
              </div>

              <div className="flex gap-4">
                <label className="w-32 shrink-0 h-9 flex items-center text-sm font-medium text-slate-700">IGST Applicable</label>
                <div className="flex-1 flex gap-6 h-9 items-center">
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
            </>
          )}

          {/* Address */}
          <div className="flex gap-4">
            <label className="w-32 shrink-0 h-9 flex items-center text-sm font-medium text-slate-700">Address</label>
            <div className="flex-1">
              <input
                ref={addressRef}
                type="text"
                name="address"
                value={form.address}
                onChange={handleChange}
                onKeyDown={(e) => focusNext(e, submitRef)}
                className="input-field"
              />
            </div>
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
