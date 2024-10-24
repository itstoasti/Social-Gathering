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
  const [debugInfo, setDebugInfo] = useState<any>(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const authStatus = urlParams.get('auth');
        const authError = urlParams.get('message');

        if (authError) {
          setError(`Authentication error: ${decodeURIComponent(authError)}`);
          return;
        }

        if (authStatus === 'success') {
          console.log('Auth callback detected, fetching accounts...');
          await fetchConnectedAccounts();
          // Clear URL parameters
          window.history.replaceState({}, document.title, window.location.pathname);
        } else {
          console.log('No auth callback, checking current status...');
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
      console.log('Fetching connected accounts...');
      
      // First check auth status
      const authStatus = await auth.checkAuthStatus();
      console.log('Auth status:', authStatus.data);
      
      // Get debug session info
      try {
        const debugResponse = await auth.debugSession();
        console.log('Debug session data:', debugResponse.data);
        setDebugInfo(debugResponse.data);
      } catch (debugErr) {
        console.warn('Debug session fetch failed:', debugErr);
      }

      // Get connected accounts
      const { data } = await auth.getConnectedAccounts();
      console.log('Connected accounts:', data);
      
      setAccounts(data);
      setError(null);
    } catch (err: any) {
      console.error('Failed to fetch connected accounts:', err);
      setError(err.response?.data?.message || 'Failed to fetch connected accounts');
      setAccounts(initialAccounts);
    }
  };

  const handleTwitterLogin = async () => {
    try {
      setLoading(prev => ({ ...prev, twitter: true }));
      setError(null);
      
      console.log('Requesting Twitter auth URL...');
      const { data } = await auth.getTwitterAuthUrl();
      
      if (data?.url) {
        console.log('Redirecting to Twitter auth URL:', data.url);
        window.location.href = data.url;
      } else {
        throw new Error('No auth URL received');
      }
    } catch (err: any) {
      console.error('Failed to get Twitter auth URL:', err);
      setError(err.response?.data?.message || 'Failed to connect to Twitter');
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

      {debugInfo && (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg text-sm">
          <h3 className="font-semibold mb-2">Debug Info:</h3>
          <pre className="whitespace-pre-wrap">
            {JSON.stringify(debugInfo, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

export default SocialLogin;
