import { useEffect, useState } from 'react';
import { Table, Button, Input, Tag, Space, Popconfirm, message, Select, Tooltip } from 'antd';
import { 
  ReloadOutlined, PlusOutlined, EditOutlined, DeleteOutlined, 
  LinkOutlined, QrcodeOutlined, ToolOutlined 
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { assetService } from '../../services/assetService';
import type { IAsset } from '../../types/itam.types';
import PeripheralForm from './PeripheralForm';
import AssetMaintenanceDrawer from './AssetMaintenanceDrawer'; 

import { useHasPermission } from '../../hooks/useHasPermission';

const PeripheralList = () => {
  const [data, setData] = useState<IAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 15, total: 0 });
  const [searchText, setSearchText] = useState('');
  
  const { hasPermission } = useHasPermission();

  const [selectedType, setSelectedType] = useState<string | undefined>(undefined);
  const [peripheralTypes, setPeripheralTypes] = useState<any[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<IAsset | null>(null);

  const [maintenanceDrawerOpen, setMaintenanceDrawerOpen] = useState(false);
  const [maintenanceAsset, setMaintenanceAsset] = useState<IAsset | null>(null);

  // 1. Load danh sách loại tài sản để lọc
  useEffect(() => {
    const fetchTypes = async () => {
        try {
            const res = await assetService.getAssetTypes();
            const pTypes = res.data.data.filter((t: any) => 
                !['PC', 'LAPTOP', 'SERVER'].includes(String(t.code).toUpperCase())
            );
            setPeripheralTypes(pTypes);
        } catch(e) {
            console.error("Lỗi lấy loại tài sản:", e);
        }
    }
    fetchTypes();
  }, []);

  // 2. Load dữ liệu SIÊU GỌN (Vì Backend đã gánh logic lọc)
  const fetchData = async (page = 1, pageSize = pagination.pageSize) => {
    setLoading(true);
    try {
      const res = await assetService.getAll({
        page,
        limit: pageSize,
        search: searchText,
        typeId: selectedType,
        excludeComputers: true // Báo cho Backend biết: "Đừng gửi PC/Laptop cho tôi!"
      } as any);
      
      // Lấy data luôn, không cần filter rườm rà nữa
      setData(res.data?.data || []);
      setPagination({ current: page, pageSize: pageSize, total: res.data?.total || 0 }); 
      
    } catch (error) {
      console.error("Lỗi tải danh sách thiết bị:", error);
      message.error("Lỗi khi tải dữ liệu thiết bị!");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchText, selectedType]); 

  const handleDelete = async (id: string) => {
      try {
          await assetService.delete(id);
          message.success("Đã xóa thiết bị");
          fetchData(pagination.current);
      } catch (err: any) {
          message.error(err.response?.data?.message || "Không thể xóa");
      }
  }

  const handleOpenMaintenance = (asset: IAsset) => {
      setMaintenanceAsset(asset);
      setMaintenanceDrawerOpen(true);
  };

  const columns: ColumnsType<IAsset> = [
    {
      title: 'Loại',
      dataIndex: ['type', 'name'],
      key: 'type',
      width: 150,
      render: (text) => <Tag color="blue">{text || 'Khác'}</Tag>
    },
    {
      title: 'Tên thiết bị / Model',
      key: 'info',
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <span className="font-bold text-slate-700">{record.name}</span>
          <span className="text-xs text-gray-500">{record.manufacturer} {record.modelName}</span>
        </Space>
      )
    },
    {
        title: 'Serial Number',
        dataIndex: 'serialNumber',
        key: 'serial',
        render: (text) => text ? <span className="font-mono text-gray-600"><QrcodeOutlined className="mr-1"/>{text}</span> : '-'
    },
    {
      title: 'Gắn vào (Máy mẹ)',
      key: 'parent',
      width: 200,
      render: (_, record) => record.parent ? (
          <div className="text-blue-600 font-semibold cursor-pointer">
             <LinkOutlined className="mr-1"/>{record.parent.name}
          </div>
      ) : <span className="text-gray-400 italic">Chưa gắn (Kho)</span>
    },
    {
      title: 'Vị trí',
      key: 'location',
      render: (_, record) => (
          <div className="text-xs">
             {record.factory && <div>🏭 {record.factory.name}</div>}
             {record.department && <div>🏢 {record.department.name}</div>}
          </div>
      )
    },
    {
      title: 'Trạng thái',
      key: 'status',
      width: 120,
      align: 'center',
      render: (_, record) => {
         const colors: Record<string, string> = { NEW: 'green', IN_USE: 'blue', BROKEN: 'red', REPAIR: 'orange', DISPOSED: 'default' };
         const textMap: Record<string, string> = { NEW: 'Mới', IN_USE: 'Đang dùng', BROKEN: 'Hỏng', REPAIR: 'Sửa chữa', DISPOSED: 'Thanh lý' };
         const statusText = textMap[record.status] || record.status;
         return <Tag color={colors[record.status] || 'default'}>{statusText}</Tag>
      }
    },
    {
      title: 'Action',
      key: 'action',
      width: 120, 
      fixed: 'right',
      align: 'center',
      render: (_, record) => (
        <Space size="small">
          {hasPermission('ITAM_MAINTENANCE') && (
              <Tooltip title="Lịch sử Bảo trì / Thay thế">
                  <Button 
                      size="small" 
                      type={record.status === 'REPAIR' ? 'primary' : 'dashed'} 
                      danger={record.status === 'REPAIR'}
                      className={record.status !== 'REPAIR' ? 'text-orange-500 border-orange-200 hover:bg-orange-50' : ''}
                      icon={<ToolOutlined />} 
                      onClick={() => handleOpenMaintenance(record)} 
                  />
              </Tooltip>
          )}

          {hasPermission('ITAM_ASSET_UPDATE') && (
              <Tooltip title="Chỉnh sửa">
                  <Button 
                    size="small" type="text" className="text-blue-600" icon={<EditOutlined />} 
                    onClick={() => { setEditingItem(record); setIsModalOpen(true); }} 
                  />
              </Tooltip>
          )}
          
          {hasPermission('ITAM_ASSET_DELETE') && (
              <Popconfirm title="Xóa thiết bị này?" onConfirm={() => handleDelete(record.id)}>
                 <Button size="small" type="text" danger icon={<DeleteOutlined />} />
              </Popconfirm>
          )}
        </Space>
      )
    }
  ];

  return (
    <div className="p-4 bg-white shadow rounded-lg m-4 h-full flex flex-col">
      <div className="flex justify-between mb-4 flex-wrap gap-2">
         <Space>
            <Input.Search 
                placeholder="Tìm tên, serial..." 
                onSearch={val => setSearchText(val)} 
                style={{ width: 250 }} 
                allowClear 
            />
            <Select 
                placeholder="Lọc theo loại"
                style={{ width: 180 }}
                allowClear
                onChange={(val) => setSelectedType(val)}
            >
                {peripheralTypes.map(t => (
                    <Select.Option key={t.id} value={t.id}>{t.name}</Select.Option>
                ))}
            </Select>
            <Button icon={<ReloadOutlined />} onClick={() => fetchData(pagination.current)} />
         </Space>

         {hasPermission('ITAM_ASSET_CREATE') && (
             <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingItem(null); setIsModalOpen(true); }}>
                Thêm ngoại vi
             </Button>
         )}
      </div>

      <Table 
         columns={columns} 
         dataSource={data} 
         rowKey="id" 
         loading={loading} 
         onChange={(newPagination) => {
             fetchData(newPagination.current || 1, newPagination.pageSize || 15);
         }}
         pagination={{
             ...pagination,
             showSizeChanger: true,
             showTotal: (total) => `Tổng ${total} thiết bị`
         }}
      />

      <PeripheralForm 
         open={isModalOpen} 
         onCancel={() => setIsModalOpen(false)}
         onSuccess={() => { setIsModalOpen(false); fetchData(pagination.current); }}
         initialValues={editingItem}
      />

      <AssetMaintenanceDrawer 
          open={maintenanceDrawerOpen} 
          asset={maintenanceAsset} 
          onClose={() => {
              setMaintenanceDrawerOpen(false);
              fetchData(pagination.current); 
          }} 
      />
    </div>
  );
};

export default PeripheralList;