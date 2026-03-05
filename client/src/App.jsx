import { Routes, Route } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import ProtectedRoute from './components/auth/ProtectedRoute';
import LoginPage from './components/auth/LoginPage';
import DashboardPage from './components/dashboard/DashboardPage';
import LedgerCreationPage from './components/ledgers/LedgerCreationPage';
import LedgerListPage from './components/ledgers/LedgerListPage';
import LedgerPage from './components/ledgers/LedgerPage';
import AccountCreationPage from './components/accounts/AccountCreationPage';
import AccountDetailPage from './components/accounts/AccountDetailPage';
import PendingInterestPage from './components/accounts/PendingInterestPage';
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
                <Route path="/ledger-creation" element={<LedgerCreationPage />} />
                <Route path="/ledgers" element={<LedgerListPage />} />
                <Route path="/ledger/:id" element={<LedgerPage />} />
                <Route path="/account-creation" element={<AccountCreationPage />} />
                <Route path="/account/:id" element={<AccountDetailPage />} />
                <Route path="/pending-interest" element={<PendingInterestPage />} />
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
