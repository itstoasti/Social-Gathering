import React, { useState, useCallback } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Menu, Send, Clock } from 'lucide-react';
import Sidebar from './components/Sidebar';
import PostEditor from './components/PostEditor';
import PostScheduler from './components/PostScheduler';
import ScheduledPosts from './components/ScheduledPosts';
import SocialLogin from './components/SocialLogin';
import { posts } from './services/api';
import { compressImage } from './utils/imageCompression';

function MainContent() {
  const [caption, setCaption] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState({
    twitter: false,
    instagram: false,
    facebook: false
  });
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduledTime, setScheduledTime] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const [isPosting, setIsPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleMediaSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setError(null);
      
      const file = event.target.files?.[0];
      if (!file) {
        throw new Error('No file selected');
      }

      if (file.size > 10 * 1024 * 1024) {
        throw new Error('File size must be less than 10MB');
      }

      const type = file.type.startsWith('image/') ? 'image' : 'video';
      setMediaType(type);

      const objectUrl = URL.createObjectURL(file);

      if (type === 'image') {
        try {
          const compressed = await compressImage(file);
          setMediaPreview(compressed);
          URL.revokeObjectURL(objectUrl);
        } catch (err) {
          URL.revokeObjectURL(objectUrl);
          throw err;
        }
      } else {
        setMediaPreview(objectUrl);
      }

      setMediaFile(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process media file');
      setMediaFile(null);
      setMediaPreview(null);
      setMediaType(null);
    }
  };

  const handlePost = async () => {
    try {
      setIsPosting(true);
      setError(null);

      if (!caption && !mediaFile) {
        throw new Error('Please add a caption or media to post');
      }

      if (!Object.values(selectedPlatforms).some(Boolean)) {
        throw new Error('Please select at least one platform to post to');
      }

      const postData = {
        caption,
        mediaUrl: mediaPreview,
        platforms: selectedPlatforms,
        scheduledFor: scheduledTime ? new Date(scheduledTime) : undefined
      };

      await posts.create(postData);

      setCaption('');
      setMediaFile(null);
      setMediaPreview(null);
      setMediaType(null);
      setScheduledTime('');
      setIsScheduling(false);
      setSelectedPlatforms({
        twitter: false,
        instagram: false,
        facebook: false
      });

    } catch (err) {
      console.error('Failed to create post:', err);
      setError(err instanceof Error ? err.message : 'Failed to create post');
    } finally {
      setIsPosting(false);
    }
  };

  const handleMediaRemove = useCallback(() => {
    if (mediaPreview?.startsWith('blob:')) {
      URL.revokeObjectURL(mediaPreview);
    }
    setMediaFile(null);
    setMediaPreview(null);
    setMediaType(null);
  }, [mediaPreview]);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <header className="text-center mb-10">
        <h1 className="text-4xl font-bold text-gray-800 mb-2">Social Crosspost</h1>
        <p className="text-gray-600">Post to multiple platforms in one go</p>
      </header>

      <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
        <PostEditor
          caption={caption}
          setCaption={setCaption}
          mediaPreview={mediaPreview}
          mediaType={mediaType}
          onMediaUpload={handleMediaSelect}
          onMediaRemove={handleMediaRemove}
        />

        <div className="flex flex-wrap gap-4 mb-6 mt-6">
          <button
            onClick={() => setSelectedPlatforms(prev => ({ ...prev, twitter: !prev.twitter }))}
            className={`flex items-center gap-2 px-4 py-2 rounded-full ${
              selectedPlatforms.twitter
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700'
            }`}
          >
            X.com
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        <div className="flex justify-between items-center gap-4">
          <button
            onClick={() => setIsScheduling(!isScheduling)}
            className={`flex items-center gap-2 px-6 py-2 rounded-full transition-colors ${
              isScheduling
                ? 'bg-purple-500 text-white hover:bg-purple-600'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Clock size={20} />
            Schedule
          </button>
          <button
            onClick={handlePost}
            disabled={isPosting || (!caption && !mediaFile)}
            className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-6 py-2 rounded-full hover:opacity-90 transition-opacity flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPosting ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                Posting...
              </span>
            ) : (
              <>
                <Send size={20} />
                {isScheduling ? 'Schedule Post' : 'Post Now'}
              </>
            )}
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
  );
}

function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
        <div className="flex min-h-screen">
          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="fixed top-4 left-4 p-2 bg-white rounded-lg shadow-lg lg:hidden z-50"
          >
            <Menu size={24} />
          </button>

          {/* Sidebar */}
          <Sidebar 
            isOpen={isSidebarOpen} 
            isCollapsed={isSidebarCollapsed}
            onClose={() => setIsSidebarOpen(false)}
            onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          />

          {/* Main Content */}
          <main className={`flex-1 transition-all duration-300 ${
            isSidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'
          }`}>
            <Routes>
              <Route path="/" element={<MainContent />} />
              <Route path="/scheduled" element={<ScheduledPosts />} />
              <Route path="/settings" element={<SocialLogin />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  );
}

export default App;
