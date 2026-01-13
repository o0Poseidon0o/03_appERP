import React, { useState, useEffect } from 'react';
import { 
  Table, Card, Button, Input, Tag, Space, 
  Modal, Form, Select, Tooltip, Popconfirm, 
  App as AntdApp, Row, Col, InputNumber, Badge, Typography 
} from 'antd';
import { 
  PlusOutlined, SearchOutlined, EditOutlined, 
  DeleteOutlined, ReloadOutlined, BoxPlotOutlined,
  BarcodeOutlined, ScanOutlined, PrinterOutlined, DownloadOutlined // <--- 1. Thêm Icon Download
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import axiosClient from '../../api/axiosClient';
import { useHasPermission } from '../../hooks/useHasPermission';
import QRScannerModal from './QRScannerModal';

const { Text } = Typography;

// --- INTERFACES ---
interface Category {
  id: string;
  name: string;
}

interface Stock {
  id: string;
  quantity: number;
  location: { locationCode: string };
}

interface Item {
  id: string;
  itemCode: string;
  itemName: string;
  unit: string;
  categoryId: string;
  minStock: number;
  category?: Category;
  stocks?: Stock[];
}

const ItemManagement: React.FC = () => {
  const { message } = AntdApp.useApp();
  const { hasPermission } = useHasPermission();
  
  const canCreate = hasPermission('ITEM_CREATE'); 
  const canUpdate = hasPermission('ITEM_UPDATE');
  const canDelete = hasPermission('ITEM_DELETE');

  // --- STATE ---
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [searchText, setSearchText] = useState('');
  
  const [form] = Form.useForm();

  // --- API CALLS ---
  const fetchData = async (query = '') => {
    setLoading(true);
    try {
      const [itemsRes, catsRes] = await Promise.all([
        axiosClient.get(`/items/search?q=${query}`),
        axiosClient.get('/items/categories')
      ]);
      setItems(itemsRes.data?.data || []);
      setCategories(catsRes.data?.data || []);
    } catch (error: any) {
      message.error('Không thể kết nối máy chủ dữ liệu.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- HÀM IN TEM ---
  const handlePrintLabel = (item: Item) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${item.itemCode}`;

    printWindow.document.write(`
      <html>
        <head><style>
          @page { size: 50mm 30mm; margin: 0; }
          body { margin: 0; display: flex; align-items: center; font-family: sans-serif; height: 30mm; }
          .c { display: flex; width: 100%; padding: 2mm; box-sizing: border-box; }
          .q { width: 40%; } .q img { width: 100%; }
          .d { width: 60%; padding-left: 2mm; display: flex; flex-direction: column; justify-content: center; }
          .t { font-size: 9px; font-weight: bold; line-height: 1.1; height: 2.2em; overflow: hidden; }
          .i { font-size: 11px; font-weight: bold; margin: 2px 0; font-family: monospace; }
          .u { font-size: 8px; color: #444; }
        </style></head>
        <body onload="window.print();window.close()">
          <div class="c">
            <div class="q"><img src="${qrUrl}" /></div>
            <div class="d">
              <div class="t">${item.itemName.toUpperCase()}</div>
              <div class="i">${item.itemCode}</div>
              <div class="u">ĐVT: ${item.unit}</div>
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // --- [MỚI] HÀM DOWNLOAD QR CODE ---
  const handleDownloadQR = async (item: Item) => {
    try {
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${item.itemCode}`;
        
        // Fetch ảnh về dạng Blob để tránh lỗi cross-origin khi download
        const response = await fetch(qrUrl);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);

        // Tạo thẻ a ảo để kích hoạt download
        const link = document.createElement('a');
        link.href = url;
        link.download = `QR-${item.itemCode}.png`;
        document.body.appendChild(link);
        link.click();
        
        // Dọn dẹp
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        message.success('Đã tải mã QR xuống!');
    } catch (error) {
        console.error(error);
        message.error('Lỗi khi tải mã QR');
    }
  };

  // --- SUB-TABLE ---
  const expandedRowRender = (record: Item) => {
    const stockColumns = [
      { title: 'Vị trí kệ (Bin)', dataIndex: ['location', 'locationCode'], key: 'loc', render: (text: string) => <Tag color="blue">{text}</Tag> },
      { title: 'Số lượng thực tế', dataIndex: 'quantity', key: 'qty', render: (val: number) => <Text strong>{val.toLocaleString()}</Text> },
      { title: 'Trạng thái', render: (_, s: any) => s.quantity > 0 ? <Badge status="success" text="Sẵn có" /> : <Badge status="default" text="Hết hàng" /> }
    ];
    return <Table columns={stockColumns} dataSource={record.stocks} pagination={false} size="small" rowKey="id" className="bg-slate-50" />;
  };

  // --- HANDLERS ---
  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      if (editingItem) {
        await axiosClient.patch(`/items/${editingItem.id}`, values);
        message.success('Cập nhật thành công');
      } else {
        await axiosClient.post('/items', values);
        message.success('Đã thêm vật tư mới');
      }
      setIsModalOpen(false);
      fetchData(searchText);
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Thao tác thất bại');
    } finally {
      setLoading(false);
    }
  };

  const columns: ColumnsType<Item> = [
    {
      title: 'Vật Tư / Mã Số',
      key: 'itemName',
      render: (_, record) => (
        <Space size="middle">
          <div className="p-1 bg-white border rounded">
            <img src={`https://api.qrserver.com/v1/create-qr-code/?size=60x60&data=${record.itemCode}`} alt="QR" width={40} />
          </div>
          <div>
            <div className="font-bold text-slate-800">{record.itemName}</div>
            <Text type="secondary" style={{ fontSize: '12px' }}><BarcodeOutlined /> {record.itemCode}</Text>
          </div>
        </Space>
      )
    },
    {
      title: 'Danh Mục',
      dataIndex: ['category', 'name'],
      render: (text) => <Tag className="rounded-md border-none bg-slate-100 text-slate-600">{text || 'Chưa phân loại'}</Tag>
    },
    { title: 'ĐVT', dataIndex: 'unit', align: 'center' },
    {
      title: 'Tổng Tồn Kho',
      key: 'totalStock',
      align: 'right',
      render: (_, record) => {
        const total = record.stocks?.reduce((acc, s) => acc + s.quantity, 0) || 0;
        const isLow = total <= record.minStock;
        return (
          <Tooltip title={isLow ? `Thấp hơn mức tối thiểu (${record.minStock})` : 'Tồn kho ổn định'}>
            <div className={`px-3 py-1 rounded-full inline-block font-bold ${isLow ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
              {total.toLocaleString()}
            </div>
          </Tooltip>
        );
      }
    },
    {
      title: 'Thao tác',
      key: 'action',
      align: 'center',
      width: 180, // Tăng width một chút để chứa đủ 4 nút
      render: (_, record) => (
        <Space>
           {/* Nút Download Mới */}
          <Tooltip title="Tải QR">
            <Button size="small" icon={<DownloadOutlined />} onClick={() => handleDownloadQR(record)} />
          </Tooltip>

          <Tooltip title="In tem">
            <Button size="small" icon={<PrinterOutlined />} onClick={() => handlePrintLabel(record)} />
          </Tooltip>
          
          {canUpdate && (
            <Button size="small" type="text" className="text-blue-600" icon={<EditOutlined />} onClick={() => {
              setEditingItem(record);
              form.setFieldsValue(record);
              setIsModalOpen(true);
            }} />
          )}
          {canDelete && (
            <Popconfirm title="Xóa vật tư này?" onConfirm={() => axiosClient.delete(`/items/${record.id}`).then(() => fetchData())}>
              <Button size="small" type="text" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="p-6 bg-[#f8fafc] min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <Space>
          <div className="bg-indigo-600 p-2 rounded-lg"><BoxPlotOutlined className="text-white text-xl" /></div>
          <div>
            <h2 className="text-xl font-bold text-slate-800 m-0">Quản Lý Vật Tư</h2>
            <Text type="secondary">Quản lý danh mục, tồn kho và in nhãn QR Code</Text>
          </div>
        </Space>
        {canCreate && (
          <Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => { setEditingItem(null); form.resetFields(); setIsModalOpen(true); }} className="shadow-md bg-indigo-600">
            Thêm Vật Tư
          </Button>
        )}
      </div>

      <Card bordered={false} className="shadow-sm rounded-xl">
        <div className="flex justify-between items-center mb-5">
          <Space.Compact style={{ width: 400 }}>
            <Input 
              placeholder="Mã, tên hoặc quét mã vạch..." 
              prefix={<SearchOutlined className="text-slate-400" />} 
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              onPressEnter={() => fetchData(searchText)}
            />
            <Button icon={<ScanOutlined />} onClick={() => setIsScannerOpen(true)}>Quét</Button>
          </Space.Compact>
          <Button icon={<ReloadOutlined />} onClick={() => { setSearchText(''); fetchData(''); }}>Làm mới</Button>
        </div>

        <Table 
          columns={columns} 
          dataSource={items} 
          rowKey="id" 
          loading={loading} 
          expandable={{ expandedRowRender, rowExpandable: record => (record.stocks?.length || 0) > 0 }}
          pagination={{ pageSize: 10, showSizeChanger: true }}
        />
      </Card>

      <QRScannerModal isOpen={isScannerOpen} onClose={() => setIsScannerOpen(false)} onScanSuccess={(text) => { setSearchText(text); fetchData(text); }} />

      <Modal title={editingItem ? "Cập nhật vật tư" : "Thêm vật tư mới"} open={isModalOpen} onCancel={() => setIsModalOpen(false)} onOk={() => form.submit()} confirmLoading={loading} width={600} centered>
        <Form form={form} layout="vertical" onFinish={handleSubmit} className="mt-4">
          <Row gutter={16}>
            <Col span={12}><Form.Item name="itemCode" label="Mã Vật Tư" rules={[{ required: true }]}><Input placeholder="Ví dụ: VT-1001" disabled={!!editingItem} /></Form.Item></Col>
            <Col span={12}>
              <Form.Item name="categoryId" label="Danh Mục" rules={[{ required: true }]}>
                <Select placeholder="Chọn nhóm" options={categories.map(c => ({ label: c.name, value: c.id }))} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="itemName" label="Tên / Quy cách vật tư" rules={[{ required: true }]}><Input.TextArea rows={2} placeholder="Nhập tên chi tiết..." /></Form.Item>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="unit" label="Đơn Vị Tính" rules={[{ required: true }]}><Input placeholder="Cái, Kg, Bộ..." /></Form.Item></Col>
            <Col span={12}><Form.Item name="minStock" label="Ngưỡng tồn tối thiểu" initialValue={5}><InputNumber style={{ width: '100%' }} min={0} /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
};

export default ItemManagement;