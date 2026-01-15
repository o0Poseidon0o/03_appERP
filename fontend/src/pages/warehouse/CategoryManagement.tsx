import React, { useState, useEffect } from 'react';
import { 
  Table, Card, Button, Input, Space, Modal, Form, 
  Popconfirm, App as AntdApp, Typography, Tabs, Upload, Tooltip 
} from 'antd';
import { 
  PlusOutlined, SearchOutlined, EditOutlined, 
  DeleteOutlined, ReloadOutlined, TagsOutlined, 
  BuildOutlined, UploadOutlined 
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { UploadProps } from 'antd';
import Papa from 'papaparse'; // Thư viện đọc CSV
import axiosClient from '../../api/axiosClient';
import { useHasPermission } from '../../hooks/useHasPermission';

const { Text } = Typography;

// --- INTERFACES ---
interface Category {
  id: string;
  name: string;
  _count?: { items: number };
}

interface UsageCategory {
  id: string;
  code: string;
  name: string;
  description?: string;
  _count?: { transactionDetails: number };
}

// ==========================================
// TAB 1: QUẢN LÝ NHÓM VẬT TƯ (CATEGORY)
// ==========================================
const CategoryTab: React.FC = () => {
  const { message } = AntdApp.useApp();
  const { hasPermission } = useHasPermission();
  const canManage = hasPermission('ITEM_CREATE');

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
    } catch (error: any) { message.error('Không thể tải nhóm vật tư.'); } 
    finally { setLoading(false); }
  };

  useEffect(() => { fetchCategories(); }, []);

  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      if (editingCat) {
        await axiosClient.patch(`/items/categories/${editingCat.id}`, values);
        message.success('Cập nhật thành công');
      } else {
        await axiosClient.post('/items/categories', values);
        message.success('Thêm mới thành công');
      }
      setIsModalOpen(false);
      fetchCategories();
    } catch (error: any) { message.error(error.response?.data?.message || 'Lỗi thao tác'); } 
    finally { setLoading(false); }
  };

  const columns: ColumnsType<Category> = [
    { title: 'Tên danh mục', dataIndex: 'name', key: 'name', render: (t) => <Text strong>{t}</Text> },
    { title: 'Số lượng VT', dataIndex: ['_count', 'items'], align: 'center', render: (c) => <span className="text-gray-500">{c || 0}</span> },
    {
      title: 'Thao tác', key: 'action', align: 'center', width: 120,
      render: (_, record) => (
        <Space>
          {canManage && (
            <>
              <Button type="text" icon={<EditOutlined />} onClick={() => { setEditingCat(record); form.setFieldsValue(record); setIsModalOpen(true); }} />
              <Popconfirm title="Xóa?" onConfirm={() => axiosClient.delete(`/items/categories/${record.id}`).then(fetchCategories)}>
                <Button type="text" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <Space>
          <Input placeholder="Tìm nhóm..." prefix={<SearchOutlined />} onChange={e => setSearchText(e.target.value)} />
          <Button icon={<ReloadOutlined />} onClick={fetchCategories} />
        </Space>
        {canManage && <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingCat(null); form.resetFields(); setIsModalOpen(true); }}>Thêm Nhóm</Button>}
      </div>
      <Table columns={columns} dataSource={categories.filter(c => c.name.toLowerCase().includes(searchText.toLowerCase()))} rowKey="id" loading={loading} pagination={{ pageSize: 8 }} size="middle" />
      <Modal title={editingCat ? "Sửa nhóm" : "Thêm nhóm mới"} open={isModalOpen} onCancel={() => setIsModalOpen(false)} onOk={() => form.submit()} confirmLoading={loading}>
        <Form form={form} layout="vertical" onFinish={handleSubmit} className="mt-4">
          <Form.Item name="name" label="Tên nhóm" rules={[{ required: true, message: 'Vui lòng nhập tên nhóm' }]}> <Input /> </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

// ==========================================
// TAB 2: QUẢN LÝ LOẠI HÀNG SỬ DỤNG (USAGE CATEGORY)
// ==========================================
const UsageCategoryTab: React.FC = () => {
  const { message } = AntdApp.useApp();
  const { hasPermission } = useHasPermission();
  const canManage = hasPermission('ITEM_CREATE');

  const [data, setData] = useState<UsageCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<UsageCategory | null>(null);
  const [searchText, setSearchText] = useState('');
  const [form] = Form.useForm();

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await axiosClient.get('/items/usage-categories');
      setData(res.data?.data || []);
    } catch (error) { message.error('Lỗi tải dữ liệu'); } 
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      if (editingItem) {
        await axiosClient.patch(`/items/usage-categories/${editingItem.id}`, values);
        message.success('Cập nhật thành công');
      } else {
        await axiosClient.post('/items/usage-categories', values);
        message.success('Thêm mới thành công');
      }
      setIsModalOpen(false);
      fetchData();
    } catch (error: any) { message.error(error.response?.data?.message || 'Lỗi thao tác'); } 
    finally { setLoading(false); }
  };

  // --- XỬ LÝ IMPORT CSV TẠI CLIENT ---
  const handleCustomRequest = (options: any) => {
    const { file, onSuccess, onError } = options;
    
    // Đọc file CSV ngay tại trình duyệt
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          console.log("Dữ liệu CSV đọc được:", results.data); // Debug xem console nếu cần

          // Gửi dữ liệu lên Server
          await axiosClient.post('/items/usage-categories/import', {
             data: results.data
          });
          
          message.success(`Đã import thành công ${results.data.length} dòng!`);
          fetchData();
          onSuccess("Ok");
        } catch (error: any) {
          console.error(error);
          message.error(error.response?.data?.message || 'Lỗi khi import dữ liệu.');
          onError(error);
        }
      },
      error: (error) => {
        message.error('Không thể đọc file CSV.');
        onError(error);
      }
    });
  };

  const uploadProps: UploadProps = {
    customRequest: handleCustomRequest,
    showUploadList: false 
  };

  const columns: ColumnsType<UsageCategory> = [
    { title: 'Mã (Code)', dataIndex: 'code', width: 150, render: (t) => <Text code>{t}</Text> },
    { title: 'Tên loại sử dụng', dataIndex: 'name', render: (t) => <Text strong>{t}</Text> },
    { title: 'Mô tả', dataIndex: 'description', ellipsis: true },
    { 
      title: 'Đã dùng', 
      dataIndex: ['_count', 'transactionDetails'], 
      align: 'center', 
      render: (c) => <span className="text-gray-500">{c || 0} lần</span> 
    },
    {
      title: 'Thao tác', key: 'action', align: 'center', width: 120,
      render: (_, record) => (
        <Space>
          {canManage && (
            <>
              <Button type="text" icon={<EditOutlined />} onClick={() => { setEditingItem(record); form.setFieldsValue(record); setIsModalOpen(true); }} />
              <Popconfirm title="Xóa?" onConfirm={() => axiosClient.delete(`/items/usage-categories/${record.id}`).then(fetchData)}>
                <Button type="text" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <Space>
          <Input placeholder="Tìm mã hoặc tên..." prefix={<SearchOutlined />} onChange={e => setSearchText(e.target.value)} />
          <Button icon={<ReloadOutlined />} onClick={fetchData} />
        </Space>
        {canManage && (
          <Space>
            <Tooltip title="Chấp nhận file CSV có cột: product_category_code, product_name">
              <Upload {...uploadProps}>
                <Button icon={<UploadOutlined />}>Import CSV</Button>
              </Upload>
            </Tooltip>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingItem(null); form.resetFields(); setIsModalOpen(true); }}>
              Thêm Mới
            </Button>
          </Space>
        )}
      </div>
      <Table columns={columns} dataSource={data.filter(t => t.name.toLowerCase().includes(searchText.toLowerCase()) || t.code?.toLowerCase().includes(searchText.toLowerCase()))} rowKey="id" loading={loading} pagination={{ pageSize: 8 }} size="middle" />
      <Modal title={editingItem ? "Sửa loại sử dụng" : "Thêm loại sử dụng"} open={isModalOpen} onCancel={() => setIsModalOpen(false)} onOk={() => form.submit()} confirmLoading={loading}>
        <Form form={form} layout="vertical" onFinish={handleSubmit} className="mt-4">
          <Form.Item name="code" label="Mã (VD: 11020)" rules={[{ required: true, message: 'Nhập mã!' }]}> <Input style={{ textTransform: 'uppercase'}} /> </Form.Item>
          <Form.Item name="name" label="Tên (VD: 42)" rules={[{ required: true, message: 'Nhập tên!' }]}> <Input /> </Form.Item>
          <Form.Item name="description" label="Mô tả"> <Input.TextArea rows={2} /> </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

// ==========================================
// COMPONENT CHÍNH
// ==========================================
const CategoryManagement: React.FC = () => {
  const items = [
    { key: '1', label: <span className="flex items-center gap-2"><TagsOutlined /> Nhóm Vật Tư (Category)</span>, children: <CategoryTab /> },
    { key: '2', label: <span className="flex items-center gap-2"><BuildOutlined /> Loại Hàng Sử Dụng (Usage)</span>, children: <UsageCategoryTab /> },
  ];

  return (
    <div style={{ padding: '0px' }}>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <TagsOutlined className="text-orange-500" /> Quản lý Danh mục Vật tư
        </h2>
        <Text type="secondary">Quản lý các nhóm hàng hóa và mục đích sử dụng trong kho.</Text>
      </div>
      <Card bordered={false} className="shadow-sm rounded-xl">
        <Tabs defaultActiveKey="1" items={items} />
      </Card>
    </div>
  );
};

export default CategoryManagement;