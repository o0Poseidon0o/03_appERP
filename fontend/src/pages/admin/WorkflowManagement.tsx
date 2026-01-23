import React, { useState, useEffect } from 'react';
import { 
  Table, Card, Button, Modal, Form, Input, Select, 
  Switch, Space, Tag, Popconfirm, Tooltip, Row, Col, 
  Typography, Steps, Divider, App as AntdApp 
} from 'antd';
import { 
  PlusOutlined, EditOutlined, DeleteOutlined, 
  DeleteRowOutlined, LockOutlined, AppstoreOutlined
} from '@ant-design/icons';
import axiosClient from '../../api/axiosClient';

const { Title } = Typography;
const { Option } = Select;

// [CONFIG] Định nghĩa các loại quy trình hệ thống hỗ trợ
const WORKFLOW_TYPES = [
    { label: '📦 Quản lý Kho (Stock)', value: 'STOCK' },
    { label: '📅 Nghỉ phép / Nhân sự', value: 'LEAVE_REQUEST' }, // Mở rộng
    { label: '💰 Thu chi / Kế toán', value: 'FINANCE' },         // Mở rộng
    { label: '📝 Hành chính chung', value: 'GENERAL' },
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
  targetType: string; // [CHANGED] documentType -> targetType
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
      width: 250,
      render: (text: string, record: Workflow) => (
        <div>
          <div className="font-bold text-blue-600">{text}</div>
          <div className="text-xs text-gray-400">{record.description}</div>
        </div>
      )
    },
    {
        title: 'Loại (Target)',
        dataIndex: 'targetType',
        width: 150,
        render: (type: string) => {
            const found = WORKFLOW_TYPES.find(t => t.value === type);
            return <Tag color="cyan">{found ? found.label : type}</Tag>;
        }
    },
    {
        title: 'Phạm vi áp dụng',
        dataIndex: 'allowedInitiatorRoles',
        width: 200,
        render: (roleIds: string[]) => {
            if (!roleIds || roleIds.length === 0) return <Tag color="green">Toàn hệ thống (Public)</Tag>;
            return (
                <div className="flex flex-wrap gap-1">
                    {roleIds.map(rid => {
                        const r = roles.find(role => role.id === rid);
                        return <Tag key={rid} color="geekblue">{r?.name || rid}</Tag>;
                    })}
                </div>
            );
        }
    },
    {
      title: 'Mã Code',
      dataIndex: 'code',
      render: (v: string) => <Tag>{v}</Tag>
    },
    {
      title: 'Các bước duyệt',
      dataIndex: 'steps',
      render: (steps: WorkflowStep[]) => (
        <Steps 
          size="small" 
          current={-1} 
          progressDot 
          items={steps.map(s => ({ 
            title: s.name, 
            description: s.approverType === 'ROLE' ? `Role: ${s.role?.name || '...'}` : (s.approverType === 'CREATOR' ? 'Người tạo' : 'Người cụ thể')
          }))} 
        />
      )
    },
    {
      title: 'Trạng thái',
      dataIndex: 'isActive',
      width: 100,
      render: (active: boolean) => active ? <Tag color="green">Bật</Tag> : <Tag color="red">Tắt</Tag>
    },
    {
      title: 'Hành động',
      width: 100,
      render: (_: any, record: Workflow) => (
        <Space>
          <Button type="text" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          <Popconfirm title="Xóa quy trình này?" onConfirm={() => handleDelete(record.id)}>
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center mb-4">
        <Title level={4}>⚙️ Cấu hình Workflow Engine</Title>
        <Button 
          type="primary" 
          icon={<PlusOutlined />} 
          size="large"
          onClick={() => { setEditingId(null); form.resetFields(); setIsModalOpen(true); }}
        >
          Thiết lập quy trình mới
        </Button>
      </div>

      <Card bordered={false} className="shadow-md rounded-lg">
        <Table 
          dataSource={workflows} 
          columns={columns} 
          rowKey="id" 
          loading={loading} 
          pagination={false}
        />
      </Card>

      {/* --- MODAL BUILDER --- */}
      <Modal
        title={editingId ? "Chỉnh sửa quy trình" : "Tạo quy trình mới"}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
        width={900}
        maskClosable={false}
      >
        <Form form={form} layout="vertical" onFinish={handleFinish} initialValues={{ isActive: true, targetType: 'STOCK', allowedInitiatorRoles: [] }}>
          
          {/* 1. THÔNG TIN CHUNG */}
          <div className="bg-blue-50 p-4 rounded-md mb-6 border border-blue-100">
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="name" label="Tên quy trình" rules={[{ required: true }]}>
                  <Input placeholder="Vd: Xuất kho (Dành cho Leader)" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="code" label="Mã quy trình (Unique)" rules={[{ required: true }]}>
                  <Input placeholder="Vd: WF_EXPORT_LEADER" disabled={!!editingId} />
                </Form.Item>
              </Col>
              <Col span={4}>
                <Form.Item name="isActive" label="Trạng thái" valuePropName="checked">
                  <Switch checkedChildren="Bật" unCheckedChildren="Tắt" />
                </Form.Item>
              </Col>

              {/* [NEW] CHỌN LOẠI QUY TRÌNH (TARGET TYPE) */}
              <Col span={12}>
                  <Form.Item name="targetType" label="Loại đối tượng áp dụng" rules={[{ required: true }]}>
                      <Select placeholder="Chọn loại nghiệp vụ...">
                          {WORKFLOW_TYPES.map(t => (
                              <Option key={t.value} value={t.value}>{t.label}</Option>
                          ))}
                      </Select>
                  </Form.Item>
              </Col>

              {/* CHỌN ROLE ĐƯỢC PHÉP SỬ DỤNG */}
              <Col span={12}>
                  <Form.Item 
                    name="allowedInitiatorRoles" 
                    label={
                        <Space>
                            <span>Phạm vi người tạo</span>
                            <Tooltip title="Để trống = Tất cả nhân viên đều thấy và tạo được. Chọn Role = Chỉ Role đó mới thấy.">
                                <LockOutlined className="text-gray-400" />
                            </Tooltip>
                        </Space>
                    }
                  >
                      <Select 
                        mode="multiple" 
                        allowClear 
                        placeholder="Public (Tất cả)"
                        options={roles.map(r => ({ value: r.id, label: r.name }))}
                      />
                  </Form.Item>
              </Col>

              <Col span={24}>
                <Form.Item name="description" label="Mô tả">
                  <Input.TextArea rows={2} placeholder="Mô tả chi tiết..." />
                </Form.Item>
              </Col>
            </Row>
          </div>

          {/* 2. CẤU HÌNH CÁC BƯỚC */}
          <Divider orientation="left">Cấu hình các bước duyệt</Divider>
          
          <Form.List name="steps">
            {(fields, { add, remove }) => (
              <div className="flex flex-col gap-4">
                {fields.map(({ key, name, ...restField }, index) => (
                  <Card 
                    key={key} 
                    size="small" 
                    className="bg-gray-50 border-gray-300"
                    title={<Space><div className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">{index + 1}</div> <span className="font-semibold">Bước {index + 1}</span></Space>}
                    extra={<Button type="text" danger icon={<DeleteRowOutlined />} onClick={() => remove(name)} />}
                  >
                    <Row gutter={16} align="middle">
                      <Col span={10}>
                        <Form.Item {...restField} name={[name, 'name']} label="Tên bước" rules={[{ required: true, message: 'Nhập tên bước' }]}>
                          <Input placeholder="Vd: Tổ trưởng xác nhận" />
                        </Form.Item>
                      </Col>
                      
                      <Col span={6}>
                        <Form.Item {...restField} name={[name, 'approverType']} label="Loại người duyệt" rules={[{ required: true }]}>
                          <Select placeholder="Chọn loại">
                            <Option value="ROLE">⚡ Theo Vai trò (Role)</Option>
                            <Option value="SPECIFIC_USER">👤 Người cụ thể</Option>
                            <Option value="CREATOR">✅ Chính người tạo</Option>
                          </Select>
                        </Form.Item>
                      </Col>

                      <Col span={8}>
                        <Form.Item
                          noStyle
                          shouldUpdate={(prevValues, currentValues) => true}
                        >
                          {({ getFieldValue }) => {
                            const approverType = getFieldValue(['steps', name, 'approverType']);
                            
                            if (approverType === 'ROLE') {
                              return (
                                <Form.Item {...restField} name={[name, 'roleId']} label="Chọn Vai trò" rules={[{ required: true, message: 'Phải chọn Role' }]}>
                                  <Select placeholder="Chọn Role..." showSearch optionFilterProp="children">
                                    {roles.map(r => <Option key={r.id} value={r.id}>{r.name}</Option>)}
                                  </Select>
                                </Form.Item>
                              );
                            }
                            
                            if (approverType === 'SPECIFIC_USER') {
                              return (
                                <Form.Item {...restField} name={[name, 'specificUserId']} label="Chọn Nhân viên" rules={[{ required: true, message: 'Phải chọn User' }]}>
                                  <Select placeholder="Chọn User..." showSearch optionFilterProp="children">
                                    {users.map(u => <Option key={u.id} value={u.id}>{u.fullName} ({u.email})</Option>)}
                                  </Select>
                                </Form.Item>
                              );
                            }

                            if (approverType === 'CREATOR') {
                                return <div className="mt-8 text-gray-500 text-sm italic">Người tạo phiếu sẽ tự xác nhận ở bước này.</div>;
                            }

                            return null;
                          }}
                        </Form.Item>
                      </Col>
                    </Row>
                  </Card>
                ))}

                <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />} size="large" className="mt-2">
                  Thêm bước duyệt tiếp theo
                </Button>
              </div>
            )}
          </Form.List>

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
            <Button size="large" onClick={() => setIsModalOpen(false)}>Hủy bỏ</Button>
            <Button type="primary" htmlType="submit" size="large" loading={loading}>
              {editingId ? "Cập nhật Quy trình" : "Tạo Quy trình"}
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default WorkflowManagement;