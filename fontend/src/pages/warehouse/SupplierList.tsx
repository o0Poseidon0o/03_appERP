import React, { useEffect, useState } from 'react';
import { Table, Button, Input, Modal, Form, Card, Space, Popconfirm, App } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import axiosClient from '../../api/axiosClient';

const SupplierList: React.FC = () => {
  const { message } = App.useApp();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form] = Form.useForm();

  const fetchSuppliers = async (search = '') => {
    setLoading(true);
    try {
      const res = await axiosClient.get(`/suppliers?search=${search}`);
      setData(res.data.data);
    } catch (e) {
      message.error('Lỗi tải dữ liệu');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSuppliers(); }, []);

  const handleSubmit = async (values: any) => {
    try {
      if (editingId) {
        await axiosClient.patch(`/suppliers/${editingId}`, values);
        message.success('Cập nhật thành công');
      } else {
        await axiosClient.post('/suppliers', values);
        message.success('Thêm mới thành công');
      }
      setIsModalOpen(false);
      form.resetFields();
      fetchSuppliers();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Có lỗi xảy ra');
    }
  };

  const deleteSupplier = async (id: string) => {
    try {
      await axiosClient.delete(`/suppliers/${id}`);
      message.success('Đã xóa nhà cung cấp');
      fetchSuppliers();
    } catch (e) {
      message.error('Không thể xóa vì đã có giao dịch phát sinh');
    }
  };

  const columns = [
    { title: 'Mã NCC', dataIndex: 'supplierCode', key: 'supplierCode' },
    { title: 'Tên nhà cung cấp', dataIndex: 'name', key: 'name' },
    {
      title: 'Hành động',
      key: 'action',
      render: (_: any, record: any) => (
        <Space>
          <Button icon={<EditOutlined />} onClick={() => {
            setEditingId(record.id);
            form.setFieldsValue(record);
            setIsModalOpen(true);
          }} />
          <Popconfirm title="Bạn có chắc chắn muốn xóa?" onConfirm={() => deleteSupplier(record.id)}>
            <Button danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="p-6">
      <Card title="Danh mục Nhà cung cấp" extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={() => {
          setEditingId(null);
          form.resetFields();
          setIsModalOpen(true);
        }}>Thêm NCC</Button>
      }>
        <Input.Search 
          placeholder="Tìm theo mã hoặc tên..." 
          onSearch={fetchSuppliers} 
          style={{ marginBottom: 16, width: 300 }} 
          enterButton 
        />
        <Table dataSource={data} columns={columns} rowKey="id" loading={loading} />
      </Card>

      <Modal
        title={editingId ? "Sửa nhà cung cấp" : "Thêm nhà cung cấp mới"}
        open={isModalOpen}
        onOk={() => form.submit()}
        onCancel={() => setIsModalOpen(false)}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="supplierCode" label="Mã nhà cung cấp" rules={[{ required: true }]}>
            <Input placeholder="VD: NCC-SAMSUNG" disabled={!!editingId} />
          </Form.Item>
          <Form.Item name="name" label="Tên nhà cung cấp" rules={[{ required: true }]}>
            <Input placeholder="VD: Công ty TNHH Samsung Việt Nam" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default SupplierList;