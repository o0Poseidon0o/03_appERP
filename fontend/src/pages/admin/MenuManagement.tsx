import React, { useEffect, useState } from 'react';
import { 
  Table, Button, Modal, Form, Input, 
  InputNumber, Switch, App as AntdApp, Popconfirm, Card, Tag, Tooltip 
} from 'antd';
import { 
  PlusOutlined, EditOutlined, DeleteOutlined, 
  FolderOutlined, EyeInvisibleOutlined, ReloadOutlined 
} from '@ant-design/icons';
import axiosClient from '../../api/axiosClient';

const MenuManagement: React.FC = () => {
  const { message } = AntdApp.useApp();
  const [menus, setMenus] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMenu, setEditingMenu] = useState<any>(null);
  
  const [form] = Form.useForm();

  const fetchMenus = async () => {
    setLoading(true);
    try {
      const res = await axiosClient.get('/menus');
      // Bóc tách dữ liệu linh hoạt
      const data = res.data?.data || res.data || [];
      setMenus(data);
    } catch (error: any) {
      message.error('Không thể tải danh sách chuyên mục');
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
    form.setFieldsValue({ order: 0, isVisible: true });
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
    setLoading(true);
    try {
      if (editingMenu) {
        await axiosClient.patch(`/menus/${editingMenu.id}`, values);
        message.success('Cập nhật chuyên mục thành công');
      } else {
        await axiosClient.post('/menus', values);
        message.success('Tạo chuyên mục thành công');
      }
      setIsModalOpen(false);
      fetchMenus();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Thao tác thất bại');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await axiosClient.delete(`/menus/${id}`);
      message.success('Đã xóa chuyên mục');
      fetchMenus();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Không thể xóa chuyên mục đang chứa dữ liệu');
    }
  };

  const columns = [
    { 
        title: 'Thứ tự', dataIndex: 'order', width: 100, align: 'center' as const,
        render: (v: number) => <Tag className="rounded-full px-3">{v}</Tag>
    },
    { 
        title: 'Tên Chuyên mục', dataIndex: 'title', 
        render: (text: string, record: any) => (
            <div className="flex items-center gap-2">
                <FolderOutlined className={record.isVisible ? "text-indigo-500" : "text-slate-300"} />
                <span className={!record.isVisible ? "text-slate-400 italic" : "font-semibold text-slate-700"}>
                    {text} {!record.isVisible && <Tooltip title="Đang ẩn"><EyeInvisibleOutlined className="ml-1" /></Tooltip>}
                </span>
            </div>
        )
    },
    { 
        title: 'Đường dẫn (Slug)', dataIndex: 'slug',
        render: (slug: string) => <code className="text-xs text-indigo-400 bg-slate-50 px-1 rounded">{slug || 'auto'}</code>
    },
    { 
        title: 'Trạng thái', dataIndex: 'isVisible', width: 150,
        render: (v: boolean) => (
            <Tag color={v ? "green" : "default"} className="border-none">
                {v ? 'Công khai' : 'Nháp/Ẩn'}
            </Tag>
        )
    },
    {
      title: 'Thao tác',
      align: 'right' as const,
      render: (_: any, record: any) => (
        <div className="flex justify-end gap-1">
          <Tooltip title="Chỉnh sửa">
            <Button type="text" className="text-blue-600" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          </Tooltip>
          <Popconfirm 
            title="Xóa chuyên mục?" 
            description="Lưu ý: Chỉ xóa được khi không có bài viết thuộc chuyên mục này." 
            onConfirm={() => handleDelete(record.id)} 
            okButtonProps={{ danger: true }}
            okText="Xóa ngay"
            cancelText="Hủy"
          >
             <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </div>
      ),
    },
  ];

  return (
    <div className="bg-slate-50 min-h-screen p-2">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold flex items-center gap-2 m-0 text-slate-800">
            <FolderOutlined className="text-indigo-600" /> Cấu trúc Chuyên mục
        </h2>
        <Button type="primary" size="large" icon={<PlusOutlined />} onClick={handleAddNew}>
            Thêm Menu mới
        </Button>
      </div>

      <Card className="shadow-sm border-none rounded-xl" bordered={false}>
        <div className="mb-4 flex justify-end">
            <Button icon={<ReloadOutlined />} onClick={fetchMenus}>Làm mới</Button>
        </div>
        <Table 
            rowKey="id" 
            columns={columns} 
            dataSource={menus} 
            loading={loading} 
            pagination={false}
            className="rounded-lg overflow-hidden border border-slate-100"
            rowClassName={(record) => !record.isVisible ? 'bg-slate-50/50' : ''}
        />
      </Card>

      <Modal 
        title={
            <div className="flex items-center gap-2 border-b pb-3">
                <FolderOutlined className="text-indigo-600" />
                <span>{editingMenu ? "Cập nhật thông tin" : "Tạo chuyên mục mới"}</span>
            </div>
        }
        open={isModalOpen} 
        onCancel={() => setIsModalOpen(false)} 
        footer={null}
        centered
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit} className="mt-5">
          <Form.Item 
            name="title" 
            label="Tên chuyên mục" 
            rules={[{ required: true, message: 'Vui lòng nhập tên chuyên mục' }]}
          >
            <Input placeholder="VD: Thông báo nội bộ, Tin tức công nghệ..." />
          </Form.Item>
          
          <Form.Item 
            name="slug" 
            label="Đường dẫn tĩnh (Slug)"
            tooltip="Để trống nếu muốn hệ thống tự tạo từ tên"
          >
            <Input placeholder="VD: thong-bao-noi-bo" className="font-mono text-xs" />
          </Form.Item>
          
          <div className="grid grid-cols-2 gap-4">
             <Form.Item name="order" label="Thứ tự ưu tiên">
                <InputNumber className="w-full" min={0} placeholder="0" />
             </Form.Item>
             <Form.Item name="isVisible" label="Trạng thái hiển thị" valuePropName="checked">
                 <Switch checkedChildren="Hiện" unCheckedChildren="Ẩn" />
             </Form.Item>
          </div>
          
          <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
             <Button onClick={() => setIsModalOpen(false)}>Đóng</Button>
             <Button type="primary" htmlType="submit" loading={loading} className="px-8">
                {editingMenu ? "Lưu thay đổi" : "Tạo ngay"}
             </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default MenuManagement;