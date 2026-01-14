import React, { useState, useEffect } from "react";
import {
  Table, Card, Button, Input, Space, Modal, Form, Tag, Tooltip,
  Select, App as AntdApp
} from "antd";
import {
  PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined,
  ReloadOutlined, ApartmentOutlined, GlobalOutlined,
  CalendarOutlined
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import axiosClient from "../../api/axiosClient";
import dayjs from "dayjs"; 

// --- INTERFACES ---
// Vẫn cần Interface Factory để hiển thị trong dropdown chọn nhà máy
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
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");

  // States dữ liệu
  const [depts, setDepts] = useState<Department[]>([]);
  
  // Vẫn giữ state factories để đổ dữ liệu vào Select Box khi tạo phòng ban
  const [factories, setFactories] = useState<Factory[]>([]); 
  
  // States Modals chỉ dành cho Department
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);

  const [form] = Form.useForm();

  // --- API CALLS ---
  const fetchData = async () => {
    setLoading(true);
    try {
      // Gọi cả 2 API: Lấy list phòng ban để hiển thị, Lấy list nhà máy để gán
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

  const handleDelete = (record: Department) => {
    modal.confirm({
      title: `Xác nhận xóa phòng ban`,
      content: `Bạn có chắc muốn xóa: ${record.name}? Hành động này không thể hoàn tác nếu đã có nhân sự.`,
      okText: "Xóa ngay",
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await axiosClient.delete(`/departments/${record.id}`);
          message.success("Đã xóa thành công");
          fetchData();
        } catch (error: any) {
          message.error("Không thể xóa do có dữ liệu nhân sự liên quan");
        }
      },
    });
  };

  // --- COLUMNS ---
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
            <Button type="text" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record)} />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div className="bg-slate-50 min-h-screen p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2 m-0">
            <ApartmentOutlined className="text-indigo-600" /> Quản lý Cơ cấu Tổ chức
            </h2>
            <span className="text-slate-500 text-sm">Quản lý danh sách các phòng ban và chức năng nhiệm vụ</span>
        </div>
        
        <Button 
          type="primary" icon={<PlusOutlined />} size="large"
          className="bg-indigo-600 hover:bg-indigo-500 shadow-md"
          onClick={() => {
             setEditingDept(null); 
             form.resetFields(); 
             setIsModalOpen(true); 
          }}
        >
          Thêm phòng ban
        </Button>
      </div>

      {/* Main Content - Không còn Tab nữa, chỉ hiển thị Table */}
      <Card bordered={false} className="shadow-sm rounded-xl">
        <div className="flex justify-between mb-5">
            <Input 
                placeholder="Tìm kiếm phòng ban..." 
                prefix={<SearchOutlined className="text-slate-400"/>} 
                style={{ width: 350 }} 
                onChange={(e) => setSearchText(e.target.value)} 
                allowClear 
                className="rounded-lg" 
            />
            <Button icon={<ReloadOutlined />} onClick={fetchData}>Làm mới</Button>
        </div>
        
        <Table 
            columns={columns} 
            dataSource={depts.filter(d => d.name.toLowerCase().includes(searchText.toLowerCase()) || d.id.includes(searchText))} 
            rowKey="id" 
            loading={loading}
            scroll={{ x: 1300 }} 
            pagination={{ pageSize: 10, showSizeChanger: true }}
            className="border border-slate-100 rounded-lg"
        />
      </Card>

      {/* Modal Phòng ban */}
      <Modal 
        title={editingDept ? "Cập nhật thông tin phòng ban" : "Tạo phòng ban mới"} 
        open={isModalOpen} 
        onCancel={() => setIsModalOpen(false)} 
        onOk={() => form.submit()} 
        width={600} 
        centered
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit} className="mt-6">
          <div className="grid grid-cols-2 gap-4">
            <Form.Item 
                name="id" 
                label="Mã ID (Duy nhất)" 
                rules={[{ required: true, message: "Vui lòng nhập mã phòng" }]} 
                tooltip="Ví dụ: 1100, HR, KETOAN..."
            >
              <Input disabled={!!editingDept} className="uppercase font-mono input-uppercase" placeholder="Mã phòng..." />
            </Form.Item>
            
            <Form.Item 
                name="factoryId" 
                label="Trực thuộc nhà máy" 
                rules={[{ required: true, message: "Bắt buộc chọn nhà máy" }]}
            >
              <Select 
                placeholder="Chọn nhà máy" 
                options={factories.map(f => ({ label: f.name, value: f.id }))} 
                notFoundContent="Không có dữ liệu nhà máy"
              />
            </Form.Item>
          </div>
          
          <Form.Item name="name" label="Tên phòng ban" rules={[{ required: true, message: "Vui lòng nhập tên phòng ban" }]}>
            <Input placeholder="Nhập tên đầy đủ (VD: Phòng Hành chính Nhân sự)" />
          </Form.Item>
          
          <Form.Item name="name_content" label="Mô tả / Chức năng nhiệm vụ">
            <Input.TextArea rows={4} placeholder="Mô tả ngắn gọn chức năng của phòng ban này..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default DepartmentManagement;