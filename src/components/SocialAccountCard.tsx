import React, { ReactNode } from 'react';

interface SocialAccountCardProps {
  platform: string;
  icon: ReactNode;
  isSelected: boolean;
  onClick: () => void;
}

const SocialAccountCard: React.FC<SocialAccountCardProps> = ({
  platform,
  icon,
  isSelected,
  onClick,
}) => {
  return (
    <button
      onClick={onClick}
      className={`p-4 rounded-lg border-2 transition-all ${
        isSelected
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`${isSelected ? 'text-blue-500' : 'text-gray-600'}`}>
          {icon}
        </div>
        <div className="text-left">
          <p className={`font-medium ${isSelected ? 'text-blue-700' : 'text-gray-700'}`}>
            {platform}
          </p>
          <p className="text-sm text-gray-500">
            {isSelected ? 'Connected' : 'Click to connect'}
          </p>
        </div>
      </div>
    </button>
  );
};

export default SocialAccountCard;