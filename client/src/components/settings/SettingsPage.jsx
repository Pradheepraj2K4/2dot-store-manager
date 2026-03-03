import { useState, useEffect, useRef } from 'react';
import { getDefaultPassword, getCustomPassword, setCustomPassword } from '../../utils/auth';
import toast from 'react-hot-toast';
import { LockClosedIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';

export default function SettingsPage() {
  const [showDefaultPassword, setShowDefaultPassword] = useState(false);
  const [customPassword, setCustomPasswordState] = useState('');
  const [showCustomPassword, setShowCustomPassword] = useState(false);
  const passwordRef = useRef(null);

  useEffect(() => {
    const savedPassword = getCustomPassword();
    if (savedPassword) {
      setCustomPasswordState(savedPassword);
    }
  }, []);

  const handleSavePassword = () => {
    try {
      setCustomPassword(customPassword);
      toast.success('Custom password saved');
    } catch (err) {
      toast.error('Failed to save password');
    }
  };

  const handleClearPassword = () => {
    setCustomPasswordState('');
    setCustomPassword('');
    toast.success('Custom password cleared');
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Manage application settings</p>
      </div>

      {/* Password Configuration */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <LockClosedIcon className="h-5 w-5 text-slate-600" />
          <h2 className="text-base font-semibold text-slate-900">Password Configuration</h2>
        </div>
        <div className="space-y-4">
          {/* Custom Password */}
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="mb-2">
              <h3 className="text-sm font-semibold text-slate-700">Custom Password (Additional)</h3>
              <p className="text-xs text-slate-500 mt-1">Set an additional password that works alongside the default admin password</p>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <input
                ref={passwordRef}
                type={showCustomPassword ? "text" : "password"}
                value={customPassword}
                onChange={(e) => setCustomPasswordState(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSavePassword();
                  }
                }}
                className="input-field flex-1"
                placeholder="Enter custom password"
              />
              <button
                type="button"
                onClick={() => setShowCustomPassword(!showCustomPassword)}
                className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-500"
              >
                {showCustomPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
              </button>
            </div>
            <div className="flex gap-2 mt-3">
              <button
                onClick={handleSavePassword}
                disabled={!customPassword}
                className="btn-primary text-sm"
              >
                Save Custom Password
              </button>
              {getCustomPassword() && (
                <button
                  onClick={handleClearPassword}
                  className="btn-secondary text-sm"
                >
                  Clear Password
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
