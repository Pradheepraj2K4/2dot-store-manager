import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeftIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { itemApi, staffApi, serviceApi } from '../../api';
import { formatCurrency } from '../../utils/helpers';
import LoadingSpinner from '../ui/LoadingSpinner';
import ServiceFormFields from './ServiceFormFields';

export default function ServiceClosePage() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [items, setItems] = useState([]);
  const [staffs, setStaffs] = useState([]);
  const [ledger, setLedger] = useState(null);
  const [form, setForm] = useState(null);
  const [serviceNumber, setServiceNumber] = useState('');
  const [materialCost, setMaterialCost] = useState('');
  const [labourCost, setLabourCost] = useState('');
  const [closingRemarks, setClosingRemarks] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [itemsRes, staffsRes, svcRes] = await Promise.all([
          itemApi.getAll().catch(() => ({ data: [] })),
          staffApi.getAll().catch(() => ({ data: [] })),
          serviceApi.getById(id),
        ]);
        setItems(itemsRes.data || []);
        setStaffs(staffsRes.data || []);
        const svc = svcRes.data;
        if (svc.status === 'closed') {
          toast.error('This service is already closed');
        }
        setServiceNumber(svc.service_number);
        setLedger({ id: svc.ledger_id, name: svc.ledger_name, behaviour: 'customer' });
        setForm({
          date: svc.date,
          item: svc.item_id ? { id: svc.item_id, name: svc.item_name } : { id: null, name: svc.item_name },
          quantity: String(svc.quantity ?? 1),
          imei: svc.imei || '',
          staff_id: svc.staff_id ? String(svc.staff_id) : '',
          advance_amount: svc.advance_amount != null ? String(svc.advance_amount) : '',
          customer_name: svc.customer_name || '',
          customer_mobile: svc.customer_mobile || '',
          customer_place: svc.customer_place || '',
          remarks: svc.remarks || '',
        });
      } catch (err) {
        toast.error(err.message);
        navigate('/services/pending');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, navigate]);

  const advance = parseFloat(form?.advance_amount) || 0;
  const collectAmount = useMemo(() => {
    const m = parseFloat(materialCost) || 0;
    const l = parseFloat(labourCost) || 0;
    return Math.round((m + l - advance) * 100) / 100;
  }, [materialCost, labourCost, advance]);

  const buildDetails = () => ({
    ledger_id: ledger?.id,
    date: form.date,
    item_id: form.item?.id || null,
    item_name: form.item?.name || '',
    quantity: parseFloat(form.quantity) || 1,
    imei: form.imei,
    staff_id: form.staff_id || null,
    advance_amount: parseFloat(form.advance_amount) || 0,
    customer_name: form.customer_name,
    customer_mobile: form.customer_mobile,
    customer_place: form.customer_place,
    remarks: form.remarks,
  });

  const validate = () => {
    if (!ledger) { toast.error('Select a customer ledger'); return false; }
    if (!form.item || !form.item.name) { toast.error('Select an item'); return false; }
    if (form.customer_mobile && form.customer_mobile.length !== 10) {
      toast.error('Customer mobile must be exactly 10 digits');
      return false;
    }
    return true;
  };

  // Save the edited detail fields without closing the service.
  const handleSaveDetails = async () => {
    if (!validate()) return;
    try {
      setSaving(true);
      await serviceApi.update(id, buildDetails());
      toast.success('Service updated');
      navigate('/services/pending');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = async () => {
    if (!validate()) return;
    try {
      setSaving(true);
      await serviceApi.close(id, {
        ...buildDetails(),
        material_cost: parseFloat(materialCost) || 0,
        labour_cost: parseFloat(labourCost) || 0,
        closing_remarks: closingRemarks,
      });
      toast.success('Service closed');
      navigate('/services/closed');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !form) return <LoadingSpinner className="py-20" size="lg" />;

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
          <ArrowLeftIcon className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="page-title">Close Service</h1>
          <p className="text-sm text-slate-500">Review &amp; edit details, then record closing costs.</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] text-slate-400 uppercase tracking-wide">Service #</p>
          <p className="text-lg font-bold text-slate-800">{serviceNumber}</p>
        </div>
      </div>

      {/* Editable details */}
      <div className="card">
        <h2 className="text-base font-semibold text-slate-900 mb-4">Service Details</h2>
        <ServiceFormFields
          form={form}
          setForm={setForm}
          ledger={ledger}
          setLedger={setLedger}
          items={items}
          staffs={staffs}
        />
        <div className="flex justify-end mt-4">
          <button onClick={handleSaveDetails} disabled={saving} className="btn-secondary">
            Save details only
          </button>
        </div>
      </div>

      {/* Closing */}
      <div className="card">
        <h2 className="text-base font-semibold text-slate-900 mb-4">Closing</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Material Cost (₹)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={materialCost}
              onChange={(e) => setMaterialCost(e.target.value)}
              className="input-field text-right"
              placeholder="0"
            />
          </div>
          <div>
            <label className="label">Labour Cost (₹)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={labourCost}
              onChange={(e) => setLabourCost(e.target.value)}
              className="input-field text-right"
              placeholder="0"
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="label">Closing Remarks</label>
          <textarea
            value={closingRemarks}
            onChange={(e) => setClosingRemarks(e.target.value)}
            rows={2}
            className="input-field resize-none"
            placeholder="Work done / parts replaced"
          />
        </div>

        {/* Summary */}
        <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-2 text-sm">
          <div className="flex justify-between text-slate-600">
            <span>Material Cost</span>
            <span>{formatCurrency(parseFloat(materialCost) || 0)}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Labour Cost</span>
            <span>{formatCurrency(parseFloat(labourCost) || 0)}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Less: Advance Received</span>
            <span>− {formatCurrency(advance)}</span>
          </div>
          <div className="flex justify-between pt-2 border-t border-slate-200 text-base font-bold text-slate-900">
            <span>{collectAmount < 0 ? 'Amount to Refund' : 'Amount to Collect'}</span>
            <span className={collectAmount < 0 ? 'text-debit-red' : 'text-credit-green'}>
              {formatCurrency(Math.abs(collectAmount))}
            </span>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button onClick={() => navigate(-1)} className="btn-secondary">Cancel</button>
        <button onClick={handleClose} disabled={saving} className="btn-primary flex items-center gap-2">
          <CheckCircleIcon className="h-4 w-4" />
          {saving ? 'Saving…' : 'Save & Close Service'}
        </button>
      </div>
    </div>
  );
}
