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
// [MỚI] Import Drawer Bảo Trì
import AssetMaintenanceDrawer from './AssetMaintenanceDrawer'; 

// [1] Import hook check quyền
import { useHasPermission } from '../../hooks/useHasPermission';

const PeripheralList = () => {
  const [data, setData] = useState<IAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [searchText, setSearchText] = useState('');
  
  // [2] Lấy hàm check quyền
  const { hasPermission } = useHasPermission();

  const [selectedType, setSelectedType] = useState<string | undefined>(undefined);
  const [peripheralTypes, setPeripheralTypes] = useState<any[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<IAsset | null>(null);

  // --- [MỚI] STATE QUẢN LÝ DRAWER BẢO TRÌ ---
  const [maintenanceDrawerOpen, setMaintenanceDrawerOpen] = useState(false);
  const [maintenanceAsset, setMaintenanceAsset] = useState<IAsset | null>(null);

  // 1. Load danh sách loại tài sản để lọc
  useEffect(() => {
    const fetchTypes = async () => {
        try {
            const res = await assetService.getAssetTypes();
            const pTypes = res.data.data.filter((t: any) => 
                !['PC', 'LAPTOP', 'SERVER'].includes(t.code)
            );
            setPeripheralTypes(pTypes);
        } catch(e) {}
    }
    fetchTypes();
  }, []);

  // 2. Load dữ liệu (Đã thêm bộ lọc chặn cứng PC, LAPTOP, SERVER và Sửa lỗi TypeScript)
  const fetchData = async (page = 1) => {
    setLoading(true);
    try {
      // Ép kiểu as any để tránh lỗi TS2353: 'excludeComputers' does not exist
      const queryParams: any = {
        page,
        limit: pagination.pageSize,
        search: searchText,
        typeId: selectedType, 
        excludeComputers: true 
      };

      const res = await assetService.getAll(queryParams);
      
      let fetchedData = res.data.data || [];
      
      // Chặn cứng ở mức Frontend: Dù Backend có trả về PC thì Frontend cũng sẽ xóa đi
      fetchedData = fetchedData.filter((item: IAsset) => {
          const typeCode = item.type?.code?.toUpperCase() || '';
          return !['PC', 'LAPTOP', 'SERVER'].includes(typeCode);
      });

      setData(fetchedData);
      
      // Tính lại tổng số để phân trang không bị sai
      const removedCount = (res.data.data?.length || 0) - fetchedData.length;
      const actualTotal = Math.max(0, (res.data.total || 0) - removedCount);
      
      setPagination({ ...pagination, current: page, total: actualTotal }); 
      
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(1);
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

  // --- [MỚI] HÀM MỞ DRAWER BẢO TRÌ ---
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
      render: (text) => <Tag color="blue">{text}</Tag>
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
        render: (text) => text ? <span className="font-mono text-gray-600"><QrcodeOutlined /> {text}</span> : '-'
    },
    {
      title: 'Gắn vào (Máy mẹ)',
      key: 'parent',
      width: 200,
      render: (_, record) => record.parent ? (
          <div className="text-blue-600 font-semibold cursor-pointer">
             <LinkOutlined /> {record.parent.name}
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
         return <Tag color={colors[record.status] || 'default'}>{record.status}</Tag>
      }
    },
    {
      title: 'Action',
      key: 'action',
      width: 120, 
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          {/* [MỚI] Nút Bảo trì */}
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

          {/* [3] Check quyền Sửa */}
          {hasPermission('ITAM_ASSET_UPDATE') && (
              <Tooltip title="Chỉnh sửa">
                  <Button 
                    size="small" type="text" className="text-blue-600" icon={<EditOutlined />} 
                    onClick={() => { setEditingItem(record); setIsModalOpen(true); }} 
                  />
              </Tooltip>
          )}
          
          {/* [4] Check quyền Xóa */}
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

         {/* [5] Check quyền Thêm mới */}
         {hasPermission('ITAM_ASSET_CREATE') && (
             <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingItem(null); setIsModalOpen(true); }}>
                Thêm ngoại vi
             </Button>
         )}
      </div>

      <Table 
         columns={columns} dataSource={data} rowKey="id" loading={loading} 
         pagination={{
             ...pagination,
             showTotal: (total) => `Tổng ${total} thiết bị`,
             onChange: (page, pageSize) => setPagination(prev => ({...prev, current: page, pageSize: pageSize || 10}))
         }}
         onChange={(newPagination) => fetchData(newPagination.current)}
      />

      <PeripheralForm 
         open={isModalOpen} 
         onCancel={() => setIsModalOpen(false)}
         onSuccess={() => { setIsModalOpen(false); fetchData(pagination.current); }}
         initialValues={editingItem}
      />

      {/* [MỚI] Render Drawer Bảo trì */}
      <AssetMaintenanceDrawer 
          open={maintenanceDrawerOpen} 
          asset={maintenanceAsset} 
          onClose={() => {
              setMaintenanceDrawerOpen(false);
              fetchData(pagination.current); // Tải lại data để cập nhật trạng thái nếu có
          }} 
      />
    </div>
  );
};

export default PeripheralList;