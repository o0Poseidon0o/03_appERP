import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Table, Button, Input, Tag, Space, 
  Modal, Form, Select, Popconfirm, 
  App as AntdApp, Badge, Typography, Tabs, Empty, Tooltip
} from 'antd';
import { 
  PlusOutlined, SearchOutlined, EditOutlined, 
  DeleteOutlined, ReloadOutlined, DatabaseOutlined, 
  PrinterOutlined, EnvironmentOutlined, BankOutlined, ApartmentOutlined,
  QrcodeOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { QRCodeSVG } from 'qrcode.react'; 
import { useReactToPrint } from 'react-to-print'; 
import axiosClient from '../../api/axiosClient';
import { useHasPermission } from '../../hooks/useHasPermission';

// Import Modal Quét QR (Đảm bảo file này nằm cùng thư mục)
import QRScannerModal from './QRScannerModal'; 

const { Text, Title, Paragraph } = Typography;
const { TextArea } = Input;

// --- INTERFACES ---
interface WarehouseLocation {
  id: string;
  locationCode: string;
  qrCode: string;
  warehouseId?: string;
  rack?: string;
  level?: string;
  bin?: string;
}

interface Warehouse {
  id: string;
  name: string;
  warehouseCode: string;
  factoryId: string;
  factory?: { name: string };
  description?: string;
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

  // States Dữ liệu
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [factories, setFactories] = useState<Factory[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');

  // States Modal
  const [isWhModalOpen, setIsWhModalOpen] = useState(false);
  const [isLocModalOpen, setIsLocModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isFactoryModalOpen, setIsFactoryModalOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // States Selection
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);
  const [editingFactory, setEditingFactory] = useState<Factory | null>(null);
  const [selectedWarehouseForLoc, setSelectedWarehouseForLoc] = useState<Warehouse | null>(null);
  const [editingLocation, setEditingLocation] = useState<WarehouseLocation | null>(null); 
  const [selectedLocForPrint, setSelectedLocForPrint] = useState<WarehouseLocation | null>(null);
  
  // State mở rộng dòng (Accordion)
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

  // --- TỰ ĐỘNG SINH MÃ LOCATION (CHỈ KHI TẠO MỚI) ---
  const rackValue = Form.useWatch('rack', locForm);
  const levelValue = Form.useWatch('level', locForm);
  const binValue = Form.useWatch('bin', locForm);

  useEffect(() => {
    // Chỉ tự động sinh mã khi đang mở modal VÀ không phải chế độ sửa
    if (isLocModalOpen && !editingLocation) {
      const parts = [];
      if (rackValue) parts.push(rackValue);
      if (levelValue) parts.push(levelValue);
      if (binValue) parts.push(binValue);
      
      const generatedCode = parts.join('-').toUpperCase();
      if (generatedCode) {
         locForm.setFieldsValue({ locationCode: generatedCode });
      }
    }
  }, [rackValue, levelValue, binValue, isLocModalOpen, editingLocation, locForm]);

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
        message.warning("Có lỗi khi tải dữ liệu");
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // --- [OPTIMIZED] XỬ LÝ KHI QUÉT QR THÀNH CÔNG ---
  const handleScanSuccess = (decodedText: string) => {
    const text = decodedText.trim().toUpperCase();
    setSearchText(text); // 1. Điền vào ô tìm kiếm

    // 2. Tìm xem mã này nằm ở kho nào
    const targetWarehouse = warehouses.find(w => 
        w.warehouseCode === text || 
        w.locations?.some(l => l.qrCode === text || l.locationCode === text)
    );

    if (targetWarehouse) {
        // 3. Tự động mở rộng dòng kho đó ra
        setExpandedRowKeys(prev => {
            const newKeys = new Set([...prev, targetWarehouse.id]);
            return Array.from(newKeys);
        });
        message.success(`Đã tìm thấy: ${text}`);

        // 4. Scroll tới vị trí tìm thấy
        setTimeout(() => {
            const element = document.getElementById(`row-${targetWarehouse.id}`);
            if (element) element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);
    } else {
        message.warning(`Không tìm thấy mã: ${text} trong hệ thống`);
    }
  };

  // --- HANDLERS CRUD ---
  const handleWhSubmit = async (values: any) => {
    try {
      const payload = { ...values, warehouseCode: values.warehouseCode.toUpperCase() };
      if (editingWarehouse) {
        await axiosClient.patch(`/warehouses/${editingWarehouse.id}`, payload);
        message.success('Đã cập nhật kho');
      } else {
        await axiosClient.post('/warehouses', payload);
        message.success('Tạo kho thành công');
      }
      setIsWhModalOpen(false);
      fetchData();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Lỗi hệ thống');
    }
  };

  const handleLocSubmit = async (values: any) => {
    try {
      const payload = {
          ...values,
          locationCode: values.locationCode.toUpperCase(),
          rack: values.rack?.toUpperCase(),
          level: values.level?.toUpperCase(),
          bin: values.bin?.toUpperCase()
      };

      if (editingLocation) {
        await axiosClient.patch(`/warehouses/location/${editingLocation.id}`, payload);
        message.success(`Đã cập nhật vị trí`);
      } else {
        await axiosClient.post('/warehouses/location', { 
            ...payload, 
            warehouseId: selectedWarehouseForLoc?.id 
        });
        message.success(`Đã thêm vị trí`);
        
        // Mở kho ngay khi thêm mới
        if (selectedWarehouseForLoc && !expandedRowKeys.includes(selectedWarehouseForLoc.id)) {
            setExpandedRowKeys(prev => [...prev, selectedWarehouseForLoc.id]);
        }
      }
      setIsLocModalOpen(false);
      setEditingLocation(null); 
      locForm.resetFields();
      await fetchData(); 
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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
        message.error("Không thể xóa (có thể đang chứa kho/phòng ban)");
    }
  };

  // --- RENDER CHI TIẾT VÀ HIGHLIGHT ---
  const expandedRowRender = (record: Warehouse) => {
    const currentWarehouse = warehouses.find(w => w.id === record.id) || record;

    if (!currentWarehouse.locations || currentWarehouse.locations.length === 0) {
        return <Empty description="Chưa có vị trí nào được thiết lập" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
    }

    return (
      <div className="p-4 bg-slate-50 border-t border-slate-200 rounded-b-lg">
        <div className="flex items-center mb-3">
            <EnvironmentOutlined className="text-indigo-600 mr-2" />
            <Text strong className="text-indigo-800">Danh sách vị trí trong {record.name}</Text>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {currentWarehouse.locations.map(loc => {
                const isHighlight = searchText && (
                    loc.qrCode.toLowerCase() === searchText.toLowerCase().trim() || 
                    loc.locationCode.toLowerCase() === searchText.toLowerCase().trim()
                );

                const humanAddress = (
                    <span className="text-orange-700 font-semibold">
                        {record.factory?.name}:{record.name}
                        {loc.rack ? ` - Kệ ${loc.rack}` : ''}
                        {loc.level ? ` - Tầng ${loc.level}` : ''}
                        {loc.bin ? ` - Hộc ${loc.bin}` : ''}
                    </span>
                );

                const systemCode = `${record.warehouseCode}-${loc.locationCode}`;

                return (
                    <div 
                        key={loc.id} 
                        id={`loc-${loc.id}`}
                        className={`p-3 rounded-lg border shadow-sm flex justify-between group transition-all duration-500
                            ${isHighlight 
                                ? 'bg-yellow-100 border-yellow-500 ring-2 ring-yellow-400 shadow-lg scale-105 z-10' 
                                : 'bg-white border-slate-200 hover:shadow-md'
                            }`}
                    >
                        {/* THÔNG TIN */}
                        <div className="flex-1 pr-2 flex flex-col justify-center">
                            <div className="mb-1 text-sm border-b border-dashed border-slate-200 pb-1">
                                {humanAddress}
                            </div>
                            <div className="flex items-center mt-1">
                                <Tag color={isHighlight ? "red" : "blue"} className="font-mono m-0 font-bold text-sm">
                                    {systemCode}
                                </Tag>
                            </div>
                            <div className="text-[10px] text-gray-400 mt-1 italic">
                                *Mã dùng để quét Scanner
                            </div>
                        </div>

                        {/* QR & BUTTONS */}
                        <div className="flex flex-col items-center justify-between border-l border-slate-100 pl-3">
                             <div 
                                className="bg-white p-1 border rounded cursor-pointer hover:border-indigo-500" 
                                onClick={() => { setSelectedLocForPrint(loc); setIsPrintModalOpen(true); }}
                                title="Bấm để in tem"
                             >
                                <QRCodeSVG value={loc.qrCode} size={48} />
                             </div>
                             
                             <Space size={2} className="mt-2 opacity-50 group-hover:opacity-100 transition-opacity">
                                {canUpdate && (
                                    <Button 
                                        size="small" type="text" 
                                        icon={<EditOutlined className="text-blue-600" />} 
                                        onClick={() => { 
                                            setEditingLocation(loc); 
                                            setSelectedWarehouseForLoc(record);
                                            locForm.setFieldsValue({
                                                locationCode: loc.locationCode,
                                                rack: loc.rack,
                                                level: loc.level,
                                                bin: loc.bin
                                            });
                                            setIsLocModalOpen(true); 
                                        }} 
                                    />
                                )}
                                {canDelete && (
                                    <Popconfirm title="Xóa vị trí?" onConfirm={() => handleDeleteLocation(loc.id)}>
                                        <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                                    </Popconfirm>
                                )}
                             </Space>
                        </div>
                    </div>
                );
            })}
        </div>
      </div>
    );
  };

  // --- COLUMNS ---
  const warehouseColumns: ColumnsType<Warehouse> = [
    { 
      title: 'Kho / Nhà máy', key: 'info', width: 350,
      render: (_, record) => (
        <div id={`row-${record.id}`}> {/* Đánh dấu ID để scroll tới */}
          <Space className="mb-1">
             <Tag color="blue" className="font-mono uppercase font-bold">{record.warehouseCode}</Tag>
          </Space>
          <br /><Text strong style={{ fontSize: 16 }}>{record.name}</Text>
          <div className="text-xs text-slate-500 flex items-center mt-1">
             <BankOutlined className="mr-1"/> {record.factory?.name || '---'}
          </div>
          {record.description && (
             <div className="text-xs text-gray-500 italic mt-1 border-l-2 border-gray-300 pl-2 bg-gray-50 p-1 rounded-r">
                <Paragraph ellipsis={{ rows: 2, expandable: true, symbol: 'xem thêm' }} className="m-0 text-gray-500">{record.description}</Paragraph>
             </div>
          )}
        </div>
      )
    },
    { 
      title: 'Số lượng Vị trí', align: 'center',
      render: (_, record) => (
          <Badge count={record._count?.locations || 0} showZero overflowCount={999} style={{ backgroundColor: record._count?.locations ? '#52c41a' : '#d9d9d9' }} />
      )
    },
    {
      title: 'Thao tác', align: 'right',
      render: (_, record) => (
        <Space size="small">
          {canCreate && (
            <Button size="small" type="primary" ghost icon={<PlusOutlined />} onClick={() => { 
                  setSelectedWarehouseForLoc(record); 
                  setEditingLocation(null); 
                  locForm.resetFields(); 
                  setIsLocModalOpen(true); 
                }}>Thêm Bin</Button>
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

  // --- FILTERED DATA (DEBOUNCED OPTIMIZATION) ---
  const filteredWarehouses = useMemo(() => {
    const txt = searchText.toLowerCase().trim();
    if (!txt) return warehouses;

    return warehouses.filter(w => {
        // 1. Tìm theo tên/mã kho
        const matchWarehouse = w.name.toLowerCase().includes(txt) || w.warehouseCode.toLowerCase().includes(txt);
        
        // 2. Tìm theo vị trí con
        const matchLocation = w.locations?.some(l => 
            l.locationCode.toLowerCase().includes(txt) || 
            l.qrCode.toLowerCase().includes(txt)
        );

        return matchWarehouse || matchLocation;
    });
  }, [searchText, warehouses]);

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <div>
          <Title level={3} className="m-0 text-indigo-700"><DatabaseOutlined className="mr-2" />Hạ tầng Kho bãi</Title>
          <Text type="secondary">Quản lý Nhà máy, Kho và Vị trí lưu trữ vật tư</Text>
        </div>
        <Space>
           <Button icon={<ReloadOutlined />} onClick={fetchData}>Làm mới</Button>
        </Space>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
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
                label: <span className="text-base"><ApartmentOutlined /> Danh sách Kho & Vị trí</span>,
                children: (
                    <>
                        {/* INPUT TÌM KIẾM TÍCH HỢP QUÉT QR */}
                        <Input 
                            prefix={<SearchOutlined />} 
                            placeholder="Nhập tên/mã kho hoặc quét QR..." 
                            className="mb-4 max-w-md" 
                            value={searchText} 
                            onChange={e => setSearchText(e.target.value)} 
                            allowClear 
                            size="large"
                            suffix={
                                <Tooltip title="Quét mã QR">
                                    <QrcodeOutlined 
                                        className="text-xl text-gray-400 hover:text-indigo-600 cursor-pointer transition-colors"
                                        onClick={() => setIsScannerOpen(true)}
                                    />
                                </Tooltip>
                            }
                        />

                        {/* TABLE KHO */}
                        <Table 
                            columns={warehouseColumns} 
                            dataSource={filteredWarehouses} 
                            rowKey="id" 
                            loading={loading} 
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
                label: <span className="text-base"><BankOutlined /> Danh sách Nhà máy</span>,
                children: <Table columns={factoryColumns} dataSource={factories} rowKey="id" loading={loading} pagination={false} />
            }
        ]}
      />
      </div>

      {/* --- CÁC MODAL --- */}
      
      {/* 1. Modal Kho */}
      <Modal title={editingWarehouse ? "Cập nhật Kho" : "Tạo Kho Mới"} open={isWhModalOpen} onOk={() => form.submit()} onCancel={() => setIsWhModalOpen(false)}>
        <Form form={form} layout="vertical" onFinish={handleWhSubmit} initialValues={{}}>
          <Form.Item name="warehouseCode" label="Mã Kho (Viết tắt)" rules={[{ required: true }]} help="Ví dụ: X1-WH01">
             <Input disabled={!!editingWarehouse} placeholder="Nhập mã kho..." onInput={(e) => e.currentTarget.value = e.currentTarget.value.toUpperCase()} />
          </Form.Item>
          <Form.Item name="name" label="Tên Kho đầy đủ" rules={[{ required: true }]}><Input placeholder="Ví dụ: Kho Vật Tư 1" /></Form.Item>
          
          <Form.Item name="factoryId" label="Thuộc Nhà máy" rules={[{ required: true }]}>
             <Select placeholder="Chọn nhà máy" options={factories.map(f => ({ label: f.name, value: f.id }))} />
          </Form.Item>

          <Form.Item name="description" label="Ghi chú thêm"><TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>

      {/* 2. Modal Vị trí */}
      <Modal title={editingLocation ? "Sửa Vị trí" : "Thêm Vị trí (Bin)"} open={isLocModalOpen} onOk={() => locForm.submit()} onCancel={() => setIsLocModalOpen(false)}>
        <div className="mb-4 bg-blue-50 p-3 rounded border border-blue-100 text-blue-700">Đang thao tác tại: <b>{selectedWarehouseForLoc?.name}</b></div>
        <Form form={locForm} layout="vertical" onFinish={handleLocSubmit}>
          <div className="grid grid-cols-3 gap-3 mb-2">
              <Form.Item name="rack" label="Kệ (Rack)" help="VD: 05"><Input placeholder="05" autoFocus onInput={(e) => e.currentTarget.value = e.currentTarget.value.toUpperCase()} /></Form.Item>
              <Form.Item name="level" label="Tầng (Level)" help="VD: 01"><Input placeholder="01" onInput={(e) => e.currentTarget.value = e.currentTarget.value.toUpperCase()} /></Form.Item>
              <Form.Item name="bin" label="Hộc (Bin)" help="VD: 02"><Input placeholder="02" onInput={(e) => e.currentTarget.value = e.currentTarget.value.toUpperCase()} /></Form.Item>
          </div>
          <Form.Item name="locationCode" label="Mã Bin (Tự động)" rules={[{ required: true }]} tooltip="Mã này sẽ dùng để tạo QR Code">
            <Input prefix={<QrcodeOutlined />} placeholder="05-01-02" onInput={(e) => e.currentTarget.value = e.currentTarget.value.toUpperCase()} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 3. Modal Nhà máy */}
      <Modal title={editingFactory ? "Sửa Nhà máy" : "Thêm Nhà máy Mới"} open={isFactoryModalOpen} onOk={() => factoryForm.submit()} onCancel={() => setIsFactoryModalOpen(false)}>
        <Form form={factoryForm} layout="vertical" onFinish={handleFactorySubmit}>
            <Form.Item name="name" label="Tên nhà máy" rules={[{required: true}]} help="Ví dụ: X1, X2..."><Input /></Form.Item>
            <Form.Item name="address" label="Địa chỉ / Mô tả vị trí"><Input /></Form.Item>
        </Form>
      </Modal>

      {/* 4. Modal In Tem */}
      <Modal title="In Tem Nhãn" open={isPrintModalOpen} onCancel={() => setIsPrintModalOpen(false)} footer={null} width={350} centered>
         <div className="flex flex-col items-center">
            <div ref={contentToPrint} className="p-4 border-2 border-black mb-4 flex flex-col items-center justify-center bg-white w-full">
                <div className="text-sm font-bold mb-2 uppercase border-b-2 border-black w-full text-center pb-1">LOCATION TAG</div>
                <QRCodeSVG value={selectedLocForPrint?.qrCode || ''} size={180} />
                
                <div className="text-3xl font-bold mt-2 font-mono text-center tracking-tighter">
                    {selectedLocForPrint?.locationCode}
                </div>
                
                <div className="text-sm font-bold mt-2 text-center w-full bg-black text-white py-1">
                    {selectedLocForPrint?.rack ? `KỆ ${selectedLocForPrint.rack}` : ''} 
                    {selectedLocForPrint?.level ? ` - TẦNG ${selectedLocForPrint.level}` : ''}
                    {selectedLocForPrint?.bin ? ` - HỘC ${selectedLocForPrint.bin}` : ''}
                </div>
                
                <div className="text-[10px] mt-2 text-center text-gray-500 font-mono">
                    {selectedLocForPrint?.qrCode}
                </div>
            </div>
            <Button type="primary" icon={<PrinterOutlined />} onClick={() => handlePrint()} size="large" block>In Tem Ngay</Button>
         </div>
      </Modal>

      {/* 5. Modal Quét QR (Nằm ở cuối) */}
      <QRScannerModal 
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={handleScanSuccess}
      />
    </div>
  );
};

export default WarehouseManagement;