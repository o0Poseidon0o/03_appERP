import React, { useEffect, useState } from 'react';
import { Drawer, Table, Input, Tag, Empty, Spin, Button, Tooltip, Space, message } from 'antd';
import { SearchOutlined, ReloadOutlined, DesktopOutlined, FileExcelOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';
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

  const handleExportExcel = () => {
    if (filteredData.length === 0) {
      message.warning("Không có dữ liệu phần mềm để xuất");
      return;
    }

    const rows = filteredData.map((sw, idx) => ({
      "STT": idx + 1,
      "Thiết Bị (Hostname)": asset?.name || "",
      "Tên Phần Mềm": sw.name,
      "Phiên Bản (Version)": sw.version || "-",
      "Nhà Phát Hành": sw.publisher || "-",
      "Ngày Ghi Nhận": sw.installDate ? new Date(sw.installDate).toLocaleDateString('vi-VN') : "-",
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [
      { wch: 6 },
      { wch: 20 },
      { wch: 38 },
      { wch: 18 },
      { wch: 28 },
      { wch: 15 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Phan_Mem_May");
    const dateStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `PhanMem_${asset?.name || 'Asset'}_${dateStr}.xlsx`);
    message.success("Đã xuất danh sách phần mềm ra Excel!");
  };

  const columns = [
    {
      title: 'Tên ứng dụng',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <span className="font-semibold text-blue-800">{text}</span>
    },
    {
      title: 'Phiên bản',
      dataIndex: 'version',
      key: 'version',
      width: 120,
      render: (ver: string) => ver ? <Tag color="geekblue" className="m-0 font-mono text-xs">{ver}</Tag> : '-'
    },
    {
      title: 'Nhà phát hành',
      dataIndex: 'publisher',
      key: 'publisher',
      width: 160,
      render: (pub: string) => <span className="text-xs text-gray-500">{pub || '-'}</span>
    },
  ];

  return (
    <Drawer
      title={
        <div className="flex flex-col">
           <div className="flex items-center gap-2 text-gray-700">
              <DesktopOutlined /> Phần mềm đã cài đặt
           </div>
           <div className="text-xs sm:text-sm font-normal text-gray-500 mt-1">
              Thiết bị: <span className="font-bold text-blue-600">{asset?.name}</span> 
              <span className="mx-2">|</span> 
              Tổng: <span className="font-bold text-green-600">{softwareList.length}</span> ứng dụng
           </div>
        </div>
      }
      placement="right"
      width="min(100vw, 720px)"
      onClose={onClose}
      open={open}
      extra={
        <Space>
          <Button
            size="small"
            type="primary"
            icon={<FileExcelOutlined />}
            onClick={handleExportExcel}
            disabled={filteredData.length === 0}
            className="bg-green-600 hover:!bg-green-500 border-none"
          >
            Xuất Excel
          </Button>
          <Tooltip title="Tải lại danh sách">
            <Button type="text" icon={<ReloadOutlined />} onClick={() => asset?.id && fetchSoftwareDetails(asset.id)} />
          </Tooltip>
        </Space>
      }
    >
      <div className="mb-4">
        <Input 
            prefix={<SearchOutlined className="text-gray-400" />} 
            placeholder="Tìm kiếm tên ứng dụng, nhà phát hành..." 
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
            scroll={{ x: 'max-content' }}
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
