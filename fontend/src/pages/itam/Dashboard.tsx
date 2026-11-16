import { useEffect, useState } from 'react';
import {
  Card,
  Spin,
  Typography,
  Tag,
  Empty,
  message,
  Modal,
  Table,
  Button,
  Badge,
  Input,
  Progress,
  Tooltip as AntTooltip,
} from 'antd';
import {
  AppstoreOutlined,
  AlertOutlined,
  SafetyCertificateOutlined,
  ShopOutlined,
  EyeOutlined,
  LaptopOutlined,
  UserOutlined,
  FileExcelOutlined,
  ToolOutlined,
  SearchOutlined,
  ReloadOutlined,
  WifiOutlined,
  DisconnectOutlined,
  HddOutlined,
  DesktopOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  RightOutlined,
  WindowsOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  LabelList,
} from 'recharts';

import { useSocket } from '../../contexts/SocketContext';
import axiosClient from '../../api/axiosClient';

const { Title, Text } = Typography;

const STATUS_COLOR_MAP: Record<string, string> = {
  IN_USE: '#10b981',
  NEW: '#3b82f6',
  REPAIR: '#f59e0b',
  BROKEN: '#ef4444',
  STORAGE: '#6366f1',
  LIQUIDATED: '#94a3b8',
  LOST: '#dc2626',
};

const FALLBACK_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

type ModalType = 'BROKEN' | 'LOW_RAM' | 'UPGRADE' | 'OFFLINE' | 'HEALTH' | 'UNLICENSED' | null;

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const navigate = useNavigate();

  const { socket, isConnected } = useSocket();

  const [modalConfig, setModalConfig] = useState<{
    open: boolean;
    title: string;
    data: any[];
    type: ModalType;
  }>({
    open: false,
    title: '',
    data: [],
    type: null,
  });

  const [modalSearchText, setModalSearchText] = useState('');

  const fetchStats = async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    try {
      const res = await axiosClient.get('/dashboard/stats');
      setStats(res.data.data);
    } catch (error: any) {
      console.error('Lỗi tải dashboard:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();

    if (socket && isConnected) {
      const handleAssetUpdate = () => fetchStats();

      const handleHardwareAlert = (data: any) => {
        message.warning(data.message);
        fetchStats();
      };

      socket.on('asset_updated', handleAssetUpdate);
      socket.on('hardware_alert', handleHardwareAlert);

      return () => {
        socket.off('asset_updated', handleAssetUpdate);
        socket.off('hardware_alert', handleHardwareAlert);
      };
    }
  }, [socket, isConnected]);

  const showDetails = (type: ModalType) => {
    setModalSearchText('');

    if (type === 'BROKEN') {
      setModalConfig({
        open: true,
        title: 'Danh sách thiết bị Đang hỏng / Sửa chữa',
        data: stats?.lists?.broken || [],
        type: 'BROKEN',
      });
    } else if (type === 'LOW_RAM') {
      setModalConfig({
        open: true,
        title: 'Danh sách thiết bị đề xuất nâng cấp (RAM < 8GB)',
        data: stats?.lists?.lowRam || [],
        type: 'LOW_RAM',
      });
    } else if (type === 'UPGRADE') {
      setModalConfig({
        open: true,
        title: 'Lịch sử biến động & Thay đổi phần cứng (60 ngày gần nhất)',
        data: stats?.lists?.upgraded || [],
        type: 'UPGRADE',
      });
    } else if (type === 'OFFLINE') {
      setModalConfig({
        open: true,
        title: 'Danh sách máy tính Mất kết nối Agent (> 7 ngày chưa đồng bộ)',
        data: stats?.lists?.offline || [],
        type: 'OFFLINE',
      });
    } else if (type === 'HEALTH') {
      setModalConfig({
        open: true,
        title: 'Danh sách máy tính Cảnh báo Sức khỏe Phần cứng (S.M.A.R.T / RAM / Ổ đĩa)',
        data: stats?.lists?.healthAlerts || [],
        type: 'HEALTH',
      });
    } else if (type === 'UNLICENSED') {
      setModalConfig({
        open: true,
        title: 'Danh sách máy tính Chưa kích hoạt Bản quyền Hệ điều hành',
        data: stats?.lists?.unlicensed || [],
        type: 'UNLICENSED',
      });
    }
  };

  const getFilteredModalData = () => {
    const rawData = modalConfig.data || [];
    if (!modalSearchText) return rawData;

    const lowerSearch = modalSearchText.toLowerCase();

    return rawData.filter((item: any) => {
      if (modalConfig.type === 'UPGRADE') {
        const assetName = item.asset?.name?.toLowerCase() || '';
        const desc = item.description?.toLowerCase() || '';
        return assetName.includes(lowerSearch) || desc.includes(lowerSearch);
      } else {
        const assetName = item.name?.toLowerCase() || '';
        const ip = item.ipAddress?.toLowerCase() || '';
        const domainUser = item.domainUser?.toLowerCase() || '';
        return (
          assetName.includes(lowerSearch) ||
          ip.includes(lowerSearch) ||
          domainUser.includes(lowerSearch)
        );
      }
    });
  };

  const exportToExcel = () => {
    const filteredDataToExport = getFilteredModalData();

    if (!filteredDataToExport || filteredDataToExport.length === 0) {
      message.warning('Không có dữ liệu để xuất');
      return;
    }

    const dateStr = new Date().toISOString().slice(0, 10);
    let fileName = `Export_${dateStr}.xlsx`;
    let sheetName = 'Danh_Sach';
    let rows: Record<string, any>[] = [];

    if (modalConfig.type === 'UPGRADE') {
      fileName = `DS_Lich_Su_Thay_Doi_Phan_Cung_${dateStr}.xlsx`;
      sheetName = 'Lich_Su_Phan_Cung';
      rows = filteredDataToExport.map((item: any, idx: number) => {
        const asset = item.asset || {};
        const users = asset.users?.map((u: any) => u.fullName).join(' & ') || 'N/A';
        const userDepartments =
          asset.users?.map((u: any) => u.department?.name || 'Không rõ').join(' & ') || '-';
        const assetDepartment = asset.department?.name || 'N/A';
        const factory = asset.factory?.name || 'N/A';
        const updateDate = item.startDate
          ? new Date(item.startDate).toLocaleDateString('vi-VN')
          : '';

        return {
          STT: idx + 1,
          'Tên máy': asset.name || 'Unknown',
          'Người dùng': users,
          'Phòng ban': userDepartments !== '-' ? userDepartments : assetDepartment,
          'Nhà máy': factory,
          'Nội dung thay đổi': item.description || 'N/A',
          'Ngày thay đổi': updateDate,
          'Người thực hiện': item.providerName || 'Auto System',
        };
      });
    } else {
      const fileMap: Record<string, string> = {
        LOW_RAM: `DS_May_Can_Nang_Cap_RAM_${dateStr}.xlsx`,
        BROKEN: `DS_May_Hong_Sua_Chua_${dateStr}.xlsx`,
        OFFLINE: `DS_May_Mat_Ket_Noi_Agent_${dateStr}.xlsx`,
        HEALTH: `DS_Canh_Bao_Suc_Khoe_Phan_Cung_${dateStr}.xlsx`,
        UNLICENSED: `DS_May_Chua_Kich_Hoat_Ban_Quyen_${dateStr}.xlsx`,
      };
      fileName = (modalConfig.type && fileMap[modalConfig.type]) || fileName;
      const statusMap: any = {
        BROKEN: 'Hỏng',
        REPAIR: 'Đang sửa chữa',
        NEW: 'Mới',
        IN_USE: 'Đang dùng',
      };

      rows = filteredDataToExport.map((item: any, idx: number) => {
        const users =
          item.users?.map((u: any) => u.fullName).join(' & ') ||
          item.domainUser ||
          'Chưa cấp phát';
        const userDepartments =
          item.users?.map((u: any) => u.department?.name || 'Không rõ').join(' & ') || '-';
        const assetDepartment = item.department?.name || 'Chưa gán';
        const factory = item.factory?.name || 'Chưa gán';
        const ram = item.customSpecs?.ram || 'N/A';
        const disk = item.customSpecs?.disk || 'N/A';
        const lastSeenStr = item.lastSeen
          ? new Date(item.lastSeen).toLocaleString('vi-VN')
          : 'Chưa từng kết nối';

        return {
          STT: idx + 1,
          'Tên máy': item.name || '',
          'Địa chỉ IP': item.ipAddress || '',
          'Hệ điều hành': item.osName || '',
          Model: item.modelName || '',
          'Người dùng': users,
          'Phòng ban User': userDepartments,
          'Vị trí máy': assetDepartment,
          'Nhà máy': factory,
          RAM: ram,
          'Ổ cứng': disk,
          'Lần cuối kết nối': lastSeenStr,
          'Ghi chú / Cảnh báo':
            item.healthSummary || item.upgradeReason || item.licenseNote || '',
          'Trạng thái': statusMap[item.status] || item.status,
        };
      });
    }

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, fileName);
    message.success('Xuất file Excel thành công!');
  };

  const getModalColumns = () => {
    if (modalConfig.type === 'UPGRADE') {
      return [
        {
          title: 'Thời gian',
          dataIndex: 'startDate',
          key: 'date',
          width: 125,
          render: (d: string) => <Tag color="blue">{new Date(d).toLocaleDateString('vi-VN')}</Tag>,
        },
        {
          title: 'Tên máy',
          dataIndex: ['asset', 'name'],
          key: 'name',
          width: 130,
          render: (t: string) => (
            <span className="font-semibold text-blue-700">{t || 'Unknown'}</span>
          ),
        },
        {
          title: 'Nhà máy / Phòng ban',
          key: 'dept',
          width: 170,
          render: (_: any, r: any) => (
            <div className="text-xs">
              <div className="font-medium text-slate-700">
                {r.asset?.factory?.name || 'Chưa gán'}
              </div>
              <div className="text-gray-400">{r.asset?.department?.name || ''}</div>
            </div>
          ),
        },
        {
          title: 'Chi tiết thay đổi phần cứng',
          dataIndex: 'description',
          key: 'desc',
          render: (t: string) => (
            <span className="text-slate-700 text-xs leading-relaxed">{t}</span>
          ),
        },
      ];
    }

    const baseColumns: any = [
      {
        title: 'Thiết bị',
        dataIndex: 'name',
        key: 'name',
        width: 150,
        render: (t: string, r: any) => (
          <div>
            <div className="font-bold text-blue-700">{t}</div>
            <div className="text-[11px] text-gray-400">{r.ipAddress || r.modelName || 'N/A'}</div>
          </div>
        ),
      },
      {
        title: 'Người dùng & Phòng ban',
        key: 'users',
        width: 220,
        render: (_: any, record: any) => {
          const users = record.users || [];
          if (users.length === 0) {
            return record.domainUser ? (
              <span className="text-xs font-mono text-purple-700 bg-purple-50 px-2 py-0.5 rounded">
                {record.domainUser}
              </span>
            ) : (
              <span className="text-gray-400 italic text-xs">Chưa cấp phát</span>
            );
          }
          return (
            <div className="flex flex-col gap-1">
              {users.map((u: any) => (
                <div
                  key={u.id}
                  className="flex flex-col bg-slate-50 px-2 py-1 rounded text-xs text-slate-700 border border-slate-100"
                >
                  <div className="flex items-center gap-1.5">
                    <UserOutlined className="text-blue-500 shrink-0" />
                    <span className="font-medium">{u.fullName}</span>
                  </div>
                  {u.department && (
                    <div className="text-[11px] text-gray-500 ml-4">
                      Phòng: {u.department.name}
                    </div>
                  )}
                </div>
              ))}
            </div>
          );
        },
      },
      {
        title: 'Vị trí',
        key: 'location',
        width: 140,
        render: (_: any, record: any) => (
          <div className="flex flex-col text-xs gap-0.5">
            {record.factory ? (
              <span className="font-medium text-slate-700">🏭 {record.factory.name}</span>
            ) : (
              <span className="text-gray-400 italic">Chưa gán</span>
            )}
            {record.department && (
              <span className="text-gray-500">🏢 {record.department.name}</span>
            )}
          </div>
        ),
      },
    ];

    if (modalConfig.type === 'LOW_RAM') {
      return [
        ...baseColumns,
        {
          title: 'Cấu hình hiện tại',
          key: 'specs',
          width: 220,
          render: (_: any, r: any) => (
            <div className="text-xs space-y-1">
              <div>
                <Tag color="warning" className="font-bold m-0">
                  RAM: {r.customSpecs?.ram || 'N/A'}
                </Tag>
              </div>
              <div className="text-gray-500 truncate max-w-[200px]">
                💾 {r.customSpecs?.disk || 'N/A'}
              </div>
            </div>
          ),
        },
      ];
    }

    if (modalConfig.type === 'OFFLINE') {
      return [
        ...baseColumns,
        {
          title: 'Lần cuối Online',
          dataIndex: 'lastSeen',
          key: 'lastSeen',
          width: 170,
          render: (d: string) => {
            if (!d) return <Tag color="default">Chưa từng kết nối</Tag>;
            const diffDays = Math.floor(
              (Date.now() - new Date(d).getTime()) / (1000 * 60 * 60 * 24)
            );
            return (
              <div className="text-xs">
                <Tag color={diffDays > 30 ? 'error' : 'warning'} className="m-0">
                  Cách đây {diffDays} ngày
                </Tag>
                <div className="text-[11px] text-gray-400 mt-0.5">
                  {new Date(d).toLocaleDateString('vi-VN')}
                </div>
              </div>
            );
          },
        },
      ];
    }

    if (modalConfig.type === 'HEALTH') {
      return [
        ...baseColumns,
        {
          title: 'Mức độ',
          dataIndex: 'healthLevel',
          key: 'healthLevel',
          width: 110,
          render: (lvl: string) =>
            lvl === 'CRITICAL' ? (
              <Tag color="error">🚨 Nguy hiểm</Tag>
            ) : (
              <Tag color="warning">⚠️ Cảnh báo</Tag>
            ),
        },
        {
          title: 'Chi tiết cảnh báo Sức khỏe',
          dataIndex: 'healthSummary',
          key: 'healthSummary',
          render: (t: string) => <span className="text-xs text-slate-700">{t}</span>,
        },
      ];
    }

    if (modalConfig.type === 'UNLICENSED') {
      return [
        ...baseColumns,
        {
          title: 'Hệ điều hành',
          dataIndex: 'osName',
          key: 'osName',
          width: 180,
          render: (t: string) => <span className="text-xs font-medium">{t || 'Windows'}</span>,
        },
        {
          title: 'Trạng thái Bản quyền',
          dataIndex: 'licenseNote',
          key: 'licenseNote',
          render: (t: string) => <Tag color="error">{t || 'Chưa kích hoạt (Unlicensed)'}</Tag>,
        },
      ];
    }

    return [
      ...baseColumns,
      {
        title: 'Trạng thái',
        dataIndex: 'status',
        key: 'status',
        align: 'center',
        width: 120,
        render: (s: string) => {
          const colorMap: any = { BROKEN: 'error', REPAIR: 'warning' };
          const textMap: any = { BROKEN: 'Đang hỏng', REPAIR: 'Đang sửa chữa' };
          return (
            <Badge
              status={colorMap[s] || 'default'}
              text={<span className="text-xs font-medium">{textMap[s] || s}</span>}
            />
          );
        },
      },
    ];
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-slate-50">
        <Spin size="large" tip="Đang tải Trung tâm Giám sát CNTT..." />
      </div>
    );
  }

  const cards = stats?.cards || {};
  const pieData = stats?.charts?.byStatus || [];
  const osChartData = stats?.charts?.byOs || [];
  const ramGenChartData = stats?.charts?.byRamGen || [];
  const barFactoryData = stats?.charts?.byFactory || [];
  const recentUpgrades = (stats?.lists?.upgraded || []).slice(0, 6);

  const totalComputing = cards.totalComputing || cards.total || 0;
  const ssdCount = cards.ssdMachines || 0;
  const hddOnlyCount = cards.hddOnly || 0;
  const ssdPercent =
    ssdCount + hddOnlyCount > 0
      ? Math.round((ssdCount / (ssdCount + hddOnlyCount)) * 100)
      : 100;

  const healthGood = cards.healthGood || 0;
  const healthWarn = cards.healthWarning || 0;
  const healthCrit = cards.healthCritical || 0;
  const healthGoodPct =
    totalComputing > 0 ? Math.round((healthGood / totalComputing) * 100) : 100;

  return (
    <div className="p-4 md:p-6 bg-slate-50 min-h-screen space-y-6">
      {/* --- HEADER TRUNG TÂM ĐIỀU HÀNH CNTT --- */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <Title level={3} className="!m-0 !text-slate-800 font-bold tracking-tight">
              Trung tâm Giám sát & Quản trị Hạ tầng CNTT
            </Title>
            <Badge
              status={isConnected ? 'processing' : 'default'}
              text={
                <span
                  className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold tracking-wider ${
                    isConnected
                      ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {isConnected ? '● REALTIME LIVE' : 'OFFLINE'}
                </span>
              }
            />
          </div>
          <Text className="text-slate-500 text-xs sm:text-sm mt-1 block">
            Theo dõi thời gian thực: Thiết bị, Sức khỏe Phần cứng (S.M.A.R.T), Biến động Linh kiện & Tuân thủ Bản quyền
          </Text>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            icon={<DesktopOutlined />}
            onClick={() => navigate('/itam/assets')}
            className="rounded-lg font-medium"
          >
            Danh sách máy
          </Button>
          <Button
            icon={<SafetyCertificateOutlined />}
            onClick={() => navigate('/itam/software')}
            className="rounded-lg font-medium"
          >
            Bản quyền Phần mềm
          </Button>
          <Button
            type="primary"
            icon={<ReloadOutlined spin={refreshing} />}
            onClick={() => fetchStats(true)}
            className="rounded-lg bg-blue-600"
          >
            Làm mới
          </Button>
        </div>
      </div>

      {/* --- HÀNG 1: 6 THẺ KPI ĐIỀU HÀNH (CLICK ĐỂ XEM CHI TIẾT & XUẤT EXCEL) --- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* 1. Tổng Hạ tầng Thiết bị */}
        <Card
          bordered={false}
          onClick={() => navigate('/itam/assets')}
          className="shadow-sm rounded-2xl border border-slate-100 hover:shadow-md hover:border-blue-300 cursor-pointer transition-all"
          styles={{ body: { padding: '18px' } }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
              Tổng Máy tính
            </span>
            <div className="p-2 bg-blue-50 rounded-xl">
              <AppstoreOutlined className="text-blue-600 text-lg" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-800 mb-3">{totalComputing}</div>
          <div className="pt-2.5 border-t border-slate-100 space-y-1 text-xs text-slate-600">
            <div className="flex justify-between">
              <span>🖥️ Màn hình:</span>
              <b className="text-slate-800">{cards.monitorsCount || 0}</b>
            </div>
            <div className="flex justify-between">
              <span>💾 Ổ cứng vật lý:</span>
              <b className="text-slate-800">{cards.disksCount || 0}</b>
            </div>
            <div className="flex justify-between">
              <span>🖱️ Chuột & Phím:</span>
              <b className="text-slate-800">{cards.peripheralsCount || 0}</b>
            </div>
          </div>
        </Card>

        {/* 2. Kết nối Agent (Online / Offline) */}
        <Card
          bordered={false}
          onClick={() => showDetails('OFFLINE')}
          className="shadow-sm rounded-2xl border border-slate-100 hover:shadow-md hover:border-emerald-300 cursor-pointer transition-all"
          styles={{ body: { padding: '18px' } }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
              Kết nối Agent
            </span>
            <div className="p-2 bg-emerald-50 rounded-xl">
              <WifiOutlined className="text-emerald-600 text-lg" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-3xl font-extrabold text-emerald-600">
              {(cards.online24h || 0) + (cards.active7d || 0)}
            </span>
            <span className="text-xs text-slate-400 font-medium">/ {totalComputing} hoạt động</span>
          </div>
          <div className="pt-2.5 border-t border-slate-100 space-y-1 text-xs">
            <div className="flex justify-between text-emerald-700">
              <span>● Online 24h qua:</span>
              <b>{cards.online24h || 0} máy</b>
            </div>
            <div className="flex justify-between text-amber-600">
              <span>● Vắng mặt &gt; 7 ngày:</span>
              <b>{cards.offline7d || 0} máy</b>
            </div>
            <div className="flex justify-between text-blue-600 font-medium pt-0.5">
              <span>Xem máy mất kết nối</span>
              <RightOutlined className="text-[10px]" />
            </div>
          </div>
        </Card>

        {/* 3. Sức khỏe Phần cứng (S.M.A.R.T & Tải) */}
        <Card
          bordered={false}
          onClick={() => showDetails('HEALTH')}
          className="shadow-sm rounded-2xl border border-slate-100 hover:shadow-md hover:border-rose-300 cursor-pointer transition-all"
          styles={{ body: { padding: '18px' } }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
              Sức khỏe Phần cứng
            </span>
            <div className="p-2 bg-rose-50 rounded-xl">
              <HddOutlined className="text-rose-600 text-lg" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mb-3">
            <span
              className={`text-3xl font-extrabold ${
                healthCrit > 0
                  ? 'text-red-600'
                  : healthWarn > 0
                  ? 'text-amber-500'
                  : 'text-emerald-600'
              }`}
            >
              {healthCrit + healthWarn}
            </span>
            <span className="text-xs text-slate-400">máy cần chú ý</span>
          </div>
          <div className="pt-2.5 border-t border-slate-100 space-y-1 text-xs">
            <div className="flex justify-between text-emerald-700">
              <span>✓ S.M.A.R.T Tốt:</span>
              <b>
                {healthGood} máy ({healthGoodPct}%)
              </b>
            </div>
            <div className="flex justify-between text-red-600">
              <span>🚨 Nguy hiểm / Hỏng:</span>
              <b>{healthCrit} máy</b>
            </div>
            <div className="flex justify-between text-amber-600">
              <span>⚠️ Đầy ổ / RAM cao:</span>
              <b>{healthWarn} máy</b>
            </div>
          </div>
        </Card>

        {/* 4. Đề xuất Nâng cấp (RAM < 8GB / Ổ HDD) */}
        <Card
          bordered={false}
          onClick={() => showDetails('LOW_RAM')}
          className="shadow-sm rounded-2xl border border-slate-100 hover:shadow-md hover:border-amber-300 cursor-pointer transition-all"
          styles={{ body: { padding: '18px' } }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
              Cần Nâng cấp
            </span>
            <div className="p-2 bg-amber-50 rounded-xl">
              <ThunderboltOutlined className="text-amber-500 text-lg" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-3xl font-extrabold text-amber-500">{cards.lowRam || 0}</span>
            <span className="text-xs text-slate-400">máy RAM &lt; 8GB</span>
          </div>
          <div className="pt-2.5 border-t border-slate-100 space-y-1 text-xs text-slate-600">
            <div className="flex justify-between">
              <span>⚡ Đã lên SSD/NVMe:</span>
              <b className="text-emerald-600">{ssdCount} máy</b>
            </div>
            <div className="flex justify-between">
              <span>🐢 Còn chạy HDD cơ:</span>
              <b className="text-amber-600">{hddOnlyCount} máy</b>
            </div>
            <div className="flex justify-between text-amber-600 font-medium pt-0.5">
              <span>Xuất DS nâng cấp</span>
              <RightOutlined className="text-[10px]" />
            </div>
          </div>
        </Card>

        {/* 5. Giám sát Thay đổi Linh kiện */}
        <Card
          bordered={false}
          onClick={() => showDetails('UPGRADE')}
          className="shadow-sm rounded-2xl border border-slate-100 hover:shadow-md hover:border-indigo-300 cursor-pointer transition-all"
          styles={{ body: { padding: '18px' } }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
              Biến động Linh kiện
            </span>
            <div className="p-2 bg-indigo-50 rounded-xl">
              <ToolOutlined className="text-indigo-600 text-lg" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-3xl font-extrabold text-indigo-600">
              {cards.upgraded || 0}
            </span>
            <span className="text-xs text-slate-400">lượt đổi (60 ngày)</span>
          </div>
          <div className="pt-2.5 border-t border-slate-100 space-y-1 text-xs text-slate-600">
            <div className="flex justify-between">
              <span>🔧 Đang hỏng/sửa:</span>
              <b className="text-red-500">{cards.broken || 0} máy</b>
            </div>
            <div className="flex justify-between">
              <span>🛡️ Tự động phát hiện:</span>
              <b className="text-indigo-600">RAM / Disk / Màn</b>
            </div>
            <div className="flex justify-between text-indigo-600 font-medium pt-0.5">
              <span>Xem lịch sử thay đổi</span>
              <RightOutlined className="text-[10px]" />
            </div>
          </div>
        </Card>

        {/* 6. Bản quyền Hệ điều hành & Phần mềm */}
        <Card
          bordered={false}
          onClick={() => showDetails('UNLICENSED')}
          className="shadow-sm rounded-2xl border border-slate-100 hover:shadow-md hover:border-purple-300 cursor-pointer transition-all"
          styles={{ body: { padding: '18px' } }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
              Bản quyền OS & Key
            </span>
            <div className="p-2 bg-purple-50 rounded-xl">
              <SafetyCertificateOutlined className="text-purple-600 text-lg" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mb-3">
            <span
              className={`text-3xl font-extrabold ${
                (cards.unlicensedOs || 0) > 0 ? 'text-red-500' : 'text-emerald-600'
              }`}
            >
              {cards.unlicensedOs || 0}
            </span>
            <span className="text-xs text-slate-400">máy chưa Active OS</span>
          </div>
          <div className="pt-2.5 border-t border-slate-100 space-y-1 text-xs text-slate-600">
            <div className="flex justify-between text-emerald-700">
              <span>✓ OS có bản quyền:</span>
              <b>{cards.licensedOs || 0} máy</b>
            </div>
            <div className="flex justify-between text-amber-600">
              <span>⏳ Key sắp hết hạn:</span>
              <b>{cards.expiringKeys || 0} key</b>
            </div>
            <div className="flex justify-between text-purple-600 font-medium pt-0.5">
              <span>Xem máy chưa Active</span>
              <RightOutlined className="text-[10px]" />
            </div>
          </div>
        </Card>
      </div>

      {/* --- HÀNG 2: 4 BIỂU ĐỒ PHÂN TÍCH HẠ TẦNG CHUYÊN SÂU --- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-5">
        {/* Biểu đồ 1: Trạng thái Vận hành (Donut Tiếng Việt chuẩn) */}
        <Card
          title={<span className="font-bold text-slate-700 text-sm">Trạng thái vận hành thiết bị</span>}
          bordered={false}
          className="shadow-sm rounded-2xl border border-slate-100"
        >
          {pieData.length > 0 ? (
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="45%"
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={4}
                    dataKey="value"
                    stroke="none"
                  >
                    {pieData.map((entry: any, index: number) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={
                          STATUS_COLOR_MAP[entry.code] ||
                          FALLBACK_COLORS[index % FALLBACK_COLORS.length]
                        }
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: '10px',
                      border: 'none',
                      boxShadow: '0 4px 12px rgb(0 0 0 / 0.1)',
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    iconType="circle"
                    wrapperStyle={{ fontSize: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[260px] flex items-center justify-center">
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có dữ liệu" />
            </div>
          )}
        </Card>

        {/* Biểu đồ 2: Phân bổ Hệ điều hành (Windows 11 / 10 / 7 / Ubuntu / Server) */}
        <Card
          title={
            <div className="flex items-center gap-2 font-bold text-slate-700 text-sm">
              <WindowsOutlined className="text-blue-500" /> Phân bổ Hệ điều hành
            </div>
          }
          bordered={false}
          className="shadow-sm rounded-2xl border border-slate-100"
        >
          {osChartData.length > 0 ? (
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={osChartData}
                  margin={{ top: 5, right: 32, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={110}
                    tick={{ fill: '#475569', fontSize: 12, fontWeight: 500 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{
                      borderRadius: '10px',
                      border: 'none',
                      boxShadow: '0 4px 12px rgb(0 0 0 / 0.1)',
                    }}
                  />
                  <Bar dataKey="value" name="Số máy" fill="#3b82f6" radius={[0, 6, 6, 0]} barSize={22}>
                    <LabelList dataKey="value" position="right" fill="#334155" fontSize={12} fontWeight={600} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[260px] flex items-center justify-center">
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có dữ liệu Hệ điều hành" />
            </div>
          )}
        </Card>

        {/* Biểu đồ 3: Thế hệ RAM (DDR3/4/5) & Tỷ lệ hiện đại hóa SSD */}
        <Card
          title={
            <div className="flex items-center gap-2 font-bold text-slate-700 text-sm">
              <LaptopOutlined className="text-indigo-500" /> Thế hệ RAM & Chuẩn Ổ cứng
            </div>
          }
          bordered={false}
          className="shadow-sm rounded-2xl border border-slate-100"
        >
          <div className="h-[260px] flex flex-col justify-between">
            {ramGenChartData.length > 0 ? (
              <div className="h-[175px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={ramGenChartData}
                    margin={{ top: 18, right: 10, left: -25, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: '#475569', fontSize: 12, fontWeight: 600 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      cursor={{ fill: '#f8fafc' }}
                      contentStyle={{
                        borderRadius: '10px',
                        border: 'none',
                        boxShadow: '0 4px 12px rgb(0 0 0 / 0.1)',
                      }}
                    />
                    <Bar dataKey="value" name="Số máy" fill="#6366f1" radius={[6, 6, 0, 0]} barSize={34}>
                      <LabelList dataKey="value" position="top" fill="#475569" fontSize={12} fontWeight={600} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[175px] flex items-center justify-center">
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có dữ liệu thế hệ RAM" />
              </div>
            )}

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <div className="flex justify-between text-xs mb-1">
                <span className="font-semibold text-slate-700">Tỷ lệ trang bị ổ SSD / NVMe</span>
                <span className="font-bold text-emerald-600">
                  {ssdCount} SSD / {hddOnlyCount} HDD ({ssdPercent}%)
                </span>
              </div>
              <Progress
                percent={ssdPercent}
                strokeColor="#10b981"
                trailColor="#fde68a"
                showInfo={false}
                size="small"
              />
            </div>
          </div>
        </Card>

        {/* Biểu đồ 4: Phân bổ theo Nhà máy */}
        <Card
          title={
            <div className="flex items-center gap-2 font-bold text-slate-700 text-sm">
              <ShopOutlined className="text-emerald-500" /> Phân bổ theo Nhà máy
            </div>
          }
          bordered={false}
          className="shadow-sm rounded-2xl border border-slate-100"
        >
          {barFactoryData.length > 0 ? (
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={barFactoryData}
                  margin={{ top: 5, right: 32, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={95}
                    tick={{ fill: '#475569', fontSize: 12, fontWeight: 500 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{
                      borderRadius: '10px',
                      border: 'none',
                      boxShadow: '0 4px 12px rgb(0 0 0 / 0.1)',
                    }}
                  />
                  <Bar dataKey="value" name="Số máy" fill="#10b981" radius={[0, 6, 6, 0]} barSize={24}>
                    <LabelList dataKey="value" position="right" fill="#334155" fontSize={12} fontWeight={600} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[260px] flex items-center justify-center">
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có dữ liệu Nhà máy" />
            </div>
          )}
        </Card>
      </div>

      {/* --- HÀNG 3: NHẬT KÝ THAY ĐỔI LINH KIỆN GẦN ĐÂY & TÂM ĐIỂM CẦN XỬ LÝ --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Cột trái (2/3): Bảng Nhật ký Thay đổi Phần cứng tự động */}
        <Card
          title={
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-slate-700">
                <ToolOutlined className="text-indigo-600" />
                <span>Nhật ký Tự động Phát hiện Thay đổi Phần cứng Gần đây</span>
              </div>
              <Button type="link" size="small" onClick={() => showDetails('UPGRADE')}>
                Xem tất cả ({cards.upgraded || 0})
              </Button>
            </div>
          }
          bordered={false}
          className="shadow-sm rounded-2xl border border-slate-100 lg:col-span-2"
        >
          {recentUpgrades.length > 0 ? (
            <div className="space-y-2.5">
              {recentUpgrades.map((log: any) => (
                <div
                  key={log.id}
                  className="p-3 rounded-xl bg-slate-50/80 hover:bg-slate-100/80 border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition-colors"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Tag color="blue" className="m-0 font-bold">
                        {log.asset?.name || 'Unknown'}
                      </Tag>
                      {log.asset?.factory?.name && (
                        <span className="text-xs text-slate-500 font-medium">
                          🏭 {log.asset.factory.name}
                          {log.asset?.department?.name ? ` • ${log.asset.department.name}` : ''}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-700 leading-relaxed">{log.description}</div>
                  </div>
                  <div className="text-[11px] text-gray-400 shrink-0 font-mono">
                    {log.startDate ? new Date(log.startDate).toLocaleString('vi-VN') : ''}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="Chưa có biến động tháo lắp linh kiện nào trong 60 ngày qua"
            />
          )}
        </Card>

        {/* Cột phải (1/3): Danh mục Cần IT Kiểm tra & Hành động */}
        <Card
          title={
            <div className="flex items-center gap-2 font-bold text-slate-700">
              <AlertOutlined className="text-amber-500" />
              <span>Hạng mục Cần IT Kiểm tra Ngay</span>
            </div>
          }
          bordered={false}
          className="shadow-sm rounded-2xl border border-slate-100"
        >
          <div className="space-y-3">
            <div
              onClick={() => showDetails('HEALTH')}
              className="p-3.5 rounded-xl border border-rose-200 bg-rose-50/50 hover:bg-rose-50 cursor-pointer transition-all flex items-center justify-between gap-3"
            >
              <div>
                <div className="font-bold text-rose-800 text-sm flex items-center gap-1.5">
                  <WarningOutlined className="text-rose-600" /> Cảnh báo S.M.A.R.T & Quá tải
                </div>
                <div className="text-xs text-rose-700 mt-0.5">
                  Có <b>{healthCrit + healthWarn} máy</b> báo lỗi ổ cứng, đầy phân vùng hoặc RAM cao.
                </div>
              </div>
              <Button size="small" danger>
                Kiểm tra
              </Button>
            </div>

            <div
              onClick={() => showDetails('OFFLINE')}
              className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/50 hover:bg-amber-50 cursor-pointer transition-all flex items-center justify-between gap-3"
            >
              <div>
                <div className="font-bold text-amber-900 text-sm flex items-center gap-1.5">
                  <DisconnectOutlined className="text-amber-600" /> Máy mất kết nối Agent
                </div>
                <div className="text-xs text-amber-800 mt-0.5">
                  Có <b>{cards.offline7d || 0} máy</b> quá 7 ngày chưa gửi thông tin về hệ thống.
                </div>
              </div>
              <Button size="small" className="border-amber-400 text-amber-700">
                Rà soát
              </Button>
            </div>

            <div
              onClick={() => showDetails('UNLICENSED')}
              className="p-3.5 rounded-xl border border-purple-200 bg-purple-50/50 hover:bg-purple-50 cursor-pointer transition-all flex items-center justify-between gap-3"
            >
              <div>
                <div className="font-bold text-purple-900 text-sm flex items-center gap-1.5">
                  <SafetyCertificateOutlined className="text-purple-600" /> Bản quyền Windows / Key
                </div>
                <div className="text-xs text-purple-800 mt-0.5">
                  Có <b>{cards.unlicensedOs || 0} máy</b> chưa kích hoạt Windows &{' '}
                  <b>{cards.expiringKeys || 0} key</b> sắp hết hạn.
                </div>
              </div>
              <Button size="small" className="border-purple-400 text-purple-700">
                Xem
              </Button>
            </div>

            <div
              onClick={() => showDetails('LOW_RAM')}
              className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/50 hover:bg-blue-50 cursor-pointer transition-all flex items-center justify-between gap-3"
            >
              <div>
                <div className="font-bold text-blue-900 text-sm flex items-center gap-1.5">
                  <CheckCircleOutlined className="text-blue-600" /> Kế hoạch Nâng cấp RAM/SSD
                </div>
                <div className="text-xs text-blue-800 mt-0.5">
                  Có <b>{cards.lowRam || 0} máy</b> RAM &lt; 8GB & <b>{hddOnlyCount} máy</b> chạy HDD cơ.
                </div>
              </div>
              <AntTooltip title="Mở danh sách và xuất file Excel đề xuất nâng cấp">
                <Button size="small" type="primary" ghost>
                  Danh sách
                </Button>
              </AntTooltip>
            </div>
          </div>
        </Card>
      </div>

      {/* --- MODAL HIỂN THỊ DANH SÁCH CHI TIẾT & XUẤT EXCEL --- */}
      <Modal
        title={
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 w-full">
            <div className="flex items-center gap-2 text-base sm:text-lg font-bold text-slate-800">
              {modalConfig.type === 'BROKEN' || modalConfig.type === 'HEALTH' ? (
                <AlertOutlined className="text-red-500" />
              ) : modalConfig.type === 'UPGRADE' ? (
                <ToolOutlined className="text-indigo-500" />
              ) : modalConfig.type === 'OFFLINE' ? (
                <DisconnectOutlined className="text-amber-500" />
              ) : (
                <SafetyCertificateOutlined className="text-blue-500" />
              )}
              <span>{modalConfig.title}</span>
            </div>
            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
              <Input
                placeholder="Tìm tên máy, IP, người dùng..."
                prefix={<SearchOutlined className="text-gray-400" />}
                value={modalSearchText}
                onChange={(e) => setModalSearchText(e.target.value)}
                className="flex-1 sm:w-56"
                allowClear
              />
              <Button
                type="primary"
                icon={<FileExcelOutlined />}
                onClick={exportToExcel}
                className="bg-green-600 hover:!bg-green-700 border-none"
              >
                Xuất Excel ({getFilteredModalData().length})
              </Button>
            </div>
          </div>
        }
        open={modalConfig.open}
        onCancel={() => {
          setModalConfig({ ...modalConfig, open: false });
          setModalSearchText('');
        }}
        footer={
          <Button
            key="close"
            type="primary"
            onClick={() => {
              setModalConfig({ ...modalConfig, open: false });
              setModalSearchText('');
            }}
            className="rounded-lg px-6"
          >
            Đóng
          </Button>
        }
        width="min(96vw, 1020px)"
        closeIcon={false}
        className="custom-modal"
      >
        <div className="py-4 border-t border-gray-100">
          <Table
            dataSource={getFilteredModalData()}
            columns={getModalColumns()}
            rowKey="id"
            scroll={{ x: 'max-content' }}
            pagination={{ pageSize: 7, position: ['bottomCenter'], showSizeChanger: false }}
            size="middle"
            className="border border-gray-100 rounded-lg overflow-hidden"
            rowClassName="hover:bg-slate-50 transition-colors"
            locale={{ emptyText: <Empty description="Không có thiết bị nào trong danh sách này" /> }}
          />
        </div>
      </Modal>
    </div>
  );
};

export default Dashboard;
