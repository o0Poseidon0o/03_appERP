import React, { useEffect, useState } from 'react';
import { 
  Card, Statistic, Row, Col, Button, Modal, Form, Input, 
  Select, Upload, message, Table, Tag, Space, Popconfirm, List, Radio 
} from 'antd';
import { 
  UserOutlined, FileTextOutlined, UploadOutlined, PlusOutlined, 
  EditOutlined, DeleteOutlined, PaperClipOutlined, 
  FilePdfOutlined, FileImageOutlined, GlobalOutlined, TeamOutlined 
} from '@ant-design/icons';
import axiosClient from '../../api/axiosClient';

// Lấy baseURL từ axiosClient để đồng bộ, tránh viết cứng localhost
const API_URL = axiosClient.defaults.baseURL;

interface Attachment {
  name: string;
  path: string;
  type: string;
}

const Dashboard: React.FC = () => {
  const [form] = Form.useForm();
  
  // --- STATE ---
  const [stats, setStats] = useState({ users: 0, posts: 0 });
  const [posts, setPosts] = useState<any[]>([]);
  const [menus, setMenus] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingPost, setEditingPost] = useState<any>(null);
  const [sendToAll, setSendToAll] = useState(true);
  
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [linkInput, setLinkInput] = useState('');

  // --- 1. LOAD DỮ LIỆU ---
  const fetchData = async () => {
      try {
          const [userRes, postRes, menuRes, deptRes] = await Promise.all([
              axiosClient.get('/users'),
              axiosClient.get('/posts?limit=100'),
              axiosClient.get('/menus'),
              axiosClient.get('/departments')
          ]);

          const usersCount = Array.isArray(userRes.data.data) ? userRes.data.data.length : (userRes.data.results || 0);
          setStats({ 
              users: usersCount, 
              posts: postRes.data.total || 0 
          });

          setPosts(postRes.data.data);
          setMenus(menuRes.data.data);
          setDepartments(deptRes.data.data || []); 
      } catch(e) {
          console.error("Lỗi tải dữ liệu", e);
      }
  };

  useEffect(() => {
      fetchData();
  }, []);

  // --- 2. XỬ LÝ ATTACHMENTS (SỬA LỖI UPLOAD) ---
  const handleUpload = (info: any) => {
      if (info.file.status === 'uploading') {
          setLoading(true);
          return;
      }
      if (info.file.status === 'done') {
          setLoading(false);
          // Kiểm tra cấu trúc response từ server của bạn
          const serverData = info.file.response.data; 
          const newFiles = serverData.map((f: any) => ({
             name: f.name || info.file.name, 
             path: f.path, 
             type: f.type?.includes('image') ? 'image' : 'file'
          }));
          setAttachments(prev => [...prev, ...newFiles]);
          message.success('Đã tải file lên thành công');
      } else if (info.file.status === 'error') {
          setLoading(false);
          message.error('Không thể tải file lên server');
      }
  };

  const handleAddLink = () => {
      if (!linkInput) return;
      setAttachments(prev => [...prev, { name: linkInput, path: linkInput, type: 'link' }]);
      setLinkInput('');
  };

  const removeAttachment = (index: number) => {
      setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  // --- 3. CRUD LOGIC ---
  const handleOpenCreate = () => {
      setEditingPost(null);
      setAttachments([]);
      setSendToAll(true);
      form.resetFields();
      form.setFieldsValue({ sendType: 'ALL' });
      setIsModalOpen(true);
  };

  const handleOpenEdit = (record: any) => {
      setEditingPost(record);
      setAttachments(record.attachments || []);
      const hasTarget = record.targets && record.targets.length > 0;
      setSendToAll(!hasTarget);

      form.setFieldsValue({
          title: record.title,
          content: record.content,
          menuId: record.menuId,
          sendType: hasTarget ? 'DEPT' : 'ALL',
          targetDeptIds: hasTarget ? record.targets.map((t: any) => t.departmentId) : []
      });
      setIsModalOpen(true);
  };

  const handleSubmit = async (values: any) => {
      setLoading(true);
      try {
          const payload = { 
              ...values, 
              attachments: attachments,
              targetDeptIds: values.sendType === 'ALL' ? [] : values.targetDeptIds
          };
          
          if (editingPost) {
              await axiosClient.patch(`/posts/${editingPost.id}`, payload);
              message.success('Cập nhật thành công!');
          } else {
              await axiosClient.post('/posts', payload);
              message.success('Đăng bài thành công!');
          }

          setIsModalOpen(false);
          fetchData();
      } catch (error: any) {
          message.error(error.response?.data?.message || 'Có lỗi xảy ra!');
      } finally {
          setLoading(false);
      }
  };

  const handleDelete = async (id: string) => {
      try {
          await axiosClient.delete(`/posts/${id}`);
          message.success('Đã xóa bài viết');
          fetchData();
      } catch (error: any) {
          message.error(error.response?.data?.message || 'Lỗi khi xóa bài viết');
      }
  };

  // --- RENDER COLUMNS ---
  const columns = [
      { title: 'Tiêu đề', dataIndex: 'title', render: (t: string) => <b className="text-indigo-700">{t}</b> },
      { title: 'Chuyên mục', dataIndex: ['menu', 'title'], render: (t: string) => <Tag color="blue">{t}</Tag> },
      {
          title: 'Đối tượng',
          render: (_: any, record: any) => (
              record.targets && record.targets.length > 0 
              ? <Tag color="orange"><TeamOutlined /> {record.targets.length} Phòng ban</Tag>
              : <Tag color="green"><GlobalOutlined /> Tất cả</Tag>
          )
      },
      { 
          title: 'Đính kèm', dataIndex: 'attachments',
          render: (files: Attachment[]) => (
              <Space>
                  {files?.some(f => f.type === 'image') && <FileImageOutlined className="text-orange-500" />}
                  {files?.some(f => f.type === 'file') && <FilePdfOutlined className="text-red-500" />}
                  {files?.some(f => f.type === 'link') && <GlobalOutlined className="text-blue-500" />}
              </Space>
          )
      },
      { title: 'Ngày tạo', dataIndex: 'createdAt', render: (d: string) => new Date(d).toLocaleDateString('vi-VN') },
      {
          title: 'Hành động',
          render: (_: any, record: any) => (
              <Space>
                  <Button size="small" icon={<EditOutlined />} onClick={() => handleOpenEdit(record)} />
                  <Popconfirm title="Xóa bài này?" onConfirm={() => handleDelete(record.id)} okButtonProps={{ danger: true }}>
                      <Button size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
              </Space>
          )
      }
  ];

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">Dashboard Quản trị</h2>
      
      <Row gutter={16} className="mb-8">
        <Col span={8}><Card className="bg-indigo-50"><Statistic title="Tổng nhân sự" value={stats.users} prefix={<UserOutlined />} /></Card></Col>
        <Col span={8}><Card className="bg-green-50"><Statistic title="Tổng bài viết" value={stats.posts} prefix={<FileTextOutlined />} /></Card></Col>
        <Col span={8}><Button type="primary" size="large" icon={<PlusOutlined />} className="w-full h-full" onClick={handleOpenCreate}>SOẠN TIN TỨC MỚI</Button></Col>
      </Row>

      <Card title="Quản lý Bài đăng">
          <Table rowKey="id" columns={columns} dataSource={posts} pagination={{ pageSize: 5 }} />
      </Card>

      <Modal 
        title={editingPost ? "Cập nhật bài viết" : "Đăng thông báo mới"} 
        open={isModalOpen} 
        onCancel={() => setIsModalOpen(false)} 
        footer={null} 
        width={800}
      >
         <Form form={form} layout="vertical" onFinish={handleSubmit}>
            <Form.Item name="title" label="Tiêu đề" rules={[{ required: true }]}><Input /></Form.Item>
            
            <Row gutter={16}>
                <Col span={12}>
                    <Form.Item name="menuId" label="Chuyên mục" rules={[{ required: true }]}>
                        <Select placeholder="Chọn mục">
                            {menus.map(m => <Select.Option key={m.id} value={m.id}>{m.title}</Select.Option>)}
                        </Select>
                    </Form.Item>
                </Col>
                <Col span={12}>
                    <Form.Item name="sendType" label="Đối tượng">
                        <Radio.Group onChange={(e) => setSendToAll(e.target.value === 'ALL')}>
                            <Radio value="ALL">Tất cả</Radio>
                            <Radio value="DEPT">Phòng ban</Radio>
                        </Radio.Group>
                    </Form.Item>
                </Col>
            </Row>

            {!sendToAll && (
                <Form.Item name="targetDeptIds" label="Chọn phòng ban" rules={[{ required: true }]}>
                    <Select mode="multiple" placeholder="Chọn...">
                        {departments.map(d => <Select.Option key={d.id} value={d.id}>{d.name}</Select.Option>)}
                    </Select>
                </Form.Item>
            )}

            <Form.Item name="content" label="Nội dung" rules={[{ required: true }]}><Input.TextArea rows={5} /></Form.Item>

            <div className="bg-gray-50 p-4 rounded border mb-4">
                <p className="font-semibold mb-2"><PaperClipOutlined /> Đính kèm</p>
                <List size="small" dataSource={attachments} renderItem={(item, index) => (
                    <List.Item actions={[<Button danger type="text" size="small" icon={<DeleteOutlined />} onClick={() => removeAttachment(index)} />]}>
                        <List.Item.Meta 
                            avatar={item.type === 'image' ? <FileImageOutlined className="text-orange-500" /> : item.type === 'link' ? <GlobalOutlined className="text-blue-500" /> : <FilePdfOutlined className="text-red-500" />}
                            title={<span className="text-xs">{item.name}</span>}
                        />
                    </List.Item>
                )} />
                <div className="flex gap-4 mt-4 pt-4 border-t">
                    <Upload 
                        name="files" 
                        action={`${API_URL}/upload`} // Sử dụng API_URL đã cấu hình /api
                        headers={{ Authorization: `Bearer ${localStorage.getItem('token')}` }} 
                        multiple 
                        showUploadList={false} 
                        onChange={handleUpload}
                    >
                        <Button icon={<UploadOutlined />}>Tải File/Ảnh</Button>
                    </Upload>
                    <Input.Group compact style={{ display: 'flex' }}>
                        <Input style={{ width: 'calc(100% - 80px)' }} placeholder="Dán link..." value={linkInput} onChange={e => setLinkInput(e.target.value)} />
                        <Button type="primary" onClick={handleAddLink}>Thêm</Button>
                    </Input.Group>
                </div>
            </div>

            <div className="flex justify-end gap-2">
                <Button onClick={() => setIsModalOpen(false)}>Hủy</Button>
                <Button type="primary" htmlType="submit" loading={loading}>Xác nhận</Button>
            </div>
         </Form>
      </Modal>
    </div>
  );
};

export default Dashboard;