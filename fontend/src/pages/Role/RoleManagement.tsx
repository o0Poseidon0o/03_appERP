import React, { useState, useEffect } from 'react';
import { 
  Card, List, Checkbox, Button, Typography, 
  App as AntdApp, Skeleton, Empty, 
  Tag, Modal, Form, Input, Popconfirm 
} from 'antd';
import { 
  SafetyCertificateOutlined, PlusOutlined, 
  SaveOutlined, DeleteOutlined
} from '@ant-design/icons';
// --- HÃY KIỂM TRA KỸ ĐƯỜNG DẪN NÀY ---
import axiosClient from '../../api/axiosClient'; 

const { Title, Text } = Typography;
const { TextArea } = Input;

const RoleManagement: React.FC = () => {
  // Dùng try-catch cho hook để tránh lỗi crash app nếu chưa bọc Provider
  let messageApi: any;
  try {
     const app = AntdApp.useApp();
     messageApi = app.message;
  } catch (e) {
     console.warn("Chưa bọc <App> của Antd, dùng console.log thay thế");
  }

  const showMsg = (type: 'success' | 'error', content: string) => {
      if(messageApi) messageApi[type](content);
      else console.log(`[${type.toUpperCase()}] ${content}`);
  };
  
  const [roles, setRoles] = useState<any[]>([]);
  const [allPermissions, setAllPermissions] = useState<any[]>([]);
  const [selectedRole, setSelectedRole] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();

  const fetchData = async () => {
    setLoading(true);
    try {
      console.log("--- BẮT ĐẦU GỌI API ---");
      
      // 1. Gọi API
      const [rolesRes, permsRes] = await Promise.all([
        axiosClient.get('/roles'),
        axiosClient.get('/roles/permissions') 
      ]);

      console.log("1. Raw Roles Response:", rolesRes);
      console.log("2. Raw Permissions Response:", permsRes);

      // 2. Xử lý Permission
      // Kiểm tra kỹ xem data nằm ở .data hay .data.data
      const rawPerms = permsRes.data?.data || permsRes.data || [];
      if (!Array.isArray(rawPerms)) {
          console.error("LỖI: Permissions không phải là mảng!", rawPerms);
          setAllPermissions([]);
      } else {
          setAllPermissions(rawPerms);
      }

      // 3. Xử lý Roles
      const rawRoles = rolesRes.data?.data || rolesRes.data || [];
      if (!Array.isArray(rawRoles)) {
          console.error("LỖI: Roles không phải là mảng!", rawRoles);
          setRoles([]);
      } else {
          // Map dữ liệu an toàn
          const safeRoles = rawRoles.map((r: any) => {
              // Xử lý permissionIds an toàn tuyệt đối
              let pIds: string[] = [];
              if (Array.isArray(r.permissions)) {
                  pIds = r.permissions.map((p: any) => p?.permission?.id).filter((id: any) => !!id);
              }
              return {
                  ...r,
                  permissionIds: pIds,
                  userCount: r._count?.users || 0
              };
          });
          setRoles(safeRoles);

          // Chọn role đầu tiên nếu chưa chọn
          if (safeRoles.length > 0 && !selectedRole) {
              setSelectedRole(safeRoles[0]);
          }
      }

    } catch (error: any) {
      console.error("--- LỖI FETCH DATA ---", error);
      showMsg('error', 'Lỗi tải dữ liệu (Xem Console F12)');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- LOGIC GOM NHÓM AN TOÀN ---
  const groupedPermissions = allPermissions.reduce((acc, curr) => {
    if (!curr) return acc;
    const mod = curr.module || 'KHÁC';
    if (!acc[mod]) acc[mod] = [];
    acc[mod].push(curr);
    return acc;
  }, {} as Record<string, any[]>);

  const handleSelectRole = (role: any) => setSelectedRole(role);

  const handlePermissionChange = (checkedValues: any[]) => {
    if (!selectedRole) return;
    const updated = { ...selectedRole, permissionIds: checkedValues };
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

  const handleCreateRole = async (values: any) => {
      try {
          await axiosClient.post('/roles', { ...values, permissionIds: [] });
          showMsg('success', 'Tạo thành công');
          setIsModalOpen(false);
          fetchData();
      } catch (err) { console.error(err); }
  };

  // --- RENDER AN TOÀN ---
  return (
    <div style={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginBottom: 16 }}>
        <h2 className="text-2xl font-bold flex items-center gap-2">
            <SafetyCertificateOutlined /> Phân quyền hệ thống
        </h2>
      </div>

      <div style={{ display: 'flex', gap: 24, flex: 1, minHeight: 0 }}>
        {/* CỘT TRÁI */}
        <div style={{ width: '25%', display: 'flex', flexDirection: 'column' }}>
          <Card title="Vai trò" extra={<Button onClick={() => setIsModalOpen(true)} icon={<PlusOutlined />}>Thêm</Button>} style={{ height: '100%' }} styles={{ body: { overflowY: 'auto' } }}>
             <List
                dataSource={roles}
                renderItem={(item) => (
                    <List.Item 
                        onClick={() => handleSelectRole(item)}
                        style={{ cursor: 'pointer', background: selectedRole?.id === item.id ? '#e6f7ff' : 'transparent', padding: 10 }}
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
          <Card title={selectedRole ? `Quyền hạn: ${selectedRole.name}` : 'Chi tiết'} extra={<Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave} disabled={selectedRole?.id === 'ROLE-ADMIN'}>Lưu</Button>} style={{ height: '100%' }} styles={{ body: { overflowY: 'auto' } }}>
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
                                 {perms.map(p => (
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

      {/* MODAL ĐƠN GIẢN */}
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