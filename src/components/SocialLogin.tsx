import React, { useState } from 'react';
import { X, Instagram, Facebook } from 'lucide-react';
import { auth } from '../services/api';

function SocialLogin() {
  const [loading, setLoading] = useState({
    twitter: false,
    instagram: false,
    facebook: false
  });

  const handleTwitterLogin = async () => {
    try {
      setLoading(prev => ({ ...prev, twitter: true }));
      const { data } = await auth.getTwitterAuthUrl();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Failed to get Twitter auth URL:', error);
      alert('Failed to connect to Twitter. Please try again.');
    } finally {
      setLoading(prev => ({ ...prev, twitter: false }));
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h2 className="text-xl font-semibold mb-4">Connected Accounts</h2>
      <div className="space-y-4">
        <button
          onClick={handleTwitterLogin}
          disabled={loading.twitter}
          className="w-full flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className="flex items-center gap-3">
            <X size={20} />
            <span>X.com</span>
          </div>
          <span className="text-red-500">
            {loading.twitter ? 'Connecting...' : 'Not Connected'}
          </span>
        </button>
        
        <button
          disabled
          className="w-full flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
        >
          <div className="flex items-center gap-3">
            <Instagram size={20} />
            <span>Instagram</span>
          </div>
          <span className="text-red-500">Not Connected</span>
        </button>
        
        <button
          disabled
          className="w-full flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
        >
          <div className="flex items-center gap-3">
            <Facebook size={20} />
            <span>Facebook</span>
          </div>
          <span className="text-red-500">Not Connected</span>
        </button>
      </div>
    </div>
  );
}

export default SocialLogin;
