import React, { useState, useEffect, useMemo } from 'react';
import { 
  Table, Card, List, Checkbox, Button, 
  App as AntdApp, Empty, 
  Tag, Modal, Form, Input, Divider, Row, Col 
} from 'antd';
import { 
  SafetyCertificateOutlined, PlusOutlined, 
  SaveOutlined, CheckSquareOutlined
} from '@ant-design/icons';
import axiosClient from '../../api/axiosClient'; 

// --- INTERFACES ---
interface Permission {
  id: string;
  name: string;
  module: string;
}

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
  permissions: RolePermissionRelation[]; 
  permissionIds: string[];
  userCount: number;
}

interface RoleApiResponse {
  id: string;
  name: string;
  description?: string;
  permissions: RolePermissionRelation[];
  _count?: { users: number };
}

const RoleManagement: React.FC = () => {
  const { message } = AntdApp.useApp();
  
  const [roles, setRoles] = useState<Role[]>([]);
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // --- API CALLS ---
  const fetchData = async () => {
    setLoading(true);
    try {
      // Gọi song song danh sách Role và tất cả Quyền hệ thống
      const [rolesRes, permsRes] = await Promise.all([
        axiosClient.get('/roles'),
        axiosClient.get('/users/permissions/all') // Sử dụng endpoint dùng chung đã thống nhất
      ]);

      const rawPerms = permsRes.data?.data || permsRes.data || [];
      setAllPermissions(Array.isArray(rawPerms) ? rawPerms : []);

      const rawRoles = rolesRes.data?.data || rolesRes.data || [];
      if (Array.isArray(rawRoles)) {
        const safeRoles = rawRoles.map((r: RoleApiResponse) => {
          const pIds = r.permissions
            ?.map((p) => p?.permission?.id)
            .filter((id): id is string => !!id) || [];
            
          return {
            ...r,
            permissionIds: pIds,
            userCount: r._count?.users || 0
          };
        });
        setRoles(safeRoles);

        // Mặc định chọn Role đầu tiên nếu chưa chọn cái nào
        if (safeRoles.length > 0 && !selectedRole) {
          setSelectedRole(safeRoles[0]);
        } else if (selectedRole) {
          const updatedSelected = safeRoles.find(sr => sr.id === selectedRole.id);
          if (updatedSelected) setSelectedRole(updatedSelected);
        }
      }
    } catch (error) {
      message.error('Lỗi tải dữ liệu hệ thống');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Nhóm quyền theo Module bằng useMemo để tối ưu hiệu năng
  const groupedPermissions = useMemo(() => {
    return allPermissions.reduce((acc, curr) => {
      const mod = curr.module || 'KHÁC';
      if (!acc[mod]) acc[mod] = [];
      acc[mod].push(curr);
      return acc;
    }, {} as Record<string, Permission[]>);
  }, [allPermissions]);

  // --- HANDLERS ---
  const handlePermissionChange = (modulePermIds: string[], currentModuleAllIds: string[]) => {
    if (!selectedRole) return;

    // Giữ lại các quyền thuộc các module khác
    const otherModulePermIds = selectedRole.permissionIds.filter(
      id => !currentModuleAllIds.includes(id)
    );

    // Hợp nhất với danh sách quyền mới của module hiện tại
    const newPermissionIds = [...otherModulePermIds, ...modulePermIds];

    const updated = { ...selectedRole, permissionIds: newPermissionIds };
    setSelectedRole(updated);
    setRoles(prev => prev.map(r => r.id === updated.id ? updated : r));
  };

  const handleSelectAllInModule = (moduleIds: string[]) => {
    if (!selectedRole) return;
    
    // Thêm những ID còn thiếu vào danh sách đang chọn
    const missingIds = moduleIds.filter(id => !selectedRole.permissionIds.includes(id));
    const newPermissionIds = [...selectedRole.permissionIds, ...missingIds];

    const updated = { ...selectedRole, permissionIds: newPermissionIds };
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
      message.success(`Đã cập nhật vai trò ${selectedRole.name} thành công`);
    } catch (error) {
      message.error('Lỗi lưu dữ liệu');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateRole = async (values: { id: string, name: string }) => {
    try {
      await axiosClient.post('/roles', { ...values, permissionIds: [] });
      message.success('Tạo vai trò mới thành công');
      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Mã vai trò đã tồn tại');
    }
  };

  return (
    <div style={{ height: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column', background: '#f8fafc', padding: '20px' }}>
      <div className="mb-4 flex justify-between items-center">
        <h2 className="text-xl font-bold flex items-center gap-2 m-0 text-slate-800">
          <SafetyCertificateOutlined className="text-indigo-600" /> 
          Thiết lập Phân quyền Role
        </h2>
        {selectedRole && (
          <Tag color="indigo" className="px-3 py-1 border-none shadow-sm">
            Cấu hình cho: <b>{selectedRole.name}</b>
          </Tag>
        )}
      </div>

      <div className="flex gap-6 flex-1 min-h-0">
        {/* CỘT DANH SÁCH ROLE */}
        <Card 
          title="Vai trò hiện có" 
          className="w-1/4 shadow-sm border-none rounded-xl"
          extra={<Button type="link" onClick={() => setIsModalOpen(true)} icon={<PlusOutlined />}>Thêm</Button>}
          styles={{ body: { padding: 0, overflowY: 'auto' } }}
        >
          <List
            dataSource={roles}
            loading={loading}
            renderItem={(item) => (
              <div 
                onClick={() => setSelectedRole(item)}
                className={`p-4 cursor-pointer border-b border-slate-50 transition-all hover:bg-slate-50 ${selectedRole?.id === item.id ? 'bg-indigo-50 border-r-4 border-r-indigo-500' : ''}`}
              >
                <div className="font-bold text-slate-700">{item.name}</div>
                <div className="text-xs text-slate-400 flex justify-between mt-1 italic">
                  <span>ID: {item.id}</span>
                  <span className="text-indigo-500">{item.permissionIds.length} quyền</span>
                </div>
              </div>
            )}
          />
        </Card>

        {/* CỘT CHI TIẾT QUYỀN */}
        <Card 
          className="flex-1 shadow-sm border-none rounded-xl"
          title={selectedRole ? `Ma trận quyền hạn chi tiết` : 'Chưa chọn vai trò'} 
          extra={
            <Button 
              type="primary" 
              icon={<SaveOutlined />} 
              loading={saving} 
              onClick={handleSave} 
              disabled={!selectedRole || selectedRole.id === 'ROLE-ADMIN'}
              className="rounded-lg"
            >
              Lưu cấu hình
            </Button>
          } 
          styles={{ body: { overflowY: 'auto' } }}
        >
          {!selectedRole ? (
            <Empty className="mt-20" description="Vui lòng chọn một vai trò bên trái" />
          ) : (
            <div className="pb-10">
              {Object.entries(groupedPermissions).map(([mod, perms]) => {
                const moduleIds = perms.map(p => p.id);
                const isAllSelected = moduleIds.every(id => selectedRole.permissionIds.includes(id));

                return (
                  <div key={mod} className="mb-6 p-5 border border-slate-100 rounded-xl bg-white shadow-sm">
                    <div className="flex justify-between items-center mb-4">
                      <Tag color="blue" className="font-bold border-none px-3 uppercase text-[10px] tracking-wider">{mod}</Tag>
                      <Button 
                        size="small" 
                        type="dashed" 
                        icon={<CheckSquareOutlined />}
                        onClick={() => handleSelectAllInModule(moduleIds)}
                        disabled={isAllSelected || selectedRole.id === 'ROLE-ADMIN'}
                        className="text-[11px]"
                      >
                        Chọn nhanh tất cả {mod}
                      </Button>
                    </div>
                    
                    <Checkbox.Group 
                      className="w-full"
                      value={selectedRole.permissionIds}
                      onChange={(checked) => handlePermissionChange(checked as string[], moduleIds)}
                      disabled={selectedRole.id === 'ROLE-ADMIN'}
                    >
                      <Row gutter={[16, 16]}>
                        {perms.map((p: Permission) => (
                          <Col span={8} key={p.id}>
                            <Checkbox value={p.id} className="text-slate-600 text-sm">
                              {p.name}
                            </Checkbox>
                          </Col>
                        ))}
                      </Row>
                    </Checkbox.Group>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <Modal 
        open={isModalOpen} 
        onCancel={() => setIsModalOpen(false)} 
        footer={null} 
        title="Tạo Vai trò (Role) mới" 
        destroyOnClose
        centered
      >
        <Form onFinish={handleCreateRole} layout="vertical" className="mt-4">
          <Form.Item name="id" label="Mã vai trò (ID)" rules={[{required: true, message: 'Ví dụ: ROLE_ACCOUNTANT'}]}>
            <Input placeholder="ID viết hoa, không dấu, dùng gạch dưới" className="font-mono" />
          </Form.Item>
          <Form.Item name="name" label="Tên hiển thị" rules={[{required: true, message: 'Ví dụ: Kế toán viên'}]}>
            <Input placeholder="Nhập tên gọi vai trò" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block size="large" className="mt-4 rounded-lg">Xác nhận tạo</Button>
        </Form>
      </Modal>
    </div>
  );
};

export default RoleManagement;