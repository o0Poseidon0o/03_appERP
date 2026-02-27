import { useEffect, useState } from 'react';
import { Table, Button, Input, Tag, Space, Popconfirm, message, Tooltip, Badge, Popover } from 'antd';
import { 
  ReloadOutlined, PlusOutlined, EditOutlined, DeleteOutlined, 
  DesktopOutlined, WindowsOutlined, AuditOutlined, 
  LaptopOutlined, CloudServerOutlined, ToolOutlined, UserOutlined,
  FundProjectionScreenOutlined, GlobalOutlined, 
  ThunderboltOutlined, SearchOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

// Import hook từ Context
import { useSocket } from '../../contexts/SocketContext'; // Lưu ý: Đảm bảo đường dẫn này đúng với dự án của bạn (context hay contexts)

import { assetService } from '../../services/assetService';
import AssetForm from './AssetForm';
import AssetSoftwareDrawer from './AssetSoftwareDrawer'; 
import AssetMaintenanceDrawer from './AssetMaintenanceDrawer'; 
import type { IAsset } from '../../types/itam.types';
import { useHasPermission } from '../../hooks/useHasPermission';

// Định nghĩa interface customSpecs
interface AssetSpecs {
  cpu?: string;
  ram?: string;
  disk?: string;
  lastAgentSync?: string;
  ramDetails?: Array<{
    Slot: string;
    Capacity: string;
    Speed: string;
    Manufacturer: string;
  }>;
  gpus?: Array<{
    Name: string;
    VRAM: string;
    DriverVersion: string;
  }>;
}

const AssetList = () => {
  const [data, setData] = useState<IAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const { hasPermission } = useHasPermission();

  // LẤY socket từ Context
  const { socket, isConnected } = useSocket(); 

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<IAsset | null>(null);
  
  const [softwareDrawerOpen, setSoftwareDrawerOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<IAsset | null>(null);
  const [maintenanceDrawerOpen, setMaintenanceDrawerOpen] = useState(false);
  const [maintenanceAsset, setMaintenanceAsset] = useState<IAsset | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Gửi searchText lên Backend
      const res = await assetService.getAll({ page: 1, limit: 1000, search: searchText });
      const allAssets = res.data.data || [];
      const computingAssets = allAssets.filter((item: IAsset) => 
          ['PC', 'LAPTOP', 'SERVER'].includes(item.type?.code || '')
      );
      setData(computingAssets);
    } catch (error) { 
      console.error(error); 
      message.error("Lỗi tải dữ liệu");
    } finally { 
      setLoading(false); 
    }
  };

  // Lắng nghe thay đổi Socket
  useEffect(() => {
    fetchData(); 
    
    if (socket && isConnected) {
        const handleUpdate = () => {
            if (!searchText) fetchData();
        };

        socket.on("asset_updated", handleUpdate);
        return () => { 
            socket.off("asset_updated", handleUpdate); 
        };
    }
  }, [socket, isConnected]); // Bỏ searchText khỏi dependency để tránh fetch liên tục khi gõ

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
      if (code === 'LAPTOP') return <LaptopOutlined className="text-lg" />;
      if (code === 'SERVER') return <CloudServerOutlined className="text-lg" />;
      return <DesktopOutlined className="text-lg" />;
  };

  const columns: ColumnsType<IAsset> = [
    {
      title: 'Thiết bị',
      key: 'info',
      width: 260,
      fixed: 'left', // Giữ cột này khi cuộn ngang trên điện thoại
      render: (_, record) => {
        let shortTypeName = record.type?.name || 'Unknown';
        const code = record.type?.code;
        if (code === 'PC') shortTypeName = 'PC';
        else if (code === 'LAPTOP') shortTypeName = 'Laptop';
        else if (code === 'SERVER') shortTypeName = 'Server';

        return (
            <div className="flex flex-col gap-1.5">
              <div className="font-bold text-blue-700 flex items-center gap-2 text-sm truncate">
                 {getDeviceIcon(record.type?.code)} 
                 <span className="truncate" title={record.name}>{record.name}</span>
              </div>
              <div className="text-xs text-gray-500 flex items-center gap-2">
                 <Tag color="cyan" bordered={false} className="m-0 leading-none py-0.5 px-1.5 text-[10px]">{shortTypeName}</Tag>
                 <span className="truncate max-w-[140px]" title={`${record.manufacturer} ${record.modelName}`}>
                    {record.manufacturer} {record.modelName}
                 </span>
              </div>
              {record.serialNumber && <div className="text-[11px] text-gray-400 font-mono">SN: {record.serialNumber}</div>}
            </div>
        );
      }
    },
    {
        title: 'Mạng & Hệ điều hành',
        key: 'system',
        width: 220,
        render: (_, record) => (
            <div className="text-xs space-y-2">
              {record.osName && (
                  <div className="flex items-center gap-1.5 text-slate-700 font-medium truncate bg-slate-50 px-2 py-1 rounded" title={record.osName}>
                      <WindowsOutlined className="text-blue-500" /> {record.osName} 
                  </div>
              )}
              <div className="flex flex-col text-slate-500 font-mono gap-1">
                  {record.ipAddress && <span className="flex items-center gap-1.5"><GlobalOutlined className="text-green-500"/> {record.ipAddress}</span>}
                  {record.macAddress && <span className="ml-5 text-[10px] text-gray-400">MAC: {record.macAddress}</span>}
              </div>
              {record.domainUser && (
                  <Tooltip title="User Domain đang đăng nhập">
                      <Tag color="purple" bordered={false} className="m-0 mt-1 w-max text-center truncate"><AuditOutlined /> {record.domainUser}</Tag>
                  </Tooltip>
              )}
            </div>
        )
    },
    {
      title: 'Cấu hình phần cứng',
      key: 'specs',
      width: 250,
      render: (_, record) => {
          if (!record.customSpecs) return <span className="text-gray-300 italic text-xs">Chưa có thông tin</span>;
          
          const specs = record.customSpecs as AssetSpecs;
          const { cpu, ram, disk, ramDetails, gpus } = specs;

          const ramContent = (
              <div className="text-xs min-w-[200px]">
                  <div className="font-bold border-b mb-2 pb-1 text-blue-600">Chi tiết RAM ({ram})</div>
                  {Array.isArray(ramDetails) && ramDetails.length > 0 ? ramDetails.map((r: any, idx: number) => (
                      <div key={idx} className="mb-1 text-slate-600 flex justify-between">
                          <span>Slot {r.Slot}: <b>{r.Capacity}</b></span>
                          <span className="text-gray-400">({r.Speed}) - {r.Manufacturer}</span>
                      </div>
                  )) : <div className="text-gray-400 italic">Không có thông tin chi tiết</div>}
              </div>
          );

          const gpuContent = (
              <div className="text-xs min-w-[200px]">
                  <div className="font-bold border-b mb-2 pb-1 text-orange-600">Card Đồ họa (GPU)</div>
                  {Array.isArray(gpus) && gpus.length > 0 ? gpus.map((g: any, idx: number) => (
                      <div key={idx} className="mb-1 text-slate-600">
                          <div className="font-medium">{g.Name}</div>
                          <div className="text-gray-400">VRAM: {g.VRAM} | Driver: {g.DriverVersion}</div>
                      </div>
                  )) : <div className="text-gray-400 italic">Onboard / Không xác định</div>}
              </div>
          );

          return (
             <div className="text-xs space-y-2">
                {cpu && <div className="truncate font-semibold text-slate-700 bg-slate-100 px-2 py-1 rounded" title={cpu}>CPU: {cpu}</div>}
                
                <div className="flex items-center gap-2">
                    <Popover content={ramContent} title={null} placement="right">
                        <Tag color="blue" bordered={false} className="cursor-help m-0 hover:opacity-80 transition-opacity">RAM: {ram}</Tag>
                    </Popover>
                    {Array.isArray(gpus) && gpus.length > 0 && (
                        <Popover content={gpuContent} title={null} placement="right">
                            <Tag color="volcano" bordered={false} className="cursor-help m-0 hover:opacity-80 transition-opacity">Có GPU rời</Tag>
                        </Popover>
                    )}
                </div>

                {disk && <div className="truncate text-slate-500 flex items-center gap-1.5" title={disk}><span>💾</span> {disk}</div>}
                
                {record._count?.softwares ? (
                    <div 
                        className="inline-flex items-center gap-1.5 cursor-pointer bg-green-50 text-green-700 px-2 py-1 rounded hover:bg-green-100 transition-colors border border-green-200" 
                        onClick={() => handleViewSoftware(record)}
                    >
                        <Badge count={record._count.softwares} overflowCount={999} color="#52c41a" size="small" /> 
                        <span className="font-medium text-[11px]">Phần mềm đã cài</span>
                    </div>
                ) : null}
             </div>
          );
      }
    },
    {
      title: 'Màn hình & Ngoại vi',
      key: 'components',
      width: 250,
      render: (_, record) => {
          const comps = record.components || [];
          const monitors = comps.filter((c: any) => c.type === 'MONITOR');
          const peripherals = comps.filter((c: any) => ['MOUSE', 'KEYBOARD'].includes(c.type));

          if (monitors.length === 0 && peripherals.length === 0) return <span className="text-gray-300 italic text-xs">Không có thiết bị đi kèm</span>;

          return (
              <div className="text-xs flex flex-col gap-1.5">
                  {monitors.length > 0 && (
                      <div className="bg-blue-50/60 p-2 rounded-md border border-blue-100 space-y-1">
                          {monitors.map((m: any) => {
                              const specs: any = m.specs || {};
                              return (
                                  <div key={m.id} className="flex items-center gap-2">
                                      <FundProjectionScreenOutlined className="text-blue-500" />
                                      <span className="truncate flex-1 font-medium text-slate-700" title={m.name}>{m.name}</span>
                                      {specs.size && specs.size !== 'N/A' && <span className="text-[10px] bg-white text-gray-500 px-1 border rounded">{specs.size}</span>}
                                  </div>
                              );
                          })}
                      </div>
                  )}

                  {peripherals.length > 0 && (
                      <div className="pt-1 space-y-1">
                          {peripherals.map((p: any) => {
                              const isMouse = p.type === 'MOUSE';
                              const specs: any = p.specs || {};
                              const icon = isMouse ? <span title="Chuột">🖱️</span> : <span title="Bàn phím">⌨️</span>;
                              
                              return (
                                  <div key={p.id} className="flex items-center gap-2 text-slate-600 pl-1">
                                      {icon}
                                      <span className="truncate" title={p.name}>
                                          {specs.brand && specs.brand !== 'Unknown' ? <b className="text-slate-800">{specs.brand}</b> : ''} {p.name.replace(specs.brand, '').replace('Device', '').trim()}
                                      </span>
                                      {specs.connection && specs.connection.includes('Bluetooth') && <ThunderboltOutlined className="text-blue-500" title="Bluetooth" />}
                                  </div>
                              );
                          })}
                      </div>
                  )}
              </div>
          );
      }
    },
    {
        title: 'Người dùng & Vị trí',
        key: 'management',
        width: 200,
        render: (_, record) => (
            <div className="text-xs space-y-2">
                {record.users && record.users.length > 0 ? (
                    <div className="flex flex-col gap-1.5">
                        {record.users.map((u) => (
                            <Tooltip key={u.id} title={`Email: ${u.email}`}>
                                <div className="flex items-center gap-1.5 bg-blue-50 text-blue-700 px-2 py-1 rounded border border-blue-100">
                                    <UserOutlined />
                                    <span className="truncate font-medium">{u.fullName}</span>
                                </div>
                            </Tooltip>
                        ))}
                    </div>
                ) : (
                    <Tag color="default" className="m-0 border-dashed text-gray-400">Chưa cấp phát</Tag>
                )}

                {(record.factory || record.department) && (
                    <div className="bg-amber-50/80 p-2 rounded-md border border-amber-100 text-amber-800">
                        {record.factory && <div className="font-semibold truncate flex items-center gap-1.5"><span>🏭</span> {record.factory.name}</div>}
                        {record.department && <div className="mt-1 truncate text-[11px] text-amber-700/80 flex items-center gap-1.5"><span>🏢</span> {record.department.name}</div>}
                    </div>
                )}
            </div>
        )
    },
    {
      title: 'Trạng thái',
      key: 'status',
      width: 120,
      align: 'center',
      render: (_, record) => (
         <div className="flex flex-col items-center gap-2">
            {(() => {
                const colors: Record<string, string> = { NEW: 'success', IN_USE: 'processing', BROKEN: 'error', REPAIR: 'warning', DISPOSED: 'default' };
                const textMap: Record<string, string> = { NEW: 'Mới', IN_USE: 'Đang dùng', BROKEN: 'Hỏng', REPAIR: 'Sửa chữa', DISPOSED: 'Thanh lý' };
                return <Badge status={colors[record.status] as any} text={<span className="font-semibold text-xs text-slate-700">{textMap[record.status] || record.status}</span>} />
            })()}
            <div className="text-[10px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full w-max">
               {record.lastSeen ? <Tooltip title={new Date(record.lastSeen).toLocaleString()}><span>{new Date(record.lastSeen).toLocaleDateString('vi-VN')}</span></Tooltip> : 'Offline'}
            </div>
         </div>
      )
    },
    {
      title: 'Thao tác',
      key: 'action',
      width: 100,
      fixed: 'right', // Cố định bên phải trên màn hình nhỏ
      align: 'center',
      render: (_, record) => (
        <div className="flex flex-col gap-2 items-center">
          {hasPermission('ITAM_MAINTENANCE') && (
              <Tooltip title="Bảo trì / Sửa chữa">
                  <Button size="small" type="dashed" className="w-full text-orange-500 border-orange-200 hover:bg-orange-50 flex justify-center items-center" icon={<ToolOutlined />} onClick={() => handleOpenMaintenance(record)} />
              </Tooltip>
          )}
          <Space size="small">
              {hasPermission('ITAM_ASSET_UPDATE') && (
                  <Tooltip title="Chỉnh sửa">
                      <Button size="small" type="text" className="text-blue-600 hover:bg-blue-50" icon={<EditOutlined />} onClick={() => { setEditingItem(record); setIsModalOpen(true); }} />
                  </Tooltip>
              )}
              {hasPermission('ITAM_ASSET_DELETE') && (
                  <Tooltip title="Xóa">
                      <Popconfirm title="Xóa thiết bị này?" description="Hành động này không thể hoàn tác." onConfirm={() => handleDelete(record.id)}>
                          <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                      </Popconfirm>
                  </Tooltip>
              )}
          </Space>
        </div>
      )
    }
  ];

  return (
    // Xóa p-4, m-4, shadow, bg-white ở thẻ ngoài cùng để nó vừa khít với MainLayout
    <div className="h-full flex flex-col">
      
      {/* HEADER SECTION - Tối ưu cho Mobile & PC */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-4">
         <div className="flex items-center gap-3">
            <div className="bg-blue-50 p-2 rounded-lg border border-blue-100">
                <DesktopOutlined className="text-blue-600 text-xl" />
            </div>
            <div>
                <h2 className="text-lg font-bold text-slate-800 m-0 leading-none">Máy tính & Server</h2>
                <div className="flex items-center gap-2 mt-1.5">
                    <Badge status={isConnected ? "success" : "default"} />
                    <span className="text-xs text-gray-500">{isConnected ? "Kết nối Realtime" : "Mất kết nối"}</span>
                    <span className="text-gray-300 text-xs">|</span>
                    <span className="text-xs text-slate-500 font-medium">Tổng: {data.length} thiết bị</span>
                </div>
            </div>
         </div>
         
         <div className="flex flex-col sm:flex-row w-full lg:w-auto gap-3">
            {/* Thanh tìm kiếm */}
            <Input
                placeholder="Tìm tên máy, IP, người dùng..." 
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                onPressEnter={() => fetchData()} 
                prefix={<SearchOutlined className="text-gray-400" />}
                className="w-full sm:w-72"
                allowClear
            />
            
            <div className="flex gap-2 w-full sm:w-auto">
                <Tooltip title="Tải lại dữ liệu">
                    <Button 
                        icon={<ReloadOutlined />} 
                        onClick={() => fetchData()} 
                        className="flex-shrink-0"
                    />
                </Tooltip>
                
                {hasPermission('ITAM_ASSET_CREATE') && (
                    <Button 
                        type="primary" 
                        icon={<PlusOutlined />} 
                        onClick={() => { setEditingItem(null); setIsModalOpen(true); }}
                        className="flex-1 sm:flex-none"
                    >
                        Thêm thiết bị
                    </Button>
                )}
            </div>
         </div>
      </div>

      {/* TABLE SECTION */}
      <div className="flex-1 pb-4">
          <Table 
            columns={columns} 
            dataSource={data} 
            rowKey="id" 
            loading={loading} 
            // [SỬA 2]: Tăng số trừ đi (từ 280px lên 340px) để chừa chỗ cho Pagination và Header
            scroll={{ x: 1300, y: 'calc(100vh - 340px)' }} 
            pagination={{ 
                defaultPageSize: 20, 
                showSizeChanger: true, 
                showTotal: (total) => <span className="font-medium text-blue-600">Tổng số {total} thiết bị</span>,
                // [SỬA 3]: Thêm margin cho pagination để nó tách biệt rõ ràng
                style: { marginTop: '16px', marginBottom: '0px' } 
            }}
            size="small"
            className="ant-table-striped"
            rowClassName={() => "hover:bg-slate-50/80 transition-colors"}
          />
      </div>

      {/* MODALS & DRAWERS */}
      <AssetForm open={isModalOpen} onCancel={() => setIsModalOpen(false)} onSuccess={() => { setIsModalOpen(false); fetchData(); }} initialValues={editingItem} />
      <AssetSoftwareDrawer open={softwareDrawerOpen} asset={selectedAsset} onClose={() => setSoftwareDrawerOpen(false)} />
      <AssetMaintenanceDrawer open={maintenanceDrawerOpen} asset={maintenanceAsset} onClose={() => setMaintenanceDrawerOpen(false)} />
    </div>
  );
};

export default AssetList;