import axios, { AxiosError } from 'axios';

// Determine API base URL based on current hostname
const getBaseUrl = () => {
  const hostname = window.location.hostname;
  
  if (hostname.includes('localhost')) {
    return 'https://localhost:5000/api';
  } else if (hostname.includes('stackblitz.io')) {
    return 'https://social-gathering.onrender.com/api';
  } else if (hostname.includes('onrender.com')) {
    return 'https://social-gathering.onrender.com/api';
  }
  
  // Default to production
  return 'https://social-gathering.onrender.com/api';
};

const baseURL = getBaseUrl();

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
  }
});

// Add request interceptor for debugging
api.interceptors.request.use(
  (config) => {
    console.log('API Request:', {
      method: config.method,
      url: config.url,
      baseURL: config.baseURL,
      headers: config.headers,
      withCredentials: config.withCredentials
    });
    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    console.error('API Response Error:', {
      status: error.response?.status,
      data: error.response?.data,
      headers: error.response?.headers,
      message: error.message
    });

    if (error.response?.status === 403) {
      console.error('CORS Error - Check allowed origins');
    }

    return Promise.reject(new ApiError(
      error.response?.data?.message || error.message,
      error.response?.status,
      error.response?.data
    ));
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
      .then(response => response.data)
};

export const posts = {
  create: (postData: CreatePostData) => 
    api.post<Post>('/posts', postData)
      .then(response => response.data),
  
  getAll: () => 
    api.get<Post[]>('/posts')
      .then(response => response.data),

  update: (id: string, data: Partial<CreatePostData>) =>
    api.put<Post>(`/posts/${id}`, data)
      .then(response => response.data),

  delete: (id: string) =>
    api.delete<{ message: string }>(`/posts/${id}`)
      .then(response => response.data)
};

export default api;
