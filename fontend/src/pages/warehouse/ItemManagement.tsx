import React, { useState, useEffect } from 'react';
import { 
  Table, Card, Button, Input, Tag, Space, 
  Modal, Form, Select, Popconfirm, 
  App as AntdApp, Row, Col, InputNumber, Divider 
} from 'antd';
// [SỬA LỖI 1] Bỏ import Typography vì không dùng
// import { Typography } from 'antd'; 

import { 
  PlusOutlined, SearchOutlined, EditOutlined, 
  DeleteOutlined, ReloadOutlined, BoxPlotOutlined,
  ScanOutlined, PrinterOutlined, DownloadOutlined,
  MinusCircleOutlined, PlusCircleOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import axiosClient from '../../api/axiosClient';
import { useHasPermission } from '../../hooks/useHasPermission';
import QRScannerModal from './QRScannerModal';

// [SỬA LỖI 1] Xóa dòng này vì biến Text không được sử dụng
// const { Text } = Typography;

// --- INTERFACES ---
interface Category { id: string; name: string; }
interface Stock { id: string; quantity: number; location: { locationCode: string }; }
interface ItemConversion { id?: string; unitName: string; factor: number; barcode?: string; }
interface Item { 
  id: string; itemCode: string; itemName: string; baseUnit: string; categoryId: string; minStock: number; 
  category?: Category; stocks?: Stock[]; conversions?: ItemConversion[]; 
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

  useEffect(() => { fetchData(); }, []);

  // --- HANDLERS (Giữ nguyên logic in ấn/xử lý) ---
  const handlePrintLabel = (item: Item) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${item.itemCode}`;
    printWindow.document.write(`<html><head><style>@page { size: 50mm 30mm; margin: 0; } body { margin: 0; display: flex; align-items: center; font-family: sans-serif; height: 30mm; } .c { display: flex; width: 100%; padding: 2mm; box-sizing: border-box; } .q { width: 40%; } .q img { width: 100%; } .d { width: 60%; padding-left: 2mm; display: flex; flex-direction: column; justify-content: center; } .t { font-size: 9px; font-weight: bold; line-height: 1.1; height: 2.2em; overflow: hidden; } .i { font-size: 11px; font-weight: bold; margin: 2px 0; font-family: monospace; } .u { font-size: 8px; color: #444; }</style></head><body onload="window.print();window.close()"><div class="c"><div class="q"><img src="${qrUrl}" /></div><div class="d"><div class="t">${item.itemName.toUpperCase()}</div><div class="i">${item.itemCode}</div><div class="u">ĐVT: ${item.baseUnit}</div></div></div></body></html>`);
    printWindow.document.close();
  };

  const handleDownloadQR = async (item: Item) => {
    try {
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${item.itemCode}`;
        const response = await fetch(qrUrl);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url; link.download = `QR-${item.itemCode}.png`;
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        message.success('Đã tải QR');
    } catch (error) { message.error('Lỗi tải QR'); }
  };

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

  // --- RENDER HELPERS ---
  const renderStockStatus = (item: Item) => {
    const total = item.stocks?.reduce((acc, s) => acc + s.quantity, 0) || 0;
    const isLow = total <= item.minStock;
    return (
      <div className={`px-2 py-1 rounded-md text-xs font-bold whitespace-nowrap ${isLow ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-green-50 text-green-600 border border-green-200'}`}>
        {total.toLocaleString()} {item.baseUnit}
      </div>
    );
  };

  // --- COLUMNS CHO PC (Màn hình lớn hẳn) ---
  const columns: ColumnsType<Item> = [
    {
      title: 'Vật Tư', key: 'itemName',
      render: (_, record) => (
        <Space>
           <div className="p-1 bg-white border rounded shrink-0">
             <img src={`https://api.qrserver.com/v1/create-qr-code/?size=60x60&data=${record.itemCode}`} alt="QR" width={32} height={32} />
           </div>
           <div className="flex flex-col">
             <span className="font-semibold text-slate-700">{record.itemName}</span>
             <span className="text-xs text-slate-500 font-mono">{record.itemCode}</span>
           </div>
        </Space>
      )
    },
    { title: 'Danh Mục', dataIndex: ['category', 'name'], render: (text) => <Tag>{text || '-'}</Tag> },
    { title: 'Tồn Kho', key: 'totalStock', align: 'right', render: (_, record) => renderStockStatus(record) },
    {
      title: 'Thao tác', key: 'action', align: 'right', width: 120,
      render: (_, record) => (
        <Space size="small">
          {canUpdate && <Button size="small" icon={<EditOutlined />} onClick={() => { setEditingItem(record); form.setFieldsValue({ ...record, conversions: record.conversions }); setIsModalOpen(true); }} />}
          <Popconfirm title="Xóa?" onConfirm={() => axiosClient.delete(`/items/${record.id}`).then(() => fetchData())}>
            {canDelete && <Button size="small" danger icon={<DeleteOutlined />} />}
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="p-3 md:p-6 bg-[#f0f2f5] min-h-screen">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-3">
        <Space>
          <div className="bg-blue-600 p-2 rounded-lg text-white"><BoxPlotOutlined style={{ fontSize: '20px' }} /></div>
          <div>
            <h2 className="text-lg font-bold text-slate-800 m-0 leading-tight">Quản Lý Vật Tư</h2>
          </div>
        </Space>
        {canCreate && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingItem(null); form.resetFields(); setIsModalOpen(true); }} className="w-full md:w-auto bg-blue-600 shadow-sm">
            Thêm Mới
          </Button>
        )}
      </div>

      <Card bordered={false} className="shadow-sm rounded-lg" bodyStyle={{ padding: '12px' }}>
        {/* TOOLBAR */}
        <div className="flex flex-col gap-3 mb-4">
          <Input 
             placeholder="Tìm mã, tên..." 
             prefix={<SearchOutlined className="text-gray-400" />} 
             value={searchText}
             onChange={e => setSearchText(e.target.value)}
             onPressEnter={() => fetchData(searchText)}
             allowClear
             size="large"
          />
          <div className="flex gap-2">
             <Button icon={<ScanOutlined />} onClick={() => setIsScannerOpen(true)} className="flex-1">Quét Mã</Button>
             <Button icon={<ReloadOutlined />} onClick={() => { setSearchText(''); fetchData(''); }} />
          </div>
        </div>

        {/* --- DESKTOP VIEW (Chỉ hiện trên màn hình > 1024px - Laptop lớn) --- */}
        <div className="hidden lg:block">
          <Table 
            columns={columns} 
            dataSource={items} 
            rowKey="id" 
            loading={loading} 
            pagination={{ pageSize: 8 }}
            expandable={{
                expandedRowRender: (record) => (
                    <div className="p-3 bg-gray-50 flex justify-between items-center">
                        <Space>
                            <Button size="small" icon={<PrinterOutlined />} onClick={() => handlePrintLabel(record)}>In Tem</Button>
                            <Button size="small" icon={<DownloadOutlined />} onClick={() => handleDownloadQR(record)}>Tải QR</Button>
                        </Space>
                        <div className="text-xs text-gray-500">
                             Quy đổi: {record.conversions?.map(c => `${c.unitName} (x${c.factor})`).join(', ') || 'Không có'}
                        </div>
                    </div>
                )
            }}
          />
        </div>

        {/* --- TABLET & MOBILE GRID VIEW (Hiện trên iPad và điện thoại) --- */}
        {/* Grid này sẽ tự chia 2 cột trên iPad (md) và 1 cột trên điện thoại (mặc định) */}
        <div className="lg:hidden grid grid-cols-1 md:grid-cols-2 gap-3">
            {loading ? <div className="text-center py-4 col-span-full">Đang tải dữ liệu...</div> : items.map(item => (
                <div key={item.id} className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm flex flex-col justify-between">
                    {/* Phần đầu thẻ: QR + Thông tin chính */}
                    <div className="flex gap-3 mb-2">
                        {/* QUAN TRỌNG: shrink-0 giúp QR không bị méo */}
                        <div className="shrink-0 border rounded p-1 h-14 w-14 bg-white flex items-center justify-center">
                            <img 
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${item.itemCode}`} 
                                className="w-full h-full object-contain" 
                                alt="QR" 
                            />
                        </div>
                        <div className="flex-1 min-w-0"> {/* min-w-0 giúp text truncate hoạt động trong flex */}
                            <h3 className="font-bold text-slate-800 text-sm truncate mb-1" title={item.itemName}>
                                {item.itemName}
                            </h3>
                            <div className="flex items-center gap-2">
                                <Tag className="m-0 font-mono text-[10px] px-1">{item.itemCode}</Tag>
                                <span className="text-xs text-gray-500 truncate">{item.category?.name}</span>
                            </div>
                        </div>
                    </div>

                    {/* Phần giữa: Thông tin phụ */}
                    <div className="bg-gray-50 rounded p-2 mb-3 text-xs text-gray-600 grid grid-cols-2 gap-y-1">
                        <div>ĐVT: <span className="font-medium text-black">{item.baseUnit}</span></div>
                        <div className="text-right">Min: {item.minStock}</div>
                        <div className="col-span-2 border-t border-gray-200 mt-1 pt-1 truncate">
                             Quy đổi: {item.conversions?.map(c => c.unitName).join(', ') || '-'}
                        </div>
                    </div>

                    {/* Phần chân: Tồn kho + Nút bấm */}
                    <div className="flex justify-between items-center mt-auto pt-2 border-t border-gray-100">
                        {renderStockStatus(item)}
                        
                        <Space size={2}>
                             <Button size="small" type="text" icon={<DownloadOutlined />} onClick={() => handleDownloadQR(item)} />
                             <Button size="small" type="text" icon={<PrinterOutlined />} onClick={() => handlePrintLabel(item)} />
                             {canUpdate && <Button size="small" type="text" className="text-blue-600" icon={<EditOutlined />} onClick={() => {
                                setEditingItem(item);
                                form.setFieldsValue({ ...item, conversions: item.conversions });
                                setIsModalOpen(true);
                            }} />}
                        </Space>
                    </div>
                </div>
            ))}
        </div>
      </Card>

      <QRScannerModal isOpen={isScannerOpen} onClose={() => setIsScannerOpen(false)} onScanSuccess={(text) => { setSearchText(text); fetchData(text); }} />

      {/* MODAL FORM */}
      <Modal 
        title={editingItem ? "Cập nhật" : "Thêm mới"} 
        open={isModalOpen} 
        onCancel={() => setIsModalOpen(false)} 
        onOk={() => form.submit()} 
        confirmLoading={loading} 
        width={600}
        style={{ top: 10 }}
        bodyStyle={{ maxHeight: '70vh', overflowY: 'auto' }} // Cho phép cuộn nội dung modal nếu quá dài
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit} className="pt-2">
           {/* Giữ nguyên Form Logic như cũ, chỉ chỉnh layout Grid */}
           <Row gutter={12}>
                <Col span={12}><Form.Item name="itemCode" label="Mã VT" rules={[{ required: true }]}><Input disabled={!!editingItem} /></Form.Item></Col>
                <Col span={12}>
                     <Form.Item name="categoryId" label="Danh Mục" rules={[{ required: true }]}>
                        <Select options={categories.map(c => ({ label: c.name, value: c.id }))} />
                     </Form.Item>
                </Col>
           </Row>
           <Form.Item name="itemName" label="Tên Vật Tư" rules={[{ required: true }]}><Input.TextArea rows={2} /></Form.Item>
           <Row gutter={12}>
                <Col span={12}><Form.Item name="baseUnit" label="ĐVT" rules={[{ required: true }]}><Input /></Form.Item></Col>
                <Col span={12}><Form.Item name="minStock" label="Min Stock"><InputNumber className="w-full" min={0} /></Form.Item></Col>
           </Row>
           
           {/* [SỬA LỖI 2] Bỏ orientation="left" để tránh lỗi TS, thêm style css inline nếu cần thiết */}
           <Divider plain className="m-2 text-xs">Đơn vị quy đổi</Divider>
           
           <Form.List name="conversions">
                {(fields, { add, remove }) => (
                    <div className="flex flex-col gap-2">
                        {fields.map(({ key, name, ...restField }) => (
                            <div key={key} className="flex gap-2 items-center bg-gray-50 p-2 rounded">
                                <Form.Item {...restField} name={[name, 'unitName']} noStyle rules={[{ required: true }]}><Input placeholder="Tên" size="small" /></Form.Item>
                                <span>=</span>
                                <Form.Item {...restField} name={[name, 'factor']} noStyle rules={[{ required: true }]}><InputNumber placeholder="HS" size="small" style={{width: 60}} /></Form.Item>
                                <MinusCircleOutlined onClick={() => remove(name)} className="text-red-500" />
                            </div>
                        ))}
                        <Button type="dashed" size="small" onClick={() => add()} block icon={<PlusCircleOutlined />}>Thêm ĐVT</Button>
                    </div>
                )}
           </Form.List>
        </Form>
      </Modal>
    </div>
  );
};

export default ItemManagement;