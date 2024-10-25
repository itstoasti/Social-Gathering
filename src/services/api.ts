import axios, { AxiosError } from 'axios';

const baseURL = import.meta.env.PROD 
  ? 'https://social-gathering.onrender.com/api'
  : 'http://localhost:5000/api';

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
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add request interceptor
api.interceptors.request.use(
  (config) => {
    // Log request details
    console.log('API Request:', {
      method: config.method,
      url: config.url,
      baseURL: config.baseURL,
      headers: config.headers,
      withCredentials: config.withCredentials,
      data: config.data
    });
    return config;
  },
  (error) => {
    console.error('Request Error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor
api.interceptors.response.use(
  (response) => {
    console.log('API Response:', {
      status: response.status,
      headers: response.headers,
      data: response.data
    });
    return response;
  },
  (error: AxiosError) => {
    console.error('Response Error:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
      headers: error.response?.headers
    });

    // Handle network errors
    if (!error.response) {
      throw new ApiError(
        'Network Error - Please check your connection',
        0,
        error
      );
    }

    // Handle API errors
    throw new ApiError(
      error.response?.data?.message || error.message,
      error.response?.status,
      error.response?.data
    );
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
  getTwitterAuthUrl: async () => {
    try {
      const response = await api.get<{ url: string }>('/auth/twitter');
      window.location.href = response.data.url;
      return response.data;
    } catch (error) {
      console.error('Twitter auth error:', error);
      throw error;
    }
  },
      
  getInstagramAuthUrl: async () => {
    try {
      const response = await api.get<{ url: string }>('/auth/instagram');
      window.location.href = response.data.url;
      return response.data;
    } catch (error) {
      console.error('Instagram auth error:', error);
      throw error;
    }
  },
      
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
