import { useEffect, useState } from 'react';
import { Card, Statistic, Spin, List, Typography, Tag, Empty, message, Modal, Table, Button, Badge } from 'antd';
import { 
  AppstoreOutlined, AlertOutlined, SafetyCertificateOutlined, 
  DisconnectOutlined, InfoCircleOutlined, ShopOutlined, EyeOutlined,
  LaptopOutlined, ApiOutlined, UserOutlined, DownloadOutlined
} from '@ant-design/icons';
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

  const [modalConfig, setModalConfig] = useState<{ open: boolean, title: string, data: any[], type: 'BROKEN' | 'LOW_RAM' | null }>({
      open: false, title: '', data: [], type: null
  });

  const fetchStats = async () => {
    try {
      const res = await axiosClient.get('/dashboard/stats');
      setStats(res.data.data);
    } catch (error) {
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

  const showDetails = (type: 'BROKEN' | 'LOW_RAM') => {
      if (type === 'BROKEN') {
          setModalConfig({
              open: true,
              title: 'Danh sách thiết bị Đang hỏng / Sửa chữa',
              data: stats?.lists?.broken || [],
              type: 'BROKEN'
          });
      } else {
          setModalConfig({
              open: true,
              title: 'Danh sách thiết bị cấu hình yếu (RAM < 8GB)',
              data: stats?.lists?.lowRam || [],
              type: 'LOW_RAM'
          });
      }
  };

  // --- Hàm Xuất File Excel (CSV) Tách Cột Chuẩn ---
  const exportToCSV = () => {
      if (!modalConfig.data || modalConfig.data.length === 0) {
          message.warning("Không có dữ liệu để xuất");
          return;
      }

      // Tạo tiêu đề cột (Tách Người dùng và Phòng ban thành 2 cột, Vị trí máy và Nhà máy thành 2 cột cho dễ nhìn trong Excel)
      const headers = ["Tên máy", "Model", "Người dùng", "Phòng ban User", "Vị trí máy", "Nhà máy", "RAM", "Trạng thái"];
      
      // Tạo dữ liệu từng dòng
      const rows = modalConfig.data.map((item: any) => {
          // Lấy tên User
          const users = item.users?.map((u: any) => u.fullName).join(" & ") || "Chưa cấp phát";
          
          // Lấy phòng ban của User (Nếu có nhiều user dùng chung 1 máy thì nối lại)
          const userDepartments = item.users?.map((u: any) => u.department?.name || "Không rõ").join(" & ") || "-";
          
          // Thông tin thiết bị
          const assetDepartment = item.department?.name || "Chưa gán";
          const factory = item.factory?.name || "Chưa gán";
          const ram = item.customSpecs?.ram || "N/A";
          
          const statusMap: any = { BROKEN: 'Hỏng', REPAIR: 'Đang sửa chữa', NEW: 'Mới', IN_USE: 'Đang dùng' };
          const status = statusMap[item.status] || item.status;

          return [
              `"${item.name}"`,
              `"${item.modelName || ''}"`,
              `"${users}"`,
              `"${userDepartments}"`, // Cột phòng ban của User
              `"${assetDepartment}"`, // Cột phòng ban đặt máy
              `"${factory}"`,         // Cột nhà máy
              `"${ram}"`,
              `"${status}"`
          ].join(",");
      });

      const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...rows].join("\n");
      
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      
      const dateStr = new Date().toISOString().slice(0,10);
      const fileName = modalConfig.type === 'LOW_RAM' ? `DS_May_Tinh_RAM_Yeu_${dateStr}.csv` : `DS_May_Tinh_Hong_${dateStr}.csv`;
      link.setAttribute("download", fileName);
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      message.success("Xuất file thành công!");
  };

  const getModalColumns = () => {
      const baseColumns: any = [
          { title: 'Tên máy', dataIndex: 'name', key: 'name', width: 140, render: (t: string) => <span className="font-semibold text-blue-700">{t}</span> },
          { title: 'Model', dataIndex: 'modelName', key: 'model', width: 160, render: (t: string) => <span className="text-gray-600 text-xs">{t || 'N/A'}</span> },
          { 
              title: 'Người dùng & Phòng ban', 
              key: 'users',
              width: 250, 
              // Sắp xếp theo tên phòng ban của User đầu tiên
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
              // Sắp xếp theo tên phòng ban của Máy
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
                  // Hỗ trợ sắp xếp theo dung lượng RAM
                  sorter: (a: any, b: any) => {
                      const ramA = parseInt(a.customSpecs?.ram?.replace(/\D/g, '') || '0');
                      const ramB = parseInt(b.customSpecs?.ram?.replace(/\D/g, '') || '0');
                      return ramA - ramB;
                  },
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

        {/* Card Offline */}
        <Card bordered={false} className="shadow-sm rounded-2xl border border-gray-100 flex flex-col justify-between">
          <div>
              <div className="flex justify-between items-start mb-4">
                  <span className="text-slate-500 font-semibold uppercase tracking-wider text-xs">Mất kết nối (&gt; 30 ngày)</span>
                  <div className="p-2 bg-slate-100 rounded-xl"><DisconnectOutlined className="text-slate-500 text-xl" /></div>
              </div>
              <div className="text-3xl font-bold text-slate-600 mb-2">{stats?.cards?.offline || 0}</div>
          </div>
          <div className="mt-auto pt-4 flex items-center text-xs text-slate-400">
              Thiết bị không gửi log về máy chủ
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
                    title: 'Đề xuất nâng cấp RAM', 
                    desc: `Hệ thống ghi nhận ${stats?.cards?.lowRam || 0} máy tính có dung lượng RAM dưới 8GB. Điều này có thể ảnh hưởng đến hiệu suất làm việc của nhân viên.`, 
                    type: 'info',
                    action: 'Lên kế hoạch'
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
            <div className="flex justify-between items-center w-full pr-8">
                <div className="flex items-center gap-2 text-lg font-bold text-slate-800">
                    {modalConfig.type === 'BROKEN' ? <AlertOutlined className="text-red-500" /> : <SafetyCertificateOutlined className="text-amber-500" />}
                    {modalConfig.title}
                </div>
                <Button 
                    type="dashed" 
                    icon={<DownloadOutlined />} 
                    onClick={exportToCSV}
                    className="border-blue-200 text-blue-600 hover:bg-blue-50"
                >
                    Xuất CSV
                </Button>
            </div>
        }
        open={modalConfig.open}
        onCancel={() => setModalConfig({ ...modalConfig, open: false })}
        footer={
            <Button key="close" type="primary" onClick={() => setModalConfig({ ...modalConfig, open: false })} className="rounded-lg px-6">
                Đóng
            </Button>
        }
        width={950}
        closeIcon={false}
        className="custom-modal"
      >
        <div className="py-4 border-t border-gray-100">
            <Table 
                dataSource={modalConfig.data}
                columns={getModalColumns()}
                rowKey="id"
                pagination={{ pageSize: 6, position: ['bottomCenter'], showSizeChanger: false }}
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