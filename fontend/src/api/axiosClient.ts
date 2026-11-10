import axios from 'axios';

const getBaseURL = () => {
  const envUrl = import.meta.env.VITE_API_URL?.trim();
  if (envUrl && envUrl !== '/') {
    const clean = envUrl.replace(/\/+$/, '');
    return clean.endsWith('/api') ? clean : `${clean}/api`;
  }

  // 1. Khi đang chạy DEV (npm run dev): dùng hostname hiện tại để Mobile/Tablet truy cập qua IP LAN vẫn gọi đúng Backend
  if (import.meta.env.DEV) {
    const host = window.location.hostname || 'localhost';
    return `http://${host}:3000/api`;
  }
  
  // 2. Khi chạy Production qua Nginx reverse proxy
  const origin = window.location.origin;
  return `${origin.endsWith('/') ? origin.slice(0, -1) : origin}/api`;
};

const axiosClient = axios.create({
  baseURL: getBaseURL(),
  headers: { 'Content-Type': 'application/json' },
});

// Interceptor gắn Token
axiosClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor xử lý lỗi 401 (Hết hạn phiên làm việc)
axiosClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/login') window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default axiosClient;
