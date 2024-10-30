import React from 'react';
import { Calendar } from 'lucide-react';

interface PostSchedulerProps {
  scheduledTime: string;
  onTimeChange: (time: string) => void;
}

function PostScheduler({ scheduledTime, onTimeChange }: PostSchedulerProps) {
  return (
    <div className="mt-6 p-4 bg-gray-50 rounded-lg">
      <div className="flex items-center gap-4">
        <Calendar size={20} className="text-gray-600" />
        <input
          type="datetime-local"
          value={scheduledTime}
          onChange={(e) => onTimeChange(e.target.value)}
          className="border border-gray-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          min={new Date().toISOString().slice(0, 16)}
        />
      </div>
    </div>
  );
}

export default PostScheduler;