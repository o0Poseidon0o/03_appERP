import React, { useState, useEffect, useRef } from 'react';
import { 
  Table, Card, Button, Input, Tag, Space, 
  Modal, Form, Select, Popconfirm, 
  App as AntdApp, Badge, Typography, Empty, Divider, Row, Col, Tooltip
} from 'antd';
import { 
  PlusOutlined, SearchOutlined, EditOutlined, 
  DeleteOutlined, ReloadOutlined, DatabaseOutlined, 
  PrinterOutlined, EnvironmentOutlined} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { QRCodeSVG } from 'qrcode.react'; 
import { useReactToPrint } from 'react-to-print'; 
import axiosClient from '../../api/axiosClient';
import { useHasPermission } from '../../hooks/useHasPermission';

const { Text, Title } = Typography;

// --- INTERFACES ---
interface WarehouseLocation {
  id: string;
  locationCode: string;
  qrCode: string;
}

interface Warehouse {
  id: string;
  name: string;
  warehouseCode: string;
  factoryId: string;
  factory?: { name: string };
  locations?: WarehouseLocation[];
  _count?: { locations: number };
}

const WarehouseManagement: React.FC = () => {
  const { message } = AntdApp.useApp();
  const { hasPermission } = useHasPermission();
  const contentToPrint = useRef<HTMLDivElement>(null); 

  const canCreate = hasPermission('WMS_CREATE'); 
  const canUpdate = hasPermission('WMS_UPDATE');
  const canDelete = hasPermission('WMS_DELETE');

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [factories, setFactories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');

  const [isWhModalOpen, setIsWhModalOpen] = useState(false);
  const [isLocModalOpen, setIsLocModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);
  const [selectedWarehouseForLoc, setSelectedWarehouseForLoc] = useState<Warehouse | null>(null);
  const [selectedLocForPrint, setSelectedLocForPrint] = useState<WarehouseLocation | null>(null);
  
  const [form] = Form.useForm();
  const [locForm] = Form.useForm();

  // Cấu hình in ấn bằng Hook
  const handlePrint = useReactToPrint({
    contentRef: contentToPrint,
    documentTitle: `BinLabel_${selectedLocForPrint?.locationCode}`,
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [whRes, factoryRes] = await Promise.all([
        axiosClient.get('/warehouses'),
        axiosClient.get('/factories') 
      ]);
      setWarehouses(whRes.data?.data || []);
      setFactories(factoryRes.data?.data || []);
    } catch (error: any) {
      message.error('Không thể tải dữ liệu hệ thống kho');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    fetchData(); 
  }, []);

  const handleWhSubmit = async (values: any) => {
    try {
      if (editingWarehouse) {
        await axiosClient.patch(`/warehouses/${editingWarehouse.id}`, values);
        message.success('Đã cập nhật thông tin kho');
      } else {
        await axiosClient.post('/warehouses', values);
        message.success('Khởi tạo kho thành công');
      }
      setIsWhModalOpen(false);
      fetchData();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Lỗi hệ thống');
    }
  };

  const handleLocSubmit = async (values: any) => {
    try {
      await axiosClient.post('/warehouses/location', {
        ...values,
        warehouseId: selectedWarehouseForLoc?.id
      });
      message.success(`Đã thêm vị trí ${values.locationCode}`);
      setIsLocModalOpen(false);
      locForm.resetFields();
      fetchData();
    } catch (error: any) {
      message.error('Không thể tạo vị trí kệ');
    }
  };

  const expandedRowRender = (record: Warehouse) => {
    const locColumns: ColumnsType<WarehouseLocation> = [
      { 
        title: 'Mã vị trí (Bin)', 
        dataIndex: 'locationCode', 
        render: (text) => (
          <Space>
            <EnvironmentOutlined className="text-amber-500" />
            <b className="text-indigo-600 font-mono text-base">{text}</b>
          </Space>
        ) 
      },
      { 
        title: 'Dữ liệu mã hóa', 
        dataIndex: 'qrCode', 
        render: (text) => <Text type="secondary" copyable>{text}</Text> 
      },
      {
        title: 'Hành động',
        align: 'right',
        render: (_, loc) => (
          <Tooltip title="In tem decal dán kệ">
            <Button 
              size="small" 
              type="primary"
              ghost
              icon={<PrinterOutlined />} 
              onClick={() => {
                setSelectedLocForPrint(loc);
                setIsPrintModalOpen(true);
              }}
            >
              In nhãn
            </Button>
          </Tooltip>
        )
      }
    ];

    return (
      <Card size="small" title="Danh sách vị trí chi tiết" className="m-2 bg-slate-50 border-dashed">
        <Table 
          columns={locColumns} 
          dataSource={record.locations} 
          pagination={false} 
          rowKey="id"
          size="small"
          locale={{ emptyText: <Empty description="Kho này chưa được chia vị trí" /> }}
        />
      </Card>
    );
  };

  const columns: ColumnsType<Warehouse> = [
    { 
      title: 'Kho / Nhà máy', 
      key: 'info',
      render: (_, record) => (
        <div>
          <Tag color="blue" className="mb-1 font-mono uppercase">{record.warehouseCode}</Tag>
          <br />
          <Text strong>{record.name}</Text>
          <div className="text-xs text-slate-400">{record.factory?.name || 'Vãng lai'}</div>
        </div>
      )
    },
    { 
      title: 'Trạng thái vị trí', 
      align: 'center',
      render: (_, record) => (
        <Badge 
          count={record._count?.locations || 0} 
          showZero 
          color={record._count?.locations ? '#6366f1' : '#d1d5db'} 
          overflowCount={999}
        />
      ) 
    },
    {
      title: 'Quản lý',
      align: 'right',
      render: (_, record) => (
        <Space size="middle">
          {canCreate && (
            <Button size="small" icon={<PlusOutlined />} onClick={() => {
                setSelectedWarehouseForLoc(record);
                setIsLocModalOpen(true);
            }}>Thêm Bin</Button>
          )}
          <Divider type="vertical" />
          {canUpdate && (
            <Button size="small" type="text" icon={<EditOutlined />} onClick={() => {
              setEditingWarehouse(record);
              form.setFieldsValue(record);
              setIsWhModalOpen(true);
            }} />
          )}
          {canDelete && (
            <Popconfirm title="Xóa kho sẽ mất dữ liệu vị trí liên quan?" onConfirm={() => axiosClient.delete(`/warehouses/${record.id}`).then(fetchData)}>
              <Button size="small" type="text" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      )
    }
  ];

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <div>
          <Title level={3} className="m-0"><DatabaseOutlined className="text-indigo-600 mr-2" />Cấu trúc Kho & Vị trí</Title>
          <Text type="secondary">Quản lý kho vật tư và tạo mã định danh vị trí (Storage Bin)</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchData}>Làm mới</Button>
          {canCreate && (
            <Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => {
              setEditingWarehouse(null);
              form.resetFields();
              setIsWhModalOpen(true);
            }} className="bg-indigo-600 shadow-sm">Tạo Kho mới</Button>
          )}
        </Space>
      </div>

      <Card bordered={false} className="shadow-sm mb-4">
        <Input 
          size="large"
          prefix={<SearchOutlined className="text-slate-300" />} 
          placeholder="Tìm kiếm nhanh kho theo mã hoặc tên..." 
          className="max-w-md rounded-lg" 
          onChange={e => setSearchText(e.target.value)} 
          allowClear 
        />
      </Card>

      <Table 
        columns={columns} 
        dataSource={warehouses.filter(w => 
          w.name.toLowerCase().includes(searchText.toLowerCase()) || 
          w.warehouseCode.toLowerCase().includes(searchText.toLowerCase())
        )} 
        rowKey="id" 
        loading={loading} 
        expandable={{ expandedRowRender }}
        className="shadow-sm bg-white rounded-xl"
      />

      {/* MODAL KHO */}
      <Modal title={editingWarehouse ? "Chỉnh sửa Kho" : "Thiết lập Kho mới"} open={isWhModalOpen} onOk={() => form.submit()} onCancel={() => setIsWhModalOpen(false)} centered>
        <Form form={form} layout="vertical" onFinish={handleWhSubmit} className="mt-4">
          <Row gutter={16}>
            <Col span={8}><Form.Item name="warehouseCode" label="Mã Kho" rules={[{ required: true }]}><Input placeholder="Ví dụ: WH01" disabled={!!editingWarehouse} /></Form.Item></Col>
            <Col span={16}><Form.Item name="name" label="Tên Kho" rules={[{ required: true }]}><Input placeholder="Ví dụ: Kho Nguyên Vật Liệu" /></Form.Item></Col>
          </Row>
          <Form.Item name="factoryId" label="Thuộc Nhà máy / Chi nhánh" rules={[{ required: true }]}>
            <Select placeholder="Chọn đơn vị sở hữu" options={factories.map(f => ({ label: f.name, value: f.id }))} />
          </Form.Item>
        </Form>
      </Modal>

      {/* MODAL VỊ TRÍ */}
      <Modal title={<Space><PlusOutlined /> Thêm vị trí kệ mới</Space>} open={isLocModalOpen} onOk={() => locForm.submit()} onCancel={() => setIsLocModalOpen(false)}>
        <div className="mb-4 p-3 bg-blue-50 rounded text-blue-700">
          Đang thêm vị trí vào: <b>{selectedWarehouseForLoc?.name}</b>
        </div>
        <Form form={locForm} layout="vertical" onFinish={handleLocSubmit}>
          <Form.Item name="locationCode" label="Mã vị trí (Bin Code)" rules={[{ required: true }]} tooltip="Quy tắc gợi ý: Khu vực - Dãy - Kệ (VD: A-01-05)">
            <Input placeholder="Nhập mã định danh duy nhất..." size="large" />
          </Form.Item>
        </Form>
      </Modal>

      {/* MODAL IN QR CODE - OPTIMIZED FOR 50x30mm or 80x50mm */}
      <Modal
        title="Xem trước nhãn in"
        open={isPrintModalOpen}
        onCancel={() => setIsPrintModalOpen(false)}
        footer={[
          <Button key="back" onClick={() => setIsPrintModalOpen(false)}>Hủy bỏ</Button>,
          <Button key="print" type="primary" size="large" icon={<PrinterOutlined />} onClick={() => handlePrint()}>Xác nhận In</Button>
        ]}
        width={350}
        centered
      >
        <div className="flex flex-col items-center py-8">
          <div 
            ref={contentToPrint} 
            className="p-4 bg-white border border-slate-200 text-center"
            style={{ width: '100%', maxWidth: '250px' }}
          >
            <div style={{ border: '2px solid black', padding: '10px' }}>
              <Text strong style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>Storage Location</Text>
              <div className="flex justify-center my-2">
                {selectedLocForPrint && (
                  <QRCodeSVG 
                    value={selectedLocForPrint.qrCode} 
                    size={150} 
                    level="H"
                    includeMargin={false}
                  />
                )}
              </div>
              <Divider style={{ margin: '8px 0', borderColor: 'black' }} />
              <div style={{ fontSize: '20px', fontWeight: 'bold', fontFamily: 'monospace' }}>
                {selectedLocForPrint?.locationCode}
              </div>
              <div style={{ fontSize: '9px', color: '#666' }}>Warehouse Management System</div>
            </div>
          </div>
          <Text type="secondary" className="mt-4 text-center text-xs">Sử dụng máy in nhãn nhiệt chuyên dụng để có kết quả tốt nhất.</Text>
        </div>
      </Modal>
    </div>
  );
};

export default WarehouseManagement;