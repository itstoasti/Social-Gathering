import axios from 'axios';

const api = axios.create({
  // In production, this should point to your deployed backend URL
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  withCredentials: true
});

export const auth = {
  getTwitterAuthUrl: () => api.get('/auth/twitter'),
  getInstagramAuthUrl: () => api.get('/auth/instagram'),
  getFacebookAuthUrl: () => api.get('/auth/facebook')
};

export const posts = {
  create: (postData: {
    caption: string;
    mediaUrl?: string;
    platforms: {
      twitter: boolean;
      instagram: boolean;
      facebook: boolean;
    };
    scheduledFor?: Date;
  }) => api.post('/posts', postData),
  
  getAll: () => api.get('/posts')
};

export default api;