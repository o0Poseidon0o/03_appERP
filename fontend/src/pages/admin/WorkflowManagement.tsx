import React, { useState, useEffect } from 'react';
import { 
  Table, Card, Button, Modal, Form, Input, Select, 
  Switch, Space, Tag, Popconfirm, Tooltip, Row, Col, 
  Typography, Steps, Divider, App as AntdApp 
} from 'antd';
import { 
  PlusOutlined, EditOutlined, DeleteOutlined, LockOutlined, SettingOutlined,
  CheckCircleFilled,  AppstoreAddOutlined
} from '@ant-design/icons';
import axiosClient from '../../api/axiosClient';

const { Title, Text } = Typography;
const { Option } = Select;

// [CONFIG] Định nghĩa các loại quy trình
const WORKFLOW_TYPES = [
    { label: 'Quản lý Kho (Stock)', value: 'STOCK', color: 'blue', icon: '📦' },
    { label: 'Nghỉ phép / Nhân sự', value: 'LEAVE_REQUEST', color: 'green', icon: '📅' }, 
    { label: 'Thu chi / Kế toán', value: 'FINANCE', color: 'gold', icon: '💰' },        
    { label: 'Hành chính chung', value: 'GENERAL', color: 'purple', icon: '📝' },
];

interface WorkflowStep {
  id?: string;
  name: string;
  order: number;
  approverType: 'ROLE' | 'SPECIFIC_USER' | 'CREATOR';
  roleId?: string;
  specificUserId?: string;
  role?: { name: string };
}

interface Workflow {
  id: string;
  name: string;
  code: string;
  targetType: string;
  description?: string;
  isActive: boolean;
  steps: WorkflowStep[];
  allowedInitiatorRoles?: string[];
}

const WorkflowManagement: React.FC = () => {
  const { message } = AntdApp.useApp();
  const [form] = Form.useForm();

  // --- STATE ---
  const [loading, setLoading] = useState(false);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // --- FETCH DATA ---
  const fetchData = async () => {
    setLoading(true);
    try {
      const [resWf, resRoles, resUsers] = await Promise.all([
        axiosClient.get('/workflows'),
        axiosClient.get('/roles'),
        axiosClient.get('/users')
      ]);
      setWorkflows(resWf.data.data);
      setRoles(resRoles.data.data);
      setUsers(resUsers.data.data);
    } catch (error) {
      message.error('Lỗi tải dữ liệu hệ thống');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- HANDLERS ---
  const handleEdit = (record: Workflow) => {
    setEditingId(record.id);
    form.setFieldsValue({
      ...record,
      steps: record.steps.sort((a, b) => a.order - b.order),
      allowedInitiatorRoles: record.allowedInitiatorRoles || [] 
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await axiosClient.delete(`/workflows/${id}`);
      message.success('Đã xóa quy trình');
      fetchData();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Không thể xóa');
    }
  };

  const handleFinish = async (values: any) => {
    const formattedSteps = values.steps?.map((step: any, index: number) => ({
      ...step,
      order: index + 1
    })) || [];

    const payload = { 
        ...values, 
        steps: formattedSteps,
        allowedInitiatorRoles: values.allowedInitiatorRoles || []
    };

    try {
      if (editingId) {
        await axiosClient.put(`/workflows/${editingId}`, payload);
        message.success('Cập nhật thành công');
      } else {
        await axiosClient.post('/workflows', payload);
        message.success('Tạo mới thành công');
      }
      setIsModalOpen(false);
      form.resetFields();
      setEditingId(null);
      fetchData();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Lỗi lưu dữ liệu');
    }
  };

  // --- COLUMNS ---
  const columns = [
    {
      title: 'Tên quy trình',
      dataIndex: 'name',
      width: 280,
      render: (text: string, record: Workflow) => (
        <div className="flex flex-col">
          <span className="font-semibold text-slate-700 text-base">{text}</span>
          <span className="text-xs text-slate-400 mt-1">{record.description || 'Chưa có mô tả'}</span>
        </div>
      )
    },
    {
        title: 'Loại',
        dataIndex: 'targetType',
        width: 180,
        render: (type: string) => {
            const found = WORKFLOW_TYPES.find(t => t.value === type);
            return (
                <Tag color={found?.color || 'default'} className="px-2 py-1 rounded-md border-0 bg-opacity-10 font-medium flex items-center w-fit gap-1">
                    <span>{found?.icon}</span> {found ? found.label.split('(')[0].trim() : type}
                </Tag>
            );
        }
    },
    {
        title: 'Phạm vi (Role)',
        dataIndex: 'allowedInitiatorRoles',
        width: 200,
        render: (roleIds: string[]) => {
            if (!roleIds || roleIds.length === 0) return <Tag className="rounded-full px-3" icon={<CheckCircleFilled />} color="success">Public</Tag>;
            return (
                <div className="flex flex-wrap gap-1">
                    {roleIds.map(rid => {
                        const r = roles.find(role => role.id === rid);
                        return <Tag key={rid} className="rounded-full" color="geekblue">{r?.name || rid}</Tag>;
                    })}
                </div>
            );
        }
    },
    {
      title: 'Các bước duyệt',
      dataIndex: 'steps',
      render: (steps: WorkflowStep[]) => (
        <div className="py-2 min-w-[200px]">
            <Steps 
            size="small" 
            current={steps.length} 
            progressDot 
            items={steps.map(s => ({ 
                title: <span className="text-xs font-medium text-slate-600">{s.name}</span>,
            }))} 
            />
        </div>
      )
    },
    {
      title: 'Trạng thái',
      dataIndex: 'isActive',
      width: 100,
      align: 'center' as const,
      render: (active: boolean) => active 
        ? <Tag color="success" className="px-2 rounded-md">Bật</Tag> 
        : <Tag color="error" className="px-2 rounded-md">Tắt</Tag>
    },
    {
      title: '',
      width: 100,
      align: 'right' as const,
      render: (_: any, record: Workflow) => (
        <Space>
          <Tooltip title="Chỉnh sửa">
            <Button type="text" className="text-blue-600 hover:bg-blue-50 hover:text-blue-700" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          </Tooltip>
          <Popconfirm title="Bạn có chắc muốn xóa?" onConfirm={() => handleDelete(record.id)} okText="Xóa" cancelText="Hủy" okButtonProps={{ danger: true }}>
            <Tooltip title="Xóa">
                <Button type="text" className="text-slate-400 hover:text-red-500 hover:bg-red-50" icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
            <Title level={3} className="!mb-1 !text-slate-800 flex items-center gap-2">
                <AppstoreAddOutlined className="text-blue-600" /> Cấu hình Workflow
            </Title>
            <Text type="secondary" className="text-slate-500">Thiết lập quy trình duyệt động cho các nghiệp vụ trong hệ thống</Text>
        </div>
        <Button 
          type="primary" 
          icon={<PlusOutlined />} 
          size="large"
          className="bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-200 border-none px-6 h-10 rounded-lg flex items-center"
          onClick={() => { setEditingId(null); form.resetFields(); setIsModalOpen(true); }}
        >
          Tạo quy trình mới
        </Button>
      </div>

      {/* TABLE SECTION */}
      <Card bordered={false} className="shadow-lg shadow-slate-200/50 rounded-xl overflow-hidden border border-slate-100">
        <Table 
          dataSource={workflows} 
          columns={columns} 
          rowKey="id" 
          loading={loading} 
          scroll={{ x: 'max-content' }}
          pagination={{ pageSize: 10, showSizeChanger: false }}
          rowClassName="hover:bg-slate-50 transition-colors cursor-pointer group"
        />
      </Card>

      {/* --- MODAL BUILDER (SỬ DỤNG TAILWIND ĐỂ LAYOUT) --- */}
      <Modal
        title={
            <div className="flex items-center gap-3 text-lg sm:text-xl font-semibold text-slate-800 pb-4 border-b border-slate-100 mb-4">
                <div className={`p-2 rounded-lg ${editingId ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                    {editingId ? <EditOutlined /> : <PlusOutlined />}
                </div>
                {editingId ? "Chỉnh sửa quy trình" : "Thiết lập quy trình mới"}
            </div>
        }
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
        width="min(96vw, 900px)"
        maskClosable={false}
        className="top-5 !pb-0"
        styles={{ body: { padding: '0 16px 20px' } }}
      >
        <Form form={form} layout="vertical" onFinish={handleFinish} initialValues={{ isActive: true, targetType: 'STOCK', allowedInitiatorRoles: [] }}>
          
          {/* 1. THÔNG TIN CHUNG */}
          <div className="bg-slate-50 p-4 sm:p-5 rounded-xl border border-slate-200 mb-6">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <SettingOutlined /> Thông tin cơ bản
            </div>
            
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item name="name" label={<span className="font-medium text-slate-600">Tên quy trình</span>} rules={[{ required: true, message: 'Vui lòng nhập tên' }]}>
                  <Input size="large" placeholder="Vd: Xuất kho Nguyên vật liệu" className="rounded-lg" />
                </Form.Item>
              </Col>
              <Col xs={16} md={8}>
                <Form.Item name="code" label={<span className="font-medium text-slate-600">Mã quy trình (Unique)</span>} rules={[{ required: true, message: 'Vui lòng nhập mã' }]}>
                  <Input size="large" placeholder="Vd: WF_EXPORT_NVL" disabled={!!editingId} className="font-mono text-slate-600 bg-slate-100 rounded-lg" />
                </Form.Item>
              </Col>
              <Col xs={8} md={4}>
                <Form.Item name="isActive" label={<span className="font-medium text-slate-600">Kích hoạt</span>} valuePropName="checked">
                  <Switch checkedChildren="ON" unCheckedChildren="OFF" className="bg-slate-300" />
                </Form.Item>
              </Col>

              <Col xs={24} md={12}>
                  <Form.Item name="targetType" label={<span className="font-medium text-slate-600">Loại nghiệp vụ áp dụng</span>} rules={[{ required: true }]}>
                      <Select size="large" placeholder="Chọn loại nghiệp vụ..." className="rounded-lg">
                          {WORKFLOW_TYPES.map(t => (
                              <Option key={t.value} value={t.value}>
                                  <Space><Tag color={t.color}>{t.value}</Tag> {t.label}</Space>
                              </Option>
                          ))}
                      </Select>
                  </Form.Item>
              </Col>

              <Col xs={24} md={12}>
                  <Form.Item 
                    name="allowedInitiatorRoles" 
                    label={<Space><span className="font-medium text-slate-600">Phạm vi người tạo</span><Tooltip title="Ai được phép tạo phiếu này? Để trống = Tất cả"><LockOutlined className="text-slate-400 cursor-help" /></Tooltip></Space>}
                  >
                      <Select 
                        mode="multiple" 
                        allowClear 
                        size="large"
                        placeholder="Mặc định: Tất cả nhân viên"
                        options={roles.map(r => ({ value: r.id, label: r.name }))}
                        className="rounded-lg"
                      />
                  </Form.Item>
              </Col>

              <Col span={24} className="mb-0">
                <Form.Item name="description" label={<span className="font-medium text-slate-600">Mô tả</span>} className="mb-0">
                  <Input.TextArea rows={2} placeholder="Nhập mô tả chi tiết về quy trình này..." className="bg-white rounded-lg" />
                </Form.Item>
              </Col>
            </Row>
          </div>

          {/* 2. CẤU HÌNH CÁC BƯỚC */}
          {/* [FIX] Fix lỗi Type của Divider: sử dụng `as any` để bypass check type strict */}
          <Divider orientation={"left" as any} className="!border-slate-200 !text-slate-500 !text-sm !font-normal">
             Thiết lập các bước duyệt (Steps)
          </Divider>
          
          <Form.List name="steps">
            {(fields, { add, remove }) => (
              <div className="flex flex-col gap-4 bg-white">
                {fields.map(({ key, name, ...restField }, index) => (
                  <div key={key} className="relative group border border-slate-200 rounded-xl p-4 sm:p-5 hover:border-blue-400 hover:shadow-lg hover:shadow-blue-50 transition-all duration-300 bg-white">
                    {/* Badge số thứ tự */}
                    <div className="absolute -left-3 top-5 w-7 h-7 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-full flex items-center justify-center text-sm font-bold shadow-md shadow-blue-200 z-10 border-2 border-white">
                        {index + 1}
                    </div>
                    
                    {/* Nút xóa */}
                    <Button 
                        type="text" danger 
                        icon={<DeleteOutlined />} 
                        className="absolute top-3 right-3 sm:opacity-0 group-hover:opacity-100 transition-opacity bg-red-50 hover:bg-red-100 rounded-full"
                        onClick={() => remove(name)} 
                    />

                    <Row gutter={[16, 12]} align="middle">
                      <Col xs={24} md={10}>
                        <Form.Item {...restField} name={[name, 'name']} label="Tên bước" rules={[{ required: true, message: 'Nhập tên bước' }]} className="mb-0 font-medium">
                          <Input size="large" placeholder="Vd: Tổ trưởng xác nhận" prefix={<EditOutlined className="text-slate-300" />} className="rounded-lg" />
                        </Form.Item>
                      </Col>
                      
                      <Col xs={24} sm={12} md={6}>
                        <Form.Item {...restField} name={[name, 'approverType']} label="Loại người duyệt" rules={[{ required: true }]} className="mb-0 font-medium">
                          <Select size="large" className="rounded-lg">
                            <Option value="ROLE">⚡ Theo Vai trò</Option>
                            <Option value="SPECIFIC_USER">👤 Người cụ thể</Option>
                            <Option value="CREATOR">✅ Chính người tạo</Option>
                          </Select>
                        </Form.Item>
                      </Col>

                      <Col xs={24} sm={12} md={8}>
                        {/* [FIX] Bỏ unused params và dùng shouldUpdate đúng cách */}
                        <Form.Item noStyle shouldUpdate>
                          {({ getFieldValue }) => {
                            const approverType = getFieldValue(['steps', name, 'approverType']);
                            
                            if (approverType === 'ROLE') {
                              return (
                                <Form.Item {...restField} name={[name, 'roleId']} label="Chọn Vai trò" rules={[{ required: true, message: 'Bắt buộc' }]} className="mb-0 font-medium">
                                  <Select size="large" placeholder="Chọn Role..." showSearch optionFilterProp="children" className="rounded-lg">
                                    {roles.map(r => <Option key={r.id} value={r.id}>{r.name}</Option>)}
                                  </Select>
                                </Form.Item>
                              );
                            }
                            
                            if (approverType === 'SPECIFIC_USER') {
                              return (
                                <Form.Item {...restField} name={[name, 'specificUserId']} label="Chọn Nhân viên" rules={[{ required: true, message: 'Bắt buộc' }]} className="mb-0 font-medium">
                                  <Select size="large" placeholder="Tìm nhân viên..." showSearch optionFilterProp="children" className="rounded-lg">
                                    {users.map(u => <Option key={u.id} value={u.id}>{u.fullName} ({u.email})</Option>)}
                                  </Select>
                                </Form.Item>
                              );
                            }

                            if (approverType === 'CREATOR') {
                                return <div className="mt-8 text-slate-400 text-sm italic flex items-center gap-2 bg-slate-50 p-2 rounded border border-slate-100"><CheckCircleFilled className="text-green-500" /> Hệ thống tự động xác nhận.</div>;
                            }

                            return <div className="mt-8"></div>;
                          }}
                        </Form.Item>
                      </Col>
                    </Row>
                  </div>
                ))}

                <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />} size="large" className="mt-2 h-12 border-blue-300 text-blue-600 hover:text-blue-700 hover:border-blue-500 hover:bg-blue-50 rounded-xl border-2">
                  Thêm bước duyệt tiếp theo
                </Button>
              </div>
            )}
          </Form.List>

          <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-gray-100 bg-white sticky bottom-0 z-50">
            <Button size="large" onClick={() => setIsModalOpen(false)} className="rounded-lg">Hủy bỏ</Button>
            <Button type="primary" htmlType="submit" size="large" loading={loading} className="bg-blue-600 hover:bg-blue-500 px-8 rounded-lg shadow-lg shadow-blue-200 border-none">
              {editingId ? "Lưu thay đổi" : "Hoàn tất tạo mới"}
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default WorkflowManagement;