import React, { useEffect, useState } from 'react';
import { Drawer, Table, Input, Tag, Empty, Spin, Button, Tooltip } from 'antd';
import { SearchOutlined, ReloadOutlined, DesktopOutlined } from '@ant-design/icons';
import { assetService } from '../../services/assetService';
import type { IAsset, IInstalledSoftware } from '../../types/itam.types';

interface AssetSoftwareDrawerProps {
  open: boolean;
  onClose: () => void;
  asset: IAsset | null; 
}

const AssetSoftwareDrawer: React.FC<AssetSoftwareDrawerProps> = ({ open, onClose, asset }) => {
  const [loading, setLoading] = useState(false);
  const [softwareList, setSoftwareList] = useState<IInstalledSoftware[]>([]);
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    if (open && asset?.id) {
      fetchSoftwareDetails(asset.id);
    } else {
      setSoftwareList([]);
      setSearchText('');
    }
  }, [open, asset]);

  const fetchSoftwareDetails = async (id: string) => {
    setLoading(true);
    try {
      const res = await assetService.getById(id);
      
      // [DEBUG] Xem dữ liệu trả về thực tế là gì
      console.log("API Response:", res); 

      // [FIX QUAN TRỌNG] 
      // Backend trả về: { status: "success", data: { ...asset... } }
      // Axios trả về: res.data = { status: "success", data: ... }
      // => Dữ liệu thật nằm ở res.data.data
      if (res.data && res.data.data) {
        setSoftwareList(res.data.data.softwares || []);
      }
    } catch (error) {
      console.error("Lỗi tải phần mềm:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredData = softwareList.filter(item => 
    item.name.toLowerCase().includes(searchText.toLowerCase()) || 
    (item.publisher && item.publisher.toLowerCase().includes(searchText.toLowerCase()))
  );

  const columns = [
    {
      title: 'Tên ứng dụng',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <span className="font-semibold text-blue-800">{text}</span>
    },
    {
      title: 'Ver',
      dataIndex: 'version',
      key: 'version',
      width: 100,
      render: (ver: string) => ver ? <Tag>{ver}</Tag> : '-'
    },
    {
      title: 'Nhà phát hành',
      dataIndex: 'publisher',
      key: 'publisher',
      width: 150,
      render: (pub: string) => <span className="text-xs text-gray-500">{pub}</span>
    },
    {
      title: 'Ngày cài',
      dataIndex: 'installDate',
      key: 'installDate',
      width: 100,
      align: 'right' as const,
      render: (date: string) => date ? <span className="text-xs text-gray-500">{new Date(date).toLocaleDateString()}</span> : '-'
    }
  ];

  return (
    <Drawer
      title={
        <div className="flex flex-col">
           <div className="flex items-center gap-2 text-gray-700">
              <DesktopOutlined /> Chi tiết phần mềm
           </div>
           <div className="text-sm font-normal text-gray-500 mt-1">
              Thiết bị: <span className="font-bold text-blue-600">{asset?.name}</span> 
              <span className="mx-2">|</span> 
              Tổng: <span className="font-bold text-green-600">{softwareList.length}</span> ứng dụng
           </div>
        </div>
      }
      placement="right"
      width={750}
      onClose={onClose}
      open={open}
      extra={
        <Tooltip title="Tải lại danh sách">
            <Button type="text" icon={<ReloadOutlined />} onClick={() => asset?.id && fetchSoftwareDetails(asset.id)} />
        </Tooltip>
      }
    >
      <div className="mb-4">
        <Input 
            prefix={<SearchOutlined className="text-gray-400" />} 
            placeholder="Tìm kiếm..." 
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            allowClear
        />
      </div>

      <Spin spinning={loading}>
        <Table 
            dataSource={filteredData} 
            columns={columns} 
            rowKey="id" 
            pagination={{ pageSize: 12, size: 'small' }}
            size="small"
            bordered
            locale={{ emptyText: <Empty description="Chưa có dữ liệu phần mềm" /> }}
        />
      </Spin>
    </Drawer>
  );
};

export default AssetSoftwareDrawer;