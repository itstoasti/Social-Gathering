import React from 'react';
import { Image as ImageIcon, X } from 'lucide-react';

interface PostEditorProps {
  caption: string;
  setCaption: (caption: string) => void;
  mediaPreview: string | null;
  onMediaUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

const PostEditor: React.FC<PostEditorProps> = ({
  caption,
  setCaption,
  mediaPreview,
  onMediaUpload
}) => {
  return (
    <div className="space-y-4">
      <textarea
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        placeholder="What's on your mind?"
        className="w-full h-32 p-4 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
      />

      <div className="relative">
        {mediaPreview ? (
          <div className="relative rounded-lg overflow-hidden">
            <img
              src={mediaPreview}
              alt="Preview"
              className="w-full h-64 object-cover rounded-lg"
            />
            <button
              onClick={() => setMediaPreview(null)}
              className="absolute top-2 right-2 p-1 bg-gray-800 bg-opacity-50 rounded-full text-white hover:bg-opacity-70 transition-opacity"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <ImageIcon className="w-12 h-12 text-gray-400 mb-3" />
              <p className="mb-2 text-sm text-gray-500">
                <span className="font-semibold">Click to upload</span> or drag and drop
              </p>
              <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p>
            </div>
            <input
              type="file"
              className="hidden"
              accept="image/*,video/*"
              onChange={onMediaUpload}
            />
          </label>
        )}
      </div>
    </div>
  );
};

export default PostEditor;