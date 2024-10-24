import { ApiError } from '../services/api';

export class ImageCompressionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImageCompressionError';
  }
}

export const compressImage = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.src = URL.createObjectURL(file);
    
    img.onload = () => {
      try {
        // Create canvas
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          throw new ImageCompressionError('Could not get canvas context');
        }

        // Calculate new dimensions while maintaining aspect ratio
        let width = img.width;
        let height = img.height;
        const maxDimension = 1200;

        if (width > height && width > maxDimension) {
          height = (height * maxDimension) / width;
          width = maxDimension;
        } else if (height > maxDimension) {
          width = (width * maxDimension) / height;
          height = maxDimension;
        }

        // Set canvas dimensions
        canvas.width = width;
        canvas.height = height;

        // Draw image
        ctx.drawImage(img, 0, 0, width, height);

        // Get compressed data URL
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
        
        // Clean up
        URL.revokeObjectURL(img.src);
        
        resolve(compressedDataUrl);
      } catch (error) {
        URL.revokeObjectURL(img.src);
        reject(new ApiError('Failed to compress image', undefined, error));
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new ApiError('Failed to load image'));
    };
  });
};
