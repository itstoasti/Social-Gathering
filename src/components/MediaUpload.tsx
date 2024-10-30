import React, { useRef } from 'react';
import { Image, Video } from 'lucide-react';

interface MediaUploadProps {
  onFileSelect: (file: File) => void;
}

function MediaUpload({ onFileSelect }: MediaUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  };

  return (
    <div className="flex gap-4">
      <button
        onClick={() => fileInputRef.current?.click()}
        className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
      >
        <Image size={20} />
        Add Media
      </button>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept="image/*,video/*"
        className="hidden"
      />
    </div>
  );
}

export default MediaUpload;