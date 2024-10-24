import axios from 'axios';

// Get the base URL from environment or default to the production URL
const baseURL = import.meta.env.DEV 
  ? '/api' // This will use Vite's proxy in development
  : 'https://social-gathering.onrender.com/api';

const api = axios.create({
  baseURL,
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
    console.error('API Error:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });
    return Promise.reject(error);
  }
);

export const auth = {
  getTwitterAuthUrl: () => api.get<{ url: string }>('/auth/twitter'),
  getInstagramAuthUrl: () => api.get<{ url: string }>('/auth/instagram'),
  getFacebookAuthUrl: () => api.get<{ url: string }>('/auth/facebook'),
  getConnectedAccounts: () => api.get<ConnectedAccounts>('/auth/accounts'),
  checkAuthStatus: () => api.get<{ authenticated: boolean }>('/auth/status'),
  debugSession: () => api.get('/auth/debug-session')
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
