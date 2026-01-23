import React, { useState, useEffect } from 'react';
import { 
  Table, Card, Button, Input, Tag, Space, 
  Modal, Form, Select, Tooltip, Popconfirm, 
  App as AntdApp, Avatar, Divider, Checkbox, Tabs, Row, Col
} from 'antd';
import { 
  PlusOutlined, SearchOutlined, EditOutlined, 
  DeleteOutlined, ReloadOutlined, KeyOutlined, SafetyCertificateOutlined, UserOutlined,
  GlobalOutlined // Icon cho Nhà máy
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import axiosClient from '../../api/axiosClient';
import { useAuth } from '../../contexts/AuthContext';
import { useHasPermission } from '../../hooks/useHasPermission';

// --- INTERFACE ---
interface User {
  id: string;
  fullName: string;
  email: string;
  isActive: boolean;
  roleId: string;
  departmentId: string;
  factoryId?: string; // [NEW] Thêm trường này
  role?: { id: string; name: string; };
  department?: { name: string };
  factory?: { name: string }; // [NEW] Để hiển thị tên nhà máy
  userPermissions?: { permissionId: string }[];
}

interface PermissionItem {
  id: string;
  name: string;
  module: string;
}

const UserManagement: React.FC = () => {
  const { message } = AntdApp.useApp();
  const { user: currentUser } = useAuth();
  const { hasPermission } = useHasPermission();
  
  const canCreate = hasPermission('USER_CREATE'); 
  const canUpdate = hasPermission('USER_EDIT') || hasPermission('USER_UPDATE');
  const canDelete = hasPermission('USER_DELETE');

  // --- STATE ---
  const [users, setUsers] = useState<User[]>([]);
  const [rolesList, setRolesList] = useState<any[]>([]); 
  const [deptList, setDeptList] = useState<any[]>([]);
  const [factoryList, setFactoryList] = useState<any[]>([]); // [NEW] List nhà máy
  const [allPermissions, setAllPermissions] = useState<PermissionItem[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [searchText, setSearchText] = useState('');
  
  const [form] = Form.useForm();

  // --- API CALLS ---
  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [usersRes, rolesRes, deptsRes, factsRes, permsRes] = await Promise.all([
        axiosClient.get('/users'),
        axiosClient.get('/roles'),
        axiosClient.get('/departments'),
        axiosClient.get('/factories'), // [NEW] API lấy danh sách nhà máy
        axiosClient.get('/users/permissions/all').catch(() => ({ data: { data: [] } }))
      ]);

      setUsers(usersRes.data?.data || usersRes.data || []);
      setRolesList(rolesRes.data?.data || rolesRes.data || []); 
      setDeptList(deptsRes.data?.data || deptsRes.data || []);
      setFactoryList(factsRes.data?.data || factsRes.data || []); // [NEW]
      setAllPermissions(permsRes.data?.data || permsRes.data || []);
    } catch (error: any) {
      message.error('Không thể tải dữ liệu hệ thống.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  const handleEdit = (record: User) => {
    setEditingUser(record);
    form.setFieldsValue({
      id: record.id,
      fullName: record.fullName,
      email: record.email,
      roleId: record.roleId, 
      departmentId: record.departmentId,
      factoryId: record.factoryId, // [NEW] Load factoryId lên form
      isActive: record.isActive,
      password: '' 
    });
    const currentPerms = record.userPermissions?.map(p => p.permissionId) || [];
    setSelectedPermissions(currentPerms);
    setIsModalOpen(true);
  };

  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      if (editingUser) {
        await axiosClient.patch(`/users/${editingUser.id}`, values);
        await axiosClient.patch(`/users/${editingUser.id}/permissions`, {
          permissionIds: selectedPermissions
        });
        message.success('Cập nhật nhân sự thành công');
      } else {
        await axiosClient.post('/users', values);
        message.success('Thêm mới thành công');
      }
      setIsModalOpen(false);
      fetchInitialData();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Thao tác thất bại');
    } finally {
      setLoading(false);
    }
  };

  const groupedPermissions = allPermissions.reduce((acc, curr) => {
    const moduleName = curr.module || 'KHÁC';
    if (!acc[moduleName]) acc[moduleName] = [];
    acc[moduleName].push(curr);
    return acc;
  }, {} as Record<string, PermissionItem[]>);

  const columns: ColumnsType<User> = [
    {
      title: 'Mã NV',
      dataIndex: 'id',
      key: 'id',
      width: 100,
      render: (text) => <span className="font-mono font-medium text-blue-600">{text}</span>
    },
    {
      title: 'Nhân sự',
      key: 'info',
      render: (_, record) => (
        <Space>
           <Avatar src={`https://ui-avatars.com/api/?name=${record.fullName}&background=random&color=fff`} />
           <div className="flex flex-col">
              <span className="font-semibold text-slate-700">{record.fullName}</span>
              <span className="text-xs text-slate-400">{record.email}</span>
           </div>
        </Space>
      ),
    },
    {
        title: 'Khu vực làm việc', // [NEW] Cột mới để hiển thị Nhà máy
        key: 'factory',
        render: (_, record) => (
            <Space direction="vertical" size={0}>
                {record.factory ? (
                    <Tag icon={<GlobalOutlined />} color="geekblue">{record.factory.name}</Tag>
                ) : <span className="text-xs text-gray-400 italic">Chưa gán</span>}
                <span className="text-xs text-gray-500">{record.department?.name}</span>
            </Space>
        )
    },
    {
      title: 'Vai trò',
      dataIndex: ['role', 'name'],
      render: (text: string, record) => (
        <Space direction="vertical" size={0}>
          <Tag icon={<SafetyCertificateOutlined />} color={text?.includes('Admin') ? 'volcano' : 'cyan'}>
            {text?.toUpperCase() || 'USER'}
          </Tag>
          {record.userPermissions && record.userPermissions.length > 0 && (
            <Tag color="orange" style={{ marginTop: 4, fontSize: '10px' }}>+{record.userPermissions.length} quyền riêng</Tag>
          )}
        </Space>
      )
    },
    {
      title: 'Trạng thái',
      dataIndex: 'isActive',
      render: (active: boolean) => (
        <Tag color={active ? 'success' : 'default'}>{active ? 'Hoạt động' : 'Tạm khóa'}</Tag>
      )
    },
    {
      title: 'Thao tác',
      key: 'action',
      align: 'center',
      render: (_, record) => (
        <Space size="middle">
          {canUpdate && (
             <Tooltip title="Chỉnh sửa thông tin & quyền hạn">
                <Button type="text" className="text-blue-600" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
             </Tooltip>
          )}
          {canDelete && record.id !== 'ADMIN-01' && record.id !== currentUser?.id && (
            <Popconfirm title="Xóa nhân sự này?" onConfirm={() => axiosClient.delete(`/users/${record.id}`).then(() => fetchInitialData())}>
                <Button type="text" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '20px', background: '#f8fafc', minHeight: '100vh' }}>
      <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-slate-800">Quản lý Nhân sự</h2>
          {canCreate && (
              <Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => { setEditingUser(null); form.resetFields(); setSelectedPermissions([]); setIsModalOpen(true); }}>
                Thêm nhân sự
              </Button>
          )}
      </div>

      <Card bordered={false} className="shadow-sm border-none rounded-xl">
        <div className="flex justify-between items-center mb-5">
             <Input 
                placeholder="Tìm tên hoặc mã NV..." 
                prefix={<SearchOutlined className="text-slate-400" />} 
                style={{ width: 300 }}
                onChange={e => setSearchText(e.target.value)}
             />
             <Button icon={<ReloadOutlined />} onClick={fetchInitialData}>Làm mới</Button>
        </div>

        <Table 
          columns={columns} 
          dataSource={users.filter(u => u.fullName.toLowerCase().includes(searchText.toLowerCase()) || u.id.toLowerCase().includes(searchText.toLowerCase()))} 
          rowKey="id" 
          loading={loading} 
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title={editingUser ? `Chỉnh sửa: ${editingUser.fullName}` : "Thêm nhân viên mới"}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={loading}
        width={750}
        okText="Lưu dữ liệu"
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Tabs defaultActiveKey="1" items={[
            {
              key: '1',
              label: <span><UserOutlined /> Thông tin chính</span>,
              children: (
                <div style={{ padding: '10px 0' }}>
                  <Row gutter={16}>
                    <Col span={12}><Form.Item name="id" label="Mã NV" rules={[{ required: true }]}><Input disabled={!!editingUser} /></Form.Item></Col>
                    <Col span={12}><Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}><Input disabled={!!editingUser} /></Form.Item></Col>
                  </Row>
                  <Form.Item name="fullName" label="Họ tên" rules={[{ required: true }]}><Input /></Form.Item>
                  <Form.Item name="password" label="Mật khẩu"><Input.Password placeholder={editingUser ? "Để trống nếu không đổi" : "Nhập mật khẩu"} /></Form.Item>
                  
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item name="departmentId" label="Phòng ban (Chấm công/Lương)" rules={[{ required: true }]}>
                        <Select options={deptList.map(d => ({ label: d.name, value: d.id }))} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="roleId" label="Vai trò (Chức năng)" rules={[{ required: true }]}>
                        <Select options={rolesList.map(r => ({ label: r.name, value: r.id }))} />
                      </Form.Item>
                    </Col>
                  </Row>

                  {/* [NEW] DROPDOWN CHỌN NHÀ MÁY */}
                  <Form.Item 
                    name="factoryId" 
                    label={
                        <Space>
                            <GlobalOutlined className="text-blue-500" /> 
                            <span>Nhà máy / Kho làm việc (Quan trọng cho duyệt phiếu)</span>
                        </Space>
                    }
                    extra="Chọn nhà máy mà nhân viên này thực tế đang làm việc. Các phiếu kho sẽ được lọc theo nhà máy này."
                  >
                    <Select 
                        allowClear 
                        placeholder="Chọn nhà máy..." 
                        options={factoryList.map(f => ({ label: f.name, value: f.id }))} 
                    />
                  </Form.Item>

                  <Form.Item name="isActive" label="Trạng thái" valuePropName="value" initialValue={true}>
                    <Select options={[{label: 'Hoạt động', value: true}, {label: 'Khóa', value: false}]} />
                  </Form.Item>
                </div>
              )
            },
            {
              key: '2',
              label: <span><KeyOutlined /> Quyền ngoại lệ</span>,
              disabled: !editingUser,
              children: (
                <div style={{ padding: '10px 0', maxHeight: '400px', overflowY: 'auto' }}>
                  <div style={{ marginBottom: 16, padding: '8px 12px', background: '#fff7ed', borderRadius: 6, color: '#9a3412', fontSize: '12px', border: '1px solid #ffedd5' }}>
                    Quyền được chọn tại đây sẽ được <b>cộng dồn</b> vào quyền của Vai trò hiện tại.
                  </div>
                  <Checkbox.Group 
                    style={{ width: '100%' }} 
                    value={selectedPermissions} 
                    onChange={list => setSelectedPermissions(list as string[])}
                  >
                    {Object.entries(groupedPermissions).map(([module, perms]) => (
                      <div key={module} style={{ marginBottom: 16 }}>
                        <Divider orientation={"left" as any} plain>
                          <span style={{ color: '#1d4ed8', fontWeight: 'bold', fontSize: '11px' }}>{module.toUpperCase()}</span>
                        </Divider>
                        <Row gutter={[16, 8]}>
                          {perms.map(p => (
                            <Col span={12} key={p.id}>
                              <Checkbox value={p.id}>{p.name}</Checkbox>
                            </Col>
                          ))}
                        </Row>
                      </div>
                    ))}
                  </Checkbox.Group>
                </div>
              )
            }
          ]} />
        </Form>
      </Modal>
    </div>
  );
};

export default UserManagement;