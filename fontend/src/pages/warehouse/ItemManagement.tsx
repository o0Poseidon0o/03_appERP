import React, { useState, useEffect } from 'react';
import { 
  Table, Card, Button, Input, Tag, Space, 
  Modal, Form, Select, Tooltip, Popconfirm, 
  App as AntdApp, Row, Col, InputNumber, Badge, Typography, Divider, Upload 
} from 'antd';
import { 
  PlusOutlined, SearchOutlined, EditOutlined, 
  DeleteOutlined, ReloadOutlined, BoxPlotOutlined,
  BarcodeOutlined, ScanOutlined, PrinterOutlined, DownloadOutlined,
  MinusCircleOutlined, PlusCircleOutlined, UploadOutlined, FileExcelOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import * as XLSX from 'xlsx'; // Import thư viện Excel
import axiosClient from '../../api/axiosClient';
import { useHasPermission } from '../../hooks/useHasPermission';
import QRScannerModal from './QRScannerModal';

const { Text } = Typography;

// --- INTERFACES ---
interface Category {
  id: string;
  name: string;
  code?: string; // [QUAN TRỌNG] Mã nhóm để đối chiếu khi import
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
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
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
      // Giả sử API trả về list category có trường 'code' (VD: 2, 4, 6, 8...)
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

  // --- [LOGIC MỚI] XỬ LÝ IMPORT EXCEL TỰ ĐỘNG KHỚP DANH MỤC ---
  const handleImportExcel = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = e.target?.result;
            if (!data) return;
            
            // Đọc file Excel dạng mảng (Array of Arrays) để dễ xử lý theo cột
            const workbook = XLSX.read(data, { type: 'binary' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            
            // header: 1 nghĩa là lấy dữ liệu dạng mảng [[col1, col2, col3], ...]
            const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

            if (rows.length === 0) {
                message.error("File Excel không có dữ liệu!");
                return;
            }

            // Xử lý dữ liệu
            const parsedItems = rows
                .filter(row => row.length >= 3 && row[0]) // Lọc dòng rỗng
                .map(row => {
                    const itemCode = String(row[0]).trim(); // Cột 1: Mã VT
                    const itemName = String(row[1]).trim(); // Cột 2: Tên VT
                    const baseUnit = String(row[2]).trim(); // Cột 3: ĐVT

                    // Bỏ qua dòng tiêu đề nếu có
                    if (itemCode.toLowerCase().includes('mã') || itemCode.toLowerCase().includes('code')) return null;

                    // --- LOGIC TÁCH MÃ DANH MỤC ---
                    // Lấy ký tự đầu tiên hoặc phần trước dấu gạch ngang làm Mã nhóm
                    // VD: "2-02-001" -> Lấy "2"
                    const categoryPrefix = itemCode.split('-')[0];

                    // Tìm Category trong state có 'code' khớp với prefix này
                    const matchedCategory = categories.find(c => c.code === categoryPrefix);

                    return {
                        itemCode,
                        itemName,
                        baseUnit,
                        categoryId: matchedCategory ? matchedCategory.id : null, // Nếu không thấy thì null
                        minStock: 5, // Mặc định
                        // Lưu lại để debug nếu cần
                        _debugCategoryCode: categoryPrefix 
                    };
                })
                .filter(item => item !== null); // Loại bỏ các dòng null (tiêu đề)

            if (parsedItems.length === 0) {
                message.warning("Không tìm thấy dữ liệu hợp lệ.");
                return;
            }

            // Kiểm tra xem có dòng nào không tìm thấy danh mục không
            const missingCategoryCount = parsedItems.filter(i => !i.categoryId).length;
            if (missingCategoryCount > 0) {
                message.warning(`Cảnh báo: Có ${missingCategoryCount} vật tư không tìm thấy Nhóm (Mã đầu: ${parsedItems.find(i => !i.categoryId)?._debugCategoryCode}).`);
            }

            // Gọi API Import Bulk
            await axiosClient.post('/items/import-bulk', { items: parsedItems });
            
            message.success(`Đã import thành công ${parsedItems.length} vật tư!`);
            setIsImportModalOpen(false);
            fetchData();
        } catch (error: any) {
            console.error(error);
            message.error("Lỗi import: " + (error.response?.data?.message || error.message));
        }
    };
    reader.readAsBinaryString(file);
    return false; // Chặn upload mặc định của antd
  };

  // --- HÀM IN TEM & TẢI QR ---
  const handlePrintLabel = (item: Item) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${item.itemCode}`;

    printWindow.document.write(`
      <html>
        <head><style>@page{size:50mm 30mm;margin:0}body{margin:0;display:flex;align-items:center;font-family:sans-serif;height:30mm}.c{display:flex;width:100%;padding:2mm;box-sizing:border-box}.q{width:40%}.q img{width:100%}.d{width:60%;padding-left:2mm;display:flex;flex-direction:column;justify-content:center}.t{font-size:9px;font-weight:bold;line-height:1.1;height:2.2em;overflow:hidden}.i{font-size:11px;font-weight:bold;margin:2px 0;font-family:monospace}.u{font-size:8px;color:#444}</style></head>
        <body onload="window.print();window.close()"><div class="c"><div class="q"><img src="${qrUrl}"/></div><div class="d"><div class="t">${item.itemName.toUpperCase()}</div><div class="i">${item.itemCode}</div><div class="u">ĐVT: ${item.baseUnit}</div></div></div></body>
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
        message.success('Đã tải QR');
    } catch (error) {
        message.error('Lỗi khi tải mã QR');
    }
  };

  // --- SUB-TABLE ---
  const expandedRowRender = (record: Item) => {
    const stockColumns = [
      { title: 'Vị trí kệ (Bin)', dataIndex: ['location', 'locationCode'], key: 'loc', render: (text: string) => <Tag color="blue">{text}</Tag> },
      { title: `Số lượng (${record.baseUnit})`, dataIndex: 'quantity', key: 'qty', render: (val: number) => <Text strong>{val.toLocaleString()}</Text> },
      { title: 'Trạng thái', render: (_: any, s: any) => s.quantity > 0 ? <Badge status="success" text="Sẵn có" /> : <Badge status="default" text="Hết hàng" /> }
    ];
    return <Table columns={stockColumns} dataSource={record.stocks} pagination={false} size="small" rowKey="id" className="bg-slate-50" />;
  };

  // --- CRUD HANDLERS ---
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
    { 
        title: 'ĐVT Cơ Sở', 
        dataIndex: 'baseUnit',
        align: 'center',
        render: (text) => <Tag color="geekblue">{text}</Tag>
    },
    {
        title: 'Quy Đổi',
        key: 'conversions',
        render: (_, record) => (
            <div className="flex flex-col gap-1">
                {record.conversions && record.conversions.length > 0 ? (
                    record.conversions.map((conv) => (
                        <Tag key={conv.id} color="orange" className="mr-0 w-fit text-xs">
                           1 {conv.unitName} = {conv.factor} {record.baseUnit}
                        </Tag>
                    ))
                ) : <span className="text-gray-300 text-xs">-</span>}
            </div>
        )
    },
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
              {total.toLocaleString()} <span className="text-xs font-normal">{record.baseUnit}</span>
            </div>
          </Tooltip>
        );
      }
    },
    {
      title: 'Thao tác',
      key: 'action',
      align: 'center',
      width: 150,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="Tải QR">
            <Button size="small" icon={<DownloadOutlined />} onClick={() => handleDownloadQR(record)} />
          </Tooltip>

          <Tooltip title="In tem">
            <Button size="small" icon={<PrinterOutlined />} onClick={() => handlePrintLabel(record)} />
          </Tooltip>
          
          {canUpdate && (
            <Button size="small" type="text" className="text-blue-600" icon={<EditOutlined />} onClick={() => {
              setEditingItem(record);
              form.setFieldsValue({
                  ...record,
                  conversions: record.conversions
              });
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
            <Text type="secondary">Quản lý danh mục, import Excel và in mã vạch</Text>
          </div>
        </Space>
        
        <Space>
            {canCreate && (
                <Button 
                    icon={<FileExcelOutlined />} 
                    className="border-green-600 text-green-600 hover:!bg-green-50"
                    onClick={() => setIsImportModalOpen(true)}
                >
                    Import Excel
                </Button>
            )}
            {canCreate && (
            <Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => { setEditingItem(null); form.resetFields(); setIsModalOpen(true); }} className="shadow-md bg-indigo-600">
                Thêm Vật Tư
            </Button>
            )}
        </Space>
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

      {/* MODAL THÊM / SỬA */}
      <Modal 
        title={editingItem ? "Cập nhật vật tư" : "Thêm vật tư mới"} 
        open={isModalOpen} 
        onCancel={() => setIsModalOpen(false)} 
        onOk={() => form.submit()} 
        confirmLoading={loading} 
        width={700} 
        centered
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit} className="mt-4">
          <Row gutter={16}>
            <Col span={12}><Form.Item name="itemCode" label="Mã Vật Tư" rules={[{ required: true }]}><Input placeholder="Ví dụ: 2-02-001..." disabled={!!editingItem} /></Form.Item></Col>
            <Col span={12}>
              {/* [UPDATE] HIỂN THỊ MÃ NHÓM ĐỂ DỄ CHỌN */}
              <Form.Item name="categoryId" label="Danh Mục" rules={[{ required: true }]}>
                <Select 
                    placeholder="Chọn nhóm" 
                    showSearch 
                    optionFilterProp="label"
                    options={categories.map(c => ({ 
                        // Hiển thị dạng: Tên Nhóm [Mã] (VD: Thép [2])
                        label: `${c.name} ${c.code ? `[${c.code}]` : ''}`, 
                        value: c.id 
                    }))} 
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="itemName" label="Tên / Quy cách vật tư" rules={[{ required: true }]}><Input.TextArea rows={2} placeholder="Nhập tên chi tiết..." /></Form.Item>
          
          <Row gutter={16}>
            <Col span={12}>
                <Form.Item name="baseUnit" label="Đơn Vị Cơ Sở (Nhỏ nhất)" rules={[{ required: true }]} tooltip="Đơn vị dùng để tính tồn kho (VD: Cái, Kg)">
                    <Input placeholder="VD: Cái" />
                </Form.Item>
            </Col>
            <Col span={12}><Form.Item name="minStock" label="Ngưỡng tồn tối thiểu" initialValue={5}><InputNumber style={{ width: '100%' }} min={0} /></Form.Item></Col>
          </Row>

          <Divider plain><span className="text-xs text-gray-500">Đơn vị quy đổi (Tùy chọn)</span></Divider>

          <Form.List name="conversions">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <Row key={key} gutter={8} align="middle" className="mb-2">
                    <Col span={8}>
                      <Form.Item
                        {...restField}
                        name={[name, 'unitName']}
                        rules={[{ required: true, message: 'Nhập tên ĐVT' }]}
                        noStyle
                      >
                        <Input placeholder="Tên ĐVT (VD: Thùng)" />
                      </Form.Item>
                    </Col>
                    <Col span={1}>
                        <div className="text-center">=</div>
                    </Col>
                    <Col span={6}>
                      <Form.Item
                        {...restField}
                        name={[name, 'factor']}
                        rules={[{ required: true, message: 'Nhập hệ số' }]}
                        noStyle
                      >
                        <InputNumber placeholder="Hệ số" style={{ width: '100%' }} min={1} />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                         <div className="text-gray-400 text-sm pl-2">
                            (Đơn vị cơ sở)
                         </div>
                    </Col>
                    <Col span={1}>
                      <MinusCircleOutlined onClick={() => remove(name)} className="text-red-500 cursor-pointer" />
                    </Col>
                  </Row>
                ))}
                
                {!editingItem && (
                    <Form.Item>
                    <Button type="dashed" onClick={() => add()} block icon={<PlusCircleOutlined />}>
                        Thêm quy đổi (VD: Thùng, Hộp)
                    </Button>
                    </Form.Item>
                )}
                {editingItem && (
                    <div className="text-xs text-orange-500 mb-4 bg-orange-50 p-2 rounded">
                        * Để sửa/xóa đơn vị quy đổi, vui lòng xóa vật tư và tạo lại hoặc liên hệ quản trị viên.
                    </div>
                )}
              </>
            )}
          </Form.List>

        </Form>
      </Modal>

      {/* --- [MỚI] MODAL IMPORT EXCEL --- */}
      <Modal 
        title="Import Vật Tư từ Excel" 
        open={isImportModalOpen} 
        onCancel={() => setIsImportModalOpen(false)} 
        footer={null}
        centered
      >
         <div className="flex flex-col gap-4 py-4">
             <div className="bg-blue-50 p-3 rounded text-blue-700 text-sm">
                 <p><b>Quy tắc Import:</b></p>
                 <ul className="list-disc pl-5 mt-1 text-xs">
                     <li>Cột 1: Mã vật tư (VD: 2-02-001...). Hệ thống sẽ tự lấy số đầu tiên (VD: 2) làm Mã Nhóm.</li>
                     <li>Cột 2: Tên vật tư.</li>
                     <li>Cột 3: Đơn vị tính.</li>
                     <li>Vui lòng đảm bảo <b>Mã Nhóm</b> đã tồn tại trong hệ thống trước khi import.</li>
                 </ul>
             </div>

             <Upload.Dragger 
                beforeUpload={handleImportExcel} 
                showUploadList={false}
                accept=".xlsx, .xls"
                height={150}
                className="w-full"
             >
                 <p className="ant-upload-drag-icon"><UploadOutlined className="text-blue-500" /></p>
                 <p className="ant-upload-text">Kéo thả file Excel vào đây</p>
                 <p className="ant-upload-hint text-gray-400">Hỗ trợ định dạng .xlsx, .xls</p>
             </Upload.Dragger>
         </div>
      </Modal>
    </div>
  );
};

export default ItemManagement;