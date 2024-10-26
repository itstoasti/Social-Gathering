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
    if (response.status === 401) {
      window.location.href = '/';
      return Promise.reject(new ApiError('Unauthorized', 401));
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
    if (error.response.data) {
      if (typeof error.response.data === 'string') {
        errorMessage = error.response.data;
      } else if (typeof error.response.data.message === 'string') {
        errorMessage = error.response.data.message;
      } else if (error.response.data.error) {
        errorMessage = error.response.data.error;
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
      const response = await api.get<{ url: string }>('/auth/twitter');
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
      
  getInstagramAuthUrl: async () => {
    try {
      const response = await api.get<{ url: string }>('/auth/instagram');
      const authUrl = response.data?.url;
      
      if (!authUrl) {
        throw new ApiError('No authorization URL received');
      }

      window.location.href = authUrl;
      return { url: authUrl };
    } catch (error) {
      console.error('Instagram auth error:', error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        'Failed to get Instagram auth URL',
        error instanceof Error ? undefined : 500,
        error
      );
    }
  },
      
  getFacebookAuthUrl: async () => {
    try {
      const response = await api.get<{ url: string }>('/auth/facebook');
      return response.data;
    } catch (error) {
      console.error('Facebook auth error:', error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        'Failed to get Facebook auth URL',
        error instanceof Error ? undefined : 500,
        error
      );
    }
  },
      
  getConnectedAccounts: async () => {
    try {
      const response = await api.get<ConnectedAccounts>('/auth/accounts');
      return response.data;
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
      const response = await api.get<{ authenticated: boolean; sessionId: string }>('/auth/status');
      return response.data;
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
      const response = await api.post<Post>('/posts', postData);
      return response.data;
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
      const response = await api.get<Post[]>('/posts');
      return response.data;
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
      const response = await api.put<Post>(`/posts/${id}`, data);
      return response.data;
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
      const response = await api.delete<{ message: string }>(`/posts/${id}`);
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
