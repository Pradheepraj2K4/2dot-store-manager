import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ledgerApi, ledgerTypeApi, interestApi } from "../../api";
import { formatCurrency, todayISO } from "../../utils/helpers";
import { exportToExcel, exportToPDF } from "../../utils/exportUtils";
import { validatePassword } from "../../utils/auth";
import Modal from "../ui/Modal";
import LoadingSpinner from "../ui/LoadingSpinner";
import EmptyState from "../ui/EmptyState";
import toast from "react-hot-toast";
import {
  PlusIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  TrashIcon,
  BookOpenIcon,
  LockClosedIcon,
  TableCellsIcon,
  DocumentArrowDownIcon,
} from "@heroicons/react/24/outline";

const GST_REGEX = /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z0-9]{1}Z[A-Z0-9]{1}$/;
const PHONE_REGEX = /^\d{10}$/;
const STATE_REGEX = /^\d{2}$/;

function validateForm(form) {
  const errors = {};
  if (!form.ledger_type_id)
    errors.ledger_type_id = "Please select a ledger type.";
  if (!form.name.trim()) errors.name = "Name is required.";
  else if (form.name.trim().length < 2)
    errors.name = "Name must be at least 2 characters.";
  if (form.phone && !PHONE_REGEX.test(form.phone.replace(/\s/g, "")))
    errors.phone = "Enter a valid 10-digit number.";
  if (form.gst_no && !GST_REGEX.test(form.gst_no.trim().toUpperCase()))
    errors.gst_no = "Invalid GST number.";
  if (form.state_code && !STATE_REGEX.test(form.state_code.trim()))
    errors.state_code = "State code must be 2 digits.";
  if (form.gst_no && !form.state_code)
    errors.state_code = "Required when GST is set.";
  return errors;
}

function FieldError({ msg }) {
  if (!msg) return null;
  return <p className="text-xs text-red-500 mt-1">{msg}</p>;
}

export default function LedgerListPage() {
  const [ledgers, setLedgers] = useState([]);
  const [ledgerTypes, setLedgerTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [editModal, setEditModal] = useState({ open: false, ledger: null });
  const [editForm, setEditForm] = useState({});
  const [editErrors, setEditErrors] = useState({});
  const [editTouched, setEditTouched] = useState({});
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [deletePasswordError, setDeletePasswordError] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const deletePasswordRef = useRef(null);
  const [interestEnabled, setInterestEnabled] = useState(false);
  const navigate = useNavigate();

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [ledgersRes, typesRes] = await Promise.all([
        ledgerApi.getAll(),
        ledgerTypeApi.getAll(),
      ]);
      setLedgers(ledgersRes.data);
      setLedgerTypes(typesRes.data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    interestApi
      .isEnabled()
      .then((res) => setInterestEnabled(res.data.enabled))
      .catch(() => {});
  }, []);

  const openEdit = (ledger) => {
    setEditForm({
      ledger_type_id: ledger.ledger_type_id || "",
      name: ledger.name,
      phone: ledger.phone || "",
      place: ledger.place || "",
      address: ledger.address || "",
      gst_no: ledger.gst_no || "",
      state_code: ledger.state_code || "",
      igst_status: ledger.igst_status || "NO",
      ledger_date: ledger.ledger_date || todayISO(),
      interest_rate:
        ledger.interest_rate != null ? String(ledger.interest_rate) : "",
      interest_scheme: ledger.interest_scheme || "NONE",
    });
    setEditErrors({});
    setEditTouched({});
    setEditModal({ open: true, ledger });
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    const next = { ...editForm, [name]: value };
    setEditForm(next);
    if (editTouched[name]) setEditErrors(validateForm(next));
  };

  const handleEditBlur = (e) => {
    const { name } = e.target;
    setEditTouched((p) => ({ ...p, [name]: true }));
    setEditErrors(validateForm(editForm));
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    const errs = validateForm(editForm);
    setEditErrors(errs);
    setEditTouched(
      Object.fromEntries(Object.keys(editForm).map((k) => [k, true])),
    );
    if (Object.keys(errs).length > 0) return;
    try {
      await ledgerApi.update(editModal.ledger.id, {
        ...editForm,
        ledger_type_id: parseInt(editForm.ledger_type_id),
        name: editForm.name.trim(),
        gst_no: editForm.gst_no.trim().toUpperCase(),
        state_code: editForm.state_code.trim(),
        ledger_date: editForm.ledger_date || "",
      });
      toast.success("Ledger updated successfully");
      setEditModal({ open: false, ledger: null });
      fetchData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const openDeleteConfirm = (ledger) => {
    setDeleteConfirm(ledger);
    setDeletePassword("");
    setDeletePasswordError("");
    setTimeout(() => deletePasswordRef.current?.focus(), 100);
  };

  const handleDelete = async () => {
    if (!deletePassword) {
      setDeletePasswordError("Password is required.");
      return;
    }
    setDeleteLoading(true);
    try {
      const valid = await validatePassword(deletePassword);
      if (!valid) {
        setDeletePasswordError("Incorrect password.");
        setDeletePassword("");
        deletePasswordRef.current?.focus();
        return;
      }
      await ledgerApi.delete(deleteConfirm.id);
      toast.success("Ledger deleted successfully");
      setDeleteConfirm(null);
      fetchData();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleteLoading(false);
    }
  };

  // Build filter options from ledger types
  const filterOptions = [
    ["all", "All"],
    ...ledgerTypes.map((t) => [String(t.id), t.name]),
  ];

  const filtered = ledgers.filter((l) => {
    const matchesSearch =
      l.name.toLowerCase().includes(search.toLowerCase()) ||
      (l.phone || "").toLowerCase().includes(search.toLowerCase()) ||
      (l.place || "").toLowerCase().includes(search.toLowerCase());
    const matchesType =
      typeFilter === "all" || String(l.ledger_type_id) === typeFilter;
    return matchesSearch && matchesType;
  });

  // Exportable rows exclude the system CASH ledger
  const exportable = filtered.filter((l) => l.name !== "CASH");

  const handleExportExcel = () => {
    if (exportable.length === 0) {
      toast.error("No ledgers to export");
      return;
    }
    const columns = [
      { header: "Name", key: "name", width: 25 },
      { header: "Type", key: "type_name", width: 18 },
      { header: "Phone", key: "phone", width: 15 },
      { header: "Place", key: "place", width: 18 },
      { header: "Balance", key: "current_balance", width: 15 },
      { header: "Status", key: "status", width: 12 },
    ];
    exportToExcel(exportable, columns, "Ledgers");
  };

  const handleExportPDF = () => {
    if (exportable.length === 0) {
      toast.error("No ledgers to export");
      return;
    }
    const headers = ["Name", "Type", "Phone", "Place", "Balance", "Status"];
    const rows = exportable.map((l) => [
      l.name,
      l.type_name || "",
      l.phone || "",
      l.place || "",
      formatCurrency(l.current_balance || 0).replace("₹", "Rs. "),
      l.status || "",
    ]);
    exportToPDF("Ledgers", headers, rows, "Ledgers");
  };

  if (loading) return <LoadingSpinner className="py-20" size="lg" />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Ledgers</h1>
          <p className="text-sm text-slate-500 mt-1">
            All ledger accounts ({filtered.length})
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportExcel}
            className="p-2 rounded-lg bg-green-600 hover:bg-green-700 text-white transition-colors"
            title="Download as Excel"
          >
            <TableCellsIcon className="h-5 w-5" />
          </button>
          <button
            onClick={handleExportPDF}
            className="p-2 rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors"
            title="Download as PDF"
          >
            <DocumentArrowDownIcon className="h-5 w-5" />
          </button>
          <button
            onClick={() => navigate("/ledger-creation")}
            className="btn-primary gap-2"
          >
            <PlusIcon className="h-4 w-4" />
            New Ledger
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 sm:max-w-md">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ledgers…"
            className="input-field pl-9"
          />
        </div>
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1 flex-wrap">
          {filterOptions.map(([val, label]) => (
            <button
              key={val}
              onClick={() => setTypeFilter(val)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                typeFilter === val
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={BookOpenIcon}
          title="No ledgers found"
          description={
            search
              ? "Try a different search term"
              : "Create your first ledger to get started"
          }
          action={
            !search && (
              <button
                onClick={() => navigate("/ledger-creation")}
                className="btn-primary gap-2"
              >
                <PlusIcon className="h-4 w-4" />
                New Ledger
              </button>
            )
          }
        />
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm table-zebra">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">
                    Phone
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">
                    Place
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-600">
                    Balance
                  </th>
                  <th className="px-4 py-3 text-center font-semibold text-slate-600">
                    Status
                  </th>
                  <th className="px-4 py-3 text-center font-semibold text-slate-600">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((ledger) => (
                  <tr
                    key={ledger.id}
                    onClick={() => navigate(`/ledger/${ledger.id}`)}
                    className="border-b border-slate-100 cursor-pointer hover:bg-blue-50/40 transition-colors"
                  >
                    <td className="px-4 py-2.5 font-medium text-slate-800">
                      {ledger.name}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          ledger.behaviour === "customer"
                            ? "bg-blue-50 text-blue-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {ledger.type_name || "Unknown"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {ledger.phone || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {ledger.place || "—"}
                    </td>
                    <td
                      className={`px-4 py-2.5 text-right font-semibold ${ledger.current_balance > 0 ? "text-debit-red" : "text-slate-400"}`}
                    >
                      {formatCurrency(ledger.current_balance || 0)}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          ledger.status === "active"
                            ? "bg-green-50 text-green-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {ledger.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openEdit(ledger);
                          }}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-trust-blue transition-colors"
                          title="Edit"
                        >
                          <PencilSquareIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openDeleteConfirm(ledger);
                          }}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-debit-red transition-colors"
                          title="Delete"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      <Modal
        open={editModal.open}
        onClose={() => setEditModal({ open: false, ledger: null })}
        title="Edit Ledger"
      >
        <form onSubmit={handleEditSubmit} className="space-y-4" noValidate>
          <div>
            <label className="label">Ledger Type *</label>
            <select
              name="ledger_type_id"
              value={editForm.ledger_type_id || ""}
              onChange={handleEditChange}
              onBlur={handleEditBlur}
              className={`input-field ${editErrors.ledger_type_id ? "border-red-400" : ""}`}
            >
              <option value="">— Select type —</option>
              {ledgerTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.behaviour})
                </option>
              ))}
            </select>
            <FieldError msg={editErrors.ledger_type_id} />
          </div>
          <div>
            <label className="label">Name *</label>
            <input
              type="text"
              name="name"
              value={editForm.name || ""}
              onChange={handleEditChange}
              onBlur={handleEditBlur}
              className={`input-field ${editErrors.name ? "border-red-400" : ""}`}
            />
            <FieldError msg={editErrors.name} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Phone</label>
              <input
                type="text"
                name="phone"
                value={editForm.phone || ""}
                onChange={handleEditChange}
                onBlur={handleEditBlur}
                className={`input-field ${editErrors.phone ? "border-red-400" : ""}`}
                maxLength={10}
              />
              <FieldError msg={editErrors.phone} />
            </div>
            <div>
              <label className="label">Place</label>
              <input
                type="text"
                name="place"
                value={editForm.place || ""}
                onChange={handleEditChange}
                className="input-field"
              />
            </div>
          </div>
          <div>
            <label className="label">Address</label>
            <textarea
              name="address"
              value={editForm.address || ""}
              onChange={handleEditChange}
              rows={2}
              className="input-field resize-none"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">GST Number</label>
              <input
                type="text"
                name="gst_no"
                value={editForm.gst_no || ""}
                onChange={handleEditChange}
                onBlur={handleEditBlur}
                className={`input-field uppercase ${editErrors.gst_no ? "border-red-400" : ""}`}
                maxLength={15}
              />
              <FieldError msg={editErrors.gst_no} />
            </div>
            <div>
              <label className="label">State Code</label>
              <input
                type="text"
                name="state_code"
                value={editForm.state_code || ""}
                onChange={handleEditChange}
                onBlur={handleEditBlur}
                className={`input-field ${editErrors.state_code ? "border-red-400" : ""}`}
                maxLength={2}
              />
              <FieldError msg={editErrors.state_code} />
            </div>
          </div>
          <div>
            <label className="label">IGST Applicable</label>
            <div className="flex gap-6 mt-1">
              {["YES", "NO"].map((opt) => (
                <label
                  key={opt}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <input
                    type="radio"
                    name="igst_status"
                    value={opt}
                    checked={editForm.igst_status === opt}
                    onChange={handleEditChange}
                    className="text-trust-blue focus:ring-trust-blue"
                  />
                  <span className="text-sm text-slate-700">{opt}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Ledger Date</label>
            <input
              type="date"
              name="ledger_date"
              value={editForm.ledger_date || ""}
              onChange={handleEditChange}
              className="input-field"
            />
          </div>
          {interestEnabled && (
            <div className="border-t border-slate-200 pt-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">
                Interest Configuration
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Interest Rate (%)</label>
                  <input
                    type="number"
                    name="interest_rate"
                    value={editForm.interest_rate || ""}
                    onChange={handleEditChange}
                    onWheel={(e) => e.target.blur()}
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
                    value={editForm.interest_scheme || "NONE"}
                    onChange={handleEditChange}
                    className="input-field"
                  >
                    <option value="NONE">None</option>
                    <option value="DAILY">Daily (monthly rate)</option>
                    <option value="MONTHLY">Monthly (monthly rate)</option>
                  </select>
                </div>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setEditModal({ open: false, ledger: null })}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Save Changes
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <Modal
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Delete Ledger"
        size="sm"
      >
        <p className="text-sm text-slate-600 mb-4">
          Are you sure you want to delete <strong>{deleteConfirm?.name}</strong>
          ? This will also delete all associated transactions. This action
          cannot be undone.
        </p>
        <div className="mb-5">
          <label className="label flex items-center gap-1">
            <LockClosedIcon className="h-3.5 w-3.5" />
            Enter Password to Confirm
          </label>
          <input
            ref={deletePasswordRef}
            type="password"
            value={deletePassword}
            onChange={(e) => {
              setDeletePassword(e.target.value);
              setDeletePasswordError("");
            }}
            onKeyDown={(e) => e.key === "Enter" && handleDelete()}
            className={`input-field mt-1 ${deletePasswordError ? "border-red-400" : ""}`}
            placeholder="Enter your password"
            autoComplete="current-password"
          />
          {deletePasswordError && (
            <p className="text-xs text-red-500 mt-1">{deletePasswordError}</p>
          )}
        </div>
        <div className="flex justify-end gap-3">
          <button
            onClick={() => setDeleteConfirm(null)}
            className="btn-secondary"
            disabled={deleteLoading}
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            className="btn-danger"
            disabled={deleteLoading}
          >
            {deleteLoading ? "Verifying…" : "Delete"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
