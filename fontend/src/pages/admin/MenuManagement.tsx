import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Switch, message, Popconfirm, Card, Tag } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, FolderOutlined, EyeInvisibleOutlined } from '@ant-design/icons';
import axiosClient from '../../api/axiosClient';

const MenuManagement: React.FC = () => {
  const [menus, setMenus] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMenu, setEditingMenu] = useState<any>(null);
  
  const [form] = Form.useForm();

  const fetchMenus = async () => {
    setLoading(true);
    try {
      const res = await axiosClient.get('/menus');
      setMenus(res.data.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMenus();
  }, []);

  const handleAddNew = () => {
    setEditingMenu(null);
    form.resetFields();
    form.setFieldsValue({ order: 1, isVisible: true });
    setIsModalOpen(true);
  };

  const handleEdit = (record: any) => {
    setEditingMenu(record);
    form.setFieldsValue({
        title: record.title,
        slug: record.slug,
        order: record.order,
        isVisible: record.isVisible
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (values: any) => {
    try {
      if (editingMenu) {
        await axiosClient.patch(`/menus/${editingMenu.id}`, values);
        message.success('Cập nhật thành công');
      } else {
        await axiosClient.post('/menus', values);
        message.success('Tạo menu thành công');
      }
      setIsModalOpen(false);
      fetchMenus();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Có lỗi xảy ra');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await axiosClient.delete(`/menus/${id}`);
      message.success('Đã xóa menu');
      fetchMenus();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Không thể xóa (Có thể do còn bài viết)');
    }
  };

  const columns = [
    { 
        title: 'ID', dataIndex: 'id', width: 60, align: 'center' as const 
    },
    { 
        title: 'Tên Chuyên mục', dataIndex: 'title', 
        render: (text: string, record: any) => (
            <span className={!record.isVisible ? "text-gray-400 italic" : "font-semibold text-indigo-700"}>
                {text} {!record.isVisible && <EyeInvisibleOutlined className="ml-2" />}
            </span>
        )
    },
    { 
        title: 'Slug (URL)', dataIndex: 'slug',
        render: (slug: string) => <Tag>{slug || 'tu-dong'}</Tag>
    },
    { 
        title: 'Thứ tự', dataIndex: 'order', align: 'center' as const, width: 100 
    },
    { 
        title: 'Trạng thái', dataIndex: 'isVisible', width: 120,
        render: (v: boolean) => v ? 
            <Tag color="success">Đang hiện</Tag> : 
            <Tag color="default">Đang ẩn</Tag>
    },
    {
      title: 'Hành động',
      align: 'right' as const,
      render: (_: any, record: any) => (
        <div className="flex justify-end gap-2">
          <Button icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          <Popconfirm title="Xóa chuyên mục này?" description="Lưu ý: Chỉ xóa được khi chuyên mục trống." onConfirm={() => handleDelete(record.id)} okButtonProps={{ danger: true }}>
             <Button danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold flex items-center gap-2">
            <FolderOutlined /> Quản lý Chuyên mục
        </h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAddNew}>Thêm Menu</Button>
      </div>

      <Card className="shadow-sm" bordered={false}>
        <Table 
            rowKey="id" 
            columns={columns} 
            dataSource={menus} 
            loading={loading} 
            pagination={false} 
            bordered
            // Tô màu xám cho dòng bị ẩn để dễ phân biệt
            rowClassName={(record) => !record.isVisible ? 'bg-gray-50' : ''}
        />
      </Card>

      <Modal 
        title={editingMenu ? "Cập nhật Chuyên mục" : "Thêm Chuyên mục Mới"} 
        open={isModalOpen} 
        onCancel={() => setIsModalOpen(false)} 
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="title" label="Tên chuyên mục" rules={[{ required: true, message: 'Nhập tên menu' }]}><Input placeholder="VD: Thông báo, Quy định..." /></Form.Item>
          
          <Form.Item name="slug" label="Slug (Đường dẫn tĩnh - Không bắt buộc)"><Input placeholder="VD: thong-bao-chung" /></Form.Item>
          
          <div className="grid grid-cols-2 gap-4">
             <Form.Item name="order" label="Thứ tự hiển thị"><InputNumber className="w-full" min={0} /></Form.Item>
             <Form.Item name="isVisible" label="Trạng thái hiển thị" valuePropName="checked">
                 <Switch checkedChildren="Hiện" unCheckedChildren="Ẩn" />
             </Form.Item>
          </div>
          
          <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
             <Button onClick={() => setIsModalOpen(false)}>Hủy</Button>
             <Button type="primary" htmlType="submit">Lưu lại</Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default MenuManagement;