import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeftIcon, WrenchScrewdriverIcon } from '@heroicons/react/24/outline';
import { itemApi, staffApi, serviceApi, ledgerApi } from '../../api';
import { todayISO } from '../../utils/helpers';
import LoadingSpinner from '../ui/LoadingSpinner';
import ServiceFormFields from './ServiceFormFields';

function emptyForm() {
  return {
    date: todayISO(),
    item: null,
    quantity: '1',
    imei: '',
    staff_id: '',
    advance_amount: '',
    customer_name: '',
    customer_mobile: '',
    customer_place: '',
    remarks: '',
  };
}

export default function ServiceEntryPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [staffs, setStaffs] = useState([]);
  const [ledger, setLedger] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [serviceNumber, setServiceNumber] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [itemsRes, staffsRes] = await Promise.all([
          itemApi.getAll().catch(() => ({ data: [] })),
          staffApi.getAll().catch(() => ({ data: [] })),
        ]);
        setItems(itemsRes.data || []);
        setStaffs(staffsRes.data || []);
        serviceApi.getNextNumber().then((r) => setServiceNumber(r.data?.service_number || '')).catch(() => {});
        ledgerApi.getCash().then((r) => { if (r.data) setLedger(r.data); }).catch(() => {});
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSave = async () => {
    if (!ledger) return toast.error('Select a customer ledger');
    if (!form.item || !form.item.id) return toast.error('Select an item');
    if (form.customer_mobile && form.customer_mobile.length !== 10) {
      return toast.error('Customer mobile must be exactly 10 digits');
    }
    try {
      setSaving(true);
      await serviceApi.create({
        ledger_id: ledger.id,
        date: form.date,
        item_id: form.item.id,
        item_name: form.item.name,
        quantity: parseFloat(form.quantity) || 1,
        imei: form.imei,
        staff_id: form.staff_id || null,
        advance_amount: parseFloat(form.advance_amount) || 0,
        customer_name: form.customer_name,
        customer_mobile: form.customer_mobile,
        customer_place: form.customer_place,
        remarks: form.remarks,
      });
      toast.success('Service recorded');
      navigate('/services/pending');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner className="py-20" size="lg" />;

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
          <ArrowLeftIcon className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="page-title flex items-center gap-2">
            <WrenchScrewdriverIcon className="h-5 w-5 text-trust-blue" />
            New Service Entry
          </h1>
          <p className="text-sm text-slate-500">Record a service / repair job.</p>
        </div>
        {serviceNumber && (
          <div className="text-right">
            <p className="text-[11px] text-slate-400 uppercase tracking-wide">Service #</p>
            <p className="text-lg font-bold text-slate-800">{serviceNumber}</p>
          </div>
        )}
      </div>

      <div className="card">
        <ServiceFormFields
          form={form}
          setForm={setForm}
          ledger={ledger}
          setLedger={setLedger}
          items={items}
          staffs={staffs}
        />
      </div>

      <div className="flex justify-end gap-2">
        <button onClick={() => navigate(-1)} className="btn-secondary">Cancel</button>
        <button onClick={handleSave} disabled={saving} className="btn-primary">
          {saving ? 'Saving…' : 'Save Service'}
        </button>
      </div>
    </div>
  );
}
