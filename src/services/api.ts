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
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  maxRedirects: 5
});

// Add request interceptor
api.interceptors.request.use(
  (config) => {
    console.log('API Request:', config);
    
    // Add timestamp to prevent caching
    const timestamp = new Date().getTime();
    const separator = config.url?.includes('?') ? '&' : '?';
    config.url = `${config.url}${separator}_=${timestamp}`;
    
    return config;
  },
  (error) => {
    console.error('Request Error:', error);
    return Promise.reject(new ApiError(
      error.message || 'Failed to make request',
      error.response?.status,
      error
    ));
  }
);

// Add response interceptor
api.interceptors.response.use(
  (response) => {
    console.log('API Response:', response);
    
    if (response.status === 401) {
      window.location.href = '/';
      return Promise.reject(new ApiError('Unauthorized', 401));
    }
    
    // Check if response has success flag
    if (response.data?.success === false) {
      throw new ApiError(
        response.data.message || 'Operation failed',
        response.status,
        response.data
      );
    }
    
    return response;
  },
  (error: AxiosError) => {
    console.error('Response Error:', error);

    if (!error.response) {
      throw new ApiError(
        'Network Error - Please check your connection',
        0,
        error
      );
    }

    if (error.response.status === 401) {
      window.location.href = '/';
      return Promise.reject(new ApiError('Unauthorized', 401));
    }

    // Try to parse error message from response
    let errorMessage = 'An unexpected error occurred';
    const data = error.response.data;
    
    if (data) {
      if (typeof data === 'string') {
        try {
          const parsed = JSON.parse(data);
          errorMessage = parsed.message || parsed.error || errorMessage;
        } catch {
          errorMessage = data;
        }
      } else if (typeof data === 'object') {
        errorMessage = data.message || data.error || errorMessage;
      }
    }

    throw new ApiError(
      errorMessage,
      error.response.status,
      error.response.data
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
      const response = await api.get<{ success: true; url: string }>('/auth/twitter');
      const authUrl = response.data?.url;
      
      if (!authUrl) {
        throw new ApiError('No authorization URL received');
      }

      window.location.href = authUrl;
      return { url: authUrl };
    } catch (error) {
      console.error('Twitter auth error:', error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        'Failed to get Twitter auth URL',
        error instanceof Error ? undefined : 500,
        error
      );
    }
  },
      
  getConnectedAccounts: async () => {
    try {
      const response = await api.get<{ success: true; accounts: ConnectedAccounts }>('/auth/accounts');
      return response.data.accounts;
    } catch (error) {
      console.error('Get accounts error:', error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        'Failed to get connected accounts',
        error instanceof Error ? undefined : 500,
        error
      );
    }
  },
      
  checkAuthStatus: async () => {
    try {
      const response = await api.get<{
        success: true;
        authenticated: boolean;
        sessionId: string;
      }>('/auth/status');
      return {
        authenticated: response.data.authenticated,
        sessionId: response.data.sessionId
      };
    } catch (error) {
      console.error('Auth status error:', error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        'Failed to check auth status',
        error instanceof Error ? undefined : 500,
        error
      );
    }
  }
};

export const posts = {
  create: async (postData: CreatePostData) => {
    try {
      const response = await api.post<{ success: true; post: Post }>('/posts', postData);
      return response.data.post;
    } catch (error) {
      console.error('Create post error:', error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        'Failed to create post',
        error instanceof Error ? undefined : 500,
        error
      );
    }
  },
  
  getAll: async () => {
    try {
      const response = await api.get<{ success: true; posts: Post[] }>('/posts');
      return response.data.posts;
    } catch (error) {
      console.error('Get posts error:', error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        'Failed to get posts',
        error instanceof Error ? undefined : 500,
        error
      );
    }
  },

  update: async (id: string, data: Partial<CreatePostData>) => {
    try {
      const response = await api.put<{ success: true; post: Post }>(`/posts/${id}`, data);
      return response.data.post;
    } catch (error) {
      console.error('Update post error:', error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        'Failed to update post',
        error instanceof Error ? undefined : 500,
        error
      );
    }
  },

  delete: async (id: string) => {
    try {
      const response = await api.delete<{ success: true; message: string }>(`/posts/${id}`);
      return response.data;
    } catch (error) {
      console.error('Delete post error:', error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        'Failed to delete post',
        error instanceof Error ? undefined : 500,
        error
      );
    }
  }
};

export default api;
