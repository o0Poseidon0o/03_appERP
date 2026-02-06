import { useEffect, useState } from 'react';
import { Table, Button, Input, Tag, Space, Popconfirm, message, Select } from 'antd';
import { 
  ReloadOutlined, PlusOutlined, EditOutlined, DeleteOutlined, 
  LinkOutlined, QrcodeOutlined 
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { assetService } from '../../services/assetService';
 // Tái sử dụng Form cũ
import type { IAsset } from '../../types/itam.types';
import PeripheralForm from './PeripheralForm';

const PeripheralList = () => {
  const [data, setData] = useState<IAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [searchText, setSearchText] = useState('');
  
  // Bộ lọc loại thiết bị (Chỉ load các loại ngoại vi)
  const [selectedType, setSelectedType] = useState<string | undefined>(undefined);
  const [peripheralTypes, setPeripheralTypes] = useState<any[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<IAsset | null>(null);

  // 1. Load danh sách loại tài sản để lọc
  useEffect(() => {
    const fetchTypes = async () => {
        try {
            const res = await assetService.getAssetTypes();
            // Lọc bỏ PC, Laptop, Server -> Chỉ lấy ngoại vi
            const pTypes = res.data.data.filter((t: any) => 
                !['PC', 'LAPTOP', 'SERVER'].includes(t.code)
            );
            setPeripheralTypes(pTypes);
        } catch(e) {}
    }
    fetchTypes();
  }, []);

  // 2. Load dữ liệu
  const fetchData = async (page = 1) => {
    setLoading(true);
    try {
      // Nếu user chọn loại cụ thể thì lọc, nếu không thì backend trả về hết (hoặc bạn cần BE hỗ trợ lọc nhiều loại)
      // Tạm thời ở đây ta lọc theo typeId nếu có
      const res = await assetService.getAll({
        page,
        limit: pagination.pageSize,
        search: searchText,
        typeId: selectedType, // Lọc theo dropdown
      });
      
      // [QUAN TRỌNG] Nếu API chưa hỗ trợ lọc "Ngoại vi", ta có thể lọc phía Client tạm thời
      // Tuy nhiên tốt nhất là chọn Type từ Dropdown
      let fetchedData = res.data.data;
      
      // Nếu chưa chọn type, ta lọc thủ công bỏ PC/Laptop để bảng nhìn sạch sẽ (Optional)
      if (!selectedType) {
          fetchedData = fetchedData.filter((item: IAsset) => 
            !['PC', 'LAPTOP', 'SERVER'].includes(item.type?.code || '')
          );
      }

      setData(fetchedData);
      setPagination({ ...pagination, current: page, total: res.data.total }); // Total này có thể sai nếu filter client, nên update BE chuẩn hơn sau
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
      width: 80,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button 
            size="small" type="text" className="text-blue-600" icon={<EditOutlined />} 
            onClick={() => { setEditingItem(record); setIsModalOpen(true); }} 
          />
          <Popconfirm title="Xóa thiết bị này?" onConfirm={() => handleDelete(record.id)}>
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
         <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingItem(null); setIsModalOpen(true); }}>
            Thêm ngoại vi
         </Button>
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
    </div>
  );
};

export default PeripheralList;