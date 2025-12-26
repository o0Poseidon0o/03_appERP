import React, { useEffect, useState } from 'react';
import { 
  Card, Statistic, Row, Col, Button, Modal, Form, Input, 
  Select, Upload, message, Table, Tag, Space, Popconfirm, List, Radio, Tooltip 
} from 'antd';
import { 
  UserOutlined, FileTextOutlined, UploadOutlined, PlusOutlined, 
  EditOutlined, DeleteOutlined, PaperClipOutlined, 
  FilePdfOutlined, FileImageOutlined, GlobalOutlined, TeamOutlined, LinkOutlined 
} from '@ant-design/icons';
import axiosClient from '../../api/axiosClient';

// Lấy baseURL từ cấu hình axiosClient để đảm bảo đồng bộ môi trường (Dev/Prod)
const API_URL = axiosClient.defaults.baseURL;

interface Attachment {
  name: string;
  path: string;
  type: string;
}

const Dashboard: React.FC = () => {
  const [form] = Form.useForm();
  
  // --- STATE QUẢN LÝ DỮ LIỆU ---
  const [stats, setStats] = useState({ users: 0, posts: 0 });
  const [posts, setPosts] = useState<any[]>([]);
  const [menus, setMenus] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  
  // --- STATE QUẢN LÝ UI ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingPost, setEditingPost] = useState<any>(null);
  const [sendToAll, setSendToAll] = useState(true);
  
  // --- STATE QUẢN LÝ ĐÍNH KÈM ---
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [linkInput, setLinkInput] = useState('');

  // --- 1. TẢI DỮ LIỆU TỪ SERVER ---
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
          console.error("Lỗi tải dữ liệu Dashboard:", e);
          message.error("Không thể tải dữ liệu từ máy chủ");
      }
  };

  useEffect(() => {
      fetchData();
  }, []);

  // --- 2. XỬ LÝ TẬP TIN ĐÍNH KÈM ---
  const handleUpload = (info: any) => {
      if (info.file.status === 'uploading') {
          setLoading(true);
          return;
      }
      if (info.file.status === 'done') {
          setLoading(false);
          const serverData = info.file.response.data; 
          const newFiles = serverData.map((f: any) => ({
             name: f.name || info.file.name, 
             path: f.path, 
             type: f.type?.includes('image') ? 'image' : 'file'
          }));
          setAttachments(prev => [...prev, ...newFiles]);
          message.success(`Đã tải lên: ${info.file.name}`);
      } else if (info.file.status === 'error') {
          setLoading(false);
          message.error('Lỗi tải file lên server. Kiểm tra dung lượng hoặc kết nối.');
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

  // --- 3. LOGIC CRUD (THÊM, SỬA, XÓA) ---
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
              message.success('Cập nhật bài viết thành công!');
          } else {
              await axiosClient.post('/posts', payload);
              message.success('Đăng bài và gửi email thông báo thành công!');
          }

          setIsModalOpen(false);
          fetchData();
      } catch (error: any) {
          message.error(error.response?.data?.message || 'Có lỗi xảy ra khi lưu bài viết!');
      } finally {
          setLoading(false);
      }
  };

  const handleDelete = async (id: string) => {
      try {
          await axiosClient.delete(`/posts/${id}`);
          message.success('Đã xóa bài viết và dọn dẹp file thành công');
          fetchData();
      } catch (error: any) {
          message.error(error.response?.data?.message || 'Lỗi khi xóa bài viết từ server');
      }
  };

  // --- 4. CẤU HÌNH BẢNG HIỂN THỊ ---
  const columns = [
      { 
        title: 'Tiêu đề', 
        dataIndex: 'title', 
        render: (t: string) => <b className="text-indigo-700">{t}</b> 
      },
      { 
        title: 'Chuyên mục', 
        dataIndex: ['menu', 'title'], 
        render: (t: string) => <Tag color="blue">{t}</Tag> 
      },
      {
          title: 'Đối tượng nhận',
          render: (_: any, record: any) => (
              record.targets && record.targets.length > 0 
              ? <Tag color="orange"><TeamOutlined /> {record.targets.length} Phòng ban</Tag>
              : <Tag color="green"><GlobalOutlined /> Tất cả nhân viên</Tag>
          )
      },
      { 
          title: 'Đính kèm', 
          dataIndex: 'attachments',
          render: (files: Attachment[]) => (
              <Space>
                  {files?.some(f => f.type === 'image') && <Tooltip title="Ảnh"><FileImageOutlined className="text-orange-500" /></Tooltip>}
                  {files?.some(f => f.type === 'file') && <Tooltip title="Tài liệu"><FilePdfOutlined className="text-red-500" /></Tooltip>}
                  {files?.some(f => f.type === 'link') && <Tooltip title="Liên kết"><GlobalOutlined className="text-blue-500" /></Tooltip>}
              </Space>
          )
      },
      { 
        title: 'Ngày tạo', 
        dataIndex: 'createdAt', 
        render: (d: string) => new Date(d).toLocaleDateString('vi-VN') 
      },
      {
          title: 'Thao tác',
          render: (_: any, record: any) => (
              <Space>
                  <Button size="small" icon={<EditOutlined />} onClick={() => handleOpenEdit(record)} />
                  <Popconfirm 
                    title="Xóa bài viết này?" 
                    description="Hành động này sẽ xóa dữ liệu và các tệp đính kèm liên quan."
                    onConfirm={() => handleDelete(record.id)} 
                    okButtonProps={{ danger: true }}
                    okText="Xóa"
                    cancelText="Hủy"
                  >
                      <Button size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
              </Space>
          )
      }
  ];

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">Bảng điều khiển Quản trị</h2>
      
      {/* THỐNG KÊ NHANH */}
      <Row gutter={16} className="mb-8">
        <Col span={8}>
          <Card className="shadow-sm border-none bg-white">
            <Statistic title="Tổng nhân sự" value={stats.users} prefix={<UserOutlined className="text-indigo-500" />} />
          </Card>
        </Col>
        <Col span={8}>
          <Card className="shadow-sm border-none bg-white">
            <Statistic title="Bài thông báo" value={stats.posts} prefix={<FileTextOutlined className="text-green-500" />} />
          </Card>
        </Col>
        <Col span={8}>
          <Button 
            type="primary" 
            size="large" 
            icon={<PlusOutlined />} 
            className="w-full h-full text-lg font-semibold shadow-indigo-200 shadow-lg" 
            onClick={handleOpenCreate}
          >
            SOẠN TIN MỚI
          </Button>
        </Col>
      </Row>

      {/* DANH SÁCH BÀI ĐĂNG */}
      <Card title="Quản lý tin tức & Thông báo" className="shadow-sm border-none">
          <Table rowKey="id" columns={columns} dataSource={posts} pagination={{ pageSize: 7 }} />
      </Card>

      {/* MODAL SOẠN THẢO */}
      <Modal 
        title={editingPost ? "Chỉnh sửa bài viết" : "Tạo bài viết & Gửi Email"} 
        open={isModalOpen} 
        onCancel={() => setIsModalOpen(false)} 
        footer={null} 
        width={850}
        maskClosable={false}
      >
         <Form form={form} layout="vertical" onFinish={handleSubmit} className="mt-4">
            <Form.Item name="title" label="Tiêu đề thông báo" rules={[{ required: true, message: 'Vui lòng nhập tiêu đề' }]}>
              <Input placeholder="Ví dụ: Thông báo nghỉ lễ..." size="large" />
            </Form.Item>
            
            <Row gutter={16}>
                <Col span={12}>
                    <Form.Item name="menuId" label="Chuyên mục hiển thị" rules={[{ required: true, message: 'Chọn chuyên mục' }]}>
                        <Select placeholder="Chọn mục">
                            {menus.map(m => <Select.Option key={m.id} value={m.id}>{m.title}</Select.Option>)}
                        </Select>
                    </Form.Item>
                </Col>
                <Col span={12}>
                    <Form.Item name="sendType" label="Đối tượng nhận tin">
                        <Radio.Group onChange={(e) => setSendToAll(e.target.value === 'ALL')}>
                            <Radio value="ALL">Tất cả nhân viên</Radio>
                            <Radio value="DEPT">Theo phòng ban</Radio>
                        </Radio.Group>
                    </Form.Item>
                </Col>
            </Row>

            {!sendToAll && (
                <Form.Item 
                  name="targetDeptIds" 
                  label="Chọn phòng ban nhận thông báo" 
                  rules={[{ required: true, message: 'Chọn ít nhất một phòng ban' }]}
                >
                    <Select mode="multiple" placeholder="Nhấp để chọn..." optionFilterProp="children">
                        {departments.map(d => <Select.Option key={d.id} value={d.id}>{d.name}</Select.Option>)}
                    </Select>
                </Form.Item>
            )}

            <Form.Item name="content" label="Nội dung chi tiết" rules={[{ required: true, message: 'Vui lòng nhập nội dung' }]}>
              <Input.TextArea rows={6} placeholder="Nhập nội dung thông báo tại đây..." />
            </Form.Item>

            {/* QUẢN LÝ ĐÍNH KÈM */}
            <div className="bg-gray-50 p-4 rounded-lg border border-dashed border-gray-300 mb-6">
                <p className="font-semibold mb-3 flex items-center gap-2"><PaperClipOutlined className="text-indigo-600" /> Tệp đính kèm & Liên kết</p>
                
                <List 
                  size="small" 
                  className="mb-4"
                  dataSource={attachments} 
                  renderItem={(item, index) => (
                    <List.Item 
                      className="bg-white mb-1 rounded px-3 border-none shadow-sm"
                      actions={[<Button danger type="text" size="small" icon={<DeleteOutlined />} onClick={() => removeAttachment(index)} />]}
                    >
                        <List.Item.Meta 
                            avatar={item.type === 'image' ? <FileImageOutlined className="text-orange-500" /> : item.type === 'link' ? <GlobalOutlined className="text-blue-500" /> : <FilePdfOutlined className="text-red-500" />}
                            title={<span className="text-xs text-gray-600">{item.name}</span>}
                        />
                    </List.Item>
                )} />

                <div className="flex flex-col md:flex-row gap-4 pt-3 border-t border-gray-200">
                    <Upload 
                        name="files" 
                        action={`${API_URL}/upload`} 
                        headers={{ Authorization: `Bearer ${localStorage.getItem('token')}` }} 
                        multiple 
                        showUploadList={false} 
                        onChange={handleUpload}
                    >
                        <Button icon={<UploadOutlined />} loading={loading} className="w-full md:w-auto">Tải File/Ảnh</Button>
                    </Upload>
                    
                    <div className="flex flex-1">
                      <Input 
                        placeholder="Dán liên kết URL (Youtube, Driver...)" 
                        value={linkInput} 
                        onChange={e => setLinkInput(e.target.value)} 
                        prefix={<LinkOutlined className="text-gray-400" />}
                        className="rounded-r-none"
                      />
                      <Button type="primary" onClick={handleAddLink} className="rounded-l-none">Thêm Link</Button>
                    </div>
                </div>
            </div>

            <div className="flex justify-end gap-3 mt-8">
                <Button onClick={() => setIsModalOpen(false)} size="large">Hủy bỏ</Button>
                <Button 
                  type="primary" 
                  htmlType="submit" 
                  loading={loading} 
                  size="large" 
                  className="px-8 shadow-md"
                >
                  {editingPost ? 'Lưu thay đổi' : 'Đăng bài & Gửi Mail'}
                </Button>
            </div>
         </Form>
      </Modal>
    </div>
  );
};

export default Dashboard;