import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { Spin, ConfigProvider, theme, App as AntdApp } from 'antd'; 

// Import Pages
import LoginPage from './pages/auth/LoginPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage'; 
import MainLayout from './layout/MainLayout';
import Profile from './pages/Profile';

// --- CÁC TRANG MỚI ---
import Dashboard from './pages/admin/Dashboard'; // Trang thống kê & soạn tin (Admin/Manager)
import PostPage from './pages/admin/PostPage';         // Trang xem tin (All Users)
import UserManagement from './pages/admin/UserManagement';
import DepartmentManagement from './pages/department/DepartmentManagement';
import RoleManagement from './pages/Role/RoleManagement';
import MenuManagement from './pages/admin/MenuManagement';
// Import Security
import RoleRoute from './components/RoleRoute';
import type { JSX } from 'react/jsx-dev-runtime';

const PrivateRoute = ({ children }: { children: JSX.Element }) => {
  const { token, isLoading } = useAuth();
  if (isLoading) return <div className="h-screen flex justify-center items-center"><Spin size="large"/></div>;
  return token ? children : <Navigate to="/login" />;
};

// --- COMPONENT BẢO VỆ DASHBOARD ---
// Logic: Admin/Manager -> Vào Dashboard. User -> Chuyển sang trang Tin tức
const DashboardGuard = () => {
  const { user } = useAuth();
  // Lấy roleId, nếu lỗi thì mặc định là User thường
  const role = user?.role?.id || 'ROLE-USER';

  // Nếu là User thường -> Đuổi sang trang /posts ngay lập tức
  if (role === 'ROLE-USER') {
    return <Navigate to="/posts" replace />;
  }
  
  // Nếu là Admin/Manager -> Cho vào Dashboard
  return <Dashboard />;
};

const AppContent = () => {
  const { isDarkMode } = useTheme();

  return (
    <ConfigProvider
      theme={{
        algorithm: isDarkMode ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: { colorPrimary: '#6366f1', borderRadius: 8, fontFamily: "'Inter', sans-serif" },
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
          {/* Public Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />

          {/* Protected Routes */}
          <Route path="/" element={<PrivateRoute><MainLayout /></PrivateRoute>}>
             
             {/* 1. TRANG CHỦ (Dashboard): Có phân luồng tự động */}
             <Route index element={<DashboardGuard />} />

             {/* 2. TRANG TIN TỨC: Ai cũng vào được */}
             <Route path="posts" element={<PostPage />} />
             
             <Route path="profile" element={<Profile />} /> 
             
             {/* NHÓM 3: TRANG NHÂN SỰ (Admin, Manager, User đều vào được - nhưng nút bấm sẽ khác) */}
             <Route element={<RoleRoute allowedRoles={['ROLE-ADMIN', 'ROLE-USER', 'ROLE-MANAGER']} />}>
                <Route path="admin/users" element={<UserManagement />} />
             </Route>

             {/* NHÓM 4: TRANG CẤU HÌNH (Chỉ Admin) */}
             <Route element={<RoleRoute allowedRoles={['ROLE-ADMIN']} />}>
                <Route path="admin/departments" element={<DepartmentManagement />} />
                <Route path="admin/roles" element={<RoleManagement />} />
                <Route path="admin/menus" element={<MenuManagement />} />
             </Route>

          </Route>
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