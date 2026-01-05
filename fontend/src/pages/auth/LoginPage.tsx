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
  const { login } = useAuth(); // Hàm login từ AuthContext

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      // 1. Gọi API đăng nhập
      const res = await axiosClient.post('/auth/login', {
        id: values.username, // Backend chờ 'id', frontend form name là 'username'
        password: values.password,
      });

      // 2. Xử lý kết quả thành công
      if (res.data.status === 'success') {
        const { token, data } = res.data;
        
        // --- QUAN TRỌNG: Lưu token và user info vào Context ---
        // Hàm login này sẽ lưu vào localStorage và set state user
        login(token, data.user); 

        message.success({ content: 'Đăng nhập thành công!', duration: 1 });

        // 3. Điều hướng
        if (data.requirePasswordChange) {
            // Nếu bắt buộc đổi mật khẩu -> Chuyển sang trang đổi pass (nếu có)
            // Tạm thời cho vào profile để đổi
            message.warning('Vui lòng đổi mật khẩu mới để bảo mật tài khoản.');
            navigate('/profile'); 
        } else {
            navigate('/');
        }
      }
    } catch (error: any) {
      // 4. Xử lý lỗi
      const msg = error.response?.data?.message || 'Đăng nhập thất bại';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout 
      title="Chào mừng trở lại!" 
      subtitle="Vui lòng nhập thông tin đăng nhập của bạn."
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
                placeholder="VD: ADMIN-01 hoặc NV001" 
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
              <Checkbox>Ghi nhớ đăng nhập</Checkbox>
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
                className="h-12 text-lg font-semibold"
                style={{ backgroundColor: '#6366f1', borderColor: '#6366f1' }}
            >
              Đăng nhập hệ thống
            </Button>
          </Form.Item>
        </Form>
    </AuthLayout>
  );
};

export default LoginPage;