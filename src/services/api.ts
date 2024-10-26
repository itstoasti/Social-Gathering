import axios, { AxiosError } from 'axios';

// Always use the production API URL
const baseURL = 'https://social-gathering.onrender.com/api';

export class ApiError extends Error {
  status?: number;
  details?: unknown;

  constructor(message: string, status?: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

const api = axios.create({
  baseURL,
  withCredentials: true,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  },
  maxContentLength: Infinity,
  maxBodyLength: Infinity
});

// Add request interceptor for debugging
api.interceptors.request.use(
  config => {
    console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`, {
      headers: config.headers,
      data: config.data
    });
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
    console.log(`[API Response] ${response.config.method?.toUpperCase()} ${response.config.url}`, {
      status: response.status,
      data: response.data
    });
    return response;
  },
  (error: AxiosError) => {
    const apiError = new ApiError(
      error.response?.data?.message || error.message || 'An unexpected error occurred',
      error.response?.status,
      error.response?.data
    );

    if (!error.response && error.request) {
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

// Retry mechanism for failed requests
const withRetry = async (fn: () => Promise<any>, retries = 2, delay = 1000) => {
  try {
    return await fn();
  } catch (error) {
    if (retries > 0 && error instanceof ApiError && (!error.status || error.status >= 500)) {
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

export interface CreatePostData {
  caption: string;
  mediaUrl?: string;
  platforms: {
    twitter: boolean;
    instagram: boolean;
    facebook: boolean;
  };
  scheduledFor?: Date;
}

export interface Post extends CreatePostData {
  _id: string;
  user: string;
  status: 'pending' | 'published' | 'failed';
  createdAt: string;
  updatedAt: string;
}

export const posts = {
  create: (postData: CreatePostData) => 
    withRetry(() => api.post<Post>('/posts', postData)
      .then(response => response.data)),
  
  getAll: () => 
    withRetry(() => api.get<Post[]>('/posts')
      .then(response => response.data))
};

export default api;
