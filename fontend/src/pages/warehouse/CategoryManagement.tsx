import React, { useState, useEffect } from 'react';
import { 
  Table, Card, Button, Input, Space, Modal, Form, 
  Popconfirm, App as AntdApp, Typography 
} from 'antd';
import { 
  PlusOutlined, SearchOutlined, EditOutlined, 
  DeleteOutlined, ReloadOutlined, TagsOutlined 
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import axiosClient from '../../api/axiosClient';
import { useHasPermission } from '../../hooks/useHasPermission';

const { Text } = Typography;

interface Category {
  id: string;
  name: string;
  _count?: { items: number }; // Để hiển thị số lượng vật tư thuộc nhóm này
}

const CategoryManagement: React.FC = () => {
  const { message } = AntdApp.useApp();
  const { hasPermission } = useHasPermission();
  
  const canManage = hasPermission('ITEM_CREATE'); // Dùng chung quyền quản lý vật tư hoặc quyền riêng nếu bạn có

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [searchText, setSearchText] = useState('');
  
  const [form] = Form.useForm();

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const res = await axiosClient.get('/items/categories');
      setCategories(res.data?.data || []);
    } catch (error: any) {
      message.error('Không thể tải danh mục.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      if (editingCat) {
        await axiosClient.patch(`/items/categories/${editingCat.id}`, values);
        message.success('Cập nhật danh mục thành công');
      } else {
        await axiosClient.post('/items/categories', values);
        message.success('Thêm mới danh mục thành công');
      }
      setIsModalOpen(false);
      fetchCategories();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Thao tác thất bại');
    } finally {
      setLoading(false);
    }
  };

  const columns: ColumnsType<Category> = [
    {
      title: 'Tên danh mục',
      dataIndex: 'name',
      key: 'name',
      render: (text) => <Text strong>{text}</Text>
    },
    {
      title: 'Số lượng vật tư',
      dataIndex: ['_count', 'items'],
      key: 'count',
      align: 'center',
      render: (count) => <span className="text-gray-500">{count || 0} vật tư</span>
    },
    {
      title: 'Thao tác',
      key: 'action',
      align: 'center',
      width: 150,
      render: (_, record) => (
        <Space size="middle">
          {canManage && (
            <>
              <Button 
                type="text" 
                icon={<EditOutlined />} 
                onClick={() => {
                  setEditingCat(record);
                  form.setFieldsValue(record);
                  setIsModalOpen(true);
                }} 
              />
              <Popconfirm 
                title="Xóa danh mục này?" 
                description="Lưu ý: Bạn chỉ có thể xóa danh mục không chứa vật tư nào."
                onConfirm={() => axiosClient.delete(`/items/categories/${record.id}`).then(fetchCategories)}
              >
                <Button type="text" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '0px' }}>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <TagsOutlined className="text-orange-500" /> Quản lý Nhóm Vật Tư
        </h2>
        {canManage && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingCat(null); form.resetFields(); setIsModalOpen(true); }}>
            Thêm nhóm mới
          </Button>
        )}
      </div>

      <Card bordered={false} className="shadow-sm rounded-xl">
        <div className="flex justify-between items-center mb-5">
          <Input 
            placeholder="Tìm tên danh mục..." 
            prefix={<SearchOutlined className="text-slate-400" />} 
            style={{ width: 300 }}
            onChange={e => setSearchText(e.target.value)}
          />
          <Button icon={<ReloadOutlined />} onClick={fetchCategories}>Làm mới</Button>
        </div>

        <Table 
          columns={columns} 
          dataSource={categories.filter(c => c.name.toLowerCase().includes(searchText.toLowerCase()))} 
          rowKey="id" 
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title={editingCat ? "Sửa danh mục" : "Thêm danh mục mới"}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={loading}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit} className="mt-4">
          <Form.Item name="name" label="Tên danh mục" rules={[{ required: true, message: 'Vui lòng nhập tên!' }]}>
            <Input placeholder="Vd: Linh kiện cơ khí, Văn phòng phẩm..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default CategoryManagement;