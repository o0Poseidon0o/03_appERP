import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ThemeProvider, useTheme } from "./contexts/ThemeContext";
import { Spin, ConfigProvider, theme, App as AntdApp } from "antd";

// Import Pages (Giữ nguyên)
import LoginPage from "./pages/auth/LoginPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import MainLayout from "./layout/MainLayout";
import Profile from "./pages/Profile";
import Dashboard from "./pages/admin/Dashboard";
import PostPage from "./pages/admin/PostPage";
import UserManagement from "./pages/admin/UserManagement";
import DepartmentManagement from "./pages/department/DepartmentManagement";
import RoleManagement from "./pages/Role/RoleManagement";
import MenuManagement from "./pages/admin/MenuManagement";
import ItemManagement from "./pages/warehouse/ItemManagement";
import CategoryManagement from "./pages/warehouse/CategoryManagement";
import SupplierPage from "./pages/warehouse/SupplierList";
import WarehouseManagement from "./pages/warehouse/WarehouseManagement";
import PendingApprovals from "./pages/warehouse/PendingApprovals";
import StockTransaction from "./pages/warehouse/StockTransaction";
import StockActual from "./pages/warehouse/StockActual";

// Import Security
import RoleRoute from "./components/RoleRoute";
import type { JSX } from "react";

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

const DashboardGuard = () => {
  const { user } = useAuth();
  const roleId = user?.role?.id || user?.roleId;
  if (roleId === "ROLE-USER") {
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
        token: { colorPrimary: "#6366f1", borderRadius: 8, fontFamily: "'Inter', system-ui, sans-serif" },
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
          {/* 1. PUBLIC ROUTES */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />

          {/* 2. PROTECTED ROUTES */}
          <Route path="/" element={<PrivateRoute><MainLayout /></PrivateRoute>}>
            <Route index element={<DashboardGuard />} />
            <Route path="posts" element={<PostPage />} />
            <Route path="profile" element={<Profile />} />

            {/* --- PHÂN QUYỀN THEO CSV --- */}

            {/* Nhân sự: USER_VIEW */}
            <Route element={<RoleRoute requiredPermission="USER_VIEW" />}>
              <Route path="admin/users" element={<UserManagement />} />
            </Route>

            {/* Phòng ban: DEPT_VIEW */}
            <Route element={<RoleRoute requiredPermission="DEPT_VIEW" />}>
              <Route path="admin/departments" element={<DepartmentManagement />} />
            </Route>

            {/* Quản lý Danh mục Kho:
                Trong CSV không có ITEM_VIEW, nhưng có WMS_VIEW cho hầu hết các vai trò liên quan kho.
                Dùng WMS_VIEW để cho phép truy cập trang danh sách.
                (Việc tạo/sửa/xóa sẽ được ẩn nút bên trong trang dựa trên ITEM_CREATE/UPDATE)
            */}
            <Route element={<RoleRoute requiredPermission="WMS_VIEW" />}>
              <Route path="warehouse/items" element={<ItemManagement />} />
              <Route path="warehouse/categories" element={<CategoryManagement />} />
              <Route path="warehouse/locations" element={<WarehouseManagement />} />
              <Route path="warehouse/stock" element={<StockActual />} />
              <Route path="/warehouse/suppliers" element={<SupplierPage />} />
              <Route path="warehouse/transactions" element={<StockTransaction />} />
            </Route>

            {/* Phê duyệt: WMS_APPROVE (Admin, Manager, Leader, User đều có trong CSV) */}
            <Route element={<RoleRoute requiredPermission="WMS_APPROVE" />}>
              <Route path="warehouse/approvals" element={<PendingApprovals />} />
            </Route>

            {/* Hệ thống Admin */}
            <Route element={<RoleRoute requiredPermission="ROLE_VIEW" />}>
               <Route path="admin/roles" element={<RoleManagement />} />
            </Route>
            
            {/* Menu Management - Thường cho Admin */}
            <Route element={<RoleRoute allowedRoles={["ROLE-ADMIN"]} />}>
               <Route path="admin/menus" element={<MenuManagement />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
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