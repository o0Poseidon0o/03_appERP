import React, { useEffect, useState } from 'react';
import { 
  Card, Statistic, Row, Col, Button, Modal, Form, Input, 
  Select, Upload, message, Table, Tag, Space, Popconfirm, List, Radio, Avatar 
} from 'antd';
import { 
  UserOutlined, FileTextOutlined, UploadOutlined, PlusOutlined, 
  EditOutlined, DeleteOutlined, PaperClipOutlined, 
  FilePdfOutlined, FileImageOutlined, GlobalOutlined, TeamOutlined, 
  EyeOutlined
} from '@ant-design/icons';
import axiosClient from '../../api/axiosClient';

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
  const [isViewModalOpen, setIsViewModalOpen] = useState(false); // Modal xem danh sách người đã xem
  const [viewingUserList, setViewingUserList] = useState<any[]>([]); // Danh sách user đã xem của 1 bài
  const [loading, setLoading] = useState(false);
  const [editingPost, setEditingPost] = useState<any>(null);
  const [sendToAll, setSendToAll] = useState(true);
  
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [linkInput, setLinkInput] = useState('');

  const fetchData = async () => {
      try {
          const [userRes, postRes, menuRes, deptRes] = await Promise.all([
              axiosClient.get('/users'),
              axiosClient.get('/posts?limit=100'),
              axiosClient.get('/menus'),
              axiosClient.get('/departments')
          ]);

          // Lấy đúng số lượng nhân sự từ mảng trả về
          const usersData = userRes.data.data || userRes.data;
          const usersCount = Array.isArray(usersData) ? usersData.length : 0;

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

  // --- HÀM XEM DANH SÁCH USER ĐÃ ĐỌC TIN ---
  const handleShowViewers = async (post: any) => {
    try {
      // Giả sử backend có route: GET /posts/:id/viewers
      // Nếu chưa có, bạn cần bổ sung logic này ở Backend
      const res = await axiosClient.get(`/posts/${post.id}/viewers`);
      setViewingUserList(res.data.data || []);
      setIsViewModalOpen(true);
    } catch (error) {
      message.error("Không thể lấy danh sách lượt xem");
    }
  };

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
          message.error('Lỗi tải file lên server.');
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
          message.error('Lỗi khi xóa bài viết');
      }
  };

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
          title: 'Đối tượng',
          render: (_: any, record: any) => (
              record.targets && record.targets.length > 0 
              ? <Tag color="orange"><TeamOutlined /> {record.targets.length} Phòng ban</Tag>
              : <Tag color="green"><GlobalOutlined /> Tất cả</Tag>
          )
      },
      {
        title: 'Lượt xem',
        key: 'views',
        align: 'center' as const,
        render: (_: any, record: any) => (
          <Button 
            type="text" 
            icon={<EyeOutlined className="text-blue-500" />} 
            onClick={() => handleShowViewers(record)}
          >
            {record._count?.views || 0}
          </Button>
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
                    onConfirm={() => handleDelete(record.id)} 
                    okButtonProps={{ danger: true }}
                  >
                      <Button size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
              </Space>
          )
      }
  ];

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">Quản trị Tin tức</h2>
      
      {/* THỐNG KÊ NHANH */}
      <Row gutter={16} className="mb-8">
        <Col span={8}>
          <Card className="shadow-sm border-none bg-white">
            <Statistic title="Tổng số nhân sự" value={stats.users} prefix={<UserOutlined className="text-indigo-500" />} />
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
            className="w-full h-full text-lg font-semibold" 
            onClick={handleOpenCreate}
          >
            SOẠN TIN MỚI
          </Button>
        </Col>
      </Row>

      <Card title="Danh sách bài viết" className="shadow-sm border-none">
          <Table rowKey="id" columns={columns} dataSource={posts} pagination={{ pageSize: 10 }} />
      </Card>

      {/* MODAL SOẠN THẢO */}
      <Modal 
        title={editingPost ? "Chỉnh sửa bài viết" : "Tạo bài viết mới"} 
        open={isModalOpen} 
        onCancel={() => setIsModalOpen(false)} 
        footer={null} 
        width={850}
      >
         <Form form={form} layout="vertical" onFinish={handleSubmit} className="mt-4">
            <Form.Item name="title" label="Tiêu đề" rules={[{ required: true }]}><Input size="large" /></Form.Item>
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
                            <Radio value="ALL">Tất cả nhân viên</Radio>
                            <Radio value="DEPT">Theo phòng ban</Radio>
                        </Radio.Group>
                    </Form.Item>
                </Col>
            </Row>

            {!sendToAll && (
                <Form.Item name="targetDeptIds" label="Chọn phòng ban" rules={[{ required: true }]}>
                    <Select mode="multiple" placeholder="Nhấp để chọn...">
                        {departments.map(d => <Select.Option key={d.id} value={d.id}>{d.name}</Select.Option>)}
                    </Select>
                </Form.Item>
            )}

            <Form.Item name="content" label="Nội dung" rules={[{ required: true }]}><Input.TextArea rows={6} /></Form.Item>

            <div className="bg-gray-50 p-4 rounded-lg border mb-6">
                <p className="font-semibold mb-3"><PaperClipOutlined /> Đính kèm</p>
                <List 
                  size="small" 
                  dataSource={attachments} 
                  renderItem={(item, index) => (
                    <List.Item actions={[<Button danger type="text" size="small" icon={<DeleteOutlined />} onClick={() => removeAttachment(index)} />]}>
                        <List.Item.Meta 
                            avatar={item.type === 'image' ? <FileImageOutlined /> : item.type === 'link' ? <GlobalOutlined /> : <FilePdfOutlined />}
                            title={<span className="text-xs">{item.name}</span>}
                        />
                    </List.Item>
                )} />
                <div className="flex gap-4 mt-2">
                    <Upload 
                        name="files" 
                        action={`${API_URL}/upload`} 
                        headers={{ Authorization: `Bearer ${localStorage.getItem('token')}` }} 
                        showUploadList={false} 
                        onChange={handleUpload}
                    >
                        <Button icon={<UploadOutlined />}>Tải File</Button>
                    </Upload>
                    <Input.Group compact style={{ display: 'flex', flex: 1 }}>
                        <Input placeholder="Dán link..." value={linkInput} onChange={e => setLinkInput(e.target.value)} />
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

      {/* MODAL XEM CHI TIẾT NGƯỜI ĐÃ XEM TIN */}
      <Modal
        title="Danh sách nhân viên đã xem tin"
        open={isViewModalOpen}
        onCancel={() => setIsViewModalOpen(false)}
        footer={[<Button key="close" onClick={() => setIsViewModalOpen(false)}>Đóng</Button>]}
      >
        <List
          itemLayout="horizontal"
          dataSource={viewingUserList}
          renderItem={(item: any) => (
            <List.Item>
              <List.Item.Meta
                avatar={<Avatar icon={<UserOutlined />} src={item.user?.avatar} />}
                title={item.user?.fullName}
                description={
                  <Space>
                    <Tag color="cyan">{item.user?.department?.name || 'N/A'}</Tag>
                    <span className="text-gray-400 text-xs italic">Xem lúc: {new Date(item.createdAt).toLocaleString('vi-VN')}</span>
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      </Modal>
    </div>
  );
};

export default Dashboard;