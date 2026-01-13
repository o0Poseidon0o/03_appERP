import React, { useState, useEffect } from 'react';
import { 
  Table, Card, Tag, Space, Input, DatePicker, 
  Select, Typography, Button, Row, Col, Statistic 
} from 'antd';
import { 
  SearchOutlined, ReloadOutlined, ArrowUpOutlined, 
  ArrowDownOutlined, SwapOutlined, FileExcelOutlined 
} from '@ant-design/icons';
import dayjs from 'dayjs';
import axiosClient from '../../api/axiosClient';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

interface InventoryLog {
  id: string;
  createdAt: string;
  type: 'IMPORT' | 'EXPORT' | 'TRANSFER';
  quantity: number;
  balanceBefore: number;
  balanceAfter: number;
  item: { itemCode: string; itemName: string; unit: string };
  location: { locationCode: string };
  user: { fullName: string };
  description: string;
}

const InventoryReport: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<InventoryLog[]>([]);
  const [summary, setSummary] = useState({ totalImport: 0, totalExport: 0 });
  const [filters, setFilters] = useState({
    q: '',
    type: null,
    dateRange: [dayjs().subtract(30, 'days'), dayjs()]
  });

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = {
        q: filters.q,
        type: filters.type,
        startDate: filters.dateRange[0]?.toISOString(),
        endDate: filters.dateRange[1]?.toISOString(),
      };
      const res = await axiosClient.get('/warehouse/inventory-logs', { params });
      setData(res.data?.data || []);
      
      // Tính toán sơ bộ tổng nhập/xuất trong kỳ
      const stats = (res.data?.data || []).reduce((acc: any, log: InventoryLog) => {
        if (log.type === 'IMPORT') acc.totalImport += log.quantity;
        if (log.type === 'EXPORT') acc.totalExport += log.quantity;
        return acc;
      }, { totalImport: 0, totalExport: 0 });
      setSummary(stats);

    } catch (error) {
      console.error('Lỗi tải thẻ kho');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const columns = [
    {
      title: 'Thời gian',
      dataIndex: 'createdAt',
      width: 160,
      render: (date: string) => dayjs(date).format('DD/MM/YYYY HH:mm'),
    },
    {
      title: 'Vật Tư',
      render: (_, record: InventoryLog) => (
        <div>
          <Text strong>{record.item.itemName}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: '11px' }}>{record.item.itemCode}</Text>
        </div>
      ),
    },
    {
      title: 'Loại',
      dataIndex: 'type',
      width: 120,
      render: (type: string) => {
        const config = {
          IMPORT: { color: 'blue', text: 'NHẬP KHO', icon: <ArrowUpOutlined /> },
          EXPORT: { color: 'volcano', text: 'XUẤT KHO', icon: <ArrowDownOutlined /> },
          TRANSFER: { color: 'purple', text: 'CHUYỂN KHO', icon: <SwapOutlined /> },
        };
        const item = config[type as keyof typeof config];
        return <Tag color={item.color} icon={item.icon}>{item.text}</Tag>;
      },
    },
    {
      title: 'Vị trí',
      dataIndex: ['location', 'locationCode'],
      render: (text: string) => <Tag>{text}</Tag>
    },
    {
      title: 'Số lượng',
      dataIndex: 'quantity',
      align: 'right' as const,
      render: (val: number, record: InventoryLog) => (
        <Text strong className={record.type === 'IMPORT' ? 'text-blue-600' : 'text-red-600'}>
          {record.type === 'IMPORT' ? `+${val}` : `-${val}`}
        </Text>
      ),
    },
    {
      title: 'Số dư sau',
      dataIndex: 'balanceAfter',
      align: 'right' as const,
      render: (val: number) => <Text strong>{val.toLocaleString()}</Text>,
    },
    {
      title: 'Người thực hiện',
      dataIndex: ['user', 'fullName'],
    },
    {
      title: 'Ghi chú',
      dataIndex: 'description',
      ellipsis: true,
    }
  ];

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <Title level={4}>Thẻ Kho & Lịch Sử Biến Động</Title>
        <Button icon={<FileExcelOutlined />} className="bg-green-600 text-white border-none">Xuất Excel</Button>
      </div>

      <Row gutter={16} className="mb-6">
        <Col span={6}>
          <Card size="small" className="border-l-4 border-blue-500 shadow-sm">
            <Statistic title="Tổng nhập trong kỳ" value={summary.totalImport} precision={0} valueStyle={{ color: '#3f8600' }} prefix={<ArrowUpOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" className="border-l-4 border-red-500 shadow-sm">
            <Statistic title="Tổng xuất trong kỳ" value={summary.totalExport} precision={0} valueStyle={{ color: '#cf1322' }} prefix={<ArrowDownOutlined />} />
          </Card>
        </Col>
      </Row>

      <Card size="small" className="mb-4 shadow-sm">
        <Space wrap>
          <Input 
            placeholder="Tìm mã, tên vật tư..." 
            prefix={<SearchOutlined />} 
            style={{ width: 250 }}
            onChange={e => setFilters({...filters, q: e.target.value})}
          />
          <RangePicker 
            value={filters.dateRange as any}
            onChange={(dates) => setFilters({...filters, dateRange: dates as any})}
          />
          <Select 
            placeholder="Loại giao dịch"
            allowClear
            style={{ width: 150 }}
            options={[
              { value: 'IMPORT', label: 'Nhập kho' },
              { value: 'EXPORT', label: 'Xuất kho' },
              { value: 'TRANSFER', label: 'Chuyển kho' },
            ]}
            onChange={val => setFilters({...filters, type: val})}
          />
          <Button type="primary" onClick={fetchLogs}>Lọc dữ liệu</Button>
          <Button icon={<ReloadOutlined />} onClick={() => {
             setFilters({ q: '', type: null, dateRange: [dayjs().subtract(30, 'days'), dayjs()] });
             fetchLogs();
          }} />
        </Space>
      </Card>

      <Table 
        columns={columns} 
        dataSource={data} 
        rowKey="id" 
        loading={loading}
        pagination={{ pageSize: 15 }}
        scroll={{ x: 1000 }}
        className="shadow-sm rounded-lg overflow-hidden"
      />
    </div>
  );
};

export default InventoryReport;