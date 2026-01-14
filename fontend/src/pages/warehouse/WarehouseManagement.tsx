import React, { useState, useEffect, useRef } from 'react';
import { 
  Table, Button, Input, Tag, Space, 
  Modal, Form, Select, Popconfirm, 
  App as AntdApp, Badge, Typography, Tabs
} from 'antd';
import { 
  PlusOutlined, SearchOutlined, EditOutlined, 
  DeleteOutlined, ReloadOutlined, DatabaseOutlined, 
  PrinterOutlined, EnvironmentOutlined, BankOutlined, ApartmentOutlined
} from '@ant-design/icons';
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
  warehouseId?: string; 
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

interface Factory {
  id: string;
  name: string;
  address?: string;
}

const WarehouseManagement: React.FC = () => {
  const { message } = AntdApp.useApp();
  const { hasPermission } = useHasPermission();
  const contentToPrint = useRef<HTMLDivElement>(null); 
  const [activeTab, setActiveTab] = useState("warehouses");

  // --- QUYỀN HẠN ---
  const canCreate = hasPermission('WMS_CREATE'); 
  const canUpdate = hasPermission('WMS_UPDATE');
  const canDelete = hasPermission('WMS_DELETE');
  const canCreateFactory = hasPermission('FACTORY_CREATE'); 
  const canUpdateFactory = hasPermission('FACTORY_UPDATE');
  const canDeleteFactory = hasPermission('FACTORY_DELETE');

  // States
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [factories, setFactories] = useState<Factory[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');

  // Modals
  const [isWhModalOpen, setIsWhModalOpen] = useState(false);
  const [isLocModalOpen, setIsLocModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isFactoryModalOpen, setIsFactoryModalOpen] = useState(false);
  
  // Selection & Editing States
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);
  const [editingFactory, setEditingFactory] = useState<Factory | null>(null);
  const [selectedWarehouseForLoc, setSelectedWarehouseForLoc] = useState<Warehouse | null>(null);
  const [editingLocation, setEditingLocation] = useState<WarehouseLocation | null>(null); 
  const [selectedLocForPrint, setSelectedLocForPrint] = useState<WarehouseLocation | null>(null);
  
  // State quản lý các dòng đang mở rộng (Expanded Rows)
  // Để khi thêm Bin xong, bảng không bị đóng lại
  const [expandedRowKeys, setExpandedRowKeys] = useState<React.Key[]>([]);

  // Forms
  const [form] = Form.useForm();
  const [locForm] = Form.useForm();
  const [factoryForm] = Form.useForm();

  // In ấn
  const handlePrint = useReactToPrint({
    contentRef: contentToPrint,
    documentTitle: `BinLabel_${selectedLocForPrint?.locationCode}`,
  });

  // --- FETCH DATA ---
  const fetchData = async () => {
    setLoading(true);
    try {
        const [whRes, factoryRes] = await Promise.all([
            axiosClient.get('/warehouses'),
            axiosClient.get('/factories')
        ]);
        setWarehouses(whRes.data?.data || []);
        setFactories(factoryRes.data?.data || []);
    } catch (error) {
        // console.error(error);
        message.warning("Có lỗi khi tải dữ liệu");
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // --- HANDLERS KHO ---
  const handleWhSubmit = async (values: any) => {
    try {
      if (editingWarehouse) {
        await axiosClient.patch(`/warehouses/${editingWarehouse.id}`, values);
        message.success('Đã cập nhật kho');
      } else {
        await axiosClient.post('/warehouses', values);
        message.success('Tạo kho thành công');
      }
      setIsWhModalOpen(false);
      fetchData();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Lỗi hệ thống');
    }
  };

  // --- HANDLERS VỊ TRÍ (BIN) ---
  const handleLocSubmit = async (values: any) => {
    try {
      if (editingLocation) {
        // SỬA BIN
        await axiosClient.patch(`/warehouses/location/${editingLocation.id}`, {
            locationCode: values.locationCode
        });
        message.success(`Đã cập nhật vị trí thành: ${values.locationCode}`);
      } else {
        // THÊM BIN
        await axiosClient.post('/warehouses/location', { 
            ...values, 
            warehouseId: selectedWarehouseForLoc?.id 
        });
        message.success(`Đã thêm vị trí ${values.locationCode}`);
        
        // Mở rộng dòng kho vừa thêm để user thấy ngay kết quả
        if (selectedWarehouseForLoc && !expandedRowKeys.includes(selectedWarehouseForLoc.id)) {
            setExpandedRowKeys(prev => [...prev, selectedWarehouseForLoc.id]);
        }
      }
      
      setIsLocModalOpen(false);
      setEditingLocation(null); 
      locForm.resetFields();
      fetchData(); 
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Không thể thao tác vị trí');
    }
  };

  const handleDeleteLocation = async (id: string) => {
      try {
        await axiosClient.delete(`/warehouses/location/${id}`);
        message.success("Đã xóa vị trí");
        fetchData();
      } catch (error: any) {
        message.error(error.response?.data?.message || "Không thể xóa vị trí này");
      }
  };

  // --- HANDLERS NHÀ MÁY ---
  const handleFactorySubmit = async (values: any) => {
    try {
      if (editingFactory) {
        await axiosClient.patch(`/factories/${editingFactory.id}`, values);
        message.success("Cập nhật nhà máy thành công");
      } else {
        await axiosClient.post("/factories", values);
        message.success("Thêm nhà máy mới thành công");
      }
      setIsFactoryModalOpen(false);
      fetchData();
    } catch (error: any) {
      message.error("Lỗi thao tác nhà máy");
    }
  };

  const handleDeleteFactory = async (id: string) => {
    try {
        await axiosClient.delete(`/factories/${id}`);
        message.success("Đã xóa nhà máy");
        fetchData();
    } catch (error) {
        message.error("Không thể xóa (có thể đang chứa kho/phòng ban)");
    }
  };

  // --- EXPANDED ROW RENDER (HIỂN THỊ DANH SÁCH BIN) ---
  const expandedRowRender = (record: Warehouse) => {
    // Logic: Lấy dữ liệu mới nhất từ state 'warehouses' thay vì dùng record cũ
    // Điều này giúp bảng con tự update khi thêm Bin mới
    const currentWarehouse = warehouses.find(w => w.id === record.id) || record;

    const locColumns: ColumnsType<WarehouseLocation> = [
      { 
        title: 'Mã vị trí (Bin)', dataIndex: 'locationCode', 
        render: (text) => <Space><EnvironmentOutlined className="text-amber-500" /><b className="text-indigo-600 font-mono">{text}</b></Space> 
      },
      { title: 'QR Data', dataIndex: 'qrCode', render: (text) => <Text type="secondary" copyable>{text}</Text> },
      {
        title: 'Thao tác', align: 'right',
        render: (_, loc) => (
            <Space>
                <Button size="small" icon={<PrinterOutlined />} onClick={() => { setSelectedLocForPrint(loc); setIsPrintModalOpen(true); }}>In</Button>
                
                {/* Nút Sửa Bin */}
                {canUpdate && (
                    <Button 
                        size="small" 
                        icon={<EditOutlined className="text-blue-600" />} 
                        onClick={() => { 
                            setEditingLocation(loc); 
                            setSelectedWarehouseForLoc(record);
                            locForm.setFieldsValue({ locationCode: loc.locationCode }); 
                            setIsLocModalOpen(true); 
                        }} 
                    />
                )}
                
                {/* Nút Xóa Bin */}
                {canDelete && (
                    <Popconfirm title="Xóa vị trí này?" onConfirm={() => handleDeleteLocation(loc.id)}>
                        <Button size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                )}
            </Space>
        )
      }
    ];

    return (
        <Table 
            columns={locColumns} 
            dataSource={currentWarehouse.locations} 
            pagination={false} 
            rowKey="id" 
            size="small" 
            locale={{ emptyText: "Chưa có vị trí nào trong kho này" }}
        />
    );
  };

  const warehouseColumns: ColumnsType<Warehouse> = [
    { 
      title: 'Kho / Nhà máy', key: 'info',
      render: (_, record) => (
        <div>
          <Tag color="blue" className="mb-1 font-mono uppercase">{record.warehouseCode}</Tag>
          <br /><Text strong>{record.name}</Text>
          <div className="text-xs text-slate-400">{record.factory?.name || '---'}</div>
        </div>
      )
    },
    { 
      title: 'Vị trí (Bin)', align: 'center',
      render: (_, record) => <Badge count={record._count?.locations || 0} showZero color={record._count?.locations ? '#6366f1' : '#d1d5db'} />
    },
    {
      title: 'Thao tác', align: 'right',
      render: (_, record) => (
        <Space size="small">
          {canCreate && (
            <Button 
                size="small" 
                icon={<PlusOutlined />} 
                onClick={() => { 
                    setSelectedWarehouseForLoc(record); 
                    setEditingLocation(null); 
                    locForm.resetFields(); 
                    setIsLocModalOpen(true); 
                }}
            >
                Thêm Bin
            </Button>
          )}
          
          {canUpdate && <Button size="small" icon={<EditOutlined />} onClick={() => { setEditingWarehouse(record); form.setFieldsValue(record); setIsWhModalOpen(true); }} />}
          
          {canDelete && <Popconfirm title="Xóa kho?" onConfirm={() => axiosClient.delete(`/warehouses/${record.id}`).then(fetchData)}><Button size="small" danger icon={<DeleteOutlined />} /></Popconfirm>}
        </Space>
      )
    }
  ];

  const factoryColumns: ColumnsType<Factory> = [
    { title: "Tên nhà máy", dataIndex: "name", render: (t) => <b className="text-lg text-slate-700">{t}</b> },
    { title: "Địa chỉ", dataIndex: "address" },
    { 
        title: "Hành động", align: "center", width: 150,
        render: (_, r) => (
          <Space>
             {canUpdateFactory && <Button icon={<EditOutlined />} onClick={() => { setEditingFactory(r); factoryForm.setFieldsValue(r); setIsFactoryModalOpen(true); }} />}
             {canDeleteFactory && <Popconfirm title="Xóa nhà máy?" onConfirm={() => handleDeleteFactory(r.id)}><Button danger icon={<DeleteOutlined />} /></Popconfirm>}
          </Space>
        )
    }
  ];

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      <div className="flex justify-between items-center mb-4">
        <div>
          <Title level={3} className="m-0"><DatabaseOutlined className="text-indigo-600 mr-2" />Hạ tầng Kho bãi</Title>
          <Text type="secondary">Quản lý Nhà máy, Kho và Vị trí lưu trữ</Text>
        </div>
        <Space>
           <Button icon={<ReloadOutlined />} onClick={fetchData}>Làm mới</Button>
        </Space>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm">
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        tabBarExtraContent={
            activeTab === 'warehouses' 
            ? canCreate && <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingWarehouse(null); form.resetFields(); setIsWhModalOpen(true); }}>Tạo Kho mới</Button>
            : canCreateFactory && <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingFactory(null); factoryForm.resetFields(); setIsFactoryModalOpen(true); }}>Tạo Nhà máy</Button>
        }
        items={[
            {
                key: 'warehouses',
                label: <span><ApartmentOutlined /> Danh sách Kho & Vị trí</span>,
                children: (
                    <>
                        <Input prefix={<SearchOutlined />} placeholder="Tìm kho..." className="mb-4 max-w-md" onChange={e => setSearchText(e.target.value)} />
                        <Table 
                            columns={warehouseColumns} 
                            dataSource={warehouses.filter(w => w.name.toLowerCase().includes(searchText.toLowerCase()))} 
                            rowKey="id" 
                            loading={loading} 
                            // Config mở rộng bảng
                            expandable={{ 
                                expandedRowRender, 
                                expandedRowKeys: expandedRowKeys,
                                onExpand: (expanded, record) => {
                                    setExpandedRowKeys(keys => expanded ? [...keys, record.id] : keys.filter(k => k !== record.id));
                                }
                            }} 
                        />
                    </>
                )
            },
            {
                key: 'factories',
                label: <span><BankOutlined /> Danh sách Nhà máy</span>,
                children: (
                    <Table columns={factoryColumns} dataSource={factories} rowKey="id" loading={loading} pagination={false} />
                )
            }
        ]}
      />
      </div>

      {/* MODAL KHO */}
      <Modal title={editingWarehouse ? "Sửa Kho" : "Tạo Kho"} open={isWhModalOpen} onOk={() => form.submit()} onCancel={() => setIsWhModalOpen(false)}>
        <Form form={form} layout="vertical" onFinish={handleWhSubmit}>
          <Form.Item name="warehouseCode" label="Mã Kho" rules={[{ required: true }]}><Input disabled={!!editingWarehouse} /></Form.Item>
          <Form.Item name="name" label="Tên Kho" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="factoryId" label="Nhà máy" rules={[{ required: true }]}>
            <Select options={factories.map(f => ({ label: f.name, value: f.id }))} />
          </Form.Item>
        </Form>
      </Modal>

      {/* MODAL VỊ TRÍ (BIN) */}
      <Modal 
        title={editingLocation ? "Cập nhật Vị trí" : "Thêm Vị trí mới"} 
        open={isLocModalOpen} 
        onOk={() => locForm.submit()} 
        onCancel={() => setIsLocModalOpen(false)}
      >
        <div className="mb-4 text-gray-500">
            Kho: <b>{selectedWarehouseForLoc?.name}</b> {editingLocation && <span>| Đang sửa: <b>{editingLocation.locationCode}</b></span>}
        </div>
        <Form form={locForm} layout="vertical" onFinish={handleLocSubmit}>
          <Form.Item name="locationCode" label="Mã Bin (Vị trí)" rules={[{ required: true }]} tooltip="Ví dụ: A-01-01">
            <Input placeholder="Nhập mã vị trí..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* MODAL NHÀ MÁY */}
      <Modal title={editingFactory ? "Sửa Nhà máy" : "Thêm Nhà máy"} open={isFactoryModalOpen} onOk={() => factoryForm.submit()} onCancel={() => setIsFactoryModalOpen(false)}>
        <Form form={factoryForm} layout="vertical" onFinish={handleFactorySubmit}>
            <Form.Item name="name" label="Tên nhà máy" rules={[{required: true}]}><Input /></Form.Item>
            <Form.Item name="address" label="Địa chỉ"><Input /></Form.Item>
        </Form>
      </Modal>

      {/* MODAL IN */}
      <Modal title="In nhãn Bin" open={isPrintModalOpen} onCancel={() => setIsPrintModalOpen(false)} footer={null} width={300} centered>
         <div className="flex flex-col items-center">
            <div ref={contentToPrint} className="p-4 border-2 border-black mb-4 flex flex-col items-center justify-center bg-white">
                <div className="text-xs font-bold mb-1">LOCATION BIN</div>
                <QRCodeSVG value={selectedLocForPrint?.qrCode || ''} size={160} />
                <div className="text-xl font-bold mt-2 font-mono">{selectedLocForPrint?.locationCode}</div>
                <div className="text-[10px] mt-1">{selectedLocForPrint?.qrCode}</div>
            </div>
            <Button type="primary" icon={<PrinterOutlined />} onClick={() => handlePrint()} size="large">In ngay</Button>
         </div>
      </Modal>
    </div>
  );
};

export default WarehouseManagement;