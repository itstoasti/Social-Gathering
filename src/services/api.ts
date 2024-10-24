import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  withCredentials: true
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
