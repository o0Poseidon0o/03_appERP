import React, { useState } from 'react';
import { Form, Input, Button, Checkbox, App } from 'antd'; // Thêm App từ antd
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate, Link } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import { useAuth } from '../../contexts/AuthContext';
import AuthLayout from '../../layout/AuthLayout';

const LoginPage: React.FC = () => {
  // SỬA TẠI ĐÂY: Dùng hook này để hết lỗi Warning static function
  const { message } = App.useApp(); 
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      const res = await axiosClient.post('/auth/login', {
        id: values.username,
        password: values.password,
      });

      console.log("Phản hồi thành công:", res.data);

      if (res.data.status === 'success') {
        const { token, data } = res.data;
        
        // Lưu dữ liệu vào Context & LocalStorage
        login(token, data.user); 

        message.success('Đăng nhập thành công!');

        if (data.requirePasswordChange) {
            message.warning('Vui lòng đổi mật khẩu mới.');
            navigate('/profile'); 
        } else {
            navigate('/');
        }
      }
    } catch (error: any) {
      console.error("Lỗi Login thực tế:", error);
      const msg = error.response?.data?.message || 'Không thể kết nối tới máy chủ (500)';
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
                placeholder="VD: NV001" 
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
                className="h-12 text-lg font-semibold bg-indigo-600 border-none rounded-lg"
            >
              Đăng nhập hệ thống
            </Button>
          </Form.Item>
        </Form>
    </AuthLayout>
  );
};

export default LoginPage;