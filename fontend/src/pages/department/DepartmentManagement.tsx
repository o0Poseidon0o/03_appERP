import React, { useState, useEffect } from "react";
import {
  Table,
  Card,
  Button,
  Input,
  Space,
  Modal,
  Form,
  App as AntdApp,
} from "antd";
import {
  PlusOutlined,
  SearchOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import axiosClient from "../../api/axiosClient";

// Interface cho dữ liệu
interface Department {
  id: string;
  name: string;
  code: string;
  _count?: {
    users: number;
  };
}

// Interface cho giá trị Form
interface FormValues {
  id: string;
  name: string;
}

// Interface cho lỗi
interface ApiError {
  response?: {
    data?: {
      message?: string;
    };
  };
}

const DepartmentManagement: React.FC = () => {
  const { message } = AntdApp.useApp();
  const [depts, setDepts] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [searchText, setSearchText] = useState("");
  const [form] = Form.useForm<FormValues>();

  const fetchDepts = async () => {
    setLoading(true);
    try {
      const res = await axiosClient.get("/departments");
      // Đảm bảo dữ liệu nhận vào đúng cấu trúc
      const data = res.data.data || res.data || [];
      setDepts(data);
    } catch (error: unknown) {
      const err = error as ApiError;
      message.error(err.response?.data?.message || "Lỗi tải dữ liệu");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepts();
  }, []);

  const handleSubmit = async (values: FormValues) => {
    setLoading(true);
    try {
      const payload = { ...values, code: values.id };
      if (editingDept) {
        await axiosClient.patch(`/departments/${editingDept.id}`, payload);
        message.success("Cập nhật thành công");
      } else {
        await axiosClient.post("/departments", payload);
        message.success("Thêm mới thành công");
      }
      setIsModalOpen(false);
      fetchDepts();
    } catch (error: unknown) {
      const err = error as ApiError;
      message.error(err.response?.data?.message || "Có lỗi xảy ra");
    } finally {
      setLoading(false);
    }
  };

  const columns: ColumnsType<Department> = [
    { title: "ID", dataIndex: "id", key: "id" },
    { title: "Tên phòng", dataIndex: "name", key: "name" },
    {
      title: "Nội dung phòng ban",
      dataIndex: "name_content",
      key: "name_content",
    },
    {
      title: "Số nhân viên",
      key: "userCount",
      render: (_, record) => record._count?.users || 0,
    },
    {
      title: "Hành động",
      key: "action",
      render: (_, record) => (
        <Space>
          <Button
            type="text"
            icon={<EditOutlined className="text-blue-600" />}
            onClick={() => {
              setEditingDept(record);
              form.setFieldsValue(record);
              setIsModalOpen(true);
            }}
          />
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
            onClick={() => {
              Modal.confirm({
                title: "Xác nhận xóa",
                content: `Bạn có chắc muốn xóa phòng ${record.name}?`,
                onOk: async () => {
                  try {
                    await axiosClient.delete(`/departments/${record.id}`);
                    message.success("Đã xóa");
                    fetchDepts();
                  } catch (error: unknown) {
                    const err = error as ApiError;
                    message.error(
                      err.response?.data?.message || "Lỗi xóa dữ liệu"
                    );
                  }
                },
              });
            }}
          />
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="flex justify-between mb-4">
        <h2 className="text-2xl font-bold">Quản lý Phòng ban</h2>
        <Button
          type="primary"
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

      <Card>
        <Space className="mb-4">
          <Input
            placeholder="Tìm tên phòng..."
            prefix={<SearchOutlined />}
            onChange={(e) => setSearchText(e.target.value)}
          />
          <Button icon={<ReloadOutlined />} onClick={fetchDepts} />
        </Space>

        <Table
          columns={columns}
          dataSource={depts.filter((d) =>
            d.name.toLowerCase().includes(searchText.toLowerCase())
          )}
          rowKey="id"
          loading={loading}
        />
      </Card>

      <Modal
        title={editingDept ? "Sửa phòng ban" : "Thêm phòng ban"}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="id" label="ID" rules={[{ required: true }]}>
            <Input disabled={!!editingDept} />
          </Form.Item>
          <Form.Item name="name" label="Tên phòng" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item
            name="name_content"
            label="Nội dung chi tiết"
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={loading}>
            Lưu
          </Button>
        </Form>
      </Modal>
    </div>
  );
};

export default DepartmentManagement;
