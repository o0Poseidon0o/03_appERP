import React, { useState, useEffect } from 'react';
import { 
  Table, Card, Button, Select, InputNumber, Space, 
  Form, Input, Row, Col, App as AntdApp, Switch, Typography, Divider, Tag, Tooltip 
} from 'antd';
import { 
  PlusOutlined, DeleteOutlined, QrcodeOutlined,
  SwapOutlined, InfoCircleOutlined, ShopOutlined, SendOutlined, QuestionCircleOutlined 
} from '@ant-design/icons';
import axiosClient from '../../api/axiosClient';
import { useNavigate } from 'react-router-dom';
import QRScannerModal from './QRScannerModal';

const { Text, Title } = Typography;

// --- INTERFACES ---
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

interface UsageCategory {
  id: string;
  code: string;
  name: string;
}

interface TransactionDetail {
  key: string;
  itemId: string | null;
  quantity: number;
  fromLocationId: string | null;
  toLocationId: string | null;
  usageCategoryId: string | null; // [MỚI] Loại hàng sử dụng
  currentStock?: number; 
  physicalStock?: number; 
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
  const [usageCategories, setUsageCategories] = useState<UsageCategory[]>([]); // [MỚI]
  const [selectedItems, setSelectedItems] = useState<TransactionDetail[]>([]);
  
  const [rowLocationOptions, setRowLocationOptions] = useState<Record<string, any[]>>({});
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  const userStr = localStorage.getItem('user');
  const currentUser = userStr ? JSON.parse(userStr) : {};
  const isLeader = ['ROLE-LEADER', 'ROLE-MANAGER'].includes(currentUser.roleId);

  const transactionType = Form.useWatch('type', form);

  // 1. FETCH MASTER DATA
  useEffect(() => {
    const fetchMasterData = async () => {
      try {
        const [resItems, resLocs, resSups, resUsage] = await Promise.all([
          axiosClient.get('/items'), 
          axiosClient.get('/warehouses/locations/all'), 
          axiosClient.get('/suppliers'),
          axiosClient.get('/items/usage-categories') // [MỚI] Lấy danh sách loại sử dụng
        ]);

        setItems(resItems.data?.data || []);
        setLocations(resLocs.data?.data || []);
        setSuppliers(resSups.data?.data || []);
        setUsageCategories(resUsage.data?.data || []);

      } catch (error) {
        console.error("Lỗi tải dữ liệu nguồn:", error);
        message.error("Không tải được danh sách vật tư/kho");
      }
    };
    fetchMasterData();
  }, []);

  const handleTypeChange = () => {
    setSelectedItems([]);
    setRowLocationOptions({});
  };

  const addRow = () => {
    const newKey = `row_${Date.now()}`;
    setSelectedItems([...selectedItems, { 
      key: newKey, itemId: null, quantity: 1, 
      fromLocationId: null, toLocationId: null, usageCategoryId: null, // Default null
      currentStock: undefined 
    }]);
  };

  const removeRow = (key: string) => {
    setSelectedItems(selectedItems.filter(item => item.key !== key));
    const newOptions = { ...rowLocationOptions };
    delete newOptions[key];
    setRowLocationOptions(newOptions);
  };

  // LOGIC TÍNH TOÁN TỒN KHO KHẢ DỤNG
  const getAvailableStockForLine = (record: TransactionDetail) => {
    if (transactionType === 'IMPORT' || record.currentStock === undefined) return 999999;

    const usedInOtherLines = selectedItems.reduce((total, item) => {
        if (
            item.key !== record.key && 
            item.itemId === record.itemId && 
            item.fromLocationId === record.fromLocationId
        ) {
            return total + (item.quantity || 0);
        }
        return total;
    }, 0);

    const available = record.currentStock - usedInOtherLines;
    return available > 0 ? available : 0;
  };

  // LẤY DANH SÁCH VỊ TRÍ CÓ HÀNG (KHI CHỌN VẬT TƯ CHO EXPORT/TRANSFER)
  const fetchStockLocationsForItem = async (rowKey: string, itemId: string) => {
    try {
        const selectedItem = items.find(i => i.id === itemId);
        if(!selectedItem) return;

        const res = await axiosClient.get('/stock-transactions/actual', {
            params: { search: selectedItem.itemCode, limit: 100 } 
        });

        const stocks = res.data.data || [];
        
        const options = stocks.map((s: any) => ({
            value: s.locationId,
            label: `${s.locationCode} (Tồn: ${s.quantity})`,
            quantity: s.quantity 
        }));

        setRowLocationOptions(prev => ({ ...prev, [rowKey]: options }));

    } catch (error) {
        console.error("Lỗi lấy vị trí tồn kho:", error);
    }
  };

  // CẬP NHẬT DÒNG
  const updateRow = async (key: string, field: keyof TransactionDetail, value: any) => {
    const newData = [...selectedItems];
    const index = newData.findIndex(item => item.key === key);
    
    if (index > -1) {
      const row = { ...newData[index], [field]: value };
      
      // 1. KHI CHỌN VẬT TƯ
      if (field === 'itemId') {
        const selectedItem = items.find(i => i.id === value);
        if (selectedItem) row.unit = selectedItem.unit;
        
        row.fromLocationId = null;
        row.currentStock = undefined;
        row.physicalStock = undefined;

        if (['EXPORT', 'TRANSFER'].includes(transactionType)) {
            fetchStockLocationsForItem(key, value);
        }
      }

      // 2. KHI CHỌN VỊ TRÍ NGUỒN (Check Stock)
      if (transactionType !== 'IMPORT') {
        const currentItemId = field === 'itemId' ? value : row.itemId;
        const currentLocationId = field === 'fromLocationId' ? value : row.fromLocationId;

        if (currentItemId && currentLocationId) {
          if (field === 'itemId' || field === 'fromLocationId') {
              try {
                const res = await axiosClient.get('/stock-transactions/check-stock', {
                  params: { itemId: currentItemId, locationId: currentLocationId }
                });
                row.currentStock = res.data.quantity; 
                row.physicalStock = res.data.physical; 
              } catch (error) {
                row.currentStock = 0;
              }
          }
        } else {
            if (field === 'itemId' || field === 'fromLocationId') {
                row.currentStock = undefined;
                row.physicalStock = undefined;
            }
        }
      }
      
      newData[index] = row;
      setSelectedItems(newData);
    }
  };

  const handleScanSuccess = (decodedText: string) => {
    const foundItem = items.find(
      i => i.itemCode.toLowerCase() === decodedText.toLowerCase() || 
           i.itemName.toLowerCase().includes(decodedText.toLowerCase())
    );

    if (foundItem) {
      const newKey = `row_qr_${Date.now()}`;
      const newRow: TransactionDetail = {
        key: newKey,
        itemId: foundItem.id,
        quantity: 1,
        fromLocationId: null, 
        toLocationId: null,
        usageCategoryId: null,
        unit: foundItem.unit,
        currentStock: undefined
      };
      
      if (['EXPORT', 'TRANSFER'].includes(transactionType)) {
          fetchStockLocationsForItem(newKey, foundItem.id);
      }

      setSelectedItems(prev => [...prev, newRow]);
      message.success(`Đã thêm vật tư: ${foundItem.itemCode}`);
      setIsScannerOpen(false); 
    } else {
      message.warning(`Không tìm thấy vật tư với mã: ${decodedText}`);
    }
  };

  const onFinish = async (values: any) => {
    if (selectedItems.length === 0) return message.error('Vui lòng thêm ít nhất một vật tư!');

    for (const item of selectedItems) {
      if (!item.itemId) return message.error('Vui lòng chọn vật tư cho tất cả các dòng');
      if (item.quantity <= 0) return message.error('Số lượng phải lớn hơn 0');
      
      // Validate Location
      if (['EXPORT', 'TRANSFER'].includes(transactionType) && !item.fromLocationId) {
        return message.error('Vui lòng chọn Vị trí xuất hàng (Nguồn)');
      }
      if (['IMPORT', 'TRANSFER'].includes(transactionType) && !item.toLocationId) {
        return message.error('Vui lòng chọn Vị trí nhập hàng (Đích)');
      }
      
      // Validate Stock
      const available = getAvailableStockForLine(item);
      if (transactionType !== 'IMPORT' && item.quantity > available) {
         return message.error(`Vật tư dòng ${selectedItems.indexOf(item) + 1} vượt quá tồn kho khả dụng (Còn lại: ${available})!`);
      }
    }

    setLoading(true);
    try {
      const payload = {
        ...values,
        isEmergency: false, 
        details: selectedItems.map(item => ({
          itemId: item.itemId!, 
          quantity: item.quantity,
          fromLocationId: item.fromLocationId || null,
          toLocationId: item.toLocationId || null,
          usageCategoryId: item.usageCategoryId || null // Gửi loại hàng sử dụng lên
        }))
      };
      
      const res = await axiosClient.post('/stock-transactions', payload);
      
      notification.success({
        message: 'Tạo phiếu thành công', 
        description: `Mã phiếu: ${res.data.data.code}. Đang chờ phê duyệt.`
      });

      form.resetFields();
      setSelectedItems([]);
      setRowLocationOptions({});
      form.setFieldsValue({ type: 'IMPORT', isEmergency: false });
      
    } catch (error: any) {
      notification.error({
        message: 'Tạo phiếu thất bại',
        description: error.response?.data?.message || 'Lỗi hệ thống.'
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
      render: (_: any, record: TransactionDetail) => {
        const available = getAvailableStockForLine(record);
        
        return (
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
            {/* Hiển thị tồn kho khả dụng */}
            {transactionType !== 'IMPORT' && record.itemId && record.fromLocationId && (
                <div style={{ fontSize: '12px', display: 'flex', justifyContent: 'space-between' }}>
                   {record.currentStock !== undefined ? (
                       <>
                           <span style={{ color: '#8c8c8c' }}>
                               Thực tế: {record.physicalStock ?? '...'}
                           </span>
                           <span style={{ color: available < record.quantity ? 'red' : 'green', fontWeight: 500 }}>
                               Khả dụng: {available} {record.unit}
                           </span>
                       </>
                   ) : <span style={{color: '#faad14'}}>Đang kiểm tra tồn...</span>}
                </div>
            )}
        </Space>
      )}
    },
    // [MỚI] Cột Loại hàng sử dụng
    {
        title: 'Mục đích / Loại hàng',
        dataIndex: 'usageCategoryId',
        width: '15%',
        render: (_: any, record: TransactionDetail) => (
            <Select
                style={{ width: '100%' }}
                placeholder="VD: 11020..."
                value={record.usageCategoryId}
                onChange={(v) => updateRow(record.key, 'usageCategoryId', v)}
                options={usageCategories.map(u => ({ value: u.id, label: `${u.code} - ${u.name}` }))}
                showSearch
                optionFilterProp="label"
            />
        )
    },
    {
      title: 'Kho Nguồn (Xuất)',
      dataIndex: 'fromLocationId',
      // Ẩn nếu là IMPORT
      className: transactionType === 'IMPORT' ? 'hidden-col' : '', 
      render: (_: any, record: TransactionDetail) => (
        <Select
            style={{ width: '100%' }}
            placeholder={record.itemId ? "Chọn vị trí có hàng..." : "Chọn vật tư trước"}
            disabled={transactionType === 'IMPORT' || !record.itemId}
            value={record.fromLocationId}
            onChange={(v) => updateRow(record.key, 'fromLocationId', v)}
            options={rowLocationOptions[record.key] || []}
            onDropdownVisibleChange={(open) => {
                if (open && (!rowLocationOptions[record.key] || rowLocationOptions[record.key].length === 0) && record.itemId) {
                    fetchStockLocationsForItem(record.key, record.itemId);
                }
            }}
            loading={!rowLocationOptions[record.key] && !!record.itemId}
            notFoundContent={record.itemId ? "Hết hàng hoặc chưa nhập kho" : "Vui lòng chọn vật tư"}
        />
      )
    },
    {
        title: 'Kho Đích (Nhập)',
        dataIndex: 'toLocationId',
        // Ẩn nếu là EXPORT
        className: transactionType === 'EXPORT' ? 'hidden-col' : '',
        render: (_: any, record: TransactionDetail) => (
          <Select
              style={{ width: '100%' }}
              placeholder="Chọn vị trí..."
              disabled={transactionType === 'EXPORT'}
              value={record.toLocationId}
              onChange={(v) => updateRow(record.key, 'toLocationId', v)}
              options={locations.map(l => ({ value: l.id, label: l.locationCode }))}
              showSearch
              optionFilterProp="label"
          />
        )
      },
    {
      title: 'Số lượng',
      dataIndex: 'quantity',
      width: '12%',
      render: (_: any, record: TransactionDetail) => {
        const available = getAvailableStockForLine(record);
        const maxVal = transactionType !== 'IMPORT' ? available : undefined;
        
        return (
        <Space>
             <InputNumber 
                min={1} 
                max={maxVal}
                value={record.quantity}
                onChange={(v) => updateRow(record.key, 'quantity', v)}
                status={transactionType !== 'IMPORT' && record.currentStock !== undefined && record.quantity > available ? 'error' : ''}
            />
            <span style={{color: '#888'}}>{record.unit || '...'}</span>
        </Space>
      )}
    },
    {
      title: '',
      dataIndex: 'action',
      width: '50px',
      render: (_: any, record: TransactionDetail) => (
        <Button 
            type="text" danger icon={<DeleteOutlined />} 
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
                <span><Tag color="gold">Quyền Ưu Tiên</Tag> {'1. Thủ kho xuất hàng \u2192 2. Bạn xác nhận nhận đủ.'}</span>
            );
            return '1. Trưởng bộ phận duyệt \u2192 2. Thủ kho xuất hàng \u2192 3. Người tạo xác nhận.';
          default: return '';
      }
  }

  return (
    <div style={{ padding: '24px', background: '#f5f7fa', minHeight: '100vh' }}>
      <QRScannerModal isOpen={isScannerOpen} onClose={() => setIsScannerOpen(false)} onScanSuccess={handleScanSuccess} />

      <Card bordered={false} style={{ borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
          <div style={{ marginBottom: '24px', borderBottom: '1px solid #f0f0f0', paddingBottom: '16px' }}>
              <Title level={4} style={{ margin: 0, color: '#1f1f1f' }}>
                  <SwapOutlined style={{ color: '#1890ff', marginRight: '8px' }} />
                  Tạo Phiếu Giao Dịch Kho
              </Title>
              <Text type="secondary">Lập phiếu yêu cầu Nhập / Xuất / Điều chuyển vật tư</Text>
          </div>

          <Form form={form} layout="vertical" onFinish={onFinish} initialValues={{ type: 'IMPORT', isEmergency: false }}>
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
                        rules={[{ required: transactionType === 'IMPORT', message: 'Vui lòng chọn NCC!' }]}
                    >
                        <Select size="large" allowClear placeholder="Chọn nhà cung cấp..." options={suppliers.map(s => ({ value: s.id, label: s.name }))} suffixIcon={<ShopOutlined />} />
                    </Form.Item>
                </Col>

                <Col xs={24} md={8}>
                    <Form.Item name="description" label="Diễn giải / Lý do" rules={[{ required: true, message: 'Vui lòng nhập lý do' }]}>
                        <Input size="large" placeholder="Vd: Nhập hàng mới / Xuất thay thế..." />
                    </Form.Item>
                </Col>
                
                <Col xs={24} md={4}>
                    <Form.Item name="isEmergency" label={
                        <Space>
                            Mức độ ưu tiên
                            <Tooltip title="Tính năng đang được phát triển.">
                                <QuestionCircleOutlined style={{ color: '#faad14', cursor: 'help' }} />
                            </Tooltip>
                        </Space>
                    } valuePropName="checked">
                          <Switch 
                            checkedChildren="Khẩn cấp" 
                            unCheckedChildren="Bình thường" 
                            disabled={true} 
                          />
                    </Form.Item>
                </Col>
            </Row>

            <Divider orientation={"left" as any}>Chi tiết vật tư</Divider>
            
            <Table 
                dataSource={selectedItems}
                columns={columns}
                pagination={false}
                rowKey="key"
                bordered
                locale={{ emptyText: 'Chưa có vật tư nào. Nhấn "Thêm dòng" để bắt đầu.' }}
                footer={() => (
                    <div className="flex gap-4">
                        <Button type="dashed" onClick={addRow} style={{ flex: 1 }} icon={<PlusOutlined />} size="large">Thêm dòng thủ công</Button>
                        <Button type="primary" onClick={() => setIsScannerOpen(true)} style={{ background: '#10b981', borderColor: '#10b981' }} icon={<QrcodeOutlined />} size="large">Quét QR để thêm</Button>
                    </div>
                )}
            />

            <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ background: '#e6f7ff', border: '1px solid #91d5ff', padding: '12px 16px', borderRadius: '6px', display: 'flex', alignItems: 'start', gap: '12px' }}>
                    <InfoCircleOutlined style={{ color: '#1890ff', marginTop: '4px' }} />
                    <div>
                        <Text strong>Quy trình dự kiến:</Text>
                        <div style={{ marginTop: '4px', color: '#595959' }}>{getProcessDescription()}</div>
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                    <Button size="large" onClick={() => navigate(-1)}>Hủy bỏ</Button>
                    <Button type="primary" htmlType="submit" size="large" icon={<SendOutlined />} loading={loading}>Gửi Yêu Cầu</Button>
                </div>
            </div>
          </Form>
      </Card>
    </div>
  );
};

export default StockTransactionCreate;