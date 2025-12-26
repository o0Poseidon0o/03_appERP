import React, { useState } from 'react';
import { Form, Input, Button, message, Alert } from 'antd';
import { MailOutlined, ArrowLeftOutlined, NumberOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import AuthLayout from '../layout/AuthLayout';

const ForgotPasswordPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false); // Trạng thái đã gửi mail thành công
  const navigate = useNavigate();

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      // Backend nhận vào 'id' (Mã nhân viên) để tìm email và gửi pass tạm
      await axiosClient.post('/auth/forgot-password', {
        id: values.userId,
      });

      setIsSuccess(true);
      message.success('Đã gửi mật khẩu tạm thời thành công!');
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Có lỗi xảy ra, vui lòng thử lại.';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // Nếu gửi thành công thì hiển thị màn hình thông báo
  if (isSuccess) {
    return (
      <AuthLayout 
        title="Kiểm tra email của bạn" 
        subtitle="Chúng tôi đã gửi mật khẩu tạm thời đến email đăng ký."
      >
        <div className="text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                 <MailOutlined className="text-3xl text-green-600" />
            </div>
            <Alert 
                message="Email đã được gửi!" 
                description="Vui lòng kiểm tra hộp thư (bao gồm cả thư mục Spam). Dùng mật khẩu tạm đó để đăng nhập lại."
                type="success" 
                showIcon 
                className="mb-6 text-left"
            />
            <Button 
                type="primary" 
                block 
                size="large"
                onClick={() => navigate('/login')}
                className="h-12"
            >
                Quay lại trang Đăng nhập
            </Button>
        </div>
      </AuthLayout>
    );
  }

  // Màn hình Form nhập ID
  return (
    <AuthLayout 
      title="Khôi phục mật khẩu" 
      subtitle="Nhập mã nhân viên của bạn để nhận mật khẩu tạm thời."
    >
        <Form 
            name="forgot-password" 
            onFinish={onFinish} 
            layout="vertical" 
            size="large"
        >
          <Form.Item
            label="Mã nhân viên"
            name="userId"
            rules={[{ required: true, message: 'Vui lòng nhập mã nhân viên!' }]}
          >
            <Input 
                prefix={<NumberOutlined className="text-gray-400 mr-2" />} 
                placeholder="VD: NV001" 
                className="py-3 rounded-lg"
            />
          </Form.Item>

          <Form.Item>
            <Button 
                type="primary" 
                htmlType="submit" 
                loading={loading} 
                block 
                className="h-12 font-semibold bg-indigo-600 hover:bg-indigo-500 shadow-md border-none rounded-lg"
            >
              Gửi yêu cầu
            </Button>
          </Form.Item>

          <div className="text-center mt-4">
            <Link to="/login" className="flex items-center justify-center gap-2 text-gray-500 hover:text-indigo-600 transition-colors">
                <ArrowLeftOutlined /> Quay lại đăng nhập
            </Link>
          </div>
        </Form>
    </AuthLayout>
  );
};

export default ForgotPasswordPage;