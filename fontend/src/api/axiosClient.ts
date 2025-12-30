import axios from 'axios';

const getBaseURL = () => {
  // 1. Khi bạn đang Code trên VS Code (npm run dev)
  if (import.meta.env.DEV) {
    return 'http://localhost:3000/api';
  }
  
  // 2. Khi đã chạy trên Server (Nội bộ hay Ngoài Internet đều dùng chung origin của trình duyệt)
  // Nếu bạn vào bằng 192.168.1.10:90 -> origin là http://192.168.1.10:90
  // Nếu bạn vào bằng thongbao.towa.com.vn:90 -> origin là http://thongbao.towa.com.vn:90
  return `${window.location.origin}/api`;
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