import React, { useEffect, useState } from 'react';
import { Calendar, Clock, Trash2, Edit2, X } from 'lucide-react';
import { posts, type Post } from '../services/api';

const ScheduledPosts: React.FC = () => {
  const [scheduledPosts, setScheduledPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [editedCaption, setEditedCaption] = useState('');
  const [editedSchedule, setEditedSchedule] = useState('');

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

  const handleDelete = async (postId: string) => {
    try {
      await posts.delete(postId);
      setScheduledPosts(prev => prev.filter(post => post._id !== postId));
    } catch (err) {
      setError('Failed to delete post');
      console.error('Error deleting post:', err);
    }
  };

  const handleEdit = (post: Post) => {
    setEditingPost(post);
    setEditedCaption(post.caption);
    setEditedSchedule(new Date(post.scheduledFor!).toISOString().slice(0, 16));
  };

  const handleUpdate = async () => {
    if (!editingPost) return;

    try {
      const updatedPost = await posts.update(editingPost._id, {
        caption: editedCaption,
        scheduledFor: new Date(editedSchedule)
      });

      setScheduledPosts(prev =>
        prev.map(post =>
          post._id === updatedPost._id ? updatedPost : post
        )
      );

      setEditingPost(null);
    } catch (err) {
      setError('Failed to update post');
      console.error('Error updating post:', err);
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
    <div className="space-y-4 max-w-4xl mx-auto p-6">
      {scheduledPosts.map((post) => (
        <div
          key={post._id}
          className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow"
        >
          {editingPost?._id === post._id ? (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-medium">Edit Post</h3>
                <button
                  onClick={() => setEditingPost(null)}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
                >
                  <X size={16} />
                </button>
              </div>
              
              <textarea
                value={editedCaption}
                onChange={(e) => setEditedCaption(e.target.value)}
                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
              />
              
              <input
                type="datetime-local"
                value={editedSchedule}
                onChange={(e) => setEditedSchedule(e.target.value)}
                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                min={new Date().toISOString().slice(0, 16)}
              />
              
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setEditingPost(null)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdate}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                >
                  Save Changes
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2 text-gray-500">
                  <Clock size={16} />
                  <span>
                    {new Date(post.scheduledFor!).toLocaleString()}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    className="p-2 text-gray-400 hover:text-blue-500 rounded-full hover:bg-blue-50 transition-colors"
                    onClick={() => handleEdit(post)}
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    className="p-2 text-gray-400 hover:text-red-500 rounded-full hover:bg-red-50 transition-colors"
                    onClick={() => handleDelete(post._id)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
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
            </>
          )}
        </div>
      ))}
    </div>
  );
};

export default ScheduledPosts;
