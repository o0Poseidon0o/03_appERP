import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ThemeProvider, useTheme } from "./contexts/ThemeContext";
// [MỚI] Import SocketProvider (Đảm bảo đường dẫn đúng với file bạn vừa tạo)
import { SocketProvider } from "./contexts/SocketContext"; 

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

// 3. Admin System (Nhân sự & Phòng ban & Workflow)
import UserManagement from "./pages/admin/UserManagement";
import DepartmentManagement from "./pages/department/DepartmentManagement";
import RoleManagement from "./pages/Role/RoleManagement";
import MenuManagement from "./pages/admin/MenuManagement";
import WorkflowManagement from "./pages/admin/WorkflowManagement";

// 4. Warehouse System (Kho & Nhà máy & Vật tư)
import ItemManagement from "./pages/warehouse/ItemManagement";
import CategoryManagement from "./pages/warehouse/CategoryManagement";
import SupplierPage from "./pages/warehouse/SupplierList";
import WarehouseManagement from "./pages/warehouse/WarehouseManagement";
import PendingApprovals from "./pages/warehouse/PendingApprovals";
import StockTransaction from "./pages/warehouse/StockTransaction";
import StockActual from "./pages/warehouse/StockActual";
import MonthlyReport from "./pages/warehouse/MonthlyReport";

// 5. [NEW] IT Asset Management (ITAM)
import AssetList from "./pages/itam/AssetList";
// import AssetDetail from "./pages/itam/AssetDetail"; 
import DashboardItam from "./pages/itam/Dashboard";
import PeripheralList from "./pages/itam/PeripheralList";
import SoftwareInventory from "./pages/itam/SoftwareInventory";
// import AssetTypeManagement from "./pages/itam/AssetTypeManagement"; 

// 6. Security Component
import RoleRoute from "./components/RoleRoute";
import NetworkScanner from "./pages/itam/NetworkScanner";

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

  // Nếu là User thường -> Sang trang Tin tức
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
          fontFamily: "'Inter', system-ui, sans-serif",
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
          <Route
            path="/"
            element={
              <PrivateRoute>
                <MainLayout />
              </PrivateRoute>
            }
          >
            {/* Trang chủ: Tự động điều hướng dựa trên Role */}
            <Route index element={<DashboardGuard />} />

            {/* Các trang chung */}
            <Route path="posts" element={<PostPage />} />
            <Route path="profile" element={<Profile />} />

            {/* --- PHÂN QUYỀN (RBAC) --- */}

            {/* A. NHÂN SỰ: Cần quyền USER_VIEW */}
            <Route element={<RoleRoute requiredPermission="USER_VIEW" />}>
              <Route path="admin/users" element={<UserManagement />} />
            </Route>

            {/* B. PHÒNG BAN: Cần quyền DEPT_VIEW */}
            <Route element={<RoleRoute requiredPermission="DEPT_VIEW" />}>
              <Route
                path="admin/departments"
                element={<DepartmentManagement />}
              />
            </Route>

            {/* C. HẠ TẦNG & KHO: Cần quyền WMS_VIEW */}
            <Route element={<RoleRoute requiredPermission="WMS_VIEW" />}>
              <Route
                path="warehouse/locations"
                element={<WarehouseManagement />}
              />
              <Route path="warehouse/items" element={<ItemManagement />} />
              <Route
                path="warehouse/categories"
                element={<CategoryManagement />}
              />
              <Route path="warehouse/stock" element={<StockActual />} />
              <Route path="warehouse/suppliers" element={<SupplierPage />} />
              <Route
                path="warehouse/transactions"
                element={<StockTransaction />}
              />
              <Route
                path="warehouse/report/monthly"
                element={<MonthlyReport />}
              />
            </Route>

            {/* D. PHÊ DUYỆT PHIẾU: Cần quyền WMS_APPROVE */}
            <Route element={<RoleRoute requiredPermission="WMS_APPROVE" />}>
              <Route
                path="warehouse/approvals"
                element={<PendingApprovals />}
              />
            </Route>

            {/* ========================================================= */}
            {/* [NEW] E. QUẢN LÝ THIẾT BỊ (ITAM) - PHÂN QUYỀN CHUẨN */}
            {/* ========================================================= */}
            
            {/* 1. Nhóm Dashboard ITAM (Cần quyền ITAM_DASHBOARD) */}
            <Route element={<RoleRoute requiredPermission="ITAM_DASHBOARD" />}>
                 <Route path="itam/dashboard" element={<DashboardItam />} />
            </Route>

            {/* 2. Nhóm Danh sách Tài sản (Cần quyền ITAM_ASSET_VIEW) */}
            <Route element={<RoleRoute requiredPermission="ITAM_ASSET_VIEW" />}>
                 <Route path="itam" element={<AssetList />} />
                 {/* Route cho Ngoại vi (Màn hình, Chuột, Phím...) */}
                 <Route path="itam/peripherals" element={<PeripheralList />} />
                 {/* <Route path="assets/:id" element={<AssetDetail />} /> */}
                 <Route path="itam/software-inventory" element={<SoftwareInventory />} />
                 <Route path="itam/network-scan" element={<NetworkScanner />} />
            </Route>

            {/* 3. Nhóm Cấu hình Danh mục (Cần quyền ITAM_ASSET_CREATE) */}
            {/* Ví dụ trang quản lý Loại tài sản - Bật khi có trang AssetTypeManagement */}
            {/* <Route element={<RoleRoute requiredPermission="ITAM_ASSET_CREATE" />}>
                 <Route path="itam/types" element={<AssetTypeManagement />} />
            </Route> */}

            {/* ========================================================= */}

            {/* F. CẤU HÌNH HỆ THỐNG: Cần quyền ROLE_VIEW */}
            <Route element={<RoleRoute requiredPermission="ROLE_VIEW" />}>
              <Route path="admin/roles" element={<RoleManagement />} />
            </Route>

            {/* G. QUẢN LÝ MENU & WORKFLOW (Admin tối cao) */}
            <Route element={<RoleRoute allowedRoles={["ROLE-ADMIN"]} />}>
              <Route path="admin/menus" element={<MenuManagement />} />
              <Route path="admin/workflows" element={<WorkflowManagement />} />
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
          {/* [QUAN TRỌNG] Bọc SocketProvider ở đây để toàn bộ App dùng được Socket */}
          <SocketProvider>
             <AppContent />
          </SocketProvider>
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;