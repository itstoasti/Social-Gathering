import { ApiError } from '../services/api';

export class ImageCompressionError extends ApiError {
  constructor(message: string, details?: unknown) {
    super(message, undefined, details);
    this.name = 'ImageCompressionError';
  }
}

export const compressImage = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      // Validate file
      if (!file || !(file instanceof File)) {
        throw new ImageCompressionError('Invalid file object');
      }

      // Create object URL
      const objectUrl = URL.createObjectURL(file);
      const img = new Image();

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

          // Draw image with white background
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);

          // Get compressed data URL
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
          
          // Clean up
          URL.revokeObjectURL(objectUrl);
          
          resolve(compressedDataUrl);
        } catch (error) {
          URL.revokeObjectURL(objectUrl);
          reject(new ImageCompressionError('Failed to compress image', error));
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new ImageCompressionError('Failed to load image'));
      };

      img.src = objectUrl;
    } catch (error) {
      reject(new ImageCompressionError('Failed to process image', error));
    }
  });
};
