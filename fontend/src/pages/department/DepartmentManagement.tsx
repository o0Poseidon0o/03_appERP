import React, { useState, useEffect } from "react";
import {
  Table, Card, Button, Input, Space, Modal, Form, Tag, Tooltip,
  Tabs, Select, App as AntdApp
} from "antd";
import {
  PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined,
  ReloadOutlined, ApartmentOutlined, BankOutlined, GlobalOutlined,
  CalendarOutlined} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import axiosClient from "../../api/axiosClient";
import dayjs from "dayjs"; // Dùng để format ngày tháng

// --- INTERFACES ---
interface Factory {
  id: string;
  name: string;
  address?: string;
}

interface Department {
  id: string;
  name: string;
  name_content: string;
  factoryId?: string;
  factory?: Factory;
  createdAt?: string;
  updatedAt?: string;
  _count?: {
    users: number;
  };
}

const DepartmentManagement: React.FC = () => {
  const { message, modal } = AntdApp.useApp();
  const [activeTab, setActiveTab] = useState("1");
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");

  // States dữ liệu
  const [depts, setDepts] = useState<Department[]>([]);
  const [factories, setFactories] = useState<Factory[]>([]);
  
  // States Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [isFactoryModalOpen, setIsFactoryModalOpen] = useState(false);
  const [editingFactory, setEditingFactory] = useState<Factory | null>(null);

  const [form] = Form.useForm();
  const [factoryForm] = Form.useForm();

  // --- API CALLS ---
  const fetchData = async () => {
    setLoading(true);
    try {
      const [resDept, resFact] = await Promise.all([
        axiosClient.get("/departments"),
        axiosClient.get("/factories")
      ]);
      setDepts(resDept.data?.data || resDept.data || []);
      setFactories(resFact.data?.data || resFact.data || []);
    } catch (error: any) {
      message.error("Lỗi tải danh sách dữ liệu");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- HANDLERS ---
  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      if (editingDept) {
        await axiosClient.patch(`/departments/${editingDept.id}`, values);
        message.success("Cập nhật phòng ban thành công");
      } else {
        await axiosClient.post("/departments", values);
        message.success("Thêm phòng ban mới thành công");
      }
      setIsModalOpen(false);
      fetchData();
    } catch (error: any) {
      message.error(error.response?.data?.message || "Thao tác thất bại");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (type: 'dept' | 'factory', record: any) => {
    modal.confirm({
      title: `Xác nhận xóa ${type === 'dept' ? 'phòng ban' : 'nhà máy'}`,
      content: `Bạn có chắc muốn xóa: ${record.name}?`,
      okText: "Xóa ngay",
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          const url = type === 'dept' ? `/departments/${record.id}` : `/factories/${record.id}`;
          await axiosClient.delete(url);
          message.success("Đã xóa thành công");
          fetchData();
        } catch (error: any) {
          message.error("Không thể xóa do có dữ liệu liên quan");
        }
      },
    });
  };

  // --- BẢNG PHÒNG BAN (HIỂN THỊ HẾT CÁC TRƯỜNG) ---
  const columns: ColumnsType<Department> = [
    { 
      title: "Mã Phòng", 
      dataIndex: "id", 
      key: "id",
      width: 100,
      fixed: 'left',
      render: (id) => <Tag color="blue" className="font-mono font-bold">{id}</Tag>
    },
    { 
      title: "Tên Phòng Ban", 
      dataIndex: "name", 
      key: "name",
      width: 200,
      render: (text) => <span className="font-bold text-slate-700">{text}</span>
    },
    {
      title: "Nhà máy / Chi nhánh",
      dataIndex: "factory",
      key: "factory",
      width: 180,
      render: (f) => f ? (
        <Tag icon={<GlobalOutlined />} color="cyan" className="rounded-md">{f.name}</Tag>
      ) : <Tag color="default">Chưa gán</Tag>
    },
    {
      title: "Nội dung / Chức năng",
      dataIndex: "name_content",
      key: "name_content",
      width: 250,
      ellipsis: true,
      render: (text) => <span className="text-slate-500 italic">{text || "---"}</span>
    },
    {
      title: "Nhân sự",
      key: "userCount",
      width: 120,
      align: "center",
      render: (_, record) => (
        <Tag color={record._count?.users ? "green" : "orange"}>
          {record._count?.users || 0} nhân viên
        </Tag>
      ),
    },
    {
      title: "Ngày tạo",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 150,
      render: (date) => <span className="text-xs text-slate-400"><CalendarOutlined /> {dayjs(date).format("DD/MM/YYYY HH:mm")}</span>
    },
    {
      title: "Cập nhật",
      dataIndex: "updatedAt",
      key: "updatedAt",
      width: 150,
      render: (date) => <span className="text-xs text-slate-400"><ReloadOutlined /> {dayjs(date).format("DD/MM/YYYY HH:mm")}</span>
    },
    {
      title: "Thao tác",
      key: "action",
      fixed: 'right',
      width: 110,
      align: "center",
      render: (_, record) => (
        <Space>
          <Tooltip title="Sửa">
            <Button type="text" icon={<EditOutlined className="text-blue-600" />} onClick={() => { setEditingDept(record); form.setFieldsValue(record); setIsModalOpen(true); }} />
          </Tooltip>
          <Tooltip title="Xóa">
            <Button type="text" danger icon={<DeleteOutlined />} onClick={() => handleDelete('dept', record)} />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div className="bg-slate-50 min-h-screen p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <ApartmentOutlined className="text-indigo-600" /> Quản lý Tổ chức & Nhà máy
        </h2>
        <Button 
          type="primary" icon={<PlusOutlined />} size="large"
          onClick={() => {
            if (activeTab === "1") { setEditingDept(null); form.resetFields(); setIsModalOpen(true); }
            else { setEditingFactory(null); factoryForm.resetFields(); setIsFactoryModalOpen(true); }
          }}
        >
          {activeTab === "1" ? "Thêm phòng ban" : "Thêm nhà máy"}
        </Button>
      </div>

      <Tabs 
        activeKey={activeTab} onChange={setActiveTab}
        items={[
          {
            key: "1", label: <span><ApartmentOutlined /> Danh sách Phòng ban</span>,
            children: (
              <Card bordered={false} className="shadow-sm rounded-xl">
                <div className="flex justify-between mb-5">
                  <Input placeholder="Tìm kiếm nhanh..." prefix={<SearchOutlined />} style={{ width: 350 }} onChange={(e) => setSearchText(e.target.value)} allowClear className="rounded-lg" />
                  <Button icon={<ReloadOutlined />} onClick={fetchData}>Làm mới</Button>
                </div>
                <Table 
                  columns={columns} 
                  dataSource={depts.filter(d => d.name.toLowerCase().includes(searchText.toLowerCase()) || d.id.includes(searchText))} 
                  rowKey="id" 
                  loading={loading}
                  scroll={{ x: 1300 }} // Cho phép cuộn ngang để xem hết các trường
                  pagination={{ pageSize: 10, showSizeChanger: true }}
                />
              </Card>
            )
          },
          {
            key: "2", label: <span><BankOutlined /> Quản lý Nhà máy</span>,
            children: (
              <Card bordered={false} className="shadow-sm rounded-xl">
                <Table 
                  rowKey="id" loading={loading} dataSource={factories}
                  columns={[
                    { title: "Tên nhà máy", dataIndex: "name", render: (t) => <b>{t}</b> },
                    { title: "Địa chỉ", dataIndex: "address" },
                    { title: "Hành động", align: "center", render: (_, r) => (
                      <Space>
                         <Button type="text" icon={<EditOutlined className="text-blue-600" />} onClick={() => { setEditingFactory(r); factoryForm.setFieldsValue(r); setIsFactoryModalOpen(true); }} />
                         <Button type="text" danger icon={<DeleteOutlined />} onClick={() => handleDelete('factory', r)} />
                      </Space>
                    )}
                  ]}
                />
              </Card>
            )
          }
        ]}
      />

      {/* Modal Phòng ban */}
      <Modal title={editingDept ? "Cập nhật phòng ban" : "Tạo phòng ban mới"} open={isModalOpen} onCancel={() => setIsModalOpen(false)} onOk={() => form.submit()} width={600} centered>
        <Form form={form} layout="vertical" onFinish={handleSubmit} className="mt-4">
          <div className="grid grid-cols-2 gap-4">
            <Form.Item name="id" label="Mã ID (Duy nhất)" rules={[{ required: true }]} tooltip="Ví dụ: 7110, KETOAN...">
              <Input disabled={!!editingDept} className="uppercase font-mono" />
            </Form.Item>
            <Form.Item name="factoryId" label="Trực thuộc nhà máy" rules={[{ required: true }]}>
              <Select placeholder="Chọn nhà máy" options={factories.map(f => ({ label: f.name, value: f.id }))} />
            </Form.Item>
          </div>
          <Form.Item name="name" label="Tên phòng ban" rules={[{ required: true }]}>
            <Input placeholder="Nhập tên đầy đủ" />
          </Form.Item>
          <Form.Item name="name_content" label="Mô tả / Chức năng nhiệm vụ">
            <Input.TextArea rows={4} placeholder="Nhập chức năng của phòng ban này..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal Nhà máy */}
      <Modal title={editingFactory ? "Sửa nhà máy" : "Thêm nhà máy"} open={isFactoryModalOpen} onCancel={() => setIsFactoryModalOpen(false)} onOk={() => factoryForm.submit()} centered>
        <Form form={factoryForm} layout="vertical" onFinish={async (v) => {
           try {
             if(editingFactory) await axiosClient.patch(`/factories/${editingFactory.id}`, v);
             else await axiosClient.post("/factories", v);
             message.success("Thành công"); fetchData(); setIsFactoryModalOpen(false);
           } catch (e) { message.error("Lỗi!"); }
        }} className="mt-4">
          <Form.Item name="name" label="Tên nhà máy" rules={[{required: true}]}><Input /></Form.Item>
          <Form.Item name="address" label="Địa chỉ"><Input /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default DepartmentManagement;