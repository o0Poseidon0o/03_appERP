import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Result, Button } from 'antd';

interface RoleRouteProps {
  allowedRoles: string[]; 
}

const RoleRoute: React.FC<RoleRouteProps> = ({ allowedRoles }) => {
  const { user, token } = useAuth();

  // 1. Chưa đăng nhập -> Đá về Login
  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  // 2. Lấy Role ID an toàn
  // SỬA Ở ĐÂY: Bỏ 'user.roleId' đi nếu Interface chưa khai báo nó.
  // Chỉ cần lấy từ 'user.role?.id' là đủ và chuẩn nhất.
  const userRole = user.role?.id || 'ROLE-USER'; 

  // 3. Kiểm tra quyền vào cửa
  if (!allowedRoles.includes(userRole)) {
    return (
      <div className="flex h-screen justify-center items-center bg-gray-50">
        <Result
          status="403"
          title="403"
          subTitle="Xin lỗi, bạn không có quyền truy cập vào trang này."
          extra={<Button type="primary" href="/">Về trang chủ</Button>}
        />
      </div>
    );
  }

  // 4. Vào cửa thành công
  return <Outlet />;
};

export default RoleRoute;