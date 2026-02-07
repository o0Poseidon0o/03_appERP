import { useEffect, useState } from 'react';
import { Table, Button, Input, Tag, Space, Popconfirm, message, Tooltip, Badge, Popover } from 'antd';
import { 
  ReloadOutlined, PlusOutlined, EditOutlined, DeleteOutlined, 
  DesktopOutlined, WindowsOutlined, AuditOutlined, 
  LaptopOutlined, CloudServerOutlined, ToolOutlined, UserOutlined,
  FundProjectionScreenOutlined, GlobalOutlined, 
  ThunderboltOutlined 
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { io } from "socket.io-client"; 
import { assetService } from '../../services/assetService';
import AssetForm from './AssetForm';
import AssetSoftwareDrawer from './AssetSoftwareDrawer'; 
import AssetMaintenanceDrawer from './AssetMaintenanceDrawer'; 
import type { IAsset } from '../../types/itam.types';
import { useHasPermission } from '../../hooks/useHasPermission';

const socket = io("http://localhost:3000"); 

// [FIX TS2339] Định nghĩa lại interface customSpecs
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

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<IAsset | null>(null);
  
  // State quản lý Drawer
  const [softwareDrawerOpen, setSoftwareDrawerOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<IAsset | null>(null);
  const [maintenanceDrawerOpen, setMaintenanceDrawerOpen] = useState(false);
  const [maintenanceAsset, setMaintenanceAsset] = useState<IAsset | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await assetService.getAll({ page: 1, limit: 1000, search: searchText });
      const allAssets = res.data.data || [];
      const computingAssets = allAssets.filter((item: IAsset) => 
          ['PC', 'LAPTOP', 'SERVER'].includes(item.type?.code || '')
      );
      setData(computingAssets);
    } catch (error) { console.error(error); } 
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchData(); 
    socket.on("asset_updated", () => !searchText && fetchData());
    return () => { socket.off("asset_updated"); };
  }, [searchText]); 

  const handleDelete = async (id: string) => {
      try {
          await assetService.delete(id);
          message.success("Đã xóa thiết bị");
          fetchData();
      } catch (err: any) { message.error(err.response?.data?.message || "Không thể xóa"); }
  }

  // Hàm mở xem phần mềm
  const handleViewSoftware = (asset: IAsset) => {
      setSelectedAsset(asset);
      setSoftwareDrawerOpen(true);
  };

  // Hàm mở bảo trì
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
      width: 220,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <div className="font-bold text-blue-600 flex items-center gap-2 text-base">
             {getDeviceIcon(record.type?.code)} {record.name}
          </div>
          <div className="text-xs text-gray-600 font-semibold flex gap-2">
             <Tag bordered={false} className="mr-0">{record.type?.name}</Tag>
             <span>{record.manufacturer} {record.modelName}</span>
          </div>
          {record.serialNumber && <div className="text-xs text-gray-400 font-mono mt-1">SN: {record.serialNumber}</div>}
        </Space>
      )
    },
    // --- [CỘT HỆ THỐNG: BỎ VERSION, GIỮ MAC] ---
    {
        title: 'Hệ thống',
        key: 'system',
        width: 200,
        render: (_, record) => (
           <div className="text-xs space-y-1">
              {record.osName && (
                  <div className="flex items-center gap-1 text-gray-700">
                      <WindowsOutlined /> {record.osName} 
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
    // --- [CỘT CẤU HÌNH: RAM/GPU CHI TIẾT + NÚT XEM APPS] ---
    {
      title: 'Cấu hình (CPU/RAM/GPU)',
      key: 'specs',
      width: 220,
      render: (_, record) => {
          if (!record.customSpecs) return <span className="text-gray-400">-</span>;
          
          // Cast kiểu dữ liệu để hết lỗi TS2339
          const specs = record.customSpecs as AssetSpecs;
          const { cpu, ram, disk, ramDetails, gpus } = specs;

          const ramContent = (
              <div className="text-xs">
                  <div className="font-bold border-b mb-1 pb-1">Chi tiết RAM ({ram})</div>
                  {Array.isArray(ramDetails) && ramDetails.length > 0 ? ramDetails.map((r: any, idx: number) => (
                      <div key={idx} className="mb-1">Slot {r.Slot}: <b>{r.Capacity}</b> ({r.Speed}) - {r.Manufacturer}</div>
                  )) : "Không có thông tin chi tiết"}
              </div>
          );

          const gpuContent = (
              <div className="text-xs">
                  <div className="font-bold border-b mb-1 pb-1">Card Đồ họa (GPU)</div>
                  {Array.isArray(gpus) && gpus.length > 0 ? gpus.map((g: any, idx: number) => (
                      <div key={idx} className="mb-1">- {g.Name} (VRAM: {g.VRAM})</div>
                  )) : "Onboard / Không có thông tin"}
              </div>
          );

          return (
             <div className="text-xs space-y-1">
                {cpu && <div className="truncate font-semibold" title={cpu}>CPU: {cpu}</div>}
                
                <div className="flex items-center gap-2">
                    <Popover content={ramContent} title={null}>
                        <Tag color="geekblue" className="cursor-help m-0">RAM: {ram}</Tag>
                    </Popover>
                    {Array.isArray(gpus) && gpus.length > 0 && (
                        <Popover content={gpuContent} title={null}>
                            <Tag color="orange" className="cursor-help m-0">GPU</Tag>
                        </Popover>
                    )}
                </div>

                {disk && <div className="truncate text-gray-500" title={disk}>HDD: {disk}</div>}
                
                {/* Link xem phần mềm */}
                {record._count?.softwares ? (
                    <div className="mt-1 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => handleViewSoftware(record)}>
                        <Badge count={record._count.softwares} overflowCount={999} style={{ backgroundColor: '#52c41a' }} /> 
                        <span className="ml-1 text-blue-600 underline">Xem apps đã cài</span>
                    </div>
                ) : null}
             </div>
          );
      }
    },
    // --- [CỘT NGOẠI VI: MÀN HÌNH + CHUỘT + PHÍM] ---
    {
      title: 'Ngoại vi & Màn hình',
      key: 'components',
      width: 250,
      render: (_, record) => {
          const comps = record.components || [];
          const monitors = comps.filter((c: any) => c.type === 'MONITOR');
          const peripherals = comps.filter((c: any) => ['MOUSE', 'KEYBOARD'].includes(c.type));

          if (monitors.length === 0 && peripherals.length === 0) return <span className="text-gray-300 italic text-xs">-</span>;

          return (
              <div className="text-xs flex flex-col gap-2">
                  {monitors.map((m: any) => {
                      const specs: any = m.specs || {};
                      return (
                          <div key={m.id} className="flex items-center gap-2">
                              <FundProjectionScreenOutlined className="text-blue-500" />
                              <span className="truncate flex-1 font-medium" title={m.name}>{m.name}</span>
                              {specs.size && specs.size !== 'N/A' && <Tag className="m-0 text-[10px]">{specs.size}</Tag>}
                          </div>
                      );
                  })}

                  {peripherals.length > 0 && (
                      <div className="mt-1 pt-1 border-t border-dashed border-gray-200">
                          {peripherals.map((p: any) => {
                              const isMouse = p.type === 'MOUSE';
                              const specs: any = p.specs || {};
                              const icon = isMouse ? <span title="Chuột">🖱️</span> : <span title="Bàn phím">⌨️</span>;
                              
                              return (
                                  <div key={p.id} className="flex items-center gap-2 text-gray-600 mt-1">
                                      {icon}
                                      <span className="truncate" title={p.name}>
                                          {specs.brand && specs.brand !== 'Unknown' ? <b className="text-slate-700">{specs.brand}</b> : ''} {p.name.replace(specs.brand, '').replace('Device', '').trim()}
                                      </span>
                                      {specs.connection && specs.connection.includes('Bluetooth') && <ThunderboltOutlined className="text-blue-400" title="Bluetooth" />}
                                  </div>
                              );
                          })}
                      </div>
                  )}
              </div>
          );
      }
    },
    // --- [CÁC CỘT KHÁC GIỮ NGUYÊN] ---
    {
        title: 'Quản lý',
        key: 'management',
        width: 180,
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
                        <Tooltip key={u.id} title={`Email: ${u.email}`}><Tag color="cyan" icon={<UserOutlined />}>{u.fullName}</Tag></Tooltip>
                    ))}
                </div>
            ) : <span className="text-gray-400 italic">Chưa bàn giao</span>}
            </div>
        )
    },
    {
      title: 'Trạng thái',
      key: 'status',
      width: 100,
      align: 'center',
      render: (_, record) => (
         <div className="flex flex-col items-center gap-1">
            {(() => {
                const colors: Record<string, string> = { NEW: 'green', IN_USE: 'blue', BROKEN: 'red', REPAIR: 'orange', DISPOSED: 'default' };
                return <Tag color={colors[record.status] || 'default'}>{record.status}</Tag>
            })()}
            <div className="text-[10px] text-gray-400 mt-1">
               {record.lastSeen ? <Tooltip title={new Date(record.lastSeen).toLocaleString()}><span>🕒 {new Date(record.lastSeen).toLocaleDateString()}</span></Tooltip> : 'Offline'}
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
        <Space size="small">
          {hasPermission('ITAM_MAINTENANCE') && <Button size="small" icon={<ToolOutlined />} onClick={() => handleOpenMaintenance(record)} />}
          {hasPermission('ITAM_ASSET_UPDATE') && <Button size="small" icon={<EditOutlined />} onClick={() => { setEditingItem(record); setIsModalOpen(true); }} />}
          {hasPermission('ITAM_ASSET_DELETE') && <Popconfirm title="Xóa?" onConfirm={() => handleDelete(record.id)}><Button size="small" danger icon={<DeleteOutlined />} /></Popconfirm>}
        </Space>
      )
    }
  ];

  return (
    <div className="p-4 bg-white shadow rounded-lg m-4 h-full flex flex-col">
      <div className="flex justify-between mb-4">
         <div className="flex items-center gap-2"><h3 className="text-lg font-bold m-0">Máy tính & Server</h3><Badge count={data.length} style={{ backgroundColor: '#1890ff' }} /></div>
         <Space>
            <Input.Search placeholder="Tìm kiếm..." onSearch={setSearchText} style={{ width: 250 }} allowClear />
            <Button icon={<ReloadOutlined />} onClick={() => fetchData()} />
            {hasPermission('ITAM_ASSET_CREATE') && <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingItem(null); setIsModalOpen(true); }}>Thêm</Button>}
         </Space>
      </div>
      <Table columns={columns} dataSource={data} rowKey="id" loading={loading} scroll={{ x: 1300 }} pagination={{ defaultPageSize: 10 }} />
      <AssetForm open={isModalOpen} onCancel={() => setIsModalOpen(false)} onSuccess={() => { setIsModalOpen(false); fetchData(); }} initialValues={editingItem} />
      <AssetSoftwareDrawer open={softwareDrawerOpen} asset={selectedAsset} onClose={() => setSoftwareDrawerOpen(false)} />
      <AssetMaintenanceDrawer open={maintenanceDrawerOpen} asset={maintenanceAsset} onClose={() => setMaintenanceDrawerOpen(false)} />
    </div>
  );
};

export default AssetList;