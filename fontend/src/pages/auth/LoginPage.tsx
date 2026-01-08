import React, { useState } from 'react';
import { Form, Input, Button, message, Checkbox } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate, Link } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import { useAuth } from '../../contexts/AuthContext';
import AuthLayout from '../../layout/AuthLayout';

const LoginPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      // 1. Gọi API đăng nhập - Backend nhận 'id'
      const res = await axiosClient.post('/auth/login', {
        id: values.username, 
        password: values.password,
      });

      if (res.data.status === 'success') {
        const { token, data } = res.data;
        
        // --- ĐIỂM CẬP NHẬT ---
        // Hàm login(token, user) trong AuthContext sẽ tự động bóc tách 
        // permissions và lưu vào LocalStorage nhờ logic chúng ta vừa sửa.
        login(token, data.user); 

        message.success({ 
          content: 'Đăng nhập thành công!', 
          duration: 1.5 
        });

        // 3. Điều hướng dựa trên trạng thái tài khoản
        // Kiểm tra mustChangePassword từ dữ liệu user hoặc requirePasswordChange từ res
        if (data.requirePasswordChange || data.user.mustChangePassword) {
            message.warning('Đây là mật khẩu tạm, vui lòng đổi mật khẩu mới.');
            navigate('/profile'); 
        } else {
            // Nếu là Admin/Manager thì về Dashboard, nếu là User thường thì về Posts
            const roleId = data.user.roleId || data.user.role?.id;
            if (roleId === 'ROLE-USER') {
              navigate('/posts');
            } else {
              navigate('/');
            }
        }
      }
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Đăng nhập thất bại. Vui lòng kiểm tra lại!';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout 
      title="Chào mừng trở lại!" 
      subtitle="Hệ thống quản trị nội bộ Towa ERP"
    >
        <Form 
            name="login" 
            onFinish={onFinish} 
            layout="vertical" 
            size="large"
            initialValues={{ remember: true }}
        >
          <Form.Item
            label={<span className="font-medium">Mã nhân viên</span>}
            name="username"
            rules={[{ required: true, message: 'Vui lòng nhập mã nhân viên!' }]}
          >
            <Input 
                prefix={<UserOutlined className="text-gray-400 mr-2" />} 
                placeholder="Nhập mã nhân viên (VD: NV001)" 
                className="py-3 rounded-lg"
            />
          </Form.Item>

          <Form.Item
            label={<span className="font-medium">Mật khẩu</span>}
            name="password"
            rules={[{ required: true, message: 'Vui lòng nhập mật khẩu!' }]}
          >
            <Input.Password 
                prefix={<LockOutlined className="text-gray-400 mr-2" />} 
                placeholder="••••••••" 
                className="py-3 rounded-lg"
            />
          </Form.Item>

          <div className="flex justify-between items-center mb-6">
            <Form.Item name="remember" valuePropName="checked" noStyle>
              <Checkbox>Ghi nhớ tôi</Checkbox>
            </Form.Item>
            <Link to="/forgot-password" style={{ color: '#6366f1', fontWeight: 500 }}>
              Quên mật khẩu?
            </Link>
          </div>

          <Form.Item>
            <Button 
                type="primary" 
                htmlType="submit" 
                loading={loading} 
                block 
                className="h-12 text-lg font-semibold shadow-md"
                style={{ backgroundColor: '#6366f1', borderColor: '#6366f1' }}
            >
              ĐĂNG NHẬP
            </Button>
          </Form.Item>
        </Form>
    </AuthLayout>
  );
};

export default LoginPage;