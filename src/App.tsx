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

  const handleMediaSelect = (file: File) => {
    // Check file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB');
      return;
    }

    setMediaFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setMediaPreview(reader.result as string);
      setMediaType(file.type.startsWith('image/') ? 'image' : 'video');
    };
    reader.readAsDataURL(file);
  };

  const handleMediaRemove = () => {
    setMediaFile(null);
    setMediaPreview(null);
    setMediaType(null);
  };

  const handlePost = async () => {
    try {
      if (!caption) {
        setError('Please enter a caption for your post.');
        return;
      }

      if (!Object.values(selectedPlatforms).some(v => v)) {
        setError('Please select at least one platform to post to.');
        return;
      }

      setIsPosting(true);
      setError(null);

      // Process media if exists
      let mediaUrl = null;
      if (mediaFile && mediaPreview) {
        if (mediaType === 'image') {
          // Compress image
          mediaUrl = await compressImage(mediaFile);
        } else {
          // For video, use the preview directly
          mediaUrl = mediaPreview;
        }
      }

      const postData = {
        caption,
        mediaUrl,
        platforms: selectedPlatforms,
        scheduledFor: scheduledTime ? new Date(scheduledTime) : undefined
      };

      await posts.create(postData);

      // Clear form
      setCaption('');
      handleMediaRemove();
      setScheduledTime('');
      setIsScheduling(false);
      setError(null);

      // Show success message
      alert(scheduledTime ? 'Post scheduled successfully!' : 'Post created successfully!');
    } catch (err: any) {
      console.error('Failed to create post:', err);
      setError(err.message || 'Failed to create post. Please try again.');
    } finally {
      setIsPosting(false);
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
            onMediaUpload={(e) => {
              const file = e.target.files?.[0];
              if (file) handleMediaSelect(file);
            }}
            onMediaRemove={handleMediaRemove}
          />

          <div className="flex flex-wrap gap-4 my-6">
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
              disabled={isPosting || !caption || !Object.values(selectedPlatforms).some(v => v)}
              className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-6 py-2 rounded-full hover:opacity-90 transition-opacity flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPosting ? (
                <>
                  <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  {isScheduling ? 'Scheduling...' : 'Posting...'}
                </>
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
