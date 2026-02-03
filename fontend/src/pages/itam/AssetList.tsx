import { useEffect, useState } from 'react';
import { Table, Button, Input, Tag, Space, Popconfirm, message, Tooltip } from 'antd';
import { ReloadOutlined, PlusOutlined, EditOutlined, DeleteOutlined, DesktopOutlined, UserOutlined } from '@ant-design/icons';
import { assetService } from '../../services/assetService';
import AssetForm from './AssetForm';
import type { IAsset } from '../../types/itam.types';

const AssetList = () => {
  const [data, setData] = useState<IAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [searchText, setSearchText] = useState('');

  // State Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<IAsset | null>(null);

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
  }, [searchText]); // Reload khi search thay đổi

  const handleDelete = async (id: string) => {
      try {
          await assetService.delete(id);
          message.success("Đã xóa tài sản");
          fetchData(pagination.current);
      } catch (err: any) {
          message.error(err.response?.data?.message || "Không thể xóa");
      }
  }

  const columns = [
    {
      title: 'Thiết bị',
      key: 'name',
      render: (_, record: IAsset) => (
        <Space direction="vertical" size={0}>
          <div className="font-bold text-blue-600 flex items-center gap-2">
             <DesktopOutlined /> {record.name}
          </div>
          {record.modelName && <span className="text-xs text-gray-500">{record.modelName}</span>}
          {record.serialNumber && <span className="text-xs text-gray-400">SN: {record.serialNumber}</span>}
        </Space>
      )
    },
    {
      title: 'Cấu hình (Agent)',
      key: 'specs',
      width: 250,
      render: (_, record: IAsset) => record.customSpecs ? (
         <div className="text-xs">
            {record.customSpecs.cpu && <div className="truncate" title={record.customSpecs.cpu}>🖥️ {record.customSpecs.cpu}</div>}
            {record.customSpecs.ram && <div>💾 {record.customSpecs.ram}</div>}
            {record.customSpecs.disk && <div className="truncate" title={record.customSpecs.disk}>💿 {record.customSpecs.disk}</div>}
         </div>
      ) : <span className="text-gray-400">-</span>
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      width: 120,
      render: (status: string) => {
        const colors: any = { NEW: 'green', IN_USE: 'blue', BROKEN: 'red', REPAIR: 'orange', DISPOSED: 'default' };
        return <Tag color={colors[status]}>{status}</Tag>
      }
    },
    {
      title: 'Vị trí / Người dùng',
      key: 'location',
      width: 250,
      render: (_, record: IAsset) => (
        <div className="text-xs">
           {/* Hiển thị Nhà máy */}
           {record.factory && <div className="mb-1">🏭 {record.factory.name}</div>}
           
           {/* [UPDATED] Hiển thị danh sách Users (Many-to-Many) */}
           {record.users && record.users.length > 0 ? (
               <div className="flex flex-wrap gap-1">
                   {record.users.map((u: any) => (
                       <Tooltip key={u.id} title={u.email}>
                           <Tag color="cyan" icon={<UserOutlined />}>
                               {u.fullName}
                           </Tag>
                       </Tooltip>
                   ))}
               </div>
           ) : (
               <span className="text-gray-400 italic">Chưa bàn giao</span>
           )}

           {/* Hiển thị máy mẹ nếu có */}
           {record.parent && (
               <div className="mt-1 text-blue-500">🔗 Gắn vào: <strong>{record.parent.name}</strong></div>
           )}
        </div>
      )
    },
    {
      title: 'Cập nhật',
      key: 'lastSeen',
      width: 150,
      render: (_, record: IAsset) => (
          <div className="text-xs text-gray-500">
              {record.lastSeen ? new Date(record.lastSeen).toLocaleString() : 'Chưa online'}
          </div>
      )
    },
    {
      title: 'Thao tác',
      key: 'action',
      width: 100,
      render: (_, record: IAsset) => (
        <Space>
          <Button 
            size="small" 
            icon={<EditOutlined />} 
            onClick={() => {
                setEditingItem(record);
                setIsModalOpen(true);
            }} 
          />
          <Popconfirm title="Xóa tài sản này?" onConfirm={() => handleDelete(record.id)}>
             <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div className="p-4 bg-white shadow rounded-lg m-4">
      <div className="flex justify-between mb-4">
         <Space>
            <Input.Search 
                placeholder="Tìm kiếm..." 
                onSearch={val => setSearchText(val)} 
                style={{ width: 250 }} 
                allowClear
            />
            <Button icon={<ReloadOutlined />} onClick={() => fetchData(pagination.current)} />
         </Space>
         
         <Button type="primary" icon={<PlusOutlined />} onClick={() => {
             setEditingItem(null);
             setIsModalOpen(true);
         }}>
            Thêm mới
         </Button>
      </div>

      <Table 
         columns={columns as any} 
         dataSource={data} 
         rowKey="id"
         loading={loading}
         pagination={{
             ...pagination,
             onChange: (page) => fetchData(page)
         }}
      />

      <AssetForm 
         open={isModalOpen} 
         onCancel={() => setIsModalOpen(false)}
         onSuccess={() => {
             setIsModalOpen(false);
             fetchData(pagination.current);
         }}
         initialValues={editingItem}
      />
    </div>
  );
};

export default AssetList;