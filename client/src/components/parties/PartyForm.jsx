import { useState, useEffect, useRef } from 'react';

// ── Validation helpers ────────────────────────────────────────────────────────
const GST_REGEX   = /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z0-9]{1}Z[A-Z0-9]{1}$/;
const PHONE_REGEX = /^\d{10}$/;
const STATE_REGEX = /^\d{2}$/;

function validatePartyForm(form, isEditing) {
  const errors = {};
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
  if (!isEditing && form.opening_balance !== '' && isNaN(parseFloat(form.opening_balance))) {
    errors.opening_balance = 'Opening balance must be a valid number.';
  }
  return errors;
}

function FieldError({ msg }) {
  if (!msg) return null;
  return <p className="text-xs text-red-500 mt-1">{msg}</p>;
}

export default function PartyForm({ party, partyType, onSubmit, onCancel }) {
  const [form, setForm] = useState({
    name: '',
    address: '',
    phone: '',
    place: '',
    opening_balance: 0,
    gst_no: '',
    state_code: '',
    igst_status: 'NO',
    type: partyType,
  });
  const [errors, setErrors]   = useState({});
  const [touched, setTouched] = useState({});

  const nameRef           = useRef(null);
  const phoneRef          = useRef(null);
  const placeRef          = useRef(null);
  const addressRef        = useRef(null);
  const gstNoRef          = useRef(null);
  const stateCodeRef      = useRef(null);
  const igstYesRef        = useRef(null);
  const igstNoRef         = useRef(null);
  const openingBalanceRef = useRef(null);
  const submitRef         = useRef(null);

  useEffect(() => {
    if (party) {
      setForm({
        name: party.name || '',
        address: party.address || '',
        phone: party.phone || '',
        place: party.place || '',
        opening_balance: party.opening_balance || 0,
        gst_no: party.gst_no || '',
        state_code: party.state_code || '',
        igst_status: party.igst_status || 'NO',
        type: party.type || partyType,
      });
    }
  }, [party, partyType]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    const newForm = {
      ...form,
      [name]: name === 'opening_balance' ? (value === '' ? '' : value) : value,
    };
    setForm(newForm);
    if (touched[name]) setErrors(validatePartyForm(newForm, isEditing));
  };

  const handleBlur = (e) => {
    const { name } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    setErrors(validatePartyForm(form, isEditing));
  };

  // For regular inputs Enter advances; for textarea Ctrl+Enter advances
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

  const handleSubmit = (e) => {
    e.preventDefault();
    const allTouched = Object.fromEntries(
      ['name', 'phone', 'gst_no', 'state_code', 'opening_balance'].map((k) => [k, true])
    );
    setTouched(allTouched);
    const errs = validatePartyForm(form, isEditing);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    onSubmit({
      ...form,
      opening_balance: form.opening_balance === '' ? 0 : parseFloat(form.opening_balance) || 0,
      gst_no:     form.gst_no.trim().toUpperCase(),
      state_code: form.state_code.trim(),
    });
  };

  const isEditing = !!party;

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
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
          required
          className={`input-field ${errors.name ? 'border-red-400 focus:ring-red-400' : ''}`}
          placeholder="Enter party name"
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

      {/* Address — Ctrl+Enter to advance */}
      <div>
        <label className="label">
          Address
          <span className="ml-1.5 text-[10px] text-slate-400 font-normal normal-case tracking-normal">
            Ctrl+Enter to continue
          </span>
        </label>
        <textarea
          ref={addressRef}
          name="address"
          value={form.address}
          onChange={handleChange}
          onKeyDown={(e) => handleKeyDown(e, gstNoRef)}
          rows={2}
          className="input-field resize-none"
          placeholder="Full address"
        />
      </div>

      {/* GST + State Code */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">
            GST No.{' '}
            <span className="text-slate-400 font-normal">(Optional)</span>
          </label>
          <input
            ref={gstNoRef}
            type="text"
            name="gst_no"
            value={form.gst_no}
            onChange={handleChange}
            onBlur={handleBlur}
            onKeyDown={(e) => handleKeyDown(e, stateCodeRef)}
            className={`input-field uppercase ${errors.gst_no ? 'border-red-400 focus:ring-red-400' : ''}`}
            placeholder="e.g. 27AAAAA0000A1Z5"
            maxLength={15}
          />
          <FieldError msg={errors.gst_no} />
        </div>
        <div>
          <label className="label">
            State Code{' '}
            <span className="text-slate-400 font-normal">(Optional)</span>
          </label>
          <input
            ref={stateCodeRef}
            type="text"
            name="state_code"
            value={form.state_code}
            onChange={handleChange}
            onBlur={handleBlur}
            onKeyDown={(e) => handleKeyDown(e, igstYesRef)}
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
        <label className="label">IGST Status *</label>
        <div className="flex gap-6 mt-1">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              ref={igstYesRef}
              type="radio"
              name="igst_status"
              value="YES"
              checked={form.igst_status === 'YES'}
              onChange={handleChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  setForm((prev) => ({ ...prev, igst_status: 'YES' }));
                  (isEditing ? submitRef : openingBalanceRef)?.current?.focus();
                }
                if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                  e.preventDefault();
                  igstNoRef.current?.focus();
                }
              }}
              className="w-4 h-4 accent-blue-500"
            />
            <span className="text-sm text-slate-500">Yes (Inter-state / IGST applicable)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              ref={igstNoRef}
              type="radio"
              name="igst_status"
              value="NO"
              checked={form.igst_status === 'NO'}
              onChange={handleChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  setForm((prev) => ({ ...prev, igst_status: 'NO' }));
                  (isEditing ? submitRef : openingBalanceRef)?.current?.focus();
                }
                if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                  e.preventDefault();
                  igstYesRef.current?.focus();
                }
              }}
              className="w-4 h-4 accent-blue-500"
            />
            <span className="text-sm text-slate-500">No (Intra-state / CGST+SGST)</span>
          </label>
        </div>
      </div>

      {/* Opening Balance — create only */}
      {!isEditing && (
        <div>
          <label className="label">Opening Balance</label>
          <input
            ref={openingBalanceRef}
            type="number"
            name="opening_balance"
            value={form.opening_balance}
            onChange={handleChange}
            onBlur={handleBlur}
            onKeyDown={(e) => handleKeyDown(e, submitRef)}
            step="0.01"
            className={`input-field ${errors.opening_balance ? 'border-red-400 focus:ring-red-400' : ''}`}
            placeholder="0.00"
          />
          <FieldError msg={errors.opening_balance} />
          <p className="text-xs text-slate-400 mt-1">
            {partyType === 'customer'
              ? 'Positive = They owe you (receivable) | Negative = You owe them (refund/return)'
              : 'Positive = You owe them (payable) | Negative = They owe you (return credit)'}
          </p>
        </div>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="btn-secondary">
          Cancel
        </button>
        <button ref={submitRef} type="submit" className="btn-primary">
          {isEditing ? 'Update' : 'Create'}{' '}
          {partyType === 'customer' ? 'Customer' : 'Supplier'}
        </button>
      </div>
    </form>
  );
}

