import React from 'react';
import { X, Instagram, Facebook } from 'lucide-react';

function SocialLogin() {
  const handleLogin = (platform: string) => {
    // In a real app, this would handle OAuth authentication
    console.log(`Logging in to ${platform}`);
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h2 className="text-xl font-semibold mb-4">Connected Accounts</h2>
      <div className="space-y-4">
        <button
          onClick={() => handleLogin('twitter')}
          className="w-full flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
        >
          <div className="flex items-center gap-3">
            <X size={20} />
            <span>X.com</span>
          </div>
          <span className="text-red-500">Not Connected</span>
        </button>
        
        <button
          onClick={() => handleLogin('instagram')}
          className="w-full flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
        >
          <div className="flex items-center gap-3">
            <Instagram size={20} />
            <span>Instagram</span>
          </div>
          <span className="text-red-500">Not Connected</span>
        </button>
        
        <button
          onClick={() => handleLogin('facebook')}
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