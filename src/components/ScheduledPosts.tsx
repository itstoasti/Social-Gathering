import React, { useEffect, useState } from 'react';
import { Calendar, Clock, Trash2 } from 'lucide-react';
import { posts, type Post } from '../services/api';

const ScheduledPosts: React.FC = () => {
  const [scheduledPosts, setScheduledPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchScheduledPosts();
  }, []);

  const fetchScheduledPosts = async () => {
    try {
      setLoading(true);
      setError(null);
      const allPosts = await posts.getAll();
      const scheduled = allPosts.filter(
        (post) => post.status === 'pending' && post.scheduledFor
      );
      setScheduledPosts(scheduled);
    } catch (err) {
      setError('Failed to load scheduled posts');
      console.error('Error fetching scheduled posts:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 text-red-700 rounded-lg">
        {error}
      </div>
    );
  }

  if (scheduledPosts.length === 0) {
    return (
      <div className="text-center py-12">
        <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900">No Scheduled Posts</h3>
        <p className="mt-2 text-gray-500">
          When you schedule posts, they'll appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {scheduledPosts.map((post) => (
        <div
          key={post._id}
          className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow"
        >
          <div className="flex justify-between items-start mb-3">
            <div className="flex items-center gap-2 text-gray-500">
              <Clock size={16} />
              <span>
                {new Date(post.scheduledFor!).toLocaleString()}
              </span>
            </div>
            <button
              className="p-2 text-gray-400 hover:text-red-500 rounded-full hover:bg-red-50 transition-colors"
              onClick={() => {/* TODO: Add delete functionality */}}
            >
              <Trash2 size={16} />
            </button>
          </div>
          
          <p className="text-gray-700">{post.caption}</p>
          
          {post.mediaUrl && (
            <div className="mt-3">
              <img
                src={post.mediaUrl}
                alt="Post media"
                className="rounded-lg max-h-48 object-cover"
              />
            </div>
          )}
          
          <div className="mt-3 flex gap-2">
            {Object.entries(post.platforms).map(([platform, isSelected]) => (
              isSelected && (
                <span
                  key={platform}
                  className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-sm"
                >
                  {platform}
                </span>
              )
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ScheduledPosts;
