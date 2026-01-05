import axios from 'axios';

const getBaseURL = () => {
  // 1. Khi bạn đang Code trên VS Code (npm run dev)
  // Nó sẽ gọi trực tiếp vào Backend đang chạy cổng 3000 ở máy bạn
  if (import.meta.env.DEV) {
    return 'http://localhost:3000/api';
  }
  
  // 2. Khi bạn đã build và up lên Server Linux
  // Nó sẽ lấy: http://14.161.29.75:90/api hoặc http://thongbao.towa.com.vn:90/api
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