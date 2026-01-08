import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useHasPermission } from '../hooks/useHasPermission'; // Sử dụng hook đã có
import { Result, Button } from 'antd';

interface RoleRouteProps {
  allowedRoles?: string[];      // Danh sách các Role được phép vào
  requiredPermission?: string; // HOẶC chỉ cần có quyền này là được vào
}

const RoleRoute: React.FC<RoleRouteProps> = ({ allowedRoles, requiredPermission }) => {
  const { user, token } = useAuth();
  const { hasPermission } = useHasPermission();

  // 1. Chưa đăng nhập -> Về Login
  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  // 2. Kiểm tra quyền (Ưu tiên kiểm tra Permission trước vì nó chi tiết hơn)
  const hasRequiredPermission = requiredPermission ? hasPermission(requiredPermission) : false;
  
  // 3. Kiểm tra Role
  const userRole = user.role?.id || '';
  const isAllowedRole = allowedRoles ? allowedRoles.includes(userRole) : false;

  // Nếu Admin tối cao thì luôn cho qua
  const isAdmin = userRole === 'ROLE-ADMIN';

  // 4. Logic "Vào cửa": Nếu là Admin HOẶC có Permission yêu cầu HOẶC thuộc Role cho phép
  if (isAdmin || hasRequiredPermission || isAllowedRole) {
    return <Outlet />;
  }

  // 5. Không thỏa mãn điều kiện nào -> Hiện trang 403
  return (
    <div className="flex h-screen justify-center items-center bg-gray-50">
      <Result
        status="403"
        title="403"
        subTitle="Xin lỗi, bạn không có quyền truy cập vào trang này."
        extra={<Button type="primary" onClick={() => window.location.href = "/"}>Về trang chủ</Button>}
      />
    </div>
  );
};

export default RoleRoute;