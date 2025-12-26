import axios from 'axios';

// Lấy URL từ biến môi trường, nếu không có thì fallback về localhost
// LOGIC MỚI: Tự động nhận diện IP của Server
const getBaseURL = () => {
  // Nếu đang chạy local (npm run dev)
  if (import.meta.env.DEV) {
    return 'http://localhost:3000/api';
  }
  
  // Nếu đã build và chạy trên Docker/Server
  // window.location.hostname sẽ lấy đúng IP 192.168.20.17 của bạn
  return `http://${window.location.hostname}:3000/api`;
};

const axiosClient = axios.create({
  baseURL: getBaseURL(),
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor: Tự động gắn Token
axiosClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor: Xử lý lỗi (401 -> Logout)
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