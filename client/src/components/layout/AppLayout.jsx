import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import { Toaster } from 'react-hot-toast';
import GlobalFinder from '../ui/GlobalFinder';

export default function AppLayout({ children }) {
  const navigate = useNavigate();
  const [finderOpen, setFinderOpen] = useState(false);

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
      <Sidebar />
      <main className="ml-64 flex-1 flex flex-col h-screen overflow-y-auto p-6 lg:p-8">
        {children}
      </main>
      <GlobalFinder open={finderOpen} onClose={() => setFinderOpen(false)} />
    </div>
  );
}
