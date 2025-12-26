import React, { useEffect, useState } from 'react';
import { 
  Card, Statistic, Row, Col, Button, Modal, Form, Input, 
  Select, Upload, message, Table, Tag, Space, Popconfirm, List, Tooltip, Radio 
} from 'antd';
import { 
  UserOutlined, FileTextOutlined, UploadOutlined, PlusOutlined, 
  EditOutlined, DeleteOutlined, LinkOutlined, PaperClipOutlined, 
  FilePdfOutlined, FileImageOutlined, GlobalOutlined, TeamOutlined 
} from '@ant-design/icons';
import axiosClient from '../../api/axiosClient';
import { useAuth } from '../../contexts/AuthContext';

// URL Backend
const BASE_URL = 'http://localhost:3000'; // Hoặc import.meta.env.VITE_API_URL

interface Attachment {
  name: string;
  path: string;
  type: string;
}

const Dashboard: React.FC = () => {
  const { token } = useAuth();
  const [form] = Form.useForm();
  
  // --- STATE ---
  const [stats, setStats] = useState({ users: 0, posts: 0 });
  const [posts, setPosts] = useState<any[]>([]);
  const [menus, setMenus] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]); // Danh sách phòng ban
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingPost, setEditingPost] = useState<any>(null);
  const [sendToAll, setSendToAll] = useState(true); // State toggle Radio button
  
  // Attachment State
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [linkInput, setLinkInput] = useState('');

  // --- 1. LOAD DỮ LIỆU ---
  const fetchData = async () => {
      try {
          const [userRes, postRes, menuRes, deptRes] = await Promise.all([
              axiosClient.get('/users'),
              axiosClient.get('/posts?limit=100'),
              axiosClient.get('/menus'),
              axiosClient.get('/departments') // Đảm bảo bạn có API này (trả về id, name)
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

  // --- 2. XỬ LÝ ATTACHMENTS ---
  const handleUpload = (info: any) => {
      if (info.file.status === 'done') {
          const newFiles = info.file.response.data.map((f: any) => ({
             name: f.name, path: f.path, type: f.type.includes('image') ? 'image' : 'file'
          }));
          setAttachments(prev => [...prev, ...newFiles]);
          message.success('Đã tải file lên');
      }
  };

  const handleAddLink = () => {
      if (!linkInput) return;
      setAttachments(prev => [...prev, { name: linkInput, path: linkInput, type: 'link' }]);
      setLinkInput('');
  };

  const removeAttachment = (index: number) => {
      const newDocs = [...attachments];
      newDocs.splice(index, 1);
      setAttachments(newDocs);
  };

  // --- 3. CRUD LOGIC ---
  const handleOpenCreate = () => {
      setEditingPost(null);
      setAttachments([]);
      setSendToAll(true); // Mặc định gửi tất cả
      form.resetFields();
      form.setFieldsValue({ sendType: 'ALL' });
      setIsModalOpen(true);
  };

  const handleOpenEdit = (record: any) => {
      setEditingPost(record);
      setAttachments(record.attachments || []);
      
      // Kiểm tra xem bài viết cũ target phòng ban nào
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
          // Logic: Nếu chọn ALL thì targetDeptIds gửi lên là mảng rỗng
          const payload = { 
              ...values, 
              attachments: attachments,
              targetDeptIds: values.sendType === 'ALL' ? [] : values.targetDeptIds
          };
          
          if (editingPost) {
              await axiosClient.patch(`/posts/${editingPost.id}`, payload);
              message.success('Cập nhật bài viết thành công!');
          } else {
              await axiosClient.post('/posts', payload);
              message.success('Đăng bài và gửi email thông báo thành công!');
          }

          setIsModalOpen(false);
          fetchData();
      } catch (error) {
          message.error('Có lỗi xảy ra!');
      } finally {
          setLoading(false);
      }
  };

  const handleDelete = async (id: string) => {
      try {
          await axiosClient.delete(`/posts/${id}`);
          message.success('Đã xóa bài viết');
          fetchData();
      } catch (error) {
          message.error('Lỗi xóa bài viết');
      }
  };

  // --- 4. RENDER CỘT ---
  const columns = [
      { 
          title: 'Tiêu đề', dataIndex: 'title', 
          render: (t: string) => <b className="text-indigo-700">{t}</b> 
      },
      { 
          title: 'Chuyên mục', dataIndex: ['menu', 'title'],
          render: (t: string) => <Tag color="blue">{t}</Tag>
      },
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
                  {files?.some(f => f.type === 'image') && <Tooltip title="Có hình ảnh"><FileImageOutlined className="text-orange-500" /></Tooltip>}
                  {files?.some(f => f.type === 'file') && <Tooltip title="Có tài liệu"><FilePdfOutlined className="text-red-500" /></Tooltip>}
                  {files?.some(f => f.type === 'link') && <Tooltip title="Có liên kết"><GlobalOutlined className="text-blue-500" /></Tooltip>}
              </Space>
          )
      },
      { 
          title: 'Ngày tạo', dataIndex: 'createdAt', 
          render: (d: string) => new Date(d).toLocaleDateString('vi-VN') 
      },
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
    <div>
      <h2 className="text-2xl font-bold mb-6">Dashboard Quản trị</h2>
      
      {/* THỐNG KÊ */}
      <Row gutter={16} className="mb-8">
        <Col span={8}><Card className="bg-indigo-50"><Statistic title="Tổng nhân sự" value={stats.users} prefix={<UserOutlined />} valueStyle={{ color: '#3f51b5' }} /></Card></Col>
        <Col span={8}><Card className="bg-green-50"><Statistic title="Tổng bài viết" value={stats.posts} prefix={<FileTextOutlined />} valueStyle={{ color: '#3f8600' }} /></Card></Col>
        <Col span={8}><Button type="primary" size="large" icon={<PlusOutlined />} className="w-full h-full text-lg shadow-md" onClick={handleOpenCreate}>SOẠN TIN TỨC MỚI</Button></Col>
      </Row>

      {/* BẢNG DỮ LIỆU */}
      <Card title="Quản lý Bài đăng" className="shadow-sm">
          <Table rowKey="id" columns={columns} dataSource={posts} pagination={{ pageSize: 5 }} />
      </Card>

      {/* MODAL FORM */}
      <Modal 
        title={editingPost ? "Cập nhật bài viết" : "Đăng thông báo mới"} 
        open={isModalOpen} 
        onCancel={() => setIsModalOpen(false)} 
        footer={null} 
        width={800}
        maskClosable={false}
      >
         <Form form={form} layout="vertical" onFinish={handleSubmit}>
            <Form.Item name="title" label="Tiêu đề" rules={[{ required: true, message: 'Nhập tiêu đề' }]}><Input /></Form.Item>
            
            <Row gutter={16}>
                <Col span={12}>
                    <Form.Item name="menuId" label="Chuyên mục" rules={[{ required: true, message: 'Chọn chuyên mục' }]}>
                        <Select placeholder="Chọn mục hiển thị">
                            {menus.map(m => <Select.Option key={m.id} value={m.id}>{m.title}</Select.Option>)}
                        </Select>
                    </Form.Item>
                </Col>
                <Col span={12}>
                    {/* CHỌN ĐỐI TƯỢNG GỬI */}
                    <Form.Item name="sendType" label="Đối tượng nhận thông báo">
                        <Radio.Group onChange={(e) => setSendToAll(e.target.value === 'ALL')}>
                            <Radio value="ALL">Tất cả nhân viên</Radio>
                            <Radio value="DEPT">Theo phòng ban</Radio>
                        </Radio.Group>
                    </Form.Item>
                </Col>
            </Row>

            {/* SELECT PHÒNG BAN (Chỉ hiện khi chọn 'Theo phòng ban') */}
            {!sendToAll && (
                <Form.Item 
                    name="targetDeptIds" 
                    label="Chọn phòng ban nhận tin" 
                    rules={[{ required: true, message: 'Vui lòng chọn ít nhất 1 phòng ban' }]}
                >
                    <Select mode="multiple" placeholder="Chọn phòng ban..." optionFilterProp="children">
                        {departments.map(d => <Select.Option key={d.id} value={d.id}>{d.name}</Select.Option>)}
                    </Select>
                </Form.Item>
            )}

            <Form.Item name="content" label="Nội dung" rules={[{ required: true }]}><Input.TextArea rows={5} /></Form.Item>

            {/* UPLOAD & LINK */}
            <div className="bg-gray-50 p-4 rounded border mb-4">
                <p className="font-semibold mb-2 flex items-center gap-2"><PaperClipOutlined /> Đính kèm</p>
                <List size="small" dataSource={attachments} renderItem={(item, index) => (
                    <List.Item actions={[<Button danger type="text" size="small" icon={<DeleteOutlined />} onClick={() => removeAttachment(index)} />]}>
                        <List.Item.Meta 
                            avatar={item.type === 'image' ? <FileImageOutlined className="text-orange-500" /> : item.type === 'link' ? <GlobalOutlined className="text-blue-500" /> : <FilePdfOutlined className="text-red-500" />}
                            title={<span className="text-xs">{item.name}</span>}
                            description={item.type === 'link' ? <a href={item.path} target="_blank" rel="noreferrer" className="text-xs text-blue-400">{item.path}</a> : null}
                        />
                    </List.Item>
                )} />
                <div className="flex gap-4 mt-4 pt-4 border-t">
                    <Upload name="files" action={`${BASE_URL}/api/upload`} headers={{ Authorization: `Bearer ${token}` }} multiple showUploadList={false} onChange={handleUpload}>
                        <Button icon={<UploadOutlined />}>Tải File/Ảnh</Button>
                    </Upload>
                    <Input.Group compact style={{ display: 'flex' }}>
                        <Input style={{ width: 'calc(100% - 80px)' }} placeholder="Dán link..." value={linkInput} onChange={e => setLinkInput(e.target.value)} prefix={<LinkOutlined />} />
                        <Button type="primary" onClick={handleAddLink}>Thêm</Button>
                    </Input.Group>
                </div>
            </div>

            <div className="flex justify-end gap-2 mt-4">
                <Button onClick={() => setIsModalOpen(false)}>Hủy</Button>
                <Button type="primary" htmlType="submit" loading={loading}>{editingPost ? 'Lưu thay đổi' : 'Đăng & Gửi mail'}</Button>
            </div>
         </Form>
      </Modal>
    </div>
  );
};

export default Dashboard;