// src/pages/Profile.tsx
import React, { useState } from 'react';
import { 
  Card, Avatar, Tabs, Form, Input, Button, 
  Row, Col, Tag, theme, App 
} from 'antd';
import { 
  UserOutlined, LockOutlined, MailOutlined, 
  PhoneOutlined, SaveOutlined 
} from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import axiosClient from '../api/axiosClient';

// 1. Định nghĩa kiểu dữ liệu cho Form cập nhật thông tin
interface ProfileInfoValues {
  fullName: string;
  phone?: string;
}

// 2. Định nghĩa kiểu dữ liệu cho Form đổi mật khẩu
interface ChangePasswordValues {
  currentPassword: string;
  newPassword: string;
}

const Profile: React.FC = () => {
  const { user } = useAuth();
  const { token } = theme.useToken();
  const { message } = App.useApp(); 

  const [loading, setLoading] = useState(false);
  const [formInfo] = Form.useForm();
  const [formPassword] = Form.useForm();

  // --- 1. Xử lý cập nhật thông tin ---
  // Thay 'any' bằng 'ProfileInfoValues'
  const handleUpdateInfo = async (values: ProfileInfoValues) => {
    setLoading(true);
    try {
      await axiosClient.put('/users/profile', {
        fullName: values.fullName,
        phone: values.phone
      });
      
      message.success('Cập nhật thông tin thành công!');
      // Bạn có thể cần gọi hàm refreshUser() từ context nếu có
    } catch (error: unknown) { // Dùng 'unknown' thay vì 'any'
      // Ép kiểu error để lấy message an toàn
      const err = error as { response?: { data?: { message?: string } } };
      const errorMsg = err.response?.data?.message || 'Có lỗi xảy ra khi cập nhật';
      message.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // --- 2. Xử lý đổi mật khẩu ---
  // Thay 'any' bằng 'ChangePasswordValues'
  const handleChangePassword = async (values: ChangePasswordValues) => {
    setLoading(true);
    try {
      await axiosClient.post('/auth/change-password', {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword
      });

      message.success('Đổi mật khẩu thành công! Vui lòng đăng nhập lại.');
      formPassword.resetFields();
    } catch (error: unknown) { // Dùng 'unknown' thay vì 'any'
      const err = error as { response?: { data?: { message?: string } } };
      const errorMsg = err.response?.data?.message || 'Đổi mật khẩu thất bại';
      message.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const items = [
    {
      key: '1',
      label: 'Thông tin chung',
      children: (
        <Form
          layout="vertical"
          form={formInfo}
          initialValues={{
            fullName: user?.fullName,
            email: user?.email,
            phone: user?.phone,     
          }}
          onFinish={handleUpdateInfo}
        >
          <Row gutter={24}>
            <Col span={12} xs={24} md={12}>
              <Form.Item label="Họ và tên" name="fullName" rules={[{ required: true, message: 'Vui lòng nhập họ tên' }]}>
                <Input prefix={<UserOutlined />} placeholder="Nhập họ tên" />
              </Form.Item>
            </Col>
            <Col span={12} xs={24} md={12}>
              <Form.Item label="Số điện thoại" name="phone">
                <Input prefix={<PhoneOutlined />} placeholder="Nhập số điện thoại" />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label="Email" name="email">
                <Input prefix={<MailOutlined />} disabled className="bg-gray-100 dark:bg-gray-700 text-gray-500" />
                <span className="text-xs text-gray-400">Email không thể thay đổi</span>
              </Form.Item>
            </Col>
          </Row>
          <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={loading}>
            Lưu thay đổi
          </Button>
        </Form>
      ),
    },
    {
      key: '2',
      label: 'Đổi mật khẩu',
      children: (
        <Form layout="vertical" form={formPassword} onFinish={handleChangePassword}>
          <Form.Item
            label="Mật khẩu hiện tại"
            name="currentPassword"
            rules={[{ required: true, message: 'Vui lòng nhập mật khẩu hiện tại' }]}
          >
            <Input.Password prefix={<LockOutlined />} />
          </Form.Item>
          <Form.Item
            label="Mật khẩu mới"
            name="newPassword"
            rules={[
              { required: true, message: 'Vui lòng nhập mật khẩu mới' },
              { min: 6, message: 'Mật khẩu tối thiểu 6 ký tự' }
            ]}
          >
            <Input.Password prefix={<LockOutlined />} />
          </Form.Item>
          <Form.Item
            label="Xác nhận mật khẩu mới"
            name="confirmPassword"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: 'Vui lòng xác nhận lại mật khẩu' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('Mật khẩu xác nhận không khớp!'));
                },
              }),
            ]}
          >
            <Input.Password prefix={<LockOutlined />} />
          </Form.Item>
          <Button type="primary" danger htmlType="submit" loading={loading}>
            Cập nhật mật khẩu
          </Button>
        </Form>
      ),
    },
  ];

  return (
    <div className="max-w-5xl mx-auto">
      <h2 className="text-2xl font-bold mb-6" style={{ color: token.colorText }}>Thiết lập tài khoản</h2>
      <Row gutter={[24, 24]}>
        <Col xs={24} md={8}>
          <Card className="text-center shadow-sm" style={{ background: token.colorBgContainer }} bordered={false}>
            <div className="flex flex-col items-center py-4">
              <Avatar size={100} src={`https://ui-avatars.com/api/?name=${user?.fullName}&background=random&size=128`} className="mb-4" />
              <h3 className="text-xl font-bold" style={{ color: token.colorText }}>{user?.fullName}</h3>
              <p className="text-gray-500 mb-3">{user?.email}</p>
              <Tag color="blue">{user?.role?.name || 'User'}</Tag>
            </div>
          </Card>
        </Col>
        <Col xs={24} md={16}>
          <Card className="shadow-sm h-full" style={{ background: token.colorBgContainer }} bordered={false}>
            <Tabs defaultActiveKey="1" items={items} />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Profile;