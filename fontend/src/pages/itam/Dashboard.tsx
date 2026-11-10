import { useEffect, useState } from 'react';
import { Card, Spin, List, Typography, Tag, Empty, message, Modal, Table, Button, Badge, Input } from 'antd';
import { 
  AppstoreOutlined, AlertOutlined, SafetyCertificateOutlined, 
  InfoCircleOutlined, ShopOutlined, EyeOutlined,
  LaptopOutlined, ApiOutlined, UserOutlined, FileExcelOutlined, ToolOutlined, SearchOutlined
} from '@ant-design/icons';
import * as XLSX from 'xlsx';
import { 
  PieChart, Pie, Cell, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, 
  CartesianGrid, ResponsiveContainer, LabelList 
} from 'recharts';

import { useSocket } from '../../contexts/SocketContext';
import axiosClient from '../../api/axiosClient';

const { Title, Text } = Typography;

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
const BAR_COLOR = '#6366f1'; 

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);

  const { socket, isConnected } = useSocket();

  const [modalConfig, setModalConfig] = useState<{ open: boolean, title: string, data: any[], type: 'BROKEN' | 'LOW_RAM' | 'UPGRADE' | null }>({
      open: false, title: '', data: [], type: null
  });

  const [modalSearchText, setModalSearchText] = useState('');

  const fetchStats = async () => {
    try {
      const res = await axiosClient.get('/dashboard/stats');
      setStats(res.data.data);
    } catch (error: any) {
      console.error("Lỗi tải dashboard:", error);
    } finally {
      setLoading(false);
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

        socket.on("asset_updated", handleAssetUpdate);
        socket.on("hardware_alert", handleHardwareAlert);
        
        return () => {
            socket.off("asset_updated", handleAssetUpdate);
            socket.off("hardware_alert", handleHardwareAlert);
        };
    }
  }, [socket, isConnected]);

  const showDetails = (type: 'BROKEN' | 'LOW_RAM' | 'UPGRADE') => {
      setModalSearchText('');

      if (type === 'BROKEN') {
          setModalConfig({
              open: true,
              title: 'Danh sách thiết bị Đang hỏng / Sửa chữa',
              data: stats?.lists?.broken || [],
              type: 'BROKEN'
          });
      } else if (type === 'LOW_RAM') {
          setModalConfig({
              open: true,
              title: 'Danh sách thiết bị cấu hình yếu (RAM < 8GB)',
              data: stats?.lists?.lowRam || [],
              type: 'LOW_RAM'
          });
      } else if (type === 'UPGRADE') {
          const upgradeData = stats?.lists?.upgraded || [];
          setModalConfig({
              open: true,
              title: 'Lịch sử thay đổi & Nâng cấp phần cứng',
              data: upgradeData, 
              type: 'UPGRADE'
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
              return assetName.includes(lowerSearch);
          } else {
              const assetName = item.name?.toLowerCase() || '';
              return assetName.includes(lowerSearch);
          }
      });
  };

  const exportToExcel = () => {
      const filteredDataToExport = getFilteredModalData();

      if (!filteredDataToExport || filteredDataToExport.length === 0) {
          message.warning("Không có dữ liệu để xuất");
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
              const users = asset.users?.map((u: any) => u.fullName).join(" & ") || "N/A";
              const userDepartments = asset.users?.map((u: any) => u.department?.name || "Không rõ").join(" & ") || "-";
              const assetDepartment = asset.department?.name || "N/A";
              const factory = asset.factory?.name || "N/A";
              const updateDate = item.startDate ? new Date(item.startDate).toLocaleDateString('vi-VN') : '';

              return {
                  'STT': idx + 1,
                  'Tên máy': asset.name || 'Unknown',
                  'Người dùng': users,
                  'Phòng ban': userDepartments !== '-' ? userDepartments : assetDepartment,
                  'Nhà máy': factory,
                  'Nội dung thay đổi': item.description || 'N/A',
                  'Ngày thay đổi': updateDate,
                  'Người thực hiện': item.providerName || 'Auto System'
              };
          });
      } else {
          if (modalConfig.type === 'LOW_RAM') {
              fileName = `DS_May_Tinh_RAM_Yeu_${dateStr}.xlsx`;
              sheetName = 'May_RAM_Yeu';
          } else if (modalConfig.type === 'BROKEN') {
              fileName = `DS_May_Tinh_Hong_${dateStr}.xlsx`;
              sheetName = 'May_Hong_Sua_Chua';
          }
          const statusMap: any = { BROKEN: 'Hỏng', REPAIR: 'Đang sửa chữa', NEW: 'Mới', IN_USE: 'Đang dùng' };
          rows = filteredDataToExport.map((item: any, idx: number) => {
              const users = item.users?.map((u: any) => u.fullName).join(" & ") || "Chưa cấp phát";
              const userDepartments = item.users?.map((u: any) => u.department?.name || "Không rõ").join(" & ") || "-";
              const assetDepartment = item.department?.name || "Chưa gán";
              const factory = item.factory?.name || "Chưa gán";
              const ram = item.customSpecs?.ram || "N/A";

              return {
                  'STT': idx + 1,
                  'Tên máy': item.name || '',
                  'Model': item.modelName || '',
                  'Người dùng': users,
                  'Phòng ban User': userDepartments,
                  'Vị trí máy': assetDepartment,
                  'Nhà máy': factory,
                  'RAM': ram,
                  'Trạng thái': statusMap[item.status] || item.status
              };
          });
      }

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
      XLSX.writeFile(wb, fileName);
      message.success("Xuất file Excel thành công!");
  };

  const getModalColumns = () => {
      if (modalConfig.type === 'UPGRADE') {
          return [
              { 
                  title: 'Ngày cập nhật', 
                  dataIndex: 'startDate', 
                  key: 'date', 
                  width: 130, 
                  render: (d: string) => <Tag color="blue">{new Date(d).toLocaleDateString('vi-VN')}</Tag> 
              },
              { 
                  title: 'Tên máy', 
                  dataIndex: ['asset', 'name'], 
                  key: 'name', 
                  width: 140, 
                  render: (t: string) => <span className="font-semibold text-slate-700">{t || 'Unknown'}</span> 
              },
              { 
                  title: 'Nội dung thay đổi', 
                  dataIndex: 'description', 
                  key: 'desc',
                  render: (t: string) => <span className="text-gray-600 text-xs leading-relaxed">{t}</span> 
              },
              {
                  title: 'Ghi nhận bởi',
                  dataIndex: 'providerName',
                  key: 'provider',
                  width: 150,
                  render: (t: string) => <span className="text-gray-400 text-[11px] font-mono">{t}</span>
              }
          ];
      }

      const baseColumns: any = [
          { title: 'Tên máy', dataIndex: 'name', key: 'name', width: 140, render: (t: string) => <span className="font-semibold text-blue-700">{t}</span> },
          { title: 'Model', dataIndex: 'modelName', key: 'model', width: 160, render: (t: string) => <span className="text-gray-600 text-xs">{t || 'N/A'}</span> },
          { 
              title: 'Người dùng & Phòng ban', 
              key: 'users',
              width: 250, 
              sorter: (a: any, b: any) => {
                  const deptA = a.users?.[0]?.department?.name || "";
                  const deptB = b.users?.[0]?.department?.name || "";
                  return deptA.localeCompare(deptB, 'vi');
              },
              render: (_: any, record: any) => {
                  const users = record.users || [];
                  if (users.length === 0) return <span className="text-gray-400 italic text-xs">Chưa cấp phát</span>;
                  return (
                      <div className="flex flex-col gap-1">
                          {users.map((u: any) => (
                              <div key={u.id} className="flex flex-col bg-slate-50 px-2.5 py-1.5 rounded text-xs text-slate-700 border border-slate-100 break-words">
                                  <div className="flex items-center gap-1.5">
                                      <UserOutlined className="text-blue-500 shrink-0" />
                                      <span className="font-medium">{u.fullName}</span>
                                  </div>
                                  {u.department && (
                                      <div className="text-[11px] text-gray-500 ml-5 mt-0.5 border-l-2 border-gray-200 pl-1.5">
                                          Phòng: {u.department.name}
                                      </div>
                                  )}
                              </div>
                          ))}
                      </div>
                  );
              } 
          },
          { 
              title: 'Vị trí máy', 
              key: 'location', 
              sorter: (a: any, b: any) => {
                  const deptA = a.department?.name || "";
                  const deptB = b.department?.name || "";
                  return deptA.localeCompare(deptB, 'vi');
              },
              render: (_: any, record: any) => (
                  <div className="flex flex-col text-xs gap-0.5">
                      {record.factory ? <span className="font-medium text-slate-700">🏭 {record.factory.name}</span> : <span className="text-gray-400 italic">Chưa gán nhà máy</span>}
                      {record.department && <span className="text-gray-500">🏢 {record.department.name}</span>}
                  </div>
              )
          },
      ];

      if (modalConfig.type === 'LOW_RAM') {
          return [
              ...baseColumns,
              { 
                  title: 'RAM', 
                  dataIndex: ['customSpecs', 'ram'], 
                  key: 'ram',
                  align: 'center',
                  width: 90,
                  render: (t: string) => <Tag color="warning" className="font-bold border-none m-0">{t}</Tag>
              }
          ];
      } else {
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
                      const textMap: any = { BROKEN: 'Hỏng', REPAIR: 'Sửa chữa' };
                      return <Badge status={colorMap[s] || 'default'} text={<span className="text-xs font-medium">{textMap[s] || s}</span>} />;
                  }
              }
          ];
      }
  };

  if (loading) return <div className="flex justify-center items-center h-screen bg-slate-50"><Spin size="large" /></div>;

  const pieData = stats?.charts?.byStatus || [];
  const barTypeData = stats?.charts?.byType || [];
  const barFactoryData = stats?.charts?.byFactory || [];

  const totalAssets = stats?.cards?.total || 0;
  const totalComputing = stats?.cards?.totalComputing || 0; 
  const totalComponents = stats?.cards?.totalComponents || 0; 

  return (
    <div className="p-4 md:p-6 bg-slate-50 min-h-screen">
      
      {/* HEADER */}
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
             <Title level={3} className="!m-0 !text-slate-800 font-bold">Tổng quan tài sản CNTT</Title>
             <Badge 
                status={isConnected ? "processing" : "default"} 
                text={
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold tracking-wider ${isConnected ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
                        {isConnected ? 'LIVE' : 'OFFLINE'}
                    </span>
                } 
             />
          </div>
          <Text className="text-slate-500">Giám sát và quản lý dữ liệu thời gian thực</Text>
        </div>
        <Tag color="blue" className="px-4 py-1.5 text-sm rounded-full font-medium border-blue-200 bg-blue-50 text-blue-700">
            Hôm nay: {new Date().toLocaleDateString('vi-VN')}
        </Tag>
      </div>

      {/* --- HÀNG 1: CARDS THỐNG KÊ --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
        
        {/* Card Tổng tài sản */}
        <Card bordered={false} className="shadow-sm rounded-2xl border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between mb-4">
                <span className="text-slate-500 font-semibold uppercase tracking-wider text-xs">Tổng tài sản</span>
                <div className="p-2 bg-blue-50 rounded-xl"><AppstoreOutlined className="text-blue-600 text-xl" /></div>
            </div>
            <div className="text-3xl font-bold text-slate-800 mb-4">{totalAssets}</div>
            
            {/* Thanh phân chia */}
            <div className="flex flex-col gap-2 pt-4 border-t border-gray-100">
                <div className="flex justify-between items-center text-xs">
                    <span className="flex items-center text-slate-600"><LaptopOutlined className="mr-1.5 text-indigo-500"/> Máy tính/Server:</span>
                    <span className="font-bold text-slate-800">{totalComputing || totalAssets}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                    <span className="flex items-center text-slate-600"><ApiOutlined className="mr-1.5 text-teal-500"/> Linh/Phụ kiện:</span>
                    <span className="font-bold text-slate-800">{totalComponents || 0}</span>
                </div>
            </div>
        </Card>

        {/* Card Hỏng */}
        <Card 
            bordered={false} 
            className="shadow-sm rounded-2xl cursor-pointer hover:shadow-md hover:border-red-300 border border-gray-100 transition-all group flex flex-col justify-between"
            onClick={() => showDetails('BROKEN')}
        >
          <div>
              <div className="flex justify-between items-start mb-4">
                  <span className="text-slate-500 font-semibold uppercase tracking-wider text-xs">Cần sửa chữa</span>
                  <div className="p-2 bg-red-50 rounded-xl group-hover:bg-red-100 transition-colors"><AlertOutlined className="text-red-500 text-xl" /></div>
              </div>
              <div className="text-3xl font-bold text-red-600 mb-2">{stats?.cards?.broken || 0}</div>
          </div>
          <div className="mt-auto pt-4 flex items-center text-xs text-gray-400 group-hover:text-red-500 transition-colors">
              <EyeOutlined className="mr-1" /> Nhấn để xem chi tiết
          </div>
        </Card>

        {/* Card Thay đổi phần cứng */}
        <Card 
            bordered={false} 
            className="shadow-sm rounded-2xl cursor-pointer hover:shadow-md hover:border-indigo-300 border border-gray-100 transition-all group flex flex-col justify-between"
            onClick={() => showDetails('UPGRADE')}
        >
          <div>
              <div className="flex justify-between items-start mb-4">
                  <span className="text-slate-500 font-semibold uppercase tracking-wider text-xs">Phần cứng thay đổi</span>
                  <div className="p-2 bg-indigo-50 rounded-xl group-hover:bg-indigo-100 transition-colors"><ToolOutlined className="text-indigo-500 text-xl" /></div>
              </div>
              <div className="text-3xl font-bold text-indigo-500 mb-2">{stats?.cards?.upgraded || 0}</div>
          </div>
          <div className="mt-auto pt-4 flex items-center text-xs text-gray-400 group-hover:text-indigo-500 transition-colors">
              <EyeOutlined className="mr-1" /> Lịch sử nâng cấp / thay thế
          </div>
        </Card>

        {/* Card RAM Yếu */}
        <Card 
            bordered={false} 
            className="shadow-sm rounded-2xl cursor-pointer hover:shadow-md hover:border-amber-300 border border-gray-100 transition-all group flex flex-col justify-between"
            onClick={() => showDetails('LOW_RAM')}
        >
          <div>
              <div className="flex justify-between items-start mb-4">
                  <span className="text-slate-500 font-semibold uppercase tracking-wider text-xs">RAM &lt; 8GB</span>
                  <div className="p-2 bg-amber-50 rounded-xl group-hover:bg-amber-100 transition-colors"><SafetyCertificateOutlined className="text-amber-500 text-xl" /></div>
              </div>
              <div className="text-3xl font-bold text-amber-500 mb-2">{stats?.cards?.lowRam || 0}</div>
          </div>
          <div className="mt-auto pt-4 flex items-center text-xs text-gray-400 group-hover:text-amber-500 transition-colors">
              <EyeOutlined className="mr-1" /> Nhấn để xem danh sách
          </div>
        </Card>

      </div>

      {/* --- HÀNG 2: BIỂU ĐỒ --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
         
         {/* Chart 1: Trạng thái (Pie) */}
         <Card 
            title={<span className="font-bold text-slate-700">Tỷ lệ trạng thái thiết bị</span>} 
            bordered={false} 
            className="shadow-sm rounded-2xl border border-gray-100 h-[420px]"
         >
            {pieData.length > 0 ? (
                <div className="h-[300px] w-full"> 
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                    <Pie
                        data={pieData}
                        cx="50%" cy="45%"
                        innerRadius={75} outerRadius={100}
                        paddingAngle={4}
                        dataKey="value"
                        stroke="none" 
                    >
                        {pieData.map((_: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                    </Pie>
                    <Tooltip 
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        itemStyle={{ color: '#334155', fontWeight: 500 }}
                    />
                    <Legend 
                        verticalAlign="bottom" 
                        iconType="circle"
                        wrapperStyle={{ paddingTop: '20px', fontSize: '12px' }}
                    />
                    </PieChart>
                </ResponsiveContainer>
                </div>
            ) : <div className="h-full flex items-center justify-center"><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có dữ liệu" /></div>}
        </Card>

        {/* Chart 2: Loại thiết bị (Bar) */}
        <Card 
            title={<span className="font-bold text-slate-700">Phân loại phần cứng</span>} 
            bordered={false} 
            className="shadow-sm rounded-2xl border border-gray-100 h-[420px]"
        >
            {barTypeData.length > 0 ? (
                <div className="h-[300px] w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barTypeData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{fill: '#64748b', fontSize: 12}} axisLine={false} tickLine={false} dy={10} />
                    <YAxis tick={{fill: '#94a3b8', fontSize: 12}} axisLine={false} tickLine={false} />
                    <Tooltip 
                        cursor={{fill: '#f8fafc'}}
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} 
                    />
                    <Bar dataKey="value" name="Số lượng" fill={BAR_COLOR} radius={[6, 6, 0, 0]} barSize={40}>
                        <LabelList dataKey="value" position="top" fill="#475569" fontSize={12} fontWeight={600} />
                    </Bar>
                    </BarChart>
                </ResponsiveContainer>
                </div>
            ) : <div className="h-full flex items-center justify-center"><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có dữ liệu" /></div>}
        </Card>

        {/* Chart 3: Nhà máy (Horizontal Bar) */}
        <Card 
            title={
                <div className="flex items-center gap-2 font-bold text-slate-700">
                    <ShopOutlined className="text-indigo-500"/> Phân bổ theo Nhà máy
                </div>
            } 
            bordered={false} 
            className="shadow-sm rounded-2xl border border-gray-100 h-[420px]"
        >
            {barFactoryData.length > 0 ? (
                <div className="h-[300px] w-full mt-2">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart layout="vertical" data={barFactoryData} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={110} tick={{fill: '#475569', fontSize: 12, fontWeight: 500}} axisLine={false} tickLine={false} />
                    <Tooltip 
                        cursor={{fill: '#f8fafc'}}
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} 
                    />
                    <Bar dataKey="value" name="Số lượng" fill="#10b981" radius={[0, 6, 6, 0]} barSize={28}>
                        <LabelList dataKey="value" position="right" fill="#64748b" fontSize={12} fontWeight={600} />
                    </Bar>
                    </BarChart>
                </ResponsiveContainer>
                </div>
            ) : <div className="h-full flex items-center justify-center"><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có dữ liệu Nhà máy" /></div>}
        </Card>
      </div>

      {/* --- GỢI Ý HÀNH ĐỘNG --- */}
      <Card 
        title={
            <div className="flex items-center gap-2 font-bold text-slate-700">
                <InfoCircleOutlined className="text-blue-500"/> Gợi ý quản trị & Bảo mật
            </div>
        } 
        bordered={false} 
        className="shadow-sm rounded-2xl border border-gray-100"
      >
        <List
            grid={{ gutter: 24, column: 2, xs: 1 }}
            dataSource={[
                { 
                    title: 'Kiểm kê máy Mất kết nối', 
                    desc: `Phát hiện ${stats?.cards?.offline || 0} máy không gửi tín hiệu Agent về Server quá 30 ngày. Cần kiểm tra xem máy đã hỏng, bị format, hay đã thanh lý.`, 
                    type: 'warning',
                    action: 'Kiểm tra ngay'
                },
                { 
                    title: 'Giám sát thay đổi linh kiện', 
                    desc: `Có ${stats?.cards?.upgraded || 0} máy tính vừa bị tháo lắp RAM, Ổ cứng hoặc Màn hình trong thời gian qua. Nhấn vào thẻ "Phần cứng thay đổi" để xem chi tiết.`, 
                    type: 'info',
                    action: 'Kiểm tra'
                }
            ]}
            renderItem={item => (
                <List.Item>
                    <div className={`p-5 rounded-xl border-l-4 h-full flex flex-col justify-between transition-colors ${
                        item.type === 'warning' ? 'bg-orange-50/50 border-orange-400 hover:bg-orange-50' : 'bg-blue-50/50 border-blue-400 hover:bg-blue-50'
                    }`}>
                        <div>
                            <div className="font-bold text-slate-800 text-base mb-2">{item.title}</div>
                            <div className="text-slate-600 text-sm leading-relaxed">{item.desc}</div>
                        </div>
                    </div>
                </List.Item>
            )}
        />
      </Card>

      {/* --- MODAL HIỂN THỊ DANH SÁCH CHI TIẾT --- */}
      <Modal
        title={
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 w-full">
                <div className="flex items-center gap-2 text-base sm:text-lg font-bold text-slate-800">
                    {modalConfig.type === 'BROKEN' ? <AlertOutlined className="text-red-500" /> : 
                     modalConfig.type === 'UPGRADE' ? <ToolOutlined className="text-indigo-500" /> :
                     <SafetyCertificateOutlined className="text-amber-500" />}
                    <span>{modalConfig.title}</span>
                </div>
                <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                    <Input
                        placeholder="Tìm tên máy..."
                        prefix={<SearchOutlined className="text-gray-400" />}
                        value={modalSearchText}
                        onChange={(e) => setModalSearchText(e.target.value)}
                        className="flex-1 sm:w-48"
                        allowClear
                    />
                    <Button 
                        type="primary" 
                        icon={<FileExcelOutlined />} 
                        onClick={exportToExcel}
                        className="bg-green-600 hover:!bg-green-700 border-none"
                    >
                        Xuất Excel
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
            <Button key="close" type="primary" onClick={() => {
                setModalConfig({ ...modalConfig, open: false });
                setModalSearchText('');
            }} className="rounded-lg px-6">
                Đóng
            </Button>
        }
        width="min(96vw, 950px)"
        closeIcon={false}
        className="custom-modal"
      >
        <div className="py-4 border-t border-gray-100">
            <Table 
                dataSource={getFilteredModalData()}
                columns={getModalColumns()}
                rowKey="id"
                scroll={{ x: 'max-content' }}
                pagination={{ pageSize: 6, position: ['bottomCenter'], showSizeChanger: false }}
                size="middle"
                className="border border-gray-100 rounded-lg overflow-hidden"
                rowClassName="hover:bg-slate-50 transition-colors"
                locale={{ emptyText: <Empty description="Không tìm thấy thiết bị nào" /> }}
            />
        </div>
      </Modal>

    </div>
  );
};

export default Dashboard;