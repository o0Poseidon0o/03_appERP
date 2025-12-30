import axios from 'axios';

const getBaseURL = () => {
  // 1. Nếu đang chạy môi trường phát triển (npm run dev trên máy cá nhân)
  if (import.meta.env.DEV) {
    return 'http://localhost:3000/api';
  }

  // 2. Nếu đã NAT ra ngoài hoặc chạy qua Nginx
  // Lấy toàn bộ Origin (bao gồm cả http/https, domain và cổng hiện tại - VD: cổng 90)
  const currentOrigin = window.location.origin; 
  
  // Trả về địa chỉ hiện tại cộng thêm /api. 
  // Ví dụ: http://thongbao.towa.com.vn:90/api
  return `${currentOrigin}/api`;
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