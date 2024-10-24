import axios, { AxiosError } from 'axios';

const api = axios.create({
  baseURL: '/api',
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

export interface ApiError {
  message: string;
  status?: number;
  details?: unknown;
}

// Add response interceptor for better error handling
api.interceptors.response.use(
  response => response,
  (error: AxiosError) => {
    const apiError: ApiError = {
      message: 'An unexpected error occurred',
      status: error.response?.status
    };

    if (error.response) {
      apiError.message = error.response.data?.message || error.message;
      apiError.details = error.response.data;
    } else if (error.request) {
      apiError.message = 'No response received from server';
    }

    // Use a plain object for error logging to avoid postMessage cloning issues
    console.error('API Error:', {
      message: apiError.message,
      status: apiError.status,
      details: apiError.details
    });

    return Promise.reject(apiError);
  }
);

export const auth = {
  getTwitterAuthUrl: () => 
    api.get<{ url: string }>('/auth/twitter')
      .then(response => response.data),
      
  getInstagramAuthUrl: () => 
    api.get<{ url: string }>('/auth/instagram')
      .then(response => response.data),
      
  getFacebookAuthUrl: () => 
    api.get<{ url: string }>('/auth/facebook')
      .then(response => response.data),
      
  getConnectedAccounts: () => 
    api.get<ConnectedAccounts>('/auth/accounts')
      .then(response => response.data),
      
  checkAuthStatus: () => 
    api.get<{ authenticated: boolean }>('/auth/status')
      .then(response => response.data),
      
  debugSession: () => 
    api.get('/auth/debug-session')
      .then(response => response.data)
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
  }) => 
    api.post('/posts', postData)
      .then(response => response.data),
  
  getAll: () => 
    api.get('/posts')
      .then(response => response.data)
};

export default api;
