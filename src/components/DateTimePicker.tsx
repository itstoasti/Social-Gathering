import React from 'react';
import { Calendar } from 'lucide-react';

interface DateTimePickerProps {
  selectedDate: Date | null;
  onChange: (date: Date | null) => void;
}

const DateTimePicker: React.FC<DateTimePickerProps> = ({ selectedDate, onChange }) => {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
        <Calendar className="w-5 h-5" />
        Schedule Post
      </h3>
      <div className="flex gap-4">
        <input
          type="date"
          className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          onChange={(e) => {
            const date = e.target.value ? new Date(e.target.value) : null;
            onChange(date);
          }}
          min={new Date().toISOString().split('T')[0]}
        />
        <input
          type="time"
          className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          onChange={(e) => {
            if (selectedDate) {
              const [hours, minutes] = e.target.value.split(':');
              const newDate = new Date(selectedDate);
              newDate.setHours(parseInt(hours), parseInt(minutes));
              onChange(newDate);
            }
          }}
        />
      </div>
    </div>
  );
};

export default DateTimePicker;