import { Routes, Route } from "react-router-dom";
import AppLayout from "./components/layout/AppLayout";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import LoginPage from "./components/auth/LoginPage";
import DashboardPage from "./components/dashboard/DashboardPage";
import LedgerCreationPage from "./components/ledgers/LedgerCreationPage";
import LedgerListPage from "./components/ledgers/LedgerListPage";
import LedgerPage from "./components/ledgers/LedgerPage";
import PendingInterestPage from "./components/accounts/PendingInterestPage";
import PaidInterestPage from "./components/accounts/PaidInterestPage";
import ReportsPage from "./components/reports/ReportsPage";
import OutstandingBalanceReportPage from "./components/reports/OutstandingBalanceReportPage";
import StatementOfAccountPage from "./components/reports/StatementOfAccountPage";
import SettingsPage from "./components/settings/SettingsPage";
import DeveloperSettingsPage from "./components/settings/DeveloperSettingsPage";
import ExpensePage from "./components/expenses/ExpensePage";
import ExpenseReportsPage from "./components/expenses/ExpenseReportsPage";
import PaymentEntryPage from "./components/payments/PaymentEntryPage";
import DayBookPage from "./components/reports/DayBookPage";
import ItemListPage from "./components/items/ItemListPage";
import ItemCreationPage from "./components/items/ItemCreationPage";
import ItemSalesEntryPage from "./components/sales/ItemSalesEntryPage";
import ItemSalesListPage from "./components/sales/ItemSalesListPage";
import SalesReportPage from "./components/sales/SalesReportPage";
import ItemPurchaseEntryPage from "./components/purchases/ItemPurchaseEntryPage";
import ItemPurchaseListPage from "./components/purchases/ItemPurchaseListPage";
import PurchaseReportPage from "./components/purchases/PurchaseReportPage";
import EstimationEntryPage from "./components/sales/EstimationEntryPage";
import EstimationListPage from "./components/sales/EstimationListPage";
import SalesReturnEntryPage from "./components/sales/SalesReturnEntryPage";
import SalesReturnListPage from "./components/sales/SalesReturnListPage";
import PurchaseReturnEntryPage from "./components/purchases/PurchaseReturnEntryPage";
import PurchaseReturnListPage from "./components/purchases/PurchaseReturnListPage";
import StockReportPage from "./components/items/StockReportPage";
import StaffListPage from "./components/staff/StaffListPage";
import ServiceEntryPage from "./components/services/ServiceEntryPage";
import ServiceListPage from "./components/services/ServiceListPage";
import ServiceClosePage from "./components/services/ServiceClosePage";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <AppLayout>
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route
                  path="/ledger-creation"
                  element={<LedgerCreationPage />}
                />
                <Route path="/ledgers" element={<LedgerListPage />} />
                <Route path="/ledger/:id" element={<LedgerPage />} />
                <Route
                  path="/pending-interest"
                  element={<PendingInterestPage />}
                />
                <Route path="/paid-interest" element={<PaidInterestPage />} />
                <Route path="/reports" element={<ReportsPage />} />
                <Route
                  path="/outstanding-balances"
                  element={<OutstandingBalanceReportPage />}
                />
                <Route
                  path="/statement-of-account"
                  element={<StatementOfAccountPage />}
                />
                <Route path="/settings" element={
                  <ProtectedRoute permission="manage_settings">
                    <SettingsPage />
                  </ProtectedRoute>
                } />
                <Route
                  path="/developer-settings"
                  element={<DeveloperSettingsPage />}
                />
                <Route path="/expenses" element={<ExpensePage />} />
                <Route
                  path="/expense-reports"
                  element={<ExpenseReportsPage />}
                />
                <Route path="/payment-entry" element={<PaymentEntryPage />} />
                <Route path="/day-book" element={<DayBookPage />} />
                <Route path="/items" element={<ItemListPage />} />
                <Route path="/items/new" element={<ItemCreationPage />} />
                <Route path="/items/:id/edit" element={<ItemCreationPage />} />
                <Route path="/item-sales" element={<ItemSalesListPage />} />
                <Route
                  path="/item-sales/new"
                  element={<ItemSalesEntryPage />}
                />
                <Route
                  path="/item-sales/:id/edit"
                  element={<ItemSalesEntryPage />}
                />
                <Route path="/sales-report" element={<SalesReportPage />} />
                <Route path="/item-purchases" element={<ItemPurchaseListPage />} />
                <Route
                  path="/item-purchases/new"
                  element={<ItemPurchaseEntryPage />}
                />
                <Route
                  path="/item-purchases/:id/edit"
                  element={<ItemPurchaseEntryPage />}
                />
                <Route path="/purchase-report" element={<PurchaseReportPage />} />
                <Route path="/estimations" element={<EstimationListPage />} />
                <Route path="/estimation" element={<EstimationEntryPage />} />
                <Route path="/estimation/:id/edit" element={<EstimationEntryPage />} />
                <Route path="/sales-returns" element={<SalesReturnListPage />} />
                <Route path="/sales-return" element={<SalesReturnEntryPage />} />
                <Route path="/sales-return/:id/edit" element={<SalesReturnEntryPage />} />
                <Route path="/purchase-returns" element={<PurchaseReturnListPage />} />
                <Route path="/purchase-return" element={<PurchaseReturnEntryPage />} />
                <Route path="/purchase-return/:id/edit" element={<PurchaseReturnEntryPage />} />
                <Route path="/stock-report" element={<StockReportPage />} />
                <Route path="/staffs" element={<StaffListPage />} />
                <Route path="/services/new" element={<ServiceEntryPage />} />
                <Route path="/services/pending" element={<ServiceListPage status="pending" />} />
                <Route path="/services/closed" element={<ServiceListPage status="closed" />} />
                <Route path="/services/:id/close" element={<ServiceClosePage />} />
              </Routes>
            </AppLayout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
