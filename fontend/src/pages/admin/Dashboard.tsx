import React, { useEffect, useState } from 'react';
import { 
  Card, Statistic, Row, Col, Button, Modal, Form, Input, 
  Select, Upload, message, Table, Tag, Space, Popconfirm, List, Radio, Avatar, Tooltip 
} from 'antd';
import { 
  UserOutlined, FileTextOutlined, UploadOutlined, PlusOutlined, 
  EditOutlined, DeleteOutlined, PaperClipOutlined, 
  FilePdfOutlined, FileImageOutlined, GlobalOutlined, TeamOutlined, 
  EyeOutlined, ReloadOutlined, LinkOutlined, SendOutlined 
} from '@ant-design/icons';
import axiosClient from '../../api/axiosClient';

// --- IMPORT BỘ SOẠN THẢO ---
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';

const API_URL = axiosClient.defaults.baseURL;

const quillModules = {
  toolbar: [
    [{ 'header': [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
    [{ 'color': [] }, { 'background': [] }],
    ['link', 'clean']
  ],
};

interface Attachment {
  name: string;
  path: string;
  type: string;
}

const Dashboard: React.FC = () => {
  const [form] = Form.useForm();
  
  const [stats, setStats] = useState({ users: 0, posts: 0 });
  const [posts, setPosts] = useState<any[]>([]);
  const [menus, setMenus] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false); 
  const [viewingUserList, setViewingUserList] = useState<any[]>([]); 
  const [loading, setLoading] = useState(false);
  const [editingPost, setEditingPost] = useState<any>(null);
  
  const [sendToAll, setSendToAll] = useState(true);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [linkInput, setLinkInput] = useState('');

  const fetchData = async () => {
      setLoading(true);
      try {
          const [userRes, postRes, menuRes, deptRes] = await Promise.all([
              axiosClient.get('/users'),
              axiosClient.get('/posts?limit=100'),
              axiosClient.get('/menus'),
              axiosClient.get('/departments')
          ]);

          const usersData = userRes.data.data || userRes.data;
          setStats({ 
              users: Array.isArray(usersData) ? usersData.length : 0, 
              posts: postRes.data.total || 0 
          });

          setPosts(postRes.data.data || []);
          setMenus(menuRes.data.data || []);
          setDepartments(deptRes.data.data || []); 
      } catch(e) {
          message.error("Lỗi đồng bộ dữ liệu hệ thống");
      } finally {
          setLoading(false);
      }
  };

  useEffect(() => { fetchData(); }, []);

  const handleShowViewers = async (post: any) => {
    try {
      const res = await axiosClient.get(`/posts/${post.id}/viewers`);
      setViewingUserList(res.data.data || []);
      setIsViewModalOpen(true);
    } catch (error) {
      message.error("Không thể lấy danh sách lượt xem");
    }
  };

  const handleUpload = (info: any) => {
      if (info.file.status === 'uploading') { setLoading(true); return; }
      if (info.file.status === 'done') {
          setLoading(false);
          const serverData = info.file.response.data; 
          const newFiles = serverData.map((f: any) => ({
             name: f.name || info.file.name, 
             path: f.path, 
             type: f.type?.includes('image') ? 'image' : 'file'
          }));
          setAttachments(prev => [...prev, ...newFiles]);
          message.success(`Đã đính kèm: ${info.file.name}`);
      } else if (info.file.status === 'error') {
          setLoading(false);
          message.error('Lỗi tải file.');
      }
  };

  const handleOpenCreate = () => {
      setEditingPost(null);
      setAttachments([]);
      setSendToAll(true);
      form.resetFields();
      form.setFieldsValue({ sendType: 'ALL', content: '' });
      setIsModalOpen(true);
  };

  const handleOpenEdit = (record: any) => {
      setEditingPost(record);
      setAttachments(record.attachments || []);
      const isPublic = record.isPublic !== false;
      setSendToAll(isPublic);
      form.setFieldsValue({
          title: record.title,
          content: record.content,
          menuId: record.menuId,
          sendType: isPublic ? 'ALL' : 'DEPT',
          targetDeptIds: !isPublic ? record.targets?.map((t: any) => t.departmentId) : []
      });
      setIsModalOpen(true);
  };

  const handleSubmit = async (values: any) => {
      setLoading(true);
      try {
          const isAll = values.sendType === 'ALL';
          const payload = { 
              ...values, 
              isPublic: isAll,
              attachments: attachments,
              targetDeptIds: isAll ? [] : values.targetDeptIds
          };
          if (editingPost) {
              await axiosClient.patch(`/posts/${editingPost.id}`, payload);
              message.success('Cập nhật thành công!');
          } else {
              await axiosClient.post('/posts', payload);
              message.success('Đã đăng tin mới!');
          }
          setIsModalOpen(false);
          fetchData();
      } catch (error: any) {
          message.error(error.response?.data?.message || 'Thao tác thất bại!');
      } finally { setLoading(false); }
  };

  const columns = [
      { 
        title: 'Tiêu đề bản tin', 
        dataIndex: 'title', 
        key: 'title',
        render: (t: string) => <span className="font-semibold text-slate-700">{t}</span> 
      },
      { 
        title: 'Chuyên mục', 
        dataIndex: ['menu', 'title'], 
        render: (t: string) => <Tag color="blue" className="border-none px-3 rounded-full">{t}</Tag> 
      },
      {
          title: 'Đối tượng',
          render: (_: any, record: any) => (
              record.isPublic === false 
              ? <Tag icon={<TeamOutlined />} color="warning" className="border-none">{record.targets?.length || 0} Phòng</Tag>
              : <Tag icon={<GlobalOutlined />} color="success" className="border-none">Tất cả</Tag>
          )
      },
      {
        title: 'Lượt xem',
        align: 'center' as const,
        render: (_: any, record: any) => (
          <Button 
            type="text" 
            className="flex items-center gap-1 mx-auto text-blue-500 hover:bg-blue-50 rounded-full"
            icon={<EyeOutlined />} 
            onClick={() => handleShowViewers(record)}
          >
            {record._count?.views || 0}
          </Button>
        )
      },
      { 
        title: 'Ngày đăng', 
        dataIndex: 'createdAt', 
        render: (d: string) => <span className="text-slate-400 text-xs">{new Date(d).toLocaleDateString('vi-VN')}</span> 
      },
      {
          title: 'Quản trị',
          align: 'right' as const,
          render: (_: any, record: any) => (
              <Space>
                  <Tooltip title="Sửa bài"><Button type="text" className="text-blue-600" icon={<EditOutlined />} onClick={() => handleOpenEdit(record)} /></Tooltip>
                  <Popconfirm title="Xóa bài viết?" onConfirm={() => handleDelete(record.id)} okButtonProps={{ danger: true }}>
                      <Button type="text" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
              </Space>
          )
      }
  ];

  const handleDelete = async (id: string) => {
    try {
        await axiosClient.delete(`/posts/${id}`);
        message.success('Đã xóa');
        fetchData();
    } catch (e) { message.error('Lỗi khi xóa'); }
  };

  return (
    <div className="bg-slate-50 min-h-screen p-2 md:p-6">
      <div className="flex justify-between items-center mb-8">
         <div>
            <h1 className="text-2xl font-bold text-slate-800 m-0">Tổng quan hệ thống</h1>
            <p className="text-slate-400 m-0">Chào mừng bạn trở lại, hôm nay có gì mới?</p>
         </div>
         <Button icon={<ReloadOutlined />} onClick={fetchData} className="rounded-lg shadow-sm">Làm mới</Button>
      </div>
      
      <Row gutter={[24, 24]} className="mb-8">
        <Col xs={24} sm={8}>
          <Card bordered={false} className="shadow-sm rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-white">
            <Statistic 
                title={<span className="text-white/80">Nhân sự hệ thống</span>} 
                value={stats.users} 
                valueStyle={{ color: '#fff', fontWeight: 'bold' }}
                prefix={<UserOutlined className="bg-white/20 p-2 rounded-lg mr-2" />} 
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card bordered={false} className="shadow-sm rounded-2xl bg-white">
            <Statistic 
                title={<span className="text-slate-400">Bản tin đã đăng</span>} 
                value={stats.posts} 
                valueStyle={{ color: '#1e293b', fontWeight: 'bold' }}
                prefix={<FileTextOutlined className="text-emerald-500 bg-emerald-50 p-2 rounded-lg mr-2" />} 
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Button 
            type="primary" 
            size="large" 
            icon={<PlusOutlined />} 
            className="w-full h-full rounded-2xl text-lg font-bold shadow-lg shadow-indigo-200" 
            onClick={handleOpenCreate}
          >
            SOẠN TIN MỚI
          </Button>
        </Col>
      </Row>

      <Card bordered={false} className="shadow-sm rounded-2xl" title={<span className="font-bold text-slate-700">Dòng thời gian tin tức</span>}>
          <Table 
            rowKey="id" 
            columns={columns} 
            dataSource={posts} 
            loading={loading}
            pagination={{ pageSize: 8 }}
            className="custom-table"
          />
      </Card>

      <Modal 
        title={<div className="flex items-center gap-2 border-b pb-4"><SendOutlined className="text-indigo-500" /><span className="text-lg font-bold">{editingPost ? "Chỉnh sửa tin tức" : "Soạn thảo bản tin mới"}</span></div>}
        open={isModalOpen} 
        onCancel={() => setIsModalOpen(false)} 
        footer={null} 
        width={1000} 
        centered
        maskClosable={false}
      >
         <Form form={form} layout="vertical" onFinish={handleSubmit} className="mt-6">
            <Form.Item name="title" label={<span className="font-bold">Tiêu đề thông báo</span>} rules={[{ required: true, message: 'Vui lòng nhập tiêu đề' }]}><Input size="large" className="rounded-lg" placeholder="Ví dụ: Thông báo nghỉ lễ 2/9..." /></Form.Item>
            <Row gutter={24}>
                <Col span={12}>
                    <Form.Item name="menuId" label={<span className="font-bold">Chuyên mục</span>} rules={[{ required: true }]}>
                        <Select placeholder="Chọn mục" size="large" className="rounded-lg">
                            {menus.map(m => <Select.Option key={m.id} value={m.id}>{m.title}</Select.Option>)}
                        </Select>
                    </Form.Item>
                </Col>
                <Col span={12}>
                    <Form.Item name="sendType" label={<span className="font-bold">Đối tượng nhận tin</span>}>
                        <Radio.Group size="large" className="w-full" onChange={(e) => setSendToAll(e.target.value === 'ALL')}>
                            <Radio.Button value="ALL" className="w-1/2 text-center"><GlobalOutlined /> Công khai</Radio.Button>
                            <Radio.Button value="DEPT" className="w-1/2 text-center"><TeamOutlined /> Nội bộ</Radio.Button>
                        </Radio.Group>
                    </Form.Item>
                </Col>
            </Row>

            {!sendToAll && (
                <Form.Item 
                  name="targetDeptIds" 
                  label={<span className="font-bold text-orange-600 uppercase text-xs">Gửi đích danh cho các phòng ban</span>} 
                  rules={[{ required: true, message: 'Vui lòng chọn ít nhất 1 phòng ban!' }]}
                >
                    <Select mode="multiple" placeholder="Chọn các phòng ban..." size="large" className="rounded-lg">
                        {departments.map(d => <Select.Option key={d.id} value={d.id}>{d.name}</Select.Option>)}
                    </Select>
                </Form.Item>
            )}

            <Form.Item 
                name="content" 
                label={<span className="font-bold">Nội dung chi tiết</span>} 
                rules={[{ required: true, message: 'Vui lòng nhập nội dung!' }]}
            >
                <ReactQuill 
                    theme="snow" 
                    modules={quillModules}
                    placeholder="Viết nội dung tin tức tại đây..."
                    className="editor-custom rounded-xl"
                    style={{ height: '300px', marginBottom: '60px' }} 
                />
            </Form.Item>

            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 mb-8 mt-12">
                <p className="font-bold mb-4 text-slate-600 uppercase text-xs tracking-widest"><PaperClipOutlined /> Tệp đính kèm & Tài liệu</p>
                <div className="grid grid-cols-2 gap-4 mb-4">
                    {attachments.map((item, index) => (
                      <div key={index} className="flex items-center justify-between bg-white p-3 rounded-xl shadow-xs border border-white">
                        <Space>
                           {item.type === 'image' ? <FileImageOutlined className="text-orange-500" /> : item.type === 'link' ? <LinkOutlined className="text-blue-500" /> : <FilePdfOutlined className="text-red-500" />}
                           <span className="text-xs font-medium truncate max-w-[200px]">{item.name}</span>
                        </Space>
                        <Button danger type="text" size="small" icon={<DeleteOutlined />} onClick={() => setAttachments(prev => prev.filter((_, i) => i !== index))} />
                      </div>
                    ))}
                </div>
                <div className="flex gap-3">
                    <Upload 
                        name="files" 
                        action={`${API_URL}/upload`} 
                        headers={{ Authorization: `Bearer ${localStorage.getItem('token')}` }} 
                        showUploadList={false} 
                        onChange={handleUpload}
                    >
                        <Button size="large" className="rounded-lg" icon={<UploadOutlined />}>Tải File</Button>
                    </Upload>
                    <div className="flex flex-1 gap-2">
                        <Input placeholder="Dán link tài liệu bổ sung..." size="large" className="rounded-lg" value={linkInput} onChange={e => setLinkInput(e.target.value)} />
                        <Button type="primary" size="large" className="rounded-lg" icon={<PlusOutlined />} onClick={() => { if(!linkInput) return; setAttachments(prev => [...prev, { name: linkInput, path: linkInput, type: 'link' }]); setLinkInput(''); }}>Thêm</Button>
                    </div>
                </div>
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t">
                <Button size="large" className="px-8 rounded-xl" onClick={() => setIsModalOpen(false)}>Đóng</Button>
                <Button type="primary" size="large" className="px-10 rounded-xl shadow-lg shadow-indigo-200" htmlType="submit" loading={loading} icon={<SendOutlined />}>
                   {editingPost ? "Lưu thay đổi" : "Xuất bản tin"}
                </Button>
            </div>
         </Form>
      </Modal>

      {/* Modal Lượt xem */}
      <Modal
        title={<span className="font-bold text-slate-700">Thống kê người đã xem</span>}
        open={isViewModalOpen}
        onCancel={() => setIsViewModalOpen(false)}
        footer={[<Button key="close" className="rounded-lg" onClick={() => setIsViewModalOpen(false)}>Đóng lại</Button>]}
        centered
      >
        <List
          itemLayout="horizontal"
          dataSource={viewingUserList}
          renderItem={(item: any) => (
            <List.Item>
              <List.Item.Meta
                avatar={<Avatar src={`https://ui-avatars.com/api/?name=${item.user?.fullName}&background=random`} />}
                title={<span className="font-bold text-slate-700">{item.user?.fullName}</span>}
                description={
                  <div className="flex items-center gap-2">
                    <Tag color="blue" className="text-[10px] border-none">{item.user?.department?.name}</Tag>
                    <span className="text-slate-400 text-xs">{new Date(item.createdAt).toLocaleString('vi-VN')}</span>
                  </div>
                }
              />
            </List.Item>
          )}
        />
      </Modal>
      
      <style>{`
        .editor-custom .ql-container { border-bottom-left-radius: 12px; border-bottom-right-radius: 12px; font-family: 'Inter', sans-serif; }
        .editor-custom .ql-toolbar { border-top-left-radius: 12px; border-top-right-radius: 12px; background: #f8fafc; }
        .custom-table .ant-table-thead > tr > th { background: #f8fafc; color: #64748b; font-weight: 600; text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em; }
        .ant-modal-content { border-radius: 24px; padding: 24px; }
      `}</style>
    </div>
  );
};

export default Dashboard;