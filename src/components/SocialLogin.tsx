import React, { useState, useEffect } from 'react';
import { X, Instagram, Facebook } from 'lucide-react';
import { auth, type ConnectedAccounts } from '../services/api';

const initialAccounts: ConnectedAccounts = {
  twitter: { connected: false },
  instagram: { connected: false },
  facebook: { connected: false }
};

function SocialLogin() {
  const [loading, setLoading] = useState({
    twitter: false,
    instagram: false,
    facebook: false
  });
  const [accounts, setAccounts] = useState<ConnectedAccounts>(initialAccounts);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('auth') === 'success') {
          await fetchConnectedAccounts();
          window.history.replaceState({}, document.title, window.location.pathname);
        } else {
          await fetchConnectedAccounts();
        }
      } catch (err) {
        console.error('Auth check failed:', err);
        setError('Failed to check authentication status');
      }
    };

    checkAuth();
  }, []);

  const fetchConnectedAccounts = async () => {
    try {
      const { data } = await auth.getConnectedAccounts();
      setAccounts(data);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch connected accounts:', err);
      setError('Failed to fetch connected accounts');
      setAccounts(initialAccounts);
    }
  };

  const handleTwitterLogin = async () => {
    try {
      setLoading(prev => ({ ...prev, twitter: true }));
      setError(null);
      const { data } = await auth.getTwitterAuthUrl();
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No auth URL received');
      }
    } catch (err) {
      console.error('Failed to get Twitter auth URL:', err);
      setError('Failed to connect to Twitter');
    } finally {
      setLoading(prev => ({ ...prev, twitter: false }));
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h2 className="text-xl font-semibold mb-4">Connected Accounts</h2>
      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg">
          {error}
        </div>
      )}
      <div className="space-y-4">
        <button
          onClick={handleTwitterLogin}
          disabled={loading.twitter}
          className="w-full flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <div className="flex items-center gap-3">
            <X className="w-5 h-5" />
            <span>X.com</span>
          </div>
          <span className={accounts.twitter.connected ? 'text-green-500' : 'text-red-500'}>
            {loading.twitter ? 'Connecting...' : 
             accounts.twitter.connected ? 
             `@${accounts.twitter.username}` : 
             'Not Connected'}
          </span>
        </button>
        
        <button
          disabled
          className="w-full flex items-center justify-between p-4 border border-gray-200 rounded-lg opacity-50 cursor-not-allowed"
        >
          <div className="flex items-center gap-3">
            <Instagram className="w-5 h-5" />
            <span>Instagram</span>
          </div>
          <span className="text-gray-500">Coming Soon</span>
        </button>
        
        <button
          disabled
          className="w-full flex items-center justify-between p-4 border border-gray-200 rounded-lg opacity-50 cursor-not-allowed"
        >
          <div className="flex items-center gap-3">
            <Facebook className="w-5 h-5" />
            <span>Facebook</span>
          </div>
          <span className="text-gray-500">Coming Soon</span>
        </button>
      </div>
    </div>
  );
}

export default SocialLogin;
