import { useEffect, useState } from 'react';
import { Table, Button, Input, Tag, Space, Popconfirm, message, Tooltip, Badge } from 'antd';
import { 
  ReloadOutlined, PlusOutlined, EditOutlined, DeleteOutlined, 
  DesktopOutlined, WindowsOutlined, AuditOutlined, 
  LaptopOutlined, CloudServerOutlined, ToolOutlined, UserOutlined,
  FundProjectionScreenOutlined, GlobalOutlined 
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { io } from "socket.io-client"; 
import { assetService } from '../../services/assetService';
import AssetForm from './AssetForm';
import AssetSoftwareDrawer from './AssetSoftwareDrawer'; 
import AssetMaintenanceDrawer from './AssetMaintenanceDrawer'; 
import type { IAsset } from '../../types/itam.types';

// Kết nối tới Socket Server (Thay IP nếu deploy lên server thật)
const socket = io("http://localhost:3000"); 

const AssetList = () => {
  const [data, setData] = useState<IAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');

  // Các state cho Modal/Drawer
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<IAsset | null>(null);
  
  const [softwareDrawerOpen, setSoftwareDrawerOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<IAsset | null>(null);

  const [maintenanceDrawerOpen, setMaintenanceDrawerOpen] = useState(false);
  const [maintenanceAsset, setMaintenanceAsset] = useState<IAsset | null>(null);

  // Load dữ liệu
  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await assetService.getAll({
        page: 1,      
        limit: 1000, 
        search: searchText
      });
      
      const allAssets = res.data.data || [];
      const computingAssets = allAssets.filter((item: IAsset) => 
          ['PC', 'LAPTOP', 'SERVER'].includes(item.type?.code || '')
      );

      setData(computingAssets);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(); 
    socket.on("asset_updated", (payload: any) => {
        if (!searchText) {
            fetchData();
        }
    });
    return () => {
        socket.off("asset_updated");
    };
  }, [searchText]); 

  const handleDelete = async (id: string) => {
      try {
          await assetService.delete(id);
          message.success("Đã xóa thiết bị");
          fetchData();
      } catch (err: any) {
          message.error(err.response?.data?.message || "Không thể xóa");
      }
  }

  const handleViewSoftware = (asset: IAsset) => {
      setSelectedAsset(asset);
      setSoftwareDrawerOpen(true);
  };

  const handleOpenMaintenance = (asset: IAsset) => {
      setMaintenanceAsset(asset);
      setMaintenanceDrawerOpen(true);
  };

  const getDeviceIcon = (code?: string) => {
      if (code === 'LAPTOP') return <LaptopOutlined />;
      if (code === 'SERVER') return <CloudServerOutlined />;
      return <DesktopOutlined />;
  };

  const columns: ColumnsType<IAsset> = [
    {
      title: 'Thiết bị',
      key: 'info',
      width: 250,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <div className="font-bold text-blue-600 flex items-center gap-2 text-base">
             {getDeviceIcon(record.type?.code)} {record.name}
          </div>
          <div className="text-xs text-gray-600 font-semibold flex gap-2">
             <Tag bordered={false} className="mr-0">{record.type?.name}</Tag>
             <span>{record.manufacturer} {record.modelName}</span>
          </div>
          {record.serialNumber && (
            <div className="text-xs text-gray-400 copyable mt-1" title="Serial Number">
               SN: <span className="font-mono">{record.serialNumber}</span>
            </div>
          )}
        </Space>
      )
    },
    {
      title: 'Hệ thống',
      key: 'system',
      width: 220,
      render: (_, record) => (
         <div className="text-xs space-y-1">
            {record.osName && (
                <div className="flex items-center gap-1 text-gray-700">
                    <WindowsOutlined /> {record.osName} <span className="text-gray-400">{record.osVersion}</span>
                </div>
            )}
            <div className="flex flex-col text-gray-500 font-mono">
                {record.ipAddress && <span><GlobalOutlined /> IP: {record.ipAddress}</span>}
                {record.macAddress && <span className="ml-4 text-xs">MAC: {record.macAddress}</span>}
            </div>
            {record.domainUser && (
                <Tooltip title="User Domain đang đăng nhập">
                    <Tag color="purple" className="m-0 mt-1"><AuditOutlined /> {record.domainUser}</Tag>
                </Tooltip>
            )}
         </div>
      )
    },
    {
      title: 'Cấu hình',
      key: 'specs',
      width: 180,
      render: (_, record) => record.customSpecs ? (
         <div className="text-xs space-y-1">
            {record.customSpecs.cpu && <div className="truncate font-semibold" title={record.customSpecs.cpu}>CPU: {record.customSpecs.cpu}</div>}
            {record.customSpecs.ram && <div>RAM: <span className="text-green-600 font-bold">{record.customSpecs.ram}</span></div>}
            {record.customSpecs.disk && <div className="truncate text-gray-500" title={record.customSpecs.disk}>HDD: {record.customSpecs.disk}</div>}
            
            {record._count?.softwares ? (
                <div 
                    className="mt-1 cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => handleViewSoftware(record)} 
                >
                    <Badge count={record._count.softwares} overflowCount={999} style={{ backgroundColor: '#52c41a' }} /> 
                    <span className="ml-1 text-blue-600 underline">Xem apps đã cài</span>
                </div>
            ) : null}
         </div>
      ) : <span className="text-gray-400">-</span>
    },
    // [CẬP NHẬT] CỘT MÀN HÌNH (HIỂN THỊ KÍCH THƯỚC)
    {
      title: 'Màn hình',
      key: 'monitors',
      width: 220,
      render: (_, record) => {
          // Lọc component loại màn hình
          const monitors = record.components?.filter((c: any) => c.type === 'MONITOR') || [];
          
          if (monitors.length === 0) return <span className="text-gray-300 italic text-xs">Không có thông tin</span>;

          return (
              <div className="text-xs flex flex-col gap-2">
                  {monitors.map((m: any) => {
                      // [LOGIC MỚI] Lấy size từ specs (cột JSON)
                      // Ép kiểu 'any' để truy cập thuộc tính trong JSON
                      const specs: any = m.specs || {};
                      
                      // Kiểm tra xem có size không để hiển thị Tag
                      const sizeTag = specs.size && specs.size !== 'N/A' && specs.size !== 'Unknown' 
                          ? <Tag color="cyan" className="ml-1 text-[10px] py-0 px-1 leading-tight">{specs.size}</Tag> 
                          : null;

                      return (
                          <div key={m.id} className="flex items-start gap-2 p-1.5 bg-gray-50 rounded border border-gray-100 hover:bg-blue-50 transition-colors">
                              <FundProjectionScreenOutlined className="text-blue-500 mt-1 text-sm" />
                              <div className="overflow-hidden flex-1">
                                  <div className="flex items-center justify-between">
                                      <div className="font-semibold text-slate-700 truncate" title={m.name}>
                                          {m.name}
                                      </div>
                                      {/* Hiển thị Tag kích thước ở đây */}
                                      {sizeTag}
                                  </div>
                                  
                                  {m.serialNumber && m.serialNumber !== "0" && m.serialNumber !== "N/A" && (
                                      <div className="text-[10px] text-gray-400 font-mono truncate mt-0.5" title={m.serialNumber}>
                                          SN: {m.serialNumber}
                                      </div>
                                  )}
                              </div>
                          </div>
                      );
                  })}
                  
                  {monitors.length > 2 && (
                      <div className="text-right">
                          <Tag className="mr-0" color="processing">Tổng: {monitors.length} màn hình</Tag>
                      </div>
                  )}
              </div>
          );
      }
    },
    {
      title: 'Quản lý & Vị trí',
      key: 'management',
      width: 200,
      render: (_, record) => (
        <div className="text-xs">
           {(record.factory || record.department) && (
               <div className="mb-2 text-gray-700">
                   {record.factory && <div>🏭 {record.factory.name}</div>}
                   {record.department && <div className="ml-4">↳ 🏢 {record.department.name}</div>}
               </div>
           )}
           {record.users && record.users.length > 0 ? (
               <div className="flex flex-wrap gap-1">
                   {record.users.map((u) => (
                       <Tooltip key={u.id} title={`Email: ${u.email}`}>
                           <Tag color="cyan" icon={<UserOutlined />}>{u.fullName}</Tag>
                       </Tooltip>
                   ))}
               </div>
           ) : (
               <span className="text-gray-400 italic">Chưa bàn giao</span>
           )}
        </div>
      )
    },
    {
      title: 'Trạng thái',
      key: 'status',
      width: 110,
      align: 'center',
      render: (_, record) => (
         <div className="flex flex-col items-center gap-1">
            {(() => {
                const colors: Record<string, string> = { NEW: 'green', IN_USE: 'blue', BROKEN: 'red', REPAIR: 'orange', DISPOSED: 'default' };
                return <Tag color={colors[record.status] || 'default'}>{record.status}</Tag>
            })()}
            <div className="text-[10px] text-gray-400 mt-1">
               {record.lastSeen ? (
                   <Tooltip title={new Date(record.lastSeen).toLocaleString()}>
                       <span>🕒 {new Date(record.lastSeen).toLocaleDateString()}</span>
                   </Tooltip>
               ) : 'Offline'}
            </div>
         </div>
      )
    },
    {
      title: 'Action',
      key: 'action',
      width: 100,
      fixed: 'right',
      render: (_, record) => (
        <Space direction="horizontal" size="small">
          <Tooltip title="Lịch sử Sửa chữa / Nâng cấp">
              <Button 
                size="small" className="text-orange-600 hover:bg-orange-50 border-orange-200" icon={<ToolOutlined />} 
                onClick={() => handleOpenMaintenance(record)} 
              />
          </Tooltip>

          <Tooltip title="Chỉnh sửa thông tin">
            <Button 
                size="small" type="text" className="text-blue-600 hover:bg-blue-50" icon={<EditOutlined />} 
                onClick={() => { setEditingItem(record); setIsModalOpen(true); }} 
            />
          </Tooltip>
          
          <Popconfirm title="Xóa tài sản này?" onConfirm={() => handleDelete(record.id)}>
             <Button size="small" type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div className="p-4 bg-white shadow rounded-lg m-4 h-full flex flex-col">
      <div className="flex justify-between mb-4 flex-wrap gap-2">
         <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-slate-700 m-0">Máy tính & Server</h3>
            <Badge count={data.length} style={{ backgroundColor: '#1890ff' }} />
         </div>
         <Space>
            <Input.Search 
                placeholder="Tìm hostname, IP, serial..." 
                onSearch={val => setSearchText(val)} 
                style={{ width: 250 }} 
                allowClear 
                enterButton 
            />
            <Button icon={<ReloadOutlined />} onClick={() => fetchData()} />
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingItem(null); setIsModalOpen(true); }}>
                Thêm Máy tính
            </Button>
         </Space>
      </div>

      <Table 
         columns={columns} 
         dataSource={data} 
         rowKey="id" 
         loading={loading} 
         scroll={{ x: 1300 }} 
         pagination={{
             defaultPageSize: 10,
             showSizeChanger: true,
             showTotal: (total) => `Tổng ${total} thiết bị`
         }}
      />

      <AssetForm 
         open={isModalOpen} onCancel={() => setIsModalOpen(false)}
         onSuccess={() => { setIsModalOpen(false); fetchData(); }}
         initialValues={editingItem}
      />

      <AssetSoftwareDrawer 
         open={softwareDrawerOpen}
         asset={selectedAsset}
         onClose={() => setSoftwareDrawerOpen(false)}
      />

      <AssetMaintenanceDrawer
         open={maintenanceDrawerOpen}
         asset={maintenanceAsset}
         onClose={() => setMaintenanceDrawerOpen(false)}
      />
    </div>
  );
};

export default AssetList;