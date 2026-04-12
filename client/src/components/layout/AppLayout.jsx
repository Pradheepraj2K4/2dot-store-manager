import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import { Toaster } from 'react-hot-toast';
import GlobalFinder from '../ui/GlobalFinder';
import { Bars3Icon } from '@heroicons/react/24/outline';

export default function AppLayout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [finderOpen, setFinderOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.altKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        navigate('/developer-settings');
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setFinderOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  // Globally prevent mouse-wheel from changing focused number inputs
  useEffect(() => {
    const handleWheel = () => {
      if (document.activeElement?.type === 'number') {
        document.activeElement.blur();
      }
    };
    document.addEventListener('wheel', handleWheel, { passive: true });
    return () => document.removeEventListener('wheel', handleWheel);
  }, []);

  return (
    <div className="flex min-h-screen">
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            borderRadius: '10px',
            background: '#0F172A',
            color: '#fff',
            fontSize: '14px',
          },
        }}
      />
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Mobile header */}
      <div className="fixed top-0 left-0 right-0 z-30 flex items-center gap-3 bg-sidebar px-4 py-3 md:hidden">
        <button
          onClick={() => setSidebarOpen(true)}
          className="rounded-lg p-1.5 text-slate-300 hover:bg-sidebar-hover hover:text-white transition-colors"
        >
          <Bars3Icon className="h-6 w-6" />
        </button>
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-trust-blue text-white font-bold text-xs">
            2D
          </div>
          <span className="text-sm font-semibold text-white">2Dot Store Manager</span>
        </div>
      </div>

      <main className="flex-1 flex flex-col h-screen overflow-y-auto p-4 pt-16 md:ml-64 md:p-6 md:pt-6 lg:p-8">
        {children}
      </main>
      <GlobalFinder open={finderOpen} onClose={() => setFinderOpen(false)} />
    </div>
  );
}
