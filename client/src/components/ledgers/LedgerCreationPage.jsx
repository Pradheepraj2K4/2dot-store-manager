import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ledgerApi } from '../../api';
import toast from 'react-hot-toast';
import { BookOpenIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

const GST_REGEX   = /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z0-9]{1}Z[A-Z0-9]{1}$/;
const PHONE_REGEX = /^\d{10}$/;
const STATE_REGEX = /^\d{2}$/;

function validate(form) {
  const errors = {};
  if (!form.type) {
    errors.type = 'Please select ledger type.';
  }
  if (!form.name.trim()) {
    errors.name = 'Name is required.';
  } else if (form.name.trim().length < 2) {
    errors.name = 'Name must be at least 2 characters.';
  }
  if (form.phone && !PHONE_REGEX.test(form.phone.replace(/\s/g, ''))) {
    errors.phone = 'Enter a valid 10-digit mobile number.';
  }
  if (form.gst_no && !GST_REGEX.test(form.gst_no.trim().toUpperCase())) {
    errors.gst_no = 'Invalid GST number. Expected format: 27AAAAA0000A1Z5';
  }
  if (form.state_code && !STATE_REGEX.test(form.state_code.trim())) {
    errors.state_code = 'State code must be a 2-digit number (e.g. 27).';
  }
  if (form.gst_no && !form.state_code) {
    errors.state_code = 'State code is required when GST number is provided.';
  }
  return errors;
}

function FieldError({ msg }) {
  if (!msg) return null;
  return <p className="text-xs text-red-500 mt-1">{msg}</p>;
}

const EMPTY_FORM = {
  type: '',
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
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Refs for keyboard navigation
  const nameRef       = useRef(null);
  const phoneRef      = useRef(null);
  const placeRef      = useRef(null);
  const addressRef    = useRef(null);
  const gstNoRef      = useRef(null);
  const stateCodeRef  = useRef(null);
  const submitRef     = useRef(null);

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

  const handleKeyDown = (e, nextRef) => {
    if (e.target.tagName === 'TEXTAREA') {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        nextRef?.current?.focus();
      }
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      nextRef?.current?.focus();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const allTouched = Object.fromEntries(
      Object.keys(EMPTY_FORM).map((k) => [k, true])
    );
    setTouched(allTouched);
    const errs = validate(form);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    try {
      setSubmitting(true);
      await ledgerApi.create({
        ...form,
        name: form.name.trim(),
        gst_no: form.gst_no.trim().toUpperCase(),
        state_code: form.state_code.trim(),
      });
      toast.success('Ledger created successfully');
      setForm(EMPTY_FORM);
      setErrors({});
      setTouched({});
      nameRef.current?.focus();
    } catch (err) {
      toast.error(err.message || 'Failed to create ledger');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateAnother = async (e) => {
    await handleSubmit(e);
    // form already reset inside handleSubmit
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-trust-blue/10">
          <BookOpenIcon className="h-5 w-5 text-trust-blue" />
        </div>
        <div>
          <h1 className="page-title">Ledger Creation</h1>
          <p className="text-sm text-slate-500 mt-0.5">Create a new customer or supplier ledger</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <div className="card space-y-5">

          {/* Ledger Type — top dropdown */}
          <div>
            <label className="label">Ledger Type *</label>
            <select
              name="type"
              value={form.type}
              onChange={handleChange}
              onBlur={handleBlur}
              onKeyDown={(e) => handleKeyDown(e, nameRef)}
              className={`input-field ${errors.type ? 'border-red-400 focus:ring-red-400' : ''}`}
            >
              <option value="">— Select type —</option>
              <option value="customer">Customer</option>
              <option value="supplier">Supplier</option>
            </select>
            <FieldError msg={errors.type} />
          </div>

          {/* Name */}
          <div>
            <label className="label">Name *</label>
            <input
              ref={nameRef}
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              onBlur={handleBlur}
              onKeyDown={(e) => handleKeyDown(e, phoneRef)}
              className={`input-field ${errors.name ? 'border-red-400 focus:ring-red-400' : ''}`}
              placeholder="Enter ledger name"
            />
            <FieldError msg={errors.name} />
          </div>

          {/* Phone + Place */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Phone</label>
              <input
                ref={phoneRef}
                type="text"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                onBlur={handleBlur}
                onKeyDown={(e) => handleKeyDown(e, placeRef)}
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
                onKeyDown={(e) => handleKeyDown(e, addressRef)}
                className="input-field"
                placeholder="City / Town"
              />
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="label">Address</label>
            <textarea
              ref={addressRef}
              name="address"
              value={form.address}
              onChange={handleChange}
              onKeyDown={(e) => handleKeyDown(e, gstNoRef)}
              rows={2}
              className="input-field resize-none"
              placeholder="Street address (Ctrl+Enter to move to next field)"
            />
          </div>

          {/* GST + State Code */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">GST Number</label>
              <input
                ref={gstNoRef}
                type="text"
                name="gst_no"
                value={form.gst_no}
                onChange={handleChange}
                onBlur={handleBlur}
                onKeyDown={(e) => handleKeyDown(e, stateCodeRef)}
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
                onKeyDown={(e) => handleKeyDown(e, submitRef)}
                className={`input-field ${errors.state_code ? 'border-red-400 focus:ring-red-400' : ''}`}
                placeholder="e.g. 27"
                maxLength={2}
                inputMode="numeric"
              />
              <FieldError msg={errors.state_code} />
            </div>
          </div>

          {/* IGST Status */}
          <div>
            <label className="label">IGST Applicable</label>
            <div className="flex gap-6 mt-1">
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

        {/* Actions */}
        <div className="flex items-center justify-between gap-3 mt-4">
          <button
            type="button"
            onClick={() => navigate('/ledgers')}
            className="btn-secondary"
          >
            View Ledgers
          </button>
          <div className="flex gap-3">
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
        </div>
      </form>
    </div>
  );
}
