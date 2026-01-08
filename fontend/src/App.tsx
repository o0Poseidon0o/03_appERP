import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext'; // Đảm bảo đúng đường dẫn file Theme của bạn
import { Spin, ConfigProvider, theme, App as AntdApp } from 'antd'; 

// Import Pages
import LoginPage from './pages/auth/LoginPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage'; 
import MainLayout from './layout/MainLayout';
import Profile from './pages/Profile';

// --- CÁC TRANG QUẢN TRỊ ---
import Dashboard from './pages/admin/Dashboard'; 
import PostPage from './pages/admin/PostPage'; 
import UserManagement from './pages/admin/UserManagement';
import DepartmentManagement from './pages/department/DepartmentManagement';
import RoleManagement from './pages/Role/RoleManagement';
import MenuManagement from './pages/admin/MenuManagement';

// Import Security
import RoleRoute from './components/RoleRoute';
import type { JSX } from 'react';

// --- COMPONENT BẢO VỆ ĐƯỜNG DẪN RIÊNG TƯ ---
const PrivateRoute = ({ children }: { children: JSX.Element }) => {
  const { token, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="h-screen flex justify-center items-center bg-gray-50">
        <Spin size="large" tip="Đang nạp dữ liệu hệ thống..." />
      </div>
    );
  }
  
  return token ? children : <Navigate to="/login" replace />;
};

// --- COMPONENT ĐIỀU HƯỚNG THÔNG MINH (DASHBOARD GUARD) ---
const DashboardGuard = () => {
  const { user } = useAuth();
  
  // Lấy roleId chuẩn từ quan hệ Prisma
  const roleId = user?.role?.id || user?.roleId;

  // Nếu là ROLE-USER (Nhân viên thường), tự động đẩy sang trang Tin tức vì họ không có Dashboard thống kê
  if (roleId === 'ROLE-USER') {
    return <Navigate to="/posts" replace />;
  }
  
  return <Dashboard />;
};

const AppContent = () => {
  const { isDarkMode } = useTheme();

  return (
    <ConfigProvider
      theme={{
        algorithm: isDarkMode ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: { 
          colorPrimary: '#6366f1', 
          borderRadius: 8, 
          fontFamily: "'Inter', system-ui, sans-serif" 
        },
        components: {
          Layout: {
             bodyBg: isDarkMode ? '#111827' : '#f3f4f6', 
             headerBg: isDarkMode ? '#1f2937' : '#ffffff',
             siderBg: isDarkMode ? '#111827' : '#001529',
          },
          Card: { headerBg: 'transparent' }
        }
      }}
    >
      <AntdApp>
        <Routes>
          {/* 1. PUBLIC ROUTES */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />

          {/* 2. PROTECTED ROUTES (Yêu cầu đăng nhập) */}
          <Route path="/" element={<PrivateRoute><MainLayout /></PrivateRoute>}>
             
             {/* Trang chủ: Tự động phân luồng Dashboard hoặc Tin tức */}
             <Route index element={<DashboardGuard />} />

             {/* Trang tin tức: Mặc định ai đã login cũng xem được */}
             <Route path="posts" element={<PostPage />} />
             
             {/* Trang cá nhân */}
             <Route path="profile" element={<Profile />} /> 
             
             {/* --- PHÂN QUYỀN CHI TIẾT DỰA TRÊN PERMISSION --- */}

             {/* Quản lý nhân sự: Chỉ cần có quyền USER_VIEW là vào được, không quan trọng Role gì */}
             <Route element={<RoleRoute requiredPermission="USER_VIEW" />}>
                <Route path="admin/users" element={<UserManagement />} />
             </Route>

             {/* Quản lý phòng ban: Yêu cầu quyền DEPT_VIEW */}
             <Route element={<RoleRoute requiredPermission="DEPT_VIEW" />}>
                <Route path="admin/departments" element={<DepartmentManagement />} />
             </Route>

             {/* --- PHÂN QUYỀN DỰA TRÊN ROLE (Dành cho trang hệ thống nhạy cảm) --- */}
             <Route element={<RoleRoute allowedRoles={['ROLE-ADMIN']} />}>
                <Route path="admin/roles" element={<RoleManagement />} />
                <Route path="admin/menus" element={<MenuManagement />} />
             </Route>

             {/* Báo lỗi 404 trong Layout */}
             <Route path="*" element={<Navigate to="/" replace />} />
          </Route>

          {/* Báo lỗi 404 ngoài Layout */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AntdApp>
    </ConfigProvider>
  );
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
           <AppContent />
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;