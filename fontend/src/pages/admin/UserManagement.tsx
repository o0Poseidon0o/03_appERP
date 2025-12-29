import React, { useState, useEffect } from 'react';
import { 
  Table, Card, Button, Input, Tag, Space, 
  Modal, Form, Select, Tooltip, Popconfirm, 
  App as AntdApp, Avatar 
} from 'antd';
import { 
  PlusOutlined, SearchOutlined, EditOutlined, 
  DeleteOutlined, ReloadOutlined} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import axiosClient from '../../api/axiosClient';
import { useAuth } from '../../contexts/AuthContext';

// --- INTERFACE ---
interface PermissionItem {
  permission: {
    id: string;
    name: string;
  };
}

interface User {
  id: string;
  fullName: string;
  email: string;
  isActive: boolean;
  roleId: string;
  departmentId: string;
  role?: { 
    id: string;
    name: string; 
    permissions?: PermissionItem[];
  };
  department?: { name: string };
}

interface OptionItem {
  id: string;
  name: string;
}

const UserManagement: React.FC = () => {
  const { message } = AntdApp.useApp();
  const { user } = useAuth();
  
  // --- 1. LOGIC PHÂN QUYỀN ---
  const isAdmin = user?.role?.id === 'ROLE-ADMIN';
  const myPermissions = user?.role?.permissions?.map((p: PermissionItem) => p.permission.id) || [];

  const canCreate = isAdmin; 
  const canUpdate = isAdmin || myPermissions.includes('USER_UPDATE');
  const canDelete = isAdmin || myPermissions.includes('USER_DELETE');

  // --- STATE ---
  const [users, setUsers] = useState<User[]>([]);
  const [rolesList, setRolesList] = useState<OptionItem[]>([]); 
  const [deptList, setDeptList] = useState<OptionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [searchText, setSearchText] = useState('');
  
  const [form] = Form.useForm();

  // --- API CALLS ---
  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [usersRes, rolesRes, deptsRes] = await Promise.all([
        axiosClient.get('/users'),
        axiosClient.get('/roles'),
        axiosClient.get('/departments')
      ]);
      setUsers(usersRes.data.data || usersRes.data || []);
      setRolesList(rolesRes.data.data || rolesRes.data || []); 
      setDeptList(deptsRes.data.data || deptsRes.data || []);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error: any) {
      message.error('Lỗi kết nối server.');
    } finally {
      setLoading(false);
    }
  };

  const refreshUsers = async () => {
    try {
      setLoading(true);
      const res = await axiosClient.get('/users');
      setUsers(res.data.data || res.data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAllData();
  }, []);

  // --- HANDLERS ---
  const handleAddNew = () => {
    setEditingUser(null);
    form.resetFields();
    form.setFieldsValue({
      isActive: true,
      roleId: rolesList.length > 0 ? rolesList[0].id : undefined, 
      departmentId: deptList.length > 0 ? deptList[0].id : undefined
    });
    setIsModalOpen(true);
  };

  const handleEdit = (record: User) => {
    setEditingUser(record);
    form.resetFields(); 
    form.setFieldsValue({
      id: record.id,
      fullName: record.fullName,
      email: record.email,
      roleId: record.roleId, 
      departmentId: record.departmentId,
      isActive: record.isActive,
      password: '' // Luôn để trống password khi mở modal edit
    });
    setIsModalOpen(true);
  };

  const handleCancel = () => {
    setIsModalOpen(false);
    form.resetFields(); 
  };

  const handleSubmit = async (values: Record<string, any>) => {
    setLoading(true);
    try {
      // Xử lý giá trị password: nếu edit và password trống thì xóa khỏi payload để backend không update
      const payload = { ...values };
      if (editingUser && (!payload.password || payload.password.trim() === '')) {
        delete payload.password;
      }

      if (editingUser) {
        await axiosClient.patch(`/users/${editingUser.id}`, payload);
        message.success('Cập nhật thông tin nhân sự thành công!');
      } else {
        await axiosClient.post('/users', payload);
        message.success('Thêm nhân sự mới thành công!');
      }
      setIsModalOpen(false);
      form.resetFields();
      refreshUsers();
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Có lỗi xảy ra';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await axiosClient.delete(`/users/${id}`);
      message.success('Đã xóa nhân sự');
      refreshUsers();
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Không thể xóa';
      message.error(msg);
    }
  };

  // --- TABLE COLUMNS ---
  const columns: ColumnsType<User> = [
    {
      title: 'Mã NV',
      dataIndex: 'id',
      key: 'id',
      width: 100,
      render: (text) => <Tag color="blue">{text}</Tag>
    },
    {
      title: 'Nhân sự',
      key: 'info',
      render: (_, record) => (
        <div className="flex items-center gap-3">
           <Avatar src={`https://ui-avatars.com/api/?name=${record.fullName}&background=random`} />
           <div className="flex flex-col">
              <span className="font-semibold">{record.fullName}</span>
              <span className="text-xs text-gray-500">{record.email}</span>
           </div>
        </div>
      ),
      filteredValue: searchText ? [searchText] : null,
      onFilter: (value, record) => 
        record.fullName.toLowerCase().includes(String(value).toLowerCase()) || 
        record.id.toLowerCase().includes(String(value).toLowerCase())
    },
    {
      title: 'Phòng ban',
      dataIndex: ['department', 'name'],
      key: 'dept',
      render: (text) => <Tag>{text || 'Chưa phân bổ'}</Tag>
    },
    {
      title: 'Vai trò',
      dataIndex: ['role', 'name'],
      key: 'role',
      render: (text: string) => {
        const color = text?.toLowerCase().includes('admin') ? 'geekblue' : 'green';
        return <Tag color={color}>{text || 'User'}</Tag>;
      }
    },
    {
      title: 'Trạng thái',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (active: boolean) => (
        <Tag color={active ? 'success' : 'error'}>
            {active ? 'Hoạt động' : 'Đã khóa'}
        </Tag>
      )
    },
    {
      title: 'Hành động',
      key: 'action',
      render: (_, record) => (
        <Space>
          {canUpdate ? (
             <Tooltip title="Chỉnh sửa & Đổi mật khẩu">
                <Button type="text" icon={<EditOutlined className="text-indigo-600" />} onClick={() => handleEdit(record)} />
             </Tooltip>
          ) : <Button type="text" disabled icon={<EditOutlined />} />}
          
          {canDelete && record.id !== 'ADMIN-01' && (
            <Tooltip title="Xóa nhân sự">
                <Popconfirm title="Xóa?" onConfirm={() => handleDelete(record.id)} okButtonProps={{ danger: true }}>
                   <Button type="text" danger icon={<DeleteOutlined />} />
                </Popconfirm>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ minHeight: '100%' }}>
      <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Quản lý Nhân sự</h2>
          {canCreate && (
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAddNew}>Thêm nhân sự</Button>
          )}
      </div>

      <Card bordered={false} className="shadow-sm rounded-lg">
        <div className="flex justify-between mb-4">
             <Input 
                placeholder="Tìm theo Tên, Email, Mã..." 
                prefix={<SearchOutlined />} 
                className="max-w-xs"
                onChange={e => setSearchText(e.target.value)}
                allowClear
             />
             <Button icon={<ReloadOutlined />} onClick={refreshUsers}>Làm mới</Button>
        </div>
        <Table columns={columns} dataSource={users} rowKey="id" loading={loading} pagination={{ pageSize: 8 }} />
      </Card>

      <Modal
        title={editingUser ? `Chỉnh sửa nhân sự: ${editingUser.fullName}` : "Thêm nhân viên mới"}
        open={isModalOpen}
        onCancel={handleCancel}
        footer={null}
        maskClosable={false}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <div className="grid grid-cols-2 gap-4">
              <Form.Item name="id" label="Mã NV" rules={[{ required: !editingUser, message: 'Nhập mã NV' }]}><Input disabled={!!editingUser} /></Form.Item>
              <Form.Item name="email" label="Email" rules={[{ required: !editingUser, type: 'email', message: 'Nhập email hợp lệ' }]}><Input disabled={!!editingUser} /></Form.Item>
          </div>
          
          <Form.Item name="fullName" label="Họ tên" rules={[{ required: true, message: 'Nhập họ tên' }]}><Input /></Form.Item>
          
          {/* Ô MẬT KHẨU: Required khi tạo mới, Optional khi edit */}
          <Form.Item 
            name="password" 
            label={editingUser ? "Mật khẩu mới (Để trống nếu không đổi)" : "Mật khẩu"} 
            rules={[
              { required: !editingUser, message: 'Vui lòng nhập mật khẩu' },
              { min: 6, message: 'Tối thiểu 6 ký tự' }
            ]}
          >
            <Input.Password placeholder={editingUser ? "Nhập để thay đổi mật khẩu" : "Mật khẩu ban đầu"} />
          </Form.Item>
          
          <div className="grid grid-cols-2 gap-4">
             <Form.Item name="departmentId" label="Phòng ban" rules={[{ required: true }]}>
                <Select>
                   {deptList.map(d => <Select.Option key={d.id} value={d.id}>{d.name}</Select.Option>)}
                </Select>
             </Form.Item>
             <Form.Item name="roleId" label="Phân quyền" rules={[{ required: true }]}>
                <Select>
                   {rolesList.map(r => <Select.Option key={r.id} value={r.id}>{r.name}</Select.Option>)}
                </Select>
             </Form.Item>
          </div>

          <Form.Item name="isActive" label="Trạng thái" valuePropName="value">
             <Select>
                <Select.Option value={true}><Tag color="success">Hoạt động</Tag></Select.Option>
                <Select.Option value={false}><Tag color="error">Đã khóa</Tag></Select.Option>
             </Select>
          </Form.Item>

          <div className="flex justify-end gap-3 mt-6 border-t pt-4">
            <Button onClick={handleCancel}>Hủy</Button>
            <Button type="primary" htmlType="submit" loading={loading}>
              {editingUser ? 'Lưu thay đổi' : 'Tạo nhân sự'}
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default UserManagement;