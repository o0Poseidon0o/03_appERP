import React, { useState, useEffect } from 'react';
import { 
  Table, Card, Button, Select, InputNumber, Space, 
  Form, Input, Row, Col, App as AntdApp, Switch, Typography, Divider, Tag 
} from 'antd';
import { 
  PlusOutlined, DeleteOutlined, QrcodeOutlined,
  SwapOutlined, InfoCircleOutlined, ShopOutlined, SendOutlined 
} from '@ant-design/icons';
import axiosClient from '../../api/axiosClient';
import { useNavigate } from 'react-router-dom';
import QRScannerModal from './QRScannerModal'; // Đảm bảo đường dẫn import đúng file bạn vừa tạo

const { Text, Title } = Typography;

// Định nghĩa Interface
interface Item {
  id: string;
  itemCode: string;
  itemName: string;
  unit: string;
}

interface Location {
  id: string;
  locationCode: string;
}

interface Supplier {
  id: string;
  name: string;
}

interface TransactionDetail {
  key: string;
  itemId: string | null;
  quantity: number;
  fromLocationId: string | null;
  toLocationId: string | null;
  currentStock?: number; 
  unit?: string;
}

const StockTransactionCreate: React.FC = () => {
  const { message, notification } = AntdApp.useApp();
  const [form] = Form.useForm();
  const navigate = useNavigate();

  // States
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedItems, setSelectedItems] = useState<TransactionDetail[]>([]);
  
  // State cho QR Scanner
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Lấy thông tin User
  const userStr = localStorage.getItem('user');
  const currentUser = userStr ? JSON.parse(userStr) : {};
  const isLeader = ['ROLE-LEADER', 'ROLE-MANAGER'].includes(currentUser.roleId);

  const transactionType = Form.useWatch('type', form);

  // 1. FETCH DỮ LIỆU
  useEffect(() => {
    const fetchMasterData = async () => {
      try {
        const [resStock, resLocs, resSups] = await Promise.all([
          axiosClient.get('/stock-transactions/actual?limit=2000'), 
          axiosClient.get('/warehouses/locations/all'), 
          axiosClient.get('/suppliers') 
        ]);

        const rawStocks = resStock.data?.data || [];
        const uniqueItemMap = new Map();

        rawStocks.forEach((s: any) => {
          const realItemId = s.itemId || s.id;
          if (!uniqueItemMap.has(realItemId)) {
            uniqueItemMap.set(realItemId, {
               id: realItemId,
               itemCode: s.itemCode, 
               itemName: s.itemName, 
               unit: s.unit 
            });
          }
        });

        setItems(Array.from(uniqueItemMap.values()));
        setLocations(resLocs.data?.data || []);
        setSuppliers(resSups.data?.data || []);

      } catch (error) {
        console.error("Lỗi tải dữ liệu nguồn:", error);
        message.error("Không tải được danh sách vật tư/kho");
      }
    };
    fetchMasterData();
  }, []);

  const handleTypeChange = () => {
    setSelectedItems([]);
  };

  const addRow = () => {
    const newKey = `row_${Date.now()}`;
    setSelectedItems([...selectedItems, { 
      key: newKey, itemId: null, quantity: 1, fromLocationId: null, toLocationId: null, currentStock: undefined 
    }]);
  };

  const removeRow = (key: string) => {
    setSelectedItems(selectedItems.filter(item => item.key !== key));
  };

  // ============================================================
  // XỬ LÝ QUÉT QR CODE
  // ============================================================
  const handleScanSuccess = (decodedText: string) => {
    // 1. Tìm vật tư trong danh sách Items đã load
    // Giả định QR Code chứa itemCode
    const foundItem = items.find(
      i => i.itemCode.toLowerCase() === decodedText.toLowerCase() || 
           i.itemName.toLowerCase().includes(decodedText.toLowerCase())
    );

    if (foundItem) {
      // 2. Tạo dòng mới với thông tin vật tư đã tìm thấy
      const newKey = `row_qr_${Date.now()}`;
      const newRow: TransactionDetail = {
        key: newKey,
        itemId: foundItem.id, // Auto-fill Item ID
        quantity: 1,
        fromLocationId: null, // Vẫn phải chọn kho tay vì QR item thường không chứa vị trí
        toLocationId: null,
        unit: foundItem.unit, // Auto-fill Unit
        currentStock: undefined
      };

      setSelectedItems(prev => [...prev, newRow]);
      message.success(`Đã thêm vật tư: ${foundItem.itemCode} - ${foundItem.itemName}`);
      
      // Đóng modal sau khi quét thành công (QRScannerModal đã tự gọi onClose trong logic của nó, 
      // nhưng ta set state ở đây để chắc chắn UI update)
      setIsScannerOpen(false); 
    } else {
      message.warning(`Không tìm thấy vật tư với mã: ${decodedText}`);
    }
  };

  // ============================================================
  // CẬP NHẬT DÒNG & CHECK TỒN KHO
  // ============================================================
  const updateRow = async (key: string, field: keyof TransactionDetail, value: any) => {
    const newData = [...selectedItems];
    const index = newData.findIndex(item => item.key === key);
    
    if (index > -1) {
      const row = { ...newData[index], [field]: value };
      
      if (field === 'itemId') {
        const selectedItem = items.find(i => i.id === value);
        if (selectedItem) row.unit = selectedItem.unit;
      }

      if (transactionType !== 'IMPORT') {
        const currentItemId = field === 'itemId' ? value : row.itemId;
        const currentLocationId = field === 'fromLocationId' ? value : row.fromLocationId;

        if (currentItemId && currentLocationId) {
          try {
            const res = await axiosClient.get('/stock-transactions/check-stock', {
              params: { itemId: currentItemId, locationId: currentLocationId }
            });
            row.currentStock = res.data.quantity;
          } catch (error) {
            row.currentStock = 0;
          }
        } else {
            if (field === 'itemId' || field === 'fromLocationId') {
                row.currentStock = undefined;
            }
        }
      }
      newData[index] = row;
      setSelectedItems(newData);
    }
  };

  const onFinish = async (values: any) => {
    if (selectedItems.length === 0) {
      return message.error('Vui lòng thêm ít nhất một vật tư vào danh sách!');
    }

    for (const item of selectedItems) {
      if (!item.itemId) return message.error('Vui lòng chọn vật tư cho tất cả các dòng');
      if (item.quantity <= 0) return message.error('Số lượng phải lớn hơn 0');
      
      if (['EXPORT', 'TRANSFER'].includes(transactionType) && !item.fromLocationId) {
        return message.error('Vui lòng chọn Vị trí xuất hàng (Nguồn)');
      }
      if (['IMPORT', 'TRANSFER'].includes(transactionType) && !item.toLocationId) {
        return message.error('Vui lòng chọn Vị trí nhập hàng (Đích)');
      }
      if (transactionType !== 'IMPORT' && item.currentStock !== undefined && item.quantity > item.currentStock) {
        return message.error(`Vật tư dòng ${selectedItems.indexOf(item) + 1} vượt quá tồn kho khả dụng (${item.currentStock})!`);
      }
    }

    setLoading(true);
    try {
      const payload = {
        ...values,
        details: selectedItems.map(item => ({
          itemId: item.itemId,
          quantity: item.quantity,
          fromLocationId: item.fromLocationId || null,
          toLocationId: item.toLocationId || null
        }))
      };
      
      const res = await axiosClient.post('/stock-transactions', payload);
      
      notification.success({
        message: 'Tạo phiếu thành công', 
        description: `Mã phiếu: ${res.data.data.code}. Đang chờ phê duyệt.`
      });

      form.resetFields();
      setSelectedItems([]);
      form.setFieldsValue({ type: 'IMPORT', isEmergency: false });
      
    } catch (error: any) {
      console.error("Lỗi submit:", error);
      notification.error({
        message: 'Tạo phiếu thất bại',
        description: error.response?.data?.message || 'Lỗi hệ thống không xác định.'
      });
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: 'Vật tư',
      dataIndex: 'itemId',
      width: '30%',
      render: (val: any, record: TransactionDetail) => (
        <Space direction="vertical" style={{ width: '100%' }} size={2}>
            <Select
                showSearch
                style={{ width: '100%' }}
                placeholder="Chọn vật tư..."
                optionFilterProp="children"
                onChange={(v) => updateRow(record.key, 'itemId', v)}
                value={record.itemId}
                options={items.map(i => ({ value: i.id, label: `[${i.itemCode}] ${i.itemName}` }))}
                filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
            />
            {transactionType !== 'IMPORT' && record.itemId && record.fromLocationId && (
                <div style={{ fontSize: '12px' }}>
                   {record.currentStock !== undefined ? (
                       <span style={{ color: record.currentStock < record.quantity ? 'red' : 'green' }}>
                           Tồn hiện tại: <b>{record.currentStock}</b> {record.unit}
                       </span>
                   ) : <span style={{color: '#faad14'}}>...</span>}
                </div>
            )}
        </Space>
      )
    },
    {
      title: 'Kho Nguồn (Xuất)',
      dataIndex: 'fromLocationId',
      className: transactionType === 'IMPORT' ? 'hidden-col' : '', 
      render: (_: any, record: TransactionDetail) => (
        <Select
            style={{ width: '100%' }}
            placeholder="Chọn vị trí..."
            disabled={transactionType === 'IMPORT'}
            value={record.fromLocationId}
            onChange={(v) => updateRow(record.key, 'fromLocationId', v)}
            options={locations.map(l => ({ value: l.id, label: l.locationCode }))}
        />
      )
    },
    {
        title: 'Kho Đích (Nhập)',
        dataIndex: 'toLocationId',
        className: transactionType === 'EXPORT' ? 'hidden-col' : '',
        render: (_: any, record: TransactionDetail) => (
          <Select
              style={{ width: '100%' }}
              placeholder="Chọn vị trí..."
              disabled={transactionType === 'EXPORT'}
              value={record.toLocationId}
              onChange={(v) => updateRow(record.key, 'toLocationId', v)}
              options={locations.map(l => ({ value: l.id, label: l.locationCode }))}
          />
        )
      },
    {
      title: 'Số lượng',
      dataIndex: 'quantity',
      width: '15%',
      render: (val: any, record: TransactionDetail) => (
        <Space>
             <InputNumber 
                min={1} 
                value={record.quantity}
                onChange={(v) => updateRow(record.key, 'quantity', v)}
                status={transactionType !== 'IMPORT' && record.currentStock !== undefined && record.quantity > record.currentStock ? 'error' : ''}
            />
            <span style={{color: '#888'}}>{record.unit || '...'}</span>
        </Space>
      )
    },
    {
      title: '',
      dataIndex: 'action',
      width: '50px',
      render: (_: any, record: TransactionDetail) => (
        <Button 
            type="text" 
            danger 
            icon={<DeleteOutlined />} 
            onClick={() => removeRow(record.key)}
        />
      )
    }
  ].filter(col => !col.className?.includes('hidden-col')); 

  const getProcessDescription = () => {
      switch(transactionType) {
          case 'IMPORT': return '1. Thủ kho kiểm đếm \u2192 2. Xác nhận nhập kho.';
          case 'TRANSFER': return '1. Quản lý kho duyệt lệnh \u2192 2. Thủ kho chuyển hàng.';
          case 'EXPORT': 
            if(isLeader) return (
                <span>
                    <Tag color="gold">Quyền Ưu Tiên</Tag> 
                    {'1. Thủ kho xuất hàng \u2192 2. Bạn xác nhận nhận đủ (Bỏ qua duyệt cấp trên).'}
                </span>
            );
            return '1. Trưởng bộ phận duyệt \u2192 2. Thủ kho xuất hàng \u2192 3. Người tạo xác nhận.';
          default: return '';
      }
  }

  return (
    <div style={{ padding: '24px', background: '#f5f7fa', minHeight: '100vh' }}>
      
      {/* Component Scanner Modal */}
      <QRScannerModal 
        isOpen={isScannerOpen} 
        onClose={() => setIsScannerOpen(false)} 
        onScanSuccess={handleScanSuccess}
      />

      <Card bordered={false} style={{ borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
          <div style={{ marginBottom: '24px', borderBottom: '1px solid #f0f0f0', paddingBottom: '16px' }}>
              <Title level={4} style={{ margin: 0, color: '#1f1f1f' }}>
                  <SwapOutlined style={{ color: '#1890ff', marginRight: '8px' }} />
                  Tạo Phiếu Giao Dịch Kho
              </Title>
              <Text type="secondary">Lập phiếu yêu cầu Nhập / Xuất / Điều chuyển vật tư</Text>
          </div>

          <Form 
            form={form} 
            layout="vertical" 
            onFinish={onFinish} 
            initialValues={{ type: 'IMPORT', isEmergency: false }}
          >
            
            <Row gutter={24}>
                <Col xs={24} md={6}>
                    <Form.Item name="type" label="Loại giao dịch" rules={[{ required: true }]}>
                        <Select size="large" onChange={handleTypeChange}>
                            <Select.Option value="IMPORT">🟢 NHẬP KHO (Import)</Select.Option>
                            <Select.Option value="EXPORT">🔴 XUẤT KHO (Export)</Select.Option>
                            <Select.Option value="TRANSFER">🔵 ĐIỀU CHUYỂN (Transfer)</Select.Option>
                        </Select>
                    </Form.Item>
                </Col>
                
                <Col xs={24} md={6}>
                    <Form.Item 
                        name="supplierId" 
                        label={transactionType === 'IMPORT' ? "Nhà cung cấp (Bắt buộc)" : "Đối tác / NCC (Tùy chọn)"}
                        rules={[
                            { 
                                required: transactionType === 'IMPORT', 
                                message: 'Vui lòng chọn Nhà cung cấp để truy xuất nguồn gốc!' 
                            }
                        ]}
                    >
                        <Select 
                            size="large" 
                            allowClear 
                            placeholder="Chọn nhà cung cấp..."
                            options={suppliers.map(s => ({ value: s.id, label: s.name }))}
                            suffixIcon={<ShopOutlined />}
                        />
                    </Form.Item>
                </Col>

                <Col xs={24} md={8}>
                    <Form.Item name="description" label="Diễn giải / Lý do" rules={[{ required: true, message: 'Vui lòng nhập lý do' }]}>
                        <Input size="large" placeholder="Vd: Nhập hàng mới / Xuất thay thế..." />
                    </Form.Item>
                </Col>
                <Col xs={24} md={4}>
                    <Form.Item name="isEmergency" label="Mức độ ưu tiên" valuePropName="checked">
                          <Switch checkedChildren="Khẩn cấp" unCheckedChildren="Bình thường" />
                    </Form.Item>
                </Col>
            </Row>

            <Divider orientation="left">Chi tiết vật tư</Divider>
            
            <Table 
                dataSource={selectedItems}
                columns={columns}
                pagination={false}
                rowKey="key"
                bordered
                locale={{ emptyText: 'Chưa có vật tư nào. Nhấn "Thêm dòng" để bắt đầu.' }}
                footer={() => (
                    <div className="flex gap-4">
                        <Button 
                            type="dashed" 
                            onClick={addRow} 
                            style={{ flex: 1 }} 
                            icon={<PlusOutlined />} 
                            size="large"
                        >
                            Thêm dòng thủ công
                        </Button>
                        <Button 
                            type="primary" 
                            onClick={() => setIsScannerOpen(true)} 
                            style={{ background: '#10b981', borderColor: '#10b981' }}
                            icon={<QrcodeOutlined />} 
                            size="large"
                        >
                            Quét QR để thêm
                        </Button>
                    </div>
                )}
            />

            <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ 
                    background: isLeader && transactionType === 'EXPORT' ? '#fffbe6' : '#e6f7ff', 
                    border: `1px solid ${isLeader && transactionType === 'EXPORT' ? '#ffe58f' : '#91d5ff'}`,
                    padding: '12px 16px',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'start',
                    gap: '12px'
                }}>
                    <InfoCircleOutlined style={{ color: '#1890ff', marginTop: '4px' }} />
                    <div>
                        <Text strong>Quy trình dự kiến:</Text>
                        <div style={{ marginTop: '4px', color: '#595959' }}>
                            {getProcessDescription()}
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                    <Button size="large" onClick={() => navigate(-1)}>Hủy bỏ</Button>
                    <Button 
                        type="primary" 
                        htmlType="submit" 
                        size="large" 
                        icon={<SendOutlined />}
                        loading={loading}
                    >
                        Gửi Yêu Cầu
                    </Button>
                </div>
            </div>

          </Form>
      </Card>
    </div>
  );
};

export default StockTransactionCreate;