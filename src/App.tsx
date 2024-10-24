import React, { useState, useCallback } from 'react';
import { Send, Clock, X, Instagram, Facebook } from 'lucide-react';
import SocialLogin from './components/SocialLogin';
import PostEditor from './components/PostEditor';
import PostScheduler from './components/PostScheduler';
import { posts } from './services/api';
import { compressImage } from './utils/imageCompression';

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
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const [isPosting, setIsPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleMediaSelect = async (file: File) => {
    try {
      setError(null);
      
      // Check file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        throw new Error('File size must be less than 10MB');
      }

      // Determine media type
      const type = file.type.startsWith('image/') ? 'image' : 'video';
      setMediaType(type);

      // Handle image compression
      if (type === 'image') {
        const compressed = await compressImage(file);
        setMediaPreview(compressed);
      } else {
        setMediaPreview(URL.createObjectURL(file));
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

      // Reset form
      setCaption('');
      setMediaFile(null);
      setMediaPreview(null);
      setMediaType(null);
      setScheduledTime('');
      setIsScheduling(false);

    } catch (err) {
      console.error('Failed to create post:', err);
      setError(err instanceof Error ? err.message : 'Failed to create post');
    } finally {
      setIsPosting(false);
    }
  };

  const handleMediaRemove = () => {
    setMediaFile(null);
    setMediaPreview(null);
    setMediaType(null);
    if (mediaPreview?.startsWith('blob:')) {
      URL.revokeObjectURL(mediaPreview);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
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

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
              {error}
            </div>
          )}

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
                  <Send size={18} />
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
    </div>
  );
}

export default App;
