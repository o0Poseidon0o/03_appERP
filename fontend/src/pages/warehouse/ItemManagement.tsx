import React, { useState, useEffect } from 'react';
import { 
  Table, Card, Button, Input, Tag, Space, 
  Modal, Form, Select, Tooltip, Popconfirm, 
  App as AntdApp, Row, Col, InputNumber, Badge, Typography, Divider 
} from 'antd';
import { 
  PlusOutlined, SearchOutlined, EditOutlined, 
  DeleteOutlined, ReloadOutlined, BoxPlotOutlined,
  BarcodeOutlined, ScanOutlined, PrinterOutlined, DownloadOutlined,
  MinusCircleOutlined, PlusCircleOutlined
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

interface ItemConversion {
  id?: string;
  unitName: string;
  factor: number;
  barcode?: string;
}

interface Item {
  id: string;
  itemCode: string;
  itemName: string;
  baseUnit: string;
  categoryId: string;
  minStock: number;

  category?: Category;
  stocks?: Stock[];
  conversions?: ItemConversion[];
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
    } catch {
      message.error('Không thể kết nối máy chủ dữ liệu.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- PRINT LABEL ---
  const handlePrintLabel = (item: Item) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${item.itemCode}`;

    printWindow.document.write(`
      <html>
        <head>
          <style>
            @page { size: 50mm 30mm; margin: 0; }
            body { margin: 0; display: flex; align-items: center; font-family: sans-serif; height: 30mm; }
            .c { display: flex; width: 100%; padding: 2mm; box-sizing: border-box; }
            .q { width: 40%; } .q img { width: 100%; }
            .d { width: 60%; padding-left: 2mm; display: flex; flex-direction: column; justify-content: center; }
            .t { font-size: 9px; font-weight: bold; line-height: 1.1; height: 2.2em; overflow: hidden; }
            .i { font-size: 11px; font-weight: bold; margin: 2px 0; font-family: monospace; }
            .u { font-size: 8px; color: #444; }
          </style>
        </head>
        <body onload="window.print();window.close()">
          <div class="c">
            <div class="q"><img src="${qrUrl}" /></div>
            <div class="d">
              <div class="t">${item.itemName.toUpperCase()}</div>
              <div class="i">${item.itemCode}</div>
              <div class="u">ĐVT: ${item.baseUnit}</div>
            </div>
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
  };

  const handleDownloadQR = async (item: Item) => {
    try {
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${item.itemCode}`;
      const response = await fetch(qrUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = `QR-${item.itemCode}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      message.success('Đã tải mã QR xuống!');
    } catch {
      message.error('Lỗi khi tải mã QR');
    }
  };

  // --- SUB TABLE ---
  const expandedRowRender = (record: Item) => {
    const stockColumns = [
      {
        title: 'Vị trí kệ (Bin)',
        dataIndex: ['location', 'locationCode'],
        render: (text: string) => <Tag color="blue">{text}</Tag>
      },
      {
        title: `Số lượng (${record.baseUnit})`,
        dataIndex: 'quantity',
        render: (val: number) => <Text strong>{val.toLocaleString()}</Text>
      },
      {
        title: 'Trạng thái',
        render: (_: any, s: Stock) =>
          s.quantity > 0
            ? <Badge status="success" text="Sẵn có" />
            : <Badge status="default" text="Hết hàng" />
      }
    ];

    return (
      <Table
        columns={stockColumns}
        dataSource={record.stocks}
        pagination={false}
        size="small"
        rowKey="id"
      />
    );
  };

  // --- SUBMIT ---
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
      render: (_, record) => (
        <Space>
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=60x60&data=${record.itemCode}`}
            width={40}
          />
          <div>
            <div className="font-bold">{record.itemName}</div>
            <Text type="secondary"><BarcodeOutlined /> {record.itemCode}</Text>
          </div>
        </Space>
      )
    },
    {
      title: 'Danh Mục',
      dataIndex: ['category', 'name'],
      render: (text) => <Tag>{text || 'Chưa phân loại'}</Tag>
    },
    {
      title: 'ĐVT Cơ Sở',
      dataIndex: 'baseUnit',
      align: 'center',
      render: (text) => <Tag color="geekblue">{text}</Tag>
    },
    {
      title: 'Quy Đổi',
      render: (_, record) =>
        record.conversions?.length
          ? record.conversions.map(c => (
              <Tag key={c.id} color="orange">
                1 {c.unitName} = {c.factor} {record.baseUnit}
              </Tag>
            ))
          : <span className="text-gray-300">-</span>
    },
    {
      title: 'Thao tác',
      align: 'center',
      render: (_, record) => (
        <Space>
          <Button icon={<DownloadOutlined />} onClick={() => handleDownloadQR(record)} />
          <Button icon={<PrinterOutlined />} onClick={() => handlePrintLabel(record)} />
          {canUpdate && (
            <Button
              icon={<EditOutlined />}
              onClick={() => {
                setEditingItem(record);
                form.setFieldsValue(record);
                setIsModalOpen(true);
              }}
            />
          )}
          {canDelete && (
            <Popconfirm
              title="Xóa vật tư này?"
              onConfirm={() => axiosClient.delete(`/items/${record.id}`).then(() => fetchData())}
            >
              <Button danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      )
    }
  ];

  return (
    <>
      {/* UI giữ nguyên */}
      <Divider orientation="start" plain>
        <span className="text-xs text-gray-500">Đơn vị quy đổi (Tùy chọn)</span>
      </Divider>
    </>
  );
};

export default ItemManagement;
