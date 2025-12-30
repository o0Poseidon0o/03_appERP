import axios from 'axios';

const getBaseURL = () => {
  // Nếu là môi trường DEV (chạy npm run dev tại máy local)
  if (import.meta.env.DEV) {
    return 'http://localhost:3000/api';
  }
  
  // Môi trường Production (Đã build và chạy qua Nginx)
  // Lấy VITE_API_URL từ file .env hoặc dùng origin hiện tại
  const url = import.meta.env.VITE_API_URL || window.location.origin;
  
  // Đảm bảo có hậu tố /api nhưng không bị lặp dấu //
  return url.endsWith('/api') ? url : `${url}/api`;
};

const axiosClient = axios.create({
  baseURL: getBaseURL(),
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor gắn Token
axiosClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor xử lý lỗi 401
axiosClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default axiosClient;