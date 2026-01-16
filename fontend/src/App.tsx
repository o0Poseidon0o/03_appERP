import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ThemeProvider, useTheme } from "./contexts/ThemeContext";
import { Spin, ConfigProvider, theme, App as AntdApp } from "antd";
import type { JSX } from "react";

// --- IMPORT PAGES ---
// 1. Auth & Public
import LoginPage from "./pages/auth/LoginPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";

// 2. Layout & General
import MainLayout from "./layout/MainLayout";
import Profile from "./pages/Profile";
import Dashboard from "./pages/admin/Dashboard";
import PostPage from "./pages/admin/PostPage";

// 3. Admin System (Nhân sự & Phòng ban)
import UserManagement from "./pages/admin/UserManagement";
import DepartmentManagement from "./pages/department/DepartmentManagement";
import RoleManagement from "./pages/Role/RoleManagement";
import MenuManagement from "./pages/admin/MenuManagement";

// 4. Warehouse System (Kho & Nhà máy & Vật tư)
import ItemManagement from "./pages/warehouse/ItemManagement";
import CategoryManagement from "./pages/warehouse/CategoryManagement";
import SupplierPage from "./pages/warehouse/SupplierList";
import WarehouseManagement from "./pages/warehouse/WarehouseManagement"; // Đã gộp quản lý Nhà máy vào đây
import PendingApprovals from "./pages/warehouse/PendingApprovals";
import StockTransaction from "./pages/warehouse/StockTransaction";
import StockActual from "./pages/warehouse/StockActual";
// [MỚI] Import trang báo cáo tồn kho theo tháng
import MonthlyReport from "./pages/warehouse/MonthlyReport"; 

// 5. Security Component
import RoleRoute from "./components/RoleRoute";

// --- COMPONENTS BẢO VỆ ---

// Component chặn người chưa đăng nhập
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

// Component điều hướng Dashboard theo Role
const DashboardGuard = () => {
  const { user } = useAuth();
  const roleId = user?.role?.id || user?.roleId;

  // Nếu là User thường (hoặc KHO không có quyền quản trị hệ thống) -> Sang trang Tin tức
  if (roleId === "ROLE-USER") {
    return <Navigate to="/posts" replace />;
  }
  // Admin, Manager, Leader... vào Dashboard
  return <Dashboard />;
};

const AppContent = () => {
  const { isDarkMode } = useTheme();

  return (
    <ConfigProvider
      theme={{
        algorithm: isDarkMode ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: { 
          colorPrimary: "#6366f1", 
          borderRadius: 8, 
          fontFamily: "'Inter', system-ui, sans-serif" 
        },
        components: {
          Layout: {
            bodyBg: isDarkMode ? "#111827" : "#f3f4f6",
            headerBg: isDarkMode ? "#1f2937" : "#ffffff",
            siderBg: isDarkMode ? "#111827" : "#001529",
          },
          Card: { headerBg: "transparent" },
        },
      }}
    >
      <AntdApp>
        <Routes>
          {/* ========================================================= */}
          {/* 1. PUBLIC ROUTES (Không cần đăng nhập) */}
          {/* ========================================================= */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />

          {/* ========================================================= */}
          {/* 2. PROTECTED ROUTES (Phải đăng nhập) */}
          {/* ========================================================= */}
          <Route path="/" element={<PrivateRoute><MainLayout /></PrivateRoute>}>
            
            {/* Trang chủ: Tự động điều hướng dựa trên Role */}
            <Route index element={<DashboardGuard />} />
            
            {/* Các trang chung */}
            <Route path="posts" element={<PostPage />} />
            <Route path="profile" element={<Profile />} />

            {/* --- PHÂN QUYỀN (RBAC) --- */}

            {/* A. NHÂN SỰ: Cần quyền USER_VIEW (Admin/HR) */}
            <Route element={<RoleRoute requiredPermission="USER_VIEW" />}>
              <Route path="admin/users" element={<UserManagement />} />
            </Route>

            {/* B. PHÒNG BAN: Cần quyền DEPT_VIEW (Admin/HR) */}
            {/* User ROLE-KHO không vào được đây -> Bảo mật thông tin tổ chức */}
            <Route element={<RoleRoute requiredPermission="DEPT_VIEW" />}>
              <Route path="admin/departments" element={<DepartmentManagement />} />
            </Route>

            {/* C. HẠ TẦNG & KHO: Cần quyền WMS_VIEW (Admin/KHO/Leader) */}
            <Route element={<RoleRoute requiredPermission="WMS_VIEW" />}>
              <Route path="warehouse/locations" element={<WarehouseManagement />} /> 
              <Route path="warehouse/items" element={<ItemManagement />} />
              <Route path="warehouse/categories" element={<CategoryManagement />} />
              <Route path="warehouse/stock" element={<StockActual />} />
              <Route path="warehouse/suppliers" element={<SupplierPage />} />
              <Route path="warehouse/transactions" element={<StockTransaction />} />
              
              {/* [MỚI] Route Báo cáo tồn kho theo tháng (Xuất Excel) */}
              <Route path="warehouse/report/monthly" element={<MonthlyReport />} />
            </Route>

            {/* D. PHÊ DUYỆT PHIẾU: Cần quyền WMS_APPROVE (Leader/Manager) */}
            <Route element={<RoleRoute requiredPermission="WMS_APPROVE" />}>
              <Route path="warehouse/approvals" element={<PendingApprovals />} />
            </Route>

            {/* E. CẤU HÌNH HỆ THỐNG: Cần quyền ROLE_VIEW (Admin) */}
            <Route element={<RoleRoute requiredPermission="ROLE_VIEW" />}>
               <Route path="admin/roles" element={<RoleManagement />} />
            </Route>
            
            {/* F. QUẢN LÝ MENU (Admin tối cao) */}
            <Route element={<RoleRoute allowedRoles={["ROLE-ADMIN"]} />}>
               <Route path="admin/menus" element={<MenuManagement />} />
            </Route>

            {/* Route không tồn tại -> Quay về trang chủ */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
          
          {/* Route rác -> Login */}
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