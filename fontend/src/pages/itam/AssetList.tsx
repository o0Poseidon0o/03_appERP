import { useEffect, useState } from 'react';
import { Table, Button, Input, Tag, Space, Popconfirm, message, Tooltip, Badge } from 'antd';
import { 
  ReloadOutlined, PlusOutlined, EditOutlined, DeleteOutlined, 
  DesktopOutlined, UserOutlined, GlobalOutlined, WindowsOutlined, 
  AuditOutlined 
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { assetService } from '../../services/assetService';
import AssetForm from './AssetForm';
import AssetSoftwareDrawer from './AssetSoftwareDrawer'; 
import type { IAsset } from '../../types/itam.types';

const AssetList = () => {
  const [data, setData] = useState<IAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [searchText, setSearchText] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<IAsset | null>(null);

  // [THAY ĐỔI] Lưu nguyên object asset để truyền vào Drawer
  const [softwareDrawerOpen, setSoftwareDrawerOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<IAsset | null>(null);

  const fetchData = async (page = 1) => {
    setLoading(true);
    try {
      const res = await assetService.getAll({
        page,
        limit: pagination.pageSize,
        search: searchText
      });
      setData(res.data.data);
      setPagination({ ...pagination, current: page, total: res.data.total });
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(1);
  }, [searchText]); 

  const handleDelete = async (id: string) => {
      try {
          await assetService.delete(id);
          message.success("Đã xóa tài sản");
          fetchData(pagination.current);
      } catch (err: any) {
          message.error(err.response?.data?.message || "Không thể xóa");
      }
  }

  // [THAY ĐỔI] Hàm nhận vào full object asset
  const handleViewSoftware = (asset: IAsset) => {
      setSelectedAsset(asset);
      setSoftwareDrawerOpen(true);
  };

  const columns: ColumnsType<IAsset> = [
    // ... (Giữ nguyên các cột Thiết bị, Hệ thống ...)
    {
      title: 'Thiết bị',
      key: 'info',
      width: 220,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <div className="font-bold text-blue-600 flex items-center gap-2 text-base">
             <DesktopOutlined /> {record.name}
          </div>
          <div className="text-xs text-gray-600 font-semibold">
             {record.manufacturer} {record.modelName}
          </div>
          {record.serialNumber && (
            <div className="text-xs text-gray-400 copyable" title="Serial Number">
               SN: <span className="font-mono">{record.serialNumber}</span>
            </div>
          )}
        </Space>
      )
    },
    {
      title: 'Hệ thống (Agent)',
      key: 'system',
      width: 200,
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
      width: 200,
      render: (_, record) => record.customSpecs ? (
         <div className="text-xs space-y-1">
            {record.customSpecs.cpu && <div className="truncate font-semibold" title={record.customSpecs.cpu}>CPU: {record.customSpecs.cpu}</div>}
            {record.customSpecs.ram && <div>RAM: <span className="text-green-600 font-bold">{record.customSpecs.ram}</span></div>}
            {record.customSpecs.disk && <div className="truncate text-gray-500" title={record.customSpecs.disk}>HDD: {record.customSpecs.disk}</div>}
            
            {/* [SỬ DỤNG] Gọi hàm handleViewSoftware với toàn bộ record */}
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
    // ... (Giữ nguyên các cột Quản lý, Trạng thái, Action ...)
    {
      title: 'Quản lý',
      key: 'management',
      width: 220,
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
           {record.parent && (
               <div className="mt-2 text-blue-500 border-t pt-1 border-dashed">
                   🔗 Con của: <strong>{record.parent.name}</strong>
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
      width: 80,
      fixed: 'right',
      render: (_, record) => (
        <Space direction="vertical" size="small">
          <Button 
            size="small" type="text" className="text-blue-600 hover:bg-blue-50" icon={<EditOutlined />} 
            onClick={() => { setEditingItem(record); setIsModalOpen(true); }} 
          />
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
         <Space>
            <Input.Search placeholder="Tìm kiếm..." onSearch={val => setSearchText(val)} style={{ width: 300 }} allowClear enterButton />
            <Button icon={<ReloadOutlined />} onClick={() => fetchData(pagination.current)} />
         </Space>
         <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingItem(null); setIsModalOpen(true); }}>Thêm thiết bị</Button>
      </div>

      <Table 
         columns={columns} dataSource={data} rowKey="id" loading={loading} scroll={{ x: 1200 }} 
         pagination={{
             ...pagination,
             showSizeChanger: true,
             showTotal: (total) => `Tổng ${total} thiết bị`,
             onChange: (page, pageSize) => { setPagination(prev => ({...prev, current: page, pageSize: pageSize || 10})); }
         }}
         onChange={(newPagination) => fetchData(newPagination.current)}
      />

      <AssetForm 
         open={isModalOpen} onCancel={() => setIsModalOpen(false)}
         onSuccess={() => { setIsModalOpen(false); fetchData(pagination.current); }}
         initialValues={editingItem}
      />

      {/* [THAY ĐỔI] Truyền selectedAsset vào Drawer */}
      <AssetSoftwareDrawer 
         open={softwareDrawerOpen}
         asset={selectedAsset}
         onClose={() => setSoftwareDrawerOpen(false)}
      />
    </div>
  );
};

export default AssetList;