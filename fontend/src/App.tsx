import { Suspense, lazy, type JSX } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ThemeProvider, useTheme } from "./contexts/ThemeContext";
// [MỚI] Import SocketProvider (Đảm bảo đường dẫn đúng với file bạn vừa tạo)
import { SocketProvider } from "./contexts/SocketContext"; 

import { Spin, ConfigProvider, theme, App as AntdApp } from "antd";

// Layout & Security Component (Core shell)
import MainLayout from "./layout/MainLayout";
import RoleRoute from "./components/RoleRoute";

// --- LAZY LOAD PAGES (Code Splitting tối ưu tốc độ tải Mobile / 4G) ---
// 1. Auth & Public
const LoginPage = lazy(() => import("./pages/auth/LoginPage"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage"));

// 2. General
const Profile = lazy(() => import("./pages/Profile"));
const Dashboard = lazy(() => import("./pages/admin/Dashboard"));
const PostPage = lazy(() => import("./pages/admin/PostPage"));

// 3. Admin System (Nhân sự & Phòng ban & Workflow)
const UserManagement = lazy(() => import("./pages/admin/UserManagement"));
const DepartmentManagement = lazy(() => import("./pages/department/DepartmentManagement"));
const RoleManagement = lazy(() => import("./pages/Role/RoleManagement"));
const MenuManagement = lazy(() => import("./pages/admin/MenuManagement"));
const WorkflowManagement = lazy(() => import("./pages/admin/WorkflowManagement"));

// 4. IT Asset Management (ITAM)
const AssetList = lazy(() => import("./pages/itam/AssetList"));
const DashboardItam = lazy(() => import("./pages/itam/Dashboard"));
const PeripheralList = lazy(() => import("./pages/itam/PeripheralList"));
const SoftwareInventory = lazy(() => import("./pages/itam/SoftwareInventory"));
const NetworkScanner = lazy(() => import("./pages/itam/NetworkScanner"));
const AssetQrPublicPage = lazy(() => import("./pages/itam/AssetQrPublicPage"));

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
  const location = useLocation(); // Lấy thông tin location hiện tại (chứa state từ Login)
  
  const roleId = user?.role?.id || user?.roleId;

  // Nếu là User thường -> Sang trang Tin tức
  if (roleId === "ROLE-USER") {
    // [SỬA QUAN TRỌNG]: Truyền lại state hiện tại sang trang mới
    return <Navigate to="/posts" replace state={location.state} />; 
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
        <Suspense
          fallback={
            <div className="h-[60vh] flex justify-center items-center">
              <Spin size="large" tip="Đang tải phân hệ..." />
            </div>
          }
        >
        <Routes>
          {/* ========================================================= */}
          {/* 1. PUBLIC ROUTES (Không cần đăng nhập) */}
          {/* ========================================================= */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/qr/asset/:code" element={<AssetQrPublicPage />} />

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
              <Route path="itam/software-inventory" element={<SoftwareInventory />} />
              <Route path="itam/software" element={<SoftwareInventory />} />
              <Route path="itam/network-scan" element={<NetworkScanner />} />
            </Route>

            {/* Route không tồn tại -> Quay về trang chủ */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>

          {/* Route rác -> Login */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
        </Suspense>
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