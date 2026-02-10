import { useEffect, useState } from 'react';
// [FIX] Đã bỏ Typography ra khỏi import vì không dùng
import { Table, Card, Input, Tag, Button, Drawer, Space, Tooltip, message } from 'antd';
import { 
  AppstoreOutlined, 
  SearchOutlined, 
  EyeOutlined, 
  DesktopOutlined, 
  UserOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { softwareService, type SoftwareSummary, type SoftwareDetail } from '../../services/softwareService';

// [FIX] Đã xóa dòng: const { Title, Text } = Typography; vì không sử dụng

const SoftwareInventory = () => {
  // --- STATE ---
  const [data, setData] = useState<SoftwareSummary[]>([]); // Dữ liệu bảng tổng
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState(''); // Tìm kiếm Client-side

  // State cho Drawer chi tiết
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedSoftware, setSelectedSoftware] = useState<string>('');
  const [detailData, setDetailData] = useState<SoftwareDetail[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // --- FETCH DATA ---
  const fetchInventory = async () => {
    setLoading(true);
    try {
      const res = await softwareService.getInventory();
      // API trả về: { status: 'success', data: [...] }
      setData(res.data.data || []);
    } catch (error) {
      message.error("Không thể tải danh sách phần mềm");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  // --- HANDLE VIEW DETAILS ---
  const handleViewDetail = async (name: string) => {
    setSelectedSoftware(name);
    setDrawerOpen(true);
    setDetailLoading(true);
    try {
      const res = await softwareService.getInstallations(name);
      setDetailData(res.data.data || []);
    } catch (error) {
      message.error("Lỗi khi tải chi tiết");
    } finally {
      setDetailLoading(false);
    }
  };

  // --- FILTER DATA (CLIENT SIDE SEARCH) ---
  const filteredData = data.filter(item => 
    item.name.toLowerCase().includes(searchText.toLowerCase()) ||
    item.publisher.toLowerCase().includes(searchText.toLowerCase())
  );

  // --- COLUMNS TABLE CHÍNH ---
  const columns: ColumnsType<SoftwareSummary> = [
    {
      title: 'Tên Phần mềm',
      dataIndex: 'name',
      key: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name),
      render: (text) => <span className="font-semibold text-blue-700">{text}</span>
    },
    {
      title: 'Nhà phát hành',
      dataIndex: 'publisher',
      key: 'publisher',
      responsive: ['md'],
      render: (t) => t !== 'Unknown' ? t : <span className="text-gray-400 italic">Không rõ</span>
    },
    {
      title: 'Số lượng máy',
      dataIndex: 'installCount',
      key: 'installCount',
      width: 150,
      align: 'center',
      sorter: (a, b) => a.installCount - b.installCount,
      render: (count) => (
        <Tag color={count > 5 ? 'volcano' : 'blue'} className="text-sm px-3 py-0.5 rounded-full">
          {count} máy
        </Tag>
      )
    },
    {
      title: 'Hành động',
      key: 'action',
      width: 100,
      align: 'center',
      render: (_, record) => (
        <Tooltip title="Xem danh sách máy cài">
          <Button 
            type="text" 
            icon={<EyeOutlined className="text-blue-500" />} 
            onClick={() => handleViewDetail(record.name)} 
          />
        </Tooltip>
      )
    }
  ];

  // --- COLUMNS TABLE CHI TIẾT (DRAWER) ---
  const detailColumns: ColumnsType<SoftwareDetail> = [
    {
      title: 'Tên Máy',
      key: 'asset',
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <span className="font-bold"><DesktopOutlined /> {record.asset?.name}</span>
          <span className="text-xs text-gray-500">{record.asset?.model}</span>
        </Space>
      )
    },
    {
      title: 'Người dùng',
      key: 'user',
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <span className="text-blue-600"><UserOutlined /> {record.asset?.domainUser || '-'}</span>
          {record.asset?.department && <Tag className="m-0 text-[10px]">{record.asset.department.name}</Tag>}
        </Space>
      )
    },
    {
      title: 'Phiên bản',
      dataIndex: 'version',
      key: 'version',
      width: 120,
      render: (t) => <Tag>{t}</Tag>
    }
  ];

  return (
    <div className="p-4 bg-gray-50 h-full">
      <Card 
        bordered={false} 
        className="shadow-sm rounded-lg"
        title={
          <div className="flex items-center gap-2">
            <AppstoreOutlined className="text-blue-600 text-xl" />
            <span>Kho Phần mềm (Software Inventory)</span>
            <Tag color="blue">{data.length} Apps</Tag>
          </div>
        }
        extra={
            <Button icon={<ReloadOutlined />} onClick={fetchInventory}>Làm mới</Button>
        }
      >
        {/* Toolbar */}
        <div className="mb-4 flex justify-between items-center flex-wrap gap-2">
          <Input 
            placeholder="Tìm theo tên phần mềm, publisher..." 
            prefix={<SearchOutlined className="text-gray-400" />}
            onChange={e => setSearchText(e.target.value)}
            style={{ width: 300 }}
            allowClear
          />
          <div className="text-xs text-gray-500 italic">
            *Dữ liệu được tổng hợp từ Agent cài trên các máy con
          </div>
        </div>

        {/* Main Table */}
        <Table 
          columns={columns} 
          dataSource={filteredData} 
          rowKey={(record) => record.name + record.publisher}
          loading={loading}
          pagination={{ pageSize: 10, showSizeChanger: true }}
          size="middle"
        />
      </Card>

      {/* Drawer Chi tiết */}
      <Drawer
        title={
            <div className="flex flex-col">
                <span className="text-sm text-gray-500">Danh sách cài đặt cho:</span>
                <span className="text-blue-700 font-bold truncate max-w-[300px]" title={selectedSoftware}>{selectedSoftware}</span>
            </div>
        }
        width={600}
        placement="right"
        onClose={() => setDrawerOpen(false)}
        open={drawerOpen}
      >
        <Table
            columns={detailColumns}
            dataSource={detailData}
            rowKey={(r) => r.asset.id + r.version}
            loading={detailLoading}
            pagination={{ pageSize: 10 }}
            size="small"
        />
      </Drawer>
    </div>
  );
};

export default SoftwareInventory;