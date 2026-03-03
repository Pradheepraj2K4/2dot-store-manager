import { Routes, Route } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import ProtectedRoute from './components/auth/ProtectedRoute';
import LoginPage from './components/auth/LoginPage';
import DashboardPage from './components/dashboard/DashboardPage';
import PartyListPage from './components/parties/PartyListPage';
import PartyLedgerPage from './components/parties/PartyLedgerPage';
import PaymentsPage from './components/payments/PaymentsPage';
import ReportsPage from './components/reports/ReportsPage';
import SettingsPage from './components/settings/SettingsPage';
import DeveloperSettingsPage from './components/settings/DeveloperSettingsPage';

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
                <Route path="/customers" element={<PartyListPage partyType="customer" />} />
                <Route path="/suppliers" element={<PartyListPage partyType="supplier" />} />
                <Route path="/ledger/:id" element={<PartyLedgerPage />} />
                <Route path="/payments" element={<PaymentsPage />} />
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/developer-settings" element={<DeveloperSettingsPage />} />
              </Routes>
            </AppLayout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
