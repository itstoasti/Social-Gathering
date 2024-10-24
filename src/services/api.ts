import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'https://social-gathering.onrender.com/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

export const auth = {
  getTwitterAuthUrl: () => api.get('/auth/twitter'),
  getTwitterCallback: (params: URLSearchParams) => 
    api.get(`/auth/twitter/callback?${params.toString()}`),
  getInstagramAuthUrl: () => api.get('/auth/instagram'),
  getFacebookAuthUrl: () => api.get('/auth/facebook'),
  getConnectedAccounts: () => api.get('/auth/accounts')
};

export default api;
