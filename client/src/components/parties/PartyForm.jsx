import { useState, useEffect, useRef } from 'react';

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

  const nameRef = useRef(null);
  const phoneRef = useRef(null);
  const placeRef = useRef(null);
  const addressRef = useRef(null);
  const openingBalanceRef = useRef(null);
  const gstNoRef = useRef(null);
  const stateCodeRef = useRef(null);
  const submitRef = useRef(null);

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
    setForm((prev) => ({
      ...prev,
      [name]:
        name === 'opening_balance'
          ? value === '' ? '' : parseFloat(value) || 0
          : value,
    }));
  };

  const handleKeyDown = (e, nextRef) => {
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
      e.preventDefault();
      if (nextRef && nextRef.current) {
        nextRef.current.focus();
      }
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(form);
  };

  const isEditing = !!party;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">Name *</label>
        <input
          ref={nameRef}
          type="text"
          name="name"
          value={form.name}
          onChange={handleChange}
          onKeyDown={(e) => handleKeyDown(e, phoneRef)}
          required
          className="input-field"
          placeholder="Enter party name"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Phone</label>
          <input
            ref={phoneRef}
            type="text"
            name="phone"
            value={form.phone}
            onChange={handleChange}
            onKeyDown={(e) => handleKeyDown(e, placeRef)}
            className="input-field"
            placeholder="Phone number"
          />
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
          placeholder="Full address"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">GST No. <span className="text-slate-400 font-normal">(Optional)</span></label>
          <input
            ref={gstNoRef}
            type="text"
            name="gst_no"
            value={form.gst_no}
            onChange={handleChange}
            onKeyDown={(e) => handleKeyDown(e, stateCodeRef)}
            className="input-field"
            placeholder="e.g. 27AAAAA0000A1Z5"
          />
        </div>
        <div>
          <label className="label">State Code <span className="text-slate-400 font-normal">(Optional)</span></label>
          <input
            ref={stateCodeRef}
            type="text"
            name="state_code"
            value={form.state_code}
            onChange={handleChange}
            onKeyDown={(e) => handleKeyDown(e, isEditing ? submitRef : openingBalanceRef)}
            className="input-field"
            placeholder="e.g. 27"
          />
        </div>
      </div>

      <div>
        <label className="label">IGST Status *</label>
        <div className="flex gap-6 mt-1">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="igst_status"
              value="YES"
              checked={form.igst_status === 'YES'}
              onChange={handleChange}
              className="w-4 h-4 accent-blue-500"
            />
            <span className="text-sm text-slate-500">Yes (Inter-state / IGST applicable)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="igst_status"
              value="NO"
              checked={form.igst_status === 'NO'}
              onChange={handleChange}
              className="w-4 h-4 accent-blue-500"
            />
            <span className="text-sm text-slate-500">No (Intra-state / CGST+SGST)</span>
          </label>
        </div>
      </div>

      {!isEditing && (
        <div>
          <label className="label">Opening Balance</label>
          <input
            ref={openingBalanceRef}
            type="number"
            name="opening_balance"
            value={form.opening_balance === 0 ? (form.opening_balance === '' ? '' : 0) : form.opening_balance}
            onChange={handleChange}
            onKeyDown={(e) => handleKeyDown(e, submitRef)}
            step="0.01"
            className="input-field"
            placeholder="0.00"
          />
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
          {isEditing ? 'Update' : 'Create'} {partyType === 'customer' ? 'Customer' : 'Supplier'}
        </button>
      </div>
    </form>
  );
}
