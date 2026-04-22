import { useState, useRef, useCallback } from 'react';
import { ledgerApi, ledgerTypeApi } from '../../api';
import { parseVCF } from '../../utils/vcfParser';
import Modal from '../ui/Modal';
import toast from 'react-hot-toast';
import {
  ArrowUpTrayIcon,
  UserGroupIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';

export default function ImportContactsModal({ open, onClose }) {
  const fileRef = useRef(null);

  // ── Steps: 'upload' | 'select' | 'done'
  const [step, setStep] = useState('upload');
  const [contacts, setContacts] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [customerTypeId, setCustomerTypeId] = useState(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [search, setSearch] = useState('');
  const [dragOver, setDragOver] = useState(false);

  // ── Reset when modal closes / reopens ─────────────────────────────
  const handleClose = () => {
    setStep('upload');
    setContacts([]);
    setSelected(new Set());
    setResult(null);
    setSearch('');
    setImporting(false);
    onClose();
  };

  // ── Resolve the customer ledger type once (lazy) ──────────────────
  const resolveCustomerType = async () => {
    if (customerTypeId) return customerTypeId;
    const res = await ledgerTypeApi.getAll();
    const types = res.data || [];
    const cust = types.find((t) => t.behaviour === 'customer');
    if (!cust) throw new Error('No ledger type with "customer" behaviour found. Please create one first.');
    setCustomerTypeId(cust.id);
    return cust.id;
  };

  // ── Parse VCF text ────────────────────────────────────────────────
  const processText = useCallback(async (text) => {
    const parsed = parseVCF(text);
    if (parsed.length === 0) {
      toast.error('No valid contacts found in the file.');
      return;
    }
    // Pre-select all
    setContacts(parsed);
    setSelected(new Set(parsed.map((_, i) => i)));
    setStep('select');
  }, []);

  // ── File input handler ────────────────────────────────────────────
  const handleFile = (file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.vcf') && file.type !== 'text/vcard') {
      toast.error('Please select a .vcf file.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => processText(e.target.result);
    reader.readAsText(file, 'utf-8');
  };

  const handleFileChange = (e) => handleFile(e.target.files?.[0]);

  // ── Drag & drop ────────────────────────────────────────────────────
  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files?.[0]);
  };

  // ── Selection helpers ──────────────────────────────────────────────
  const filteredContacts = contacts.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.phone || '').includes(q) ||
      (c.place || '').toLowerCase().includes(q)
    );
  });

  const allFilteredSelected = filteredContacts.length > 0 && filteredContacts.every((_, idx) => {
    const realIdx = contacts.indexOf(filteredContacts[idx]);
    return selected.has(realIdx);
  });

  const toggleSelectAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filteredContacts.forEach((c) => next.delete(contacts.indexOf(c)));
      } else {
        filteredContacts.forEach((c) => next.add(contacts.indexOf(c)));
      }
      return next;
    });
  };

  const toggleOne = (realIdx) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(realIdx)) next.delete(realIdx);
      else next.add(realIdx);
      return next;
    });
  };

  // ── Import ─────────────────────────────────────────────────────────
  const handleImport = async () => {
    if (selected.size === 0) {
      toast.error('Please select at least one contact to import.');
      return;
    }
    try {
      setImporting(true);
      const typeId = await resolveCustomerType();
      const toImport = [...selected].map((i) => ({
        ledger_type_id: typeId,
        name: contacts[i].name.trim(),
        phone: contacts[i].phone || '',
        place: contacts[i].place || '',
        address: contacts[i].address || '',
        igst_status: 'NO',
      }));
      const res = await ledgerApi.bulkCreate(toImport);
      setResult(res.data);
      setStep('done');
    } catch (err) {
      toast.error(err.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────
  return (
    <Modal open={open} onClose={handleClose} title="Import Contacts from .vcf" size="xl">
      {/* ── Step: Upload ──────────────────────────────────────────── */}
      {step === 'upload' && (
        <div className="space-y-5">
          <p className="text-sm text-slate-500">
            Upload a <strong>.vcf</strong> (vCard) file exported from your phone or contacts app.
            Selected contacts will be created as <strong>Customer</strong> ledgers.
          </p>

          {/* Drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
              dragOver
                ? 'border-trust-blue bg-blue-50'
                : 'border-slate-300 hover:border-trust-blue hover:bg-slate-50'
            }`}
          >
            <ArrowUpTrayIcon className="h-10 w-10 mx-auto mb-3 text-slate-300" />
            <p className="text-sm font-medium text-slate-600">
              Drag & drop your .vcf file here, or <span className="text-trust-blue underline">browse</span>
            </p>
            <p className="text-xs text-slate-400 mt-1">Supports vCard 2.1, 3.0 and 4.0</p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".vcf,text/vcard"
            className="hidden"
            onChange={handleFileChange}
          />

          <div className="flex justify-end">
            <button onClick={handleClose} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      {/* ── Step: Select ──────────────────────────────────────────── */}
      {step === 'select' && (
        <div className="flex flex-col gap-4">
          {/* Stats bar */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm text-slate-500">
              <strong>{contacts.length}</strong> contacts found ·{' '}
              <strong>{selected.size}</strong> selected
            </p>
            {/* Search */}
            <div className="relative w-56">
              <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search contacts…"
                className="input-field !pl-8 !py-1.5 !text-xs w-full"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs leading-none"
                >✕</button>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-y-auto max-h-[50vh]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
                  <tr>
                    <th className="w-10 px-3 py-2.5 text-center">
                      <input
                        type="checkbox"
                        checked={allFilteredSelected}
                        onChange={toggleSelectAll}
                        className="rounded border-slate-300 text-trust-blue focus:ring-trust-blue"
                        title="Select all"
                      />
                    </th>
                    <th className="px-3 py-2.5 text-left font-semibold text-slate-600">Name</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-slate-600">Phone</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-slate-600">Place</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredContacts.map((c) => {
                    const realIdx = contacts.indexOf(c);
                    const isSelected = selected.has(realIdx);
                    return (
                      <tr
                        key={realIdx}
                        onClick={() => toggleOne(realIdx)}
                        className={`border-b border-slate-100 cursor-pointer transition-colors ${
                          isSelected ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="px-3 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleOne(realIdx)}
                            onClick={(e) => e.stopPropagation()}
                            className="rounded border-slate-300 text-trust-blue focus:ring-trust-blue"
                          />
                        </td>
                        <td className="px-3 py-2 font-medium text-slate-800">{c.name}</td>
                        <td className="px-3 py-2 text-slate-500 font-mono text-xs">{c.phone || '—'}</td>
                        <td className="px-3 py-2 text-slate-500">{c.place || '—'}</td>
                      </tr>
                    );
                  })}
                  {filteredContacts.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-3 py-6 text-center text-slate-400 text-xs">
                        No contacts match your search
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Action bar */}
          <div className="flex items-center justify-between flex-wrap gap-3 pt-1">
            <button
              onClick={() => setStep('upload')}
              className="btn-secondary text-sm"
            >
              ← Change File
            </button>
            <button
              onClick={handleImport}
              disabled={importing || selected.size === 0}
              className="btn-primary text-sm gap-2"
            >
              <UserGroupIcon className="h-4 w-4" />
              {importing ? 'Importing…' : `Import ${selected.size} Contact${selected.size !== 1 ? 's' : ''} as Ledgers`}
            </button>
          </div>
        </div>
      )}

      {/* ── Step: Done ────────────────────────────────────────────── */}
      {step === 'done' && result && (
        <div className="space-y-5">
          <div className="flex items-center gap-3 p-4 rounded-xl bg-green-50 border border-green-200">
            <CheckCircleIcon className="h-7 w-7 text-green-600 shrink-0" />
            <div>
              <p className="font-semibold text-green-800">Import Complete</p>
              <p className="text-sm text-green-700 mt-0.5">
                <strong>{result.created}</strong> ledger{result.created !== 1 ? 's' : ''} created.
                {result.skipped > 0 && <> &nbsp;<strong>{result.skipped}</strong> skipped.</>}
              </p>
            </div>
          </div>

          {result.errors && result.errors.length > 0 && (
            <div className="border border-red-200 rounded-xl p-4 bg-red-50">
              <div className="flex items-center gap-2 mb-2">
                <ExclamationCircleIcon className="h-4 w-4 text-red-500" />
                <p className="text-sm font-semibold text-red-700">Skipped contacts</p>
              </div>
              <ul className="space-y-1 max-h-40 overflow-y-auto">
                {result.errors.map((e, i) => (
                  <li key={i} className="text-xs text-red-600">
                    <strong>{e.name}</strong> — {e.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button onClick={handleClose} className="btn-primary text-sm">Done</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
