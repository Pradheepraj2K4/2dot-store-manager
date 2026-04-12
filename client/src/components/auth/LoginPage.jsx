import { useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { login } from '../../utils/auth';
import { LockClosedIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const passwordRef = useRef(null);

  const from = location.state?.from?.pathname || '/';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password) {
      toast.error('Please enter password');
      return;
    }

    setLoading(true);
    
    try {
      if (await login(password)) {
        toast.success('Login successful');
        navigate(from, { replace: true });
      } else {
        toast.error('Invalid password');
        setPassword('');
        passwordRef.current?.focus();
      }
    } catch {
      toast.error('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo/Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-trust-blue/10 border-2 border-trust-blue/20 mb-4">
            <LockClosedIcon className="h-8 w-8 text-trust-blue" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">2Dot Store Manager</h1>
          <p className="text-slate-400">Accounts Module</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-semibold text-slate-800 mb-6">Sign In</h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Password</label>
              <input
                ref={passwordRef}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                className="input-field"
                placeholder="Enter password"
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-200">
            <p className="text-xs text-slate-500 text-center">
              Default admin password changes daily based on the current date
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-slate-500 text-sm mt-6">
          © 2026 2Dot Solutions. All rights reserved.
        </p>
      </div>
    </div>
  );
}
