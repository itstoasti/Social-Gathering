import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'https://social-gathering.onrender.com/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

export interface ConnectedAccount {
  username?: string;
  pageName?: string;
  connected: boolean;
}

export interface ConnectedAccounts {
  twitter: ConnectedAccount;
  instagram: ConnectedAccount;
  facebook: ConnectedAccount;
}

// Add response interceptor for better error handling
api.interceptors.response.use(
  response => response,
  error => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export const auth = {
  getTwitterAuthUrl: () => api.get<{ url: string }>('/auth/twitter'),
  getInstagramAuthUrl: () => api.get<{ url: string }>('/auth/instagram'),
  getFacebookAuthUrl: () => api.get<{ url: string }>('/auth/facebook'),
  getConnectedAccounts: () => api.get<ConnectedAccounts>('/auth/accounts'),
  checkAuthStatus: () => api.get<{ authenticated: boolean }>('/auth/status')
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
