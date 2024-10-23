import React, { useState } from 'react';
import { Calendar, Image, Video, Send, Clock, X, Instagram, Facebook } from 'lucide-react';
import SocialLogin from './components/SocialLogin';
import MediaUpload from './components/MediaUpload';
import PostScheduler from './components/PostScheduler';

function App() {
  const [caption, setCaption] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState({
    twitter: false,
    instagram: false,
    facebook: false
  });
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduledTime, setScheduledTime] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const handleMediaSelect = (file: File) => {
    setMediaFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handlePost = () => {
    // In a real app, this would handle the API calls to each platform
    console.log('Posting to platforms:', selectedPlatforms);
    console.log('Caption:', caption);
    console.log('Media:', mediaFile);
    console.log('Scheduled time:', scheduledTime);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
      <div className="max-w-4xl mx-auto p-6">
        <header className="text-center mb-10">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Social Crosspost</h1>
          <p className="text-gray-600">Post to multiple platforms in one go</p>
        </header>

        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="mb-6">
            <textarea
              className="w-full p-4 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={4}
              placeholder="What's on your mind?"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
            />
          </div>

          <div className="mb-6">
            <MediaUpload onFileSelect={handleMediaSelect} />
            {preview && (
              <div className="relative mt-4 inline-block">
                <img src={preview} alt="Preview" className="max-h-48 rounded-lg" />
                <button
                  onClick={() => {
                    setPreview(null);
                    setMediaFile(null);
                  }}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"
                >
                  <X size={16} />
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-4 mb-6">
            <button
              onClick={() => setSelectedPlatforms(prev => ({ ...prev, twitter: !prev.twitter }))}
              className={`flex items-center gap-2 px-4 py-2 rounded-full ${
                selectedPlatforms.twitter
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              <X size={18} />
              X.com
            </button>
            <button
              onClick={() => setSelectedPlatforms(prev => ({ ...prev, instagram: !prev.instagram }))}
              className={`flex items-center gap-2 px-4 py-2 rounded-full ${
                selectedPlatforms.instagram
                  ? 'bg-pink-500 text-white'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              <Instagram size={18} />
              Instagram
            </button>
            <button
              onClick={() => setSelectedPlatforms(prev => ({ ...prev, facebook: !prev.facebook }))}
              className={`flex items-center gap-2 px-4 py-2 rounded-full ${
                selectedPlatforms.facebook
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              <Facebook size={18} />
              Facebook
            </button>
          </div>

          <div className="flex justify-between items-center">
            <button
              onClick={() => setIsScheduling(!isScheduling)}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-800"
            >
              <Clock size={20} />
              Schedule
            </button>
            <button
              onClick={handlePost}
              className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-6 py-2 rounded-full hover:opacity-90 transition-opacity flex items-center gap-2"
              disabled={!caption || Object.values(selectedPlatforms).every(v => !v)}
            >
              <Send size={18} />
              {isScheduling ? 'Schedule Post' : 'Post Now'}
            </button>
          </div>

          {isScheduling && (
            <PostScheduler
              scheduledTime={scheduledTime}
              onTimeChange={setScheduledTime}
            />
          )}
        </div>

        <SocialLogin />
      </div>
    </div>
  );
}

export default App;