import { NavLink, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import {
  HomeIcon,
  BookOpenIcon,
  DocumentChartBarIcon,
  Cog6ToothIcon,
  ArrowLeftOnRectangleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusCircleIcon,
  ClockIcon,
  CurrencyRupeeIcon,
  DocumentTextIcon,
  BanknotesIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { logout } from '../../utils/auth';
import { interestApi, expenseApi } from '../../api';
import toast from 'react-hot-toast';

const baseNavigation = [
  { name: 'Dashboard', href: '/', icon: HomeIcon },
  { name: 'Ledger Creation', href: '/ledger-creation', icon: PlusCircleIcon },
  { name: 'Ledgers', href: '/ledgers', icon: BookOpenIcon },
  { name: 'Reports', href: '/reports', icon: DocumentChartBarIcon },
  { name: 'Outstanding Balances', href: '/outstanding-balances', icon: CurrencyRupeeIcon },
  { name: 'Statement of Account', href: '/statement-of-account', icon: DocumentTextIcon },
  { name: 'Settings', href: '/settings', icon: Cog6ToothIcon },
];

export default function Sidebar() {
  const navigate = useNavigate();
  const [interestEnabled, setInterestEnabled] = useState(false);
  const [expenseEnabled, setExpenseEnabled] = useState(false);

  useEffect(() => {
    interestApi.isEnabled().then((res) => {
      setInterestEnabled(res.data.enabled);
    }).catch(() => {});
    expenseApi.isEnabled().then((res) => {
      const val = res.data?.value;
      setExpenseEnabled(val === true || val === 'true');
    }).catch(() => {});
  }, []);

  const navigation = (() => {
    let nav = [...baseNavigation];
    if (interestEnabled) {
      // Insert after Statement of Account
      const soaIdx = nav.findIndex((n) => n.href === '/statement-of-account');
      const insertAt = soaIdx >= 0 ? soaIdx + 1 : nav.length;
      nav = [
        ...nav.slice(0, insertAt),
        { name: 'Pending Interest', href: '/pending-interest', icon: ClockIcon },
        { name: 'Paid Interest', href: '/paid-interest', icon: CheckCircleIcon },
        ...nav.slice(insertAt),
      ];
    }
    if (expenseEnabled) {
      // Insert Expenses and Expense Reports before Settings
      const settingsIdx = nav.findIndex((n) => n.href === '/settings');
      nav = [
        ...nav.slice(0, settingsIdx),
        { name: 'Expenses', href: '/expenses', icon: BanknotesIcon },
        { name: 'Expense Reports', href: '/expense-reports', icon: DocumentChartBarIcon },
        ...nav.slice(settingsIdx),
      ];
    }
    return nav;
  })();

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
    navigate('/login', { replace: true });
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-64 flex-col bg-sidebar">
      {/* Logo / Brand */}
      <div className="flex h-16 items-center gap-2 px-6 border-b border-slate-700">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-trust-blue text-white font-bold text-sm">
          2D
        </div>
        <div>
          <h1 className="text-base font-bold text-white leading-tight">2Dot Store Manager</h1>
          <p className="text-[10px] text-slate-400 leading-tight">Accounts Module</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
        {navigation.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            end={item.href === '/'}
            className={({ isActive }) =>
              `group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-trust-blue text-white shadow-lg shadow-trust-blue/25'
                  : 'text-slate-300 hover:bg-sidebar-hover hover:text-white'
              }`
            }
          >
            <item.icon className="h-5 w-5 flex-shrink-0" />
            {item.name}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-slate-700 px-3 py-3 space-y-2">
        {/* Back / Forward history navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(-1)}
            title="Go back"
            className="flex-1 flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors text-slate-300 hover:bg-sidebar-hover hover:text-white"
          >
            <ChevronLeftIcon className="h-4 w-4 flex-shrink-0" />
           
          </button>
          <div className="w-px h-5 bg-slate-700" />
          <button
            onClick={() => navigate(1)}
            title="Go forward"
            className="flex-1 flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors text-slate-300 hover:bg-sidebar-hover hover:text-white"
          >
           
            <ChevronRightIcon className="h-4 w-4 flex-shrink-0" />
          </button>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors text-slate-300 hover:bg-red-500/10 hover:text-red-400"
        >
          <ArrowLeftOnRectangleIcon className="h-5 w-5 flex-shrink-0" />
          Logout
        </button>
        <p className="text-xs text-slate-500 text-center">v1.0.0 — Offline Ready</p>
      </div>
    </aside>
  );
}
