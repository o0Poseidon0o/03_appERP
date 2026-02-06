import { useEffect, useState } from 'react';
import { Card, Statistic, Spin, List, Typography, Tag, Empty, message, Modal, Table, Button } from 'antd';
import { 
  AppstoreOutlined, AlertOutlined, SafetyCertificateOutlined, 
  DisconnectOutlined, InfoCircleOutlined, ShopOutlined, EyeOutlined 
} from '@ant-design/icons';
import { 
  PieChart, Pie, Cell, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, 
  CartesianGrid, ResponsiveContainer, LabelList 
} from 'recharts';
import { io } from "socket.io-client";
import axiosClient from '../../api/axiosClient';

const { Title, Text } = Typography;
const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

const socket = io("http://localhost:3000"); 

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);

  // [MỚI] State quản lý Modal chi tiết
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
    socket.on("asset_updated", () => fetchStats());
    socket.on("hardware_alert", (data: any) => {
        message.warning(data.message);
        fetchStats();
    });
    return () => {
        socket.off("asset_updated");
        socket.off("hardware_alert");
    };
  }, []);

  // [MỚI] Hàm mở Modal xem danh sách
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

  // [MỚI] Cấu hình cột cho bảng trong Modal
  const getModalColumns = () => {
      const baseColumns = [
          { title: 'Tên máy', dataIndex: 'name', key: 'name', render: (t: string) => <b className="text-blue-600">{t}</b> },
          { title: 'Model', dataIndex: 'modelName', key: 'model' },
          { title: 'Người dùng', dataIndex: 'domainUser', key: 'user' },
          { title: 'Vị trí', dataIndex: ['factory', 'name'], key: 'factory' },
      ];

      if (modalConfig.type === 'LOW_RAM') {
          return [
              ...baseColumns,
              { 
                  title: 'RAM hiện tại', 
                  dataIndex: ['customSpecs', 'ram'], 
                  key: 'ram',
                  render: (t: string) => <Tag color="warning">{t}</Tag>
              }
          ];
      } else {
          return [
              ...baseColumns,
              { 
                  title: 'Trạng thái', 
                  dataIndex: 'status', 
                  key: 'status',
                  render: (s: string) => <Tag color="red">{s}</Tag>
              }
          ];
      }
  };

  if (loading) return <div className="flex justify-center items-center h-screen bg-slate-50"><Spin size="large" /></div>;

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <Title level={3} className="!mb-1 !text-slate-800">Tổng quan tài sản CNTT</Title>
          <Text type="secondary">Cập nhật dữ liệu thời gian thực</Text>
        </div>
        <Tag color="blue" className="px-3 py-1 text-sm rounded-full">Hôm nay: {new Date().toLocaleDateString('vi-VN')}</Tag>
      </div>

      {/* --- HÀNG 1: CARDS --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        
        {/* Card Tổng (Không click) */}
        <Card bordered={false} className="shadow-sm rounded-xl">
          <Statistic 
            title={<span className="text-slate-500 font-medium">Tổng tài sản</span>}
            value={stats?.cards?.total || 0} 
            prefix={<div className="p-2 bg-blue-100 rounded-lg mr-2"><AppstoreOutlined className="text-blue-600 text-xl" /></div>} 
            valueStyle={{ fontWeight: 'bold', color: '#1e293b' }}
          />
        </Card>

        {/* Card Hỏng (CLICKABLE) */}
        <Card 
            bordered={false} 
            className="shadow-sm rounded-xl cursor-pointer hover:shadow-lg hover:border-red-200 border border-transparent transition-all"
            onClick={() => showDetails('BROKEN')}
        >
          <div className="flex justify-between items-start">
              <Statistic 
                title={<span className="text-slate-500 font-medium">Hỏng / Sửa chữa</span>}
                value={stats?.cards?.broken || 0} 
                valueStyle={{ color: '#ef4444', fontWeight: 'bold' }}
                prefix={<div className="p-2 bg-red-100 rounded-lg mr-2"><AlertOutlined className="text-red-600 text-xl" /></div>} 
              />
              <EyeOutlined className="text-gray-300" />
          </div>
        </Card>

        {/* Card RAM Yếu (CLICKABLE) */}
        <Card 
            bordered={false} 
            className="shadow-sm rounded-xl cursor-pointer hover:shadow-lg hover:border-yellow-200 border border-transparent transition-all"
            onClick={() => showDetails('LOW_RAM')}
        >
          <div className="flex justify-between items-start">
              <Statistic 
                title={<span className="text-slate-500 font-medium">RAM &lt; 8GB</span>}
                value={stats?.cards?.lowRam || 0} 
                valueStyle={{ color: '#f59e0b', fontWeight: 'bold' }}
                prefix={<div className="p-2 bg-yellow-100 rounded-lg mr-2"><SafetyCertificateOutlined className="text-yellow-600 text-xl" /></div>} 
              />
              <EyeOutlined className="text-gray-300" />
          </div>
        </Card>

        {/* Card Offline */}
        <Card bordered={false} className="shadow-sm rounded-xl">
          <Statistic 
            title={<span className="text-slate-500 font-medium">Mất kết nối (&gt; 30 ngày)</span>}
            value={stats?.cards?.offline || 0} 
            valueStyle={{ color: '#64748b', fontWeight: 'bold' }}
            prefix={<div className="p-2 bg-gray-200 rounded-lg mr-2"><DisconnectOutlined className="text-gray-600 text-xl" /></div>} 
          />
        </Card>
      </div>

      {/* --- CÁC BIỂU ĐỒ GIỮ NGUYÊN NHƯ CŨ --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
         {/* Copy lại phần biểu đồ từ code cũ dán vào đây (để tiết kiệm không gian hiển thị) */}
         {/* Card 1: PieChart */}
         <Card title="Tỷ lệ trạng thái" bordered={false} className="shadow-sm rounded-xl h-96">
            {stats?.charts?.byStatus?.length > 0 ? (
                <div className="h-80 w-full"> 
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                    <Pie
                        data={stats?.charts?.byStatus}
                        cx="50%" cy="50%"
                        innerRadius={60} outerRadius={80}
                        fill="#8884d8"
                        paddingAngle={5}
                        dataKey="value"
                        label={({percent}) => `${(percent * 100).toFixed(0)}%`}
                    >
                        {stats?.charts?.byStatus.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom"/>
                    </PieChart>
                </ResponsiveContainer>
                </div>
            ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có dữ liệu" />}
        </Card>

        {/* Card 2: BarChart Type */}
        <Card title="Phân loại thiết bị" bordered={false} className="shadow-sm rounded-xl h-96">
            {stats?.charts?.byType?.length > 0 ? (
                <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats?.charts?.byType} margin={{ top: 20, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{fill: '#64748b', fontSize: 12}} />
                    <Tooltip cursor={{fill: '#f1f5f9'}} />
                    <Bar dataKey="value" name="Số lượng" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={30} />
                    </BarChart>
                </ResponsiveContainer>
                </div>
            ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có dữ liệu" />}
        </Card>

        {/* Card 3: BarChart Factory */}
        <Card title={<><ShopOutlined className="mr-2 text-indigo-500"/>PC/Laptop tại Nhà máy</>} bordered={false} className="shadow-sm rounded-xl h-96">
            {stats?.charts?.byFactory?.length > 0 ? (
                <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart layout="vertical" data={stats?.charts?.byFactory} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={100} tick={{fill: '#475569', fontWeight: 500}} />
                    <Tooltip cursor={{fill: '#f8fafc'}} />
                    <Bar dataKey="value" name="Số lượng" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={25}>
                        <LabelList dataKey="value" position="right" fill="#64748b" />
                    </Bar>
                    </BarChart>
                </ResponsiveContainer>
                </div>
            ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có dữ liệu Nhà máy" />}
        </Card>
      </div>

      {/* --- GỢI Ý HÀNH ĐỘNG (Giữ nguyên) --- */}
      <Card title={<><InfoCircleOutlined className="mr-2 text-blue-500"/>Gợi ý hành động quản trị</>} bordered={false} className="shadow-sm rounded-xl">
        <List
            grid={{ gutter: 16, column: 2, xs: 1 }}
            dataSource={[
                { title: 'Kiểm kê máy Offline', desc: `Có ${stats?.cards?.offline || 0} máy không gửi tín hiệu về Server quá 30 ngày.`, type: 'warning' },
                { title: 'Nâng cấp RAM', desc: `Phát hiện ${stats?.cards?.lowRam || 0} máy tính có RAM dưới 8GB.`, type: 'info' }
            ]}
            renderItem={item => (
                <List.Item>
                    <div className={`p-4 rounded-lg border-l-4 ${item.type === 'warning' ? 'bg-orange-50 border-orange-400' : 'bg-blue-50 border-blue-400'}`}>
                        <div className="font-bold text-slate-700 mb-1">{item.title}</div>
                        <div className="text-slate-600 text-sm">{item.desc}</div>
                    </div>
                </List.Item>
            )}
        />
      </Card>

      {/* --- [MỚI] MODAL HIỂN THỊ DANH SÁCH CHI TIẾT --- */}
      <Modal
        title={modalConfig.title}
        open={modalConfig.open}
        onCancel={() => setModalConfig({ ...modalConfig, open: false })}
        footer={[<Button key="close" onClick={() => setModalConfig({ ...modalConfig, open: false })}>Đóng</Button>]}
        width={800}
      >
        <Table 
            dataSource={modalConfig.data}
            columns={getModalColumns()}
            rowKey="id"
            pagination={{ pageSize: 5 }}
            size="small"
        />
      </Modal>

    </div>
  );
};

export default Dashboard;