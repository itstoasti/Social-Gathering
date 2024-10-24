import axios, { AxiosError } from 'axios';

const TIMEOUT = 10000; // 10 seconds timeout

// Always use production URL
const baseURL = 'https://social-gathering.onrender.com/api';

const api = axios.create({
  baseURL,
  withCredentials: true,
  timeout: TIMEOUT,
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

// Add request interceptor for debugging
api.interceptors.request.use(
  config => {
    if (import.meta.env.DEV) {
      console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`, {
        headers: config.headers,
        data: config.data
      });
    }
    return config;
  },
  error => {
    console.error('[API Request Error]', error);
    return Promise.reject(error);
  }
);

// Add response interceptor for better error handling
api.interceptors.response.use(
  response => {
    if (import.meta.env.DEV) {
      console.log(`[API Response] ${response.config.method?.toUpperCase()} ${response.config.url}`, {
        status: response.status,
        data: response.data
      });
    }
    return response;
  },
  (error: AxiosError) => {
    const apiError: ApiError = {
      message: 'An unexpected error occurred',
      status: error.response?.status
    };

    if (error.response) {
      apiError.message = error.response.data?.message || error.message;
      apiError.details = error.response.data;
    } else if (error.request) {
      if (error.code === 'ECONNABORTED') {
        apiError.message = 'Request timed out. Please try again.';
      } else {
        apiError.message = 'No response received from server. Please check your connection.';
      }
    }

    console.error('API Error:', apiError);
    return Promise.reject(apiError);
  }
);

// Health check function
const checkHealth = async () => {
  try {
    const response = await api.get('/health');
    return response.data;
  } catch (error) {
    console.error('Health check failed:', error);
    throw error;
  }
};

// Retry mechanism for failed requests
const withRetry = async (fn: () => Promise<any>, retries = 2, delay = 1000) => {
  try {
    return await fn();
  } catch (error) {
    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
};

export const auth = {
  getTwitterAuthUrl: () => 
    withRetry(() => api.get<{ url: string }>('/auth/twitter')
      .then(response => response.data)),
      
  getInstagramAuthUrl: () => 
    withRetry(() => api.get<{ url: string }>('/auth/instagram')
      .then(response => response.data)),
      
  getFacebookAuthUrl: () => 
    withRetry(() => api.get<{ url: string }>('/auth/facebook')
      .then(response => response.data)),
      
  getConnectedAccounts: () => 
    withRetry(() => api.get<ConnectedAccounts>('/auth/accounts')
      .then(response => response.data)),
      
  checkAuthStatus: () => 
    withRetry(() => api.get<{ authenticated: boolean }>('/auth/status')
      .then(response => response.data)),
      
  debugSession: () => 
    withRetry(() => api.get('/auth/debug-session')
      .then(response => response.data))
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
    withRetry(() => api.post('/posts', postData)
      .then(response => response.data)),
  
  getAll: () => 
    withRetry(() => api.get('/posts')
      .then(response => response.data))
};

export default api;
