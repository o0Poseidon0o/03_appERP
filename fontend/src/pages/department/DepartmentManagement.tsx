import React, { useState, useEffect } from 'react';
import { 
  Table, Card, Button, Input, Modal, Form, 
  Space, Tooltip, Popconfirm, App as AntdApp, Tag, Badge 
} from 'antd';
import { 
  PlusOutlined, SearchOutlined, EditOutlined, 
  DeleteOutlined, ApartmentOutlined, ReloadOutlined,
  UsergroupAddOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import axiosClient from '../../api/axiosClient';

// Interface cập nhật thêm _count từ Backend
interface Department {
  id: string;
  name: string;
  code: string;
  _count?: {
    users: number; // Số lượng user
  };
}

const DepartmentManagement: React.FC = () => {
  const { message } = AntdApp.useApp();
  
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  
  const [form] = Form.useForm();

  // --- FETCH DATA ---
  const fetchDepartments = async () => {
    setLoading(true);
    try {
      const res = await axiosClient.get('/departments');
      setDepartments(res.data.data || []);
    } catch (error) {
      message.error('Lỗi tải dữ liệu phòng ban');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDepartments(); }, []);

  // --- HANDLERS ---
  const handleAddNew = () => {
    setEditingDept(null);
    form.resetFields();
    setIsModalOpen(true);
  };

  const handleEdit = (record: Department) => {
    setEditingDept(record);
    form.setFieldsValue({
      id: record.id,
      name: record.name,
      code: record.code
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (values: any) => {
    try {
      if (editingDept) {
        await axiosClient.patch(`/departments/${editingDept.id}`, {
          name: values.name,
          code: values.code
        });
        message.success('Cập nhật thành công');
      } else {
        await axiosClient.post('/departments', values);
        message.success('Tạo mới thành công');
      }
      setIsModalOpen(false);
      fetchDepartments();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Có lỗi xảy ra');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await axiosClient.delete(`/departments/${id}`);
      message.success('Đã xóa phòng ban');
      fetchDepartments();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Không thể xóa');
    }
  };

  // --- COLUMNS ---
  const columns: ColumnsType<Department> = [
    {
      title: 'Mã ID',
      dataIndex: 'id',
      key: 'id',
      width: 120,
      render: (text) => <Tag color="geekblue" className="font-bold">{text}</Tag>,
      sorter: (a, b) => a.id.localeCompare(b.id),
    },
    {
      title: 'Tên Phòng Ban',
      dataIndex: 'name',
      key: 'name',
      render: (text) => <span className="font-semibold text-gray-700">{text}</span>,
      filteredValue: searchText ? [searchText] : null,
      onFilter: (value, record) => 
        record.name.toLowerCase().includes(String(value).toLowerCase()) ||
        record.id.toLowerCase().includes(String(value).toLowerCase())
    },
    {
      title: 'Mã Code',
      dataIndex: 'code',
      key: 'code',
      render: (text) => <Tag>{text}</Tag>
    },
    {
      // --- CỘT MỚI: HIỂN THỊ SỐ LƯỢNG NHÂN SỰ ---
      title: 'Nhân sự',
      key: 'users',
      render: (_, record) => {
        const count = record._count?.users || 0;
        return (
          <Badge count={count} showZero color={count > 0 ? '#52c41a' : '#d9d9d9'}>
             <Tag style={{ marginLeft: 8 }}>nhân viên</Tag>
          </Badge>
        );
      }
    },
    {
      title: 'Hành động',
      key: 'action',
      width: 120,
      render: (_, record) => {
        const userCount = record._count?.users || 0;
        const canDelete = userCount === 0; // Chỉ cho xóa nếu 0 nhân viên

        return (
          <Space>
            <Tooltip title="Chỉnh sửa">
              <Button 
                type="text" 
                icon={<EditOutlined className="text-blue-600" />} 
                onClick={() => handleEdit(record)} 
              />
            </Tooltip>
            
            {/* Logic thông minh: Nếu có user -> Disable nút xóa + Tooltip giải thích */}
            {canDelete ? (
              <Tooltip title="Xóa phòng ban">
                <Popconfirm
                  title="Xóa phòng ban này?"
                  description="Hành động không thể hoàn tác"
                  onConfirm={() => handleDelete(record.id)}
                  okButtonProps={{ danger: true }}
                >
                  <Button type="text" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </Tooltip>
            ) : (
              <Tooltip title={`Không thể xóa: Còn ${userCount} nhân viên`}>
                <Button type="text" disabled icon={<DeleteOutlined />} />
              </Tooltip>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <div style={{ minHeight: '100%' }}>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold flex items-center gap-2">
            <ApartmentOutlined /> Quản lý Phòng Ban
        </h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAddNew}>
          Thêm mới
        </Button>
      </div>

      <Card bordered={false} className="shadow-sm rounded-lg">
        <div className="flex justify-between mb-4">
          <Input 
            placeholder="Tìm theo Tên hoặc ID..." 
            prefix={<SearchOutlined />} 
            className="max-w-xs"
            onChange={e => setSearchText(e.target.value)}
            allowClear
          />
          <Button icon={<ReloadOutlined />} onClick={fetchDepartments}>Làm mới</Button>
        </div>

        <Table 
          columns={columns} 
          dataSource={departments} 
          rowKey="id" 
          loading={loading}
          pagination={{ pageSize: 8 }}
        />
      </Card>

      <Modal
        title={editingDept ? "Cập nhật thông tin" : "Tạo phòng ban mới"}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="id"
            label="Mã định danh (ID)"
            rules={[
              { required: true, message: 'Nhập ID' },
              { pattern: /^[A-Z0-9-_]+$/, message: 'Ký tự in hoa, số hoặc gạch ngang' }
            ]}
            help={!editingDept && "VD: DEP-SALE, IT-DEV (Dùng làm khóa chính)"}
          >
            <Input 
              disabled={!!editingDept} 
              placeholder="Nhập ID" 
              style={{ textTransform: 'uppercase' }}
              prefix={<ApartmentOutlined className="text-gray-400"/>}
            />
          </Form.Item>

          <Form.Item
            name="name"
            label="Tên phòng ban"
            rules={[{ required: true, message: 'Nhập tên phòng' }]}
          >
            <Input placeholder="VD: Phòng Kinh Doanh" />
          </Form.Item>

          <Form.Item
            name="code"
            label="Mã Code (Viết tắt)"
            rules={[{ required: true, message: 'Nhập mã code' }]}
          >
            <Input placeholder="VD: SALE, DEV" prefix={<Tag>CODE</Tag>} />
          </Form.Item>

          <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
            <Button onClick={() => setIsModalOpen(false)}>Hủy bỏ</Button>
            <Button type="primary" htmlType="submit">
              {editingDept ? 'Lưu thay đổi' : 'Tạo mới'}
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default DepartmentManagement;