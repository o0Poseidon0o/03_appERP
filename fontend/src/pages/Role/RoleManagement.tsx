import React, { useState, useEffect } from 'react';
import { 
  Card, List, Checkbox, Button, 
  App as AntdApp, Empty, 
  Tag, Modal, Form, Input 
} from 'antd';
import { 
  SafetyCertificateOutlined, PlusOutlined, 
  SaveOutlined
} from '@ant-design/icons';
import axiosClient from '../../api/axiosClient'; 

// 1. Định nghĩa các Interface cụ thể để thay thế 'any'
interface Permission {
  id: string;
  name: string;
  module: string;
}

// Cấu trúc quan hệ lồng nhau từ API trả về
interface RolePermissionRelation {
  permission: {
    id: string;
    name?: string;
    module?: string;
  };
}

interface Role {
  id: string;
  name: string;
  description?: string;
  // Dùng cấu trúc cụ thể thay cho any[]
  permissions: RolePermissionRelation[]; 
  permissionIds: string[];
  userCount: number;
}

// Interface cho dữ liệu thô từ API
interface RoleApiResponse {
  id: string;
  name: string;
  description?: string;
  permissions: RolePermissionRelation[];
  _count?: { users: number };
}

const RoleManagement: React.FC = () => {
  // Sửa lỗi 'any' cho messageApi bằng cách dùng unknown và type casting
  let messageApi: { success: (content: string) => void; error: (content: string) => void } | null = null;
  try {
     const app = AntdApp.useApp();
     messageApi = app.message;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (e) {
     console.warn("Chưa bọc <App> của Antd, dùng console.log thay thế");
  }

  const showMsg = (type: 'success' | 'error', content: string) => {
      if(messageApi && messageApi[type]) messageApi[type](content);
      else console.log(`[${type.toUpperCase()}] ${content}`);
  };
  
  const [roles, setRoles] = useState<Role[]>([]);
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [rolesRes, permsRes] = await Promise.all([
        axiosClient.get('/roles'),
        axiosClient.get('/roles/permissions') 
      ]);

      const rawPerms = permsRes.data?.data || permsRes.data || [];
      setAllPermissions(Array.isArray(rawPerms) ? rawPerms : []);

      const rawRoles = rolesRes.data?.data || rolesRes.data || [];
      if (Array.isArray(rawRoles)) {
          // GIỮ NGUYÊN LOGIC MAP DỮ LIỆU CỦA BẠN
          const safeRoles = rawRoles.map((r: RoleApiResponse) => {
              let pIds: string[] = [];
              if (Array.isArray(r.permissions)) {
                  pIds = r.permissions
                    .map((p) => p?.permission?.id)
                    .filter((id): id is string => !!id); // Type guard để lọc id
              }
              return {
                  ...r,
                  permissionIds: pIds,
                  userCount: r._count?.users || 0
              };
          });
          setRoles(safeRoles);

          if (safeRoles.length > 0 && !selectedRole) {
              setSelectedRole(safeRoles[0]);
          }
      }
    } catch (error) {
      console.error("--- LỖI FETCH DATA ---", error);
      showMsg('error', 'Lỗi tải dữ liệu');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const groupedPermissions = allPermissions.reduce((acc, curr) => {
    if (!curr) return acc;
    const mod = curr.module || 'KHÁC';
    if (!acc[mod]) acc[mod] = [];
    acc[mod].push(curr);
    return acc;
  }, {} as Record<string, Permission[]>);

  const handleSelectRole = (role: Role) => setSelectedRole(role);

  // Thay any[] bằng (string | number | boolean)[] - kiểu mặc định của Checkbox.Group Antd
  const handlePermissionChange = (checkedValues: (string | number | boolean)[]) => {
    if (!selectedRole) return;
    const updated = { ...selectedRole, permissionIds: checkedValues as string[] };
    setSelectedRole(updated);
    setRoles(prev => prev.map(r => r.id === updated.id ? updated : r));
  };

  const handleSave = async () => {
    if (!selectedRole) return;
    setSaving(true);
    try {
      await axiosClient.patch(`/roles/${selectedRole.id}`, {
        name: selectedRole.name,
        description: selectedRole.description,
        permissionIds: selectedRole.permissionIds
      });
      showMsg('success', 'Đã lưu thành công!');
    } catch (error) {
      console.error(error);
      showMsg('error', 'Lỗi khi lưu');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateRole = async (values: { id: string, name: string }) => {
      try {
          await axiosClient.post('/roles', { ...values, permissionIds: [] });
          showMsg('success', 'Tạo thành công');
          setIsModalOpen(false);
          fetchData();
      } catch (err) { console.error(err); }
  };

  return (
    <div style={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginBottom: 16 }}>
        <h2 className="text-2xl font-bold flex items-center gap-2">
            <SafetyCertificateOutlined /> Phân quyền hệ thống {loading && "(Đang tải...)"}
        </h2>
      </div>

      <div style={{ display: 'flex', gap: 24, flex: 1, minHeight: 0 }}>
        {/* CỘT TRÁI */}
        <div style={{ width: '25%', display: 'flex', flexDirection: 'column' }}>
          <Card 
            title="Vai trò" 
            extra={<Button onClick={() => setIsModalOpen(true)} icon={<PlusOutlined />}>Thêm</Button>} 
            style={{ height: '100%' }} 
            styles={{ body: { overflowY: 'auto' } }}
          >
             <List
                dataSource={roles}
                renderItem={(item) => (
                    <List.Item 
                        onClick={() => handleSelectRole(item)}
                        style={{ 
                            cursor: 'pointer', 
                            background: selectedRole?.id === item.id ? '#e6f7ff' : 'transparent', 
                            padding: 10,
                            borderRadius: 4
                        }}
                    >
                        <div style={{ width: '100%' }}>
                            <div style={{ fontWeight: 'bold' }}>{item.name}</div>
                            <div style={{ fontSize: 12, color: '#888' }}>{item.id}</div>
                        </div>
                    </List.Item>
                )}
             />
          </Card>
        </div>

        {/* CỘT PHẢI */}
        <div style={{ width: '75%', display: 'flex', flexDirection: 'column' }}>
          <Card 
            title={selectedRole ? `Quyền hạn: ${selectedRole.name}` : 'Chi tiết'} 
            extra={
                <Button 
                    type="primary" 
                    icon={<SaveOutlined />} 
                    loading={saving} 
                    onClick={handleSave} 
                    disabled={!selectedRole || selectedRole.id === 'ROLE-ADMIN'}
                >
                    Lưu
                </Button>
            } 
            style={{ height: '100%' }} 
            styles={{ body: { overflowY: 'auto' } }}
          >
             {!selectedRole ? <Empty description="Chọn vai trò" /> : (
                 <div>
                     {Object.keys(groupedPermissions).length === 0 && <Empty description="Không có dữ liệu quyền" />}
                     {Object.entries(groupedPermissions).map(([mod, perms]) => (
                         <div key={mod} style={{ marginBottom: 24 }}>
                             <Tag color="blue" style={{ marginBottom: 12 }}>{mod}</Tag>
                             <Checkbox.Group 
                                value={selectedRole.permissionIds}
                                onChange={handlePermissionChange}
                                style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}
                             >
                                 {perms.map((p: Permission) => (
                                     <Checkbox key={p.id} value={p.id}>{p.name}</Checkbox>
                                 ))}
                             </Checkbox.Group>
                         </div>
                     ))}
                 </div>
             )}
          </Card>
        </div>
      </div>

      <Modal open={isModalOpen} onCancel={() => setIsModalOpen(false)} footer={null} title="Thêm Role" destroyOnClose>
          <Form onFinish={handleCreateRole} layout="vertical">
              <Form.Item name="id" label="Mã ID" rules={[{required: true}]}><Input placeholder="ROLE_TEST" /></Form.Item>
              <Form.Item name="name" label="Tên" rules={[{required: true}]}><Input placeholder="Tên vai trò" /></Form.Item>
              <Button type="primary" htmlType="submit" block>Tạo mới</Button>
          </Form>
      </Modal>
    </div>
  );
};

export default RoleManagement;