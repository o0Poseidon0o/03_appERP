import React, { useState, useEffect } from "react";
import {
  Table,
  Card,
  Button,
  Input,
  Space,
  Modal,
  Form,
  Tag,
  Tooltip,
  App as AntdApp,
} from "antd";
import {
  PlusOutlined,
  SearchOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  ApartmentOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import axiosClient from "../../api/axiosClient";

// --- INTERFACE ---
interface Department {
  id: string;
  name: string;
  name_content: string;
  _count?: {
    users: number;
  };
}

interface FormValues {
  id: string;
  name: string;
  name_content: string;
}

const DepartmentManagement: React.FC = () => {
  const { message, modal } = AntdApp.useApp();
  const [depts, setDepts] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [searchText, setSearchText] = useState("");
  const [form] = Form.useForm<FormValues>();

  // --- API CALLS ---
  const fetchDepts = async () => {
    setLoading(true);
    try {
      const res = await axiosClient.get("/departments");
      // Hỗ trợ cả 2 cấu trúc res.data hoặc res.data.data
      const data = res.data?.data || res.data || [];
      setDepts(data);
    } catch (error: any) {
      message.error(error.response?.data?.message || "Lỗi tải danh sách phòng ban");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepts();
  }, []);

  // --- HANDLERS ---
  const handleSubmit = async (values: FormValues) => {
    setLoading(true);
    try {
      if (editingDept) {
        await axiosClient.patch(`/departments/${editingDept.id}`, values);
        message.success("Cập nhật thông tin phòng ban thành công");
      } else {
        await axiosClient.post("/departments", values);
        message.success("Thêm phòng ban mới thành công");
      }
      setIsModalOpen(false);
      fetchDepts();
    } catch (error: any) {
      message.error(error.response?.data?.message || "Thao tác thất bại");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (record: Department) => {
    modal.confirm({
      title: "Xác nhận xóa phòng ban",
      content: (
        <div>
          Bạn có chắc chắn muốn xóa phòng <b>{record.name}</b>? 
          <p className="text-red-500 text-xs mt-2 italic">
            * Lưu ý: Chỉ xóa được nếu phòng ban này không còn nhân sự.
          </p>
        </div>
      ),
      okText: "Xóa ngay",
      okButtonProps: { danger: true },
      cancelText: "Hủy",
      onOk: async () => {
        try {
          await axiosClient.delete(`/departments/${record.id}`);
          message.success("Đã xóa phòng ban thành công");
          fetchDepts();
        } catch (error: any) {
          message.error(error.response?.data?.message || "Không thể xóa phòng ban đang có dữ liệu ràng buộc");
        }
      },
    });
  };

  // --- TABLE COLUMNS ---
  const columns: ColumnsType<Department> = [
    { 
      title: "Mã Phòng", 
      dataIndex: "id", 
      key: "id",
      width: 120,
      render: (id) => <Tag color="blue" className="font-mono font-bold">{id}</Tag>
    },
    { 
      title: "Tên Phòng Ban", 
      dataIndex: "name", 
      key: "name",
      render: (text) => <span className="font-semibold text-slate-700">{text}</span>
    },
    {
      title: "Nội dung / Chức năng",
      dataIndex: "name_content",
      key: "name_content",
      render: (text) => <span className="text-slate-500">{text || "---"}</span>
    },
    {
      title: "Số nhân sự",
      key: "userCount",
      align: "center",
      render: (_, record) => (
        <Tag color={record._count?.users === 0 ? "default" : "green"} className="rounded-full px-3">
          {record._count?.users || 0} nhân viên
        </Tag>
      ),
    },
    {
      title: "Hành động",
      key: "action",
      align: "center",
      render: (_, record) => (
        <Space>
          <Tooltip title="Chỉnh sửa">
            <Button
              type="text"
              icon={<EditOutlined className="text-blue-600" />}
              onClick={() => {
                setEditingDept(record);
                form.setFieldsValue(record);
                setIsModalOpen(true);
              }}
            />
          </Tooltip>
          <Tooltip title="Xóa phòng ban">
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(record)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <ApartmentOutlined className="text-indigo-600" />
          Quản lý Cơ cấu Phòng ban
        </h2>
        <Button
          type="primary"
          size="large"
          icon={<PlusOutlined />}
          onClick={() => {
            setEditingDept(null);
            form.resetFields();
            setIsModalOpen(true);
          }}
        >
          Thêm phòng ban
        </Button>
      </div>

      <Card bordered={false} className="shadow-sm border-none rounded-xl">
        <div className="flex justify-between items-center mb-5">
          <Input
            placeholder="Tìm theo tên phòng ban..."
            prefix={<SearchOutlined className="text-slate-400" />}
            style={{ width: 300 }}
            className="rounded-lg"
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
          />
          <Button icon={<ReloadOutlined />} onClick={fetchDepts}>Làm mới</Button>
        </div>

        <Table
          columns={columns}
          dataSource={depts.filter((d) =>
            d.name.toLowerCase().includes(searchText.toLowerCase()) ||
            d.id.toLowerCase().includes(searchText.toLowerCase())
          )}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title={
          <div className="flex items-center gap-2 border-b pb-3">
            <ApartmentOutlined className="text-indigo-600" />
            <span>{editingDept ? "Cập nhật phòng ban" : "Khai báo phòng ban mới"}</span>
          </div>
        }
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
        width={500}
        centered
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit} className="mt-5">
          <Form.Item 
            name="id" 
            label="Mã phòng ban (ID)" 
            rules={[{ required: true, message: 'Vui lòng nhập mã phòng (VD: KT, HC)' }]}
          >
            <Input placeholder="Mã viết tắt (Không dấu)" disabled={!!editingDept} className="font-mono uppercase" />
          </Form.Item>
          
          <Form.Item 
            name="name" 
            label="Tên phòng ban" 
            rules={[{ required: true, message: 'Nhập tên đầy đủ của phòng' }]}
          >
            <Input placeholder="Ví dụ: Phòng Kế toán - Tài chính" />
          </Form.Item>
          
          <Form.Item
            name="name_content"
            label="Mô tả chức năng / Nội dung"
            rules={[{ required: true, message: 'Nhập mô tả ngắn gọn' }]}
          >
            <Input.TextArea rows={3} placeholder="Mô tả sơ lược về nhiệm vụ của phòng ban..." />
          </Form.Item>

          <div className="flex justify-end gap-2 mt-6">
            <Button onClick={() => setIsModalOpen(false)}>Hủy bỏ</Button>
            <Button type="primary" htmlType="submit" loading={loading} className="px-6">
              {editingDept ? "Cập nhật" : "Tạo mới"}
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default DepartmentManagement;