import { useEffect, useRef, useState } from 'react';
import { Table, Button, Input, Tag, Space, Popconfirm, message, Select, Tooltip, Modal, Radio } from 'antd';
import { 
  ReloadOutlined, PlusOutlined, EditOutlined, DeleteOutlined, 
  LinkOutlined, QrcodeOutlined, ToolOutlined, FileExcelOutlined,
  PrinterOutlined, ScanOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import { QRCodeSVG } from 'qrcode.react';
import { assetService } from '../../services/assetService';
import type { IAsset } from '../../types/itam.types';
import PeripheralForm from './PeripheralForm';
import AssetMaintenanceDrawer from './AssetMaintenanceDrawer'; 
import QRScannerModal from '../warehouse/QRScannerModal'; 

import { useHasPermission } from '../../hooks/useHasPermission';
import { useMediaQuery } from '../../hooks/useMediaQuery';

const PeripheralList = () => {
  const [data, setData] = useState<IAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 15, total: 0 });
  const [searchText, setSearchText] = useState('');
  
  const { hasPermission } = useHasPermission();
  const isCompactScreen = useMediaQuery('(max-width: 1024px)');

  const [selectedType, setSelectedType] = useState<string | undefined>(undefined);
  const [peripheralTypes, setPeripheralTypes] = useState<any[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<IAsset | null>(null);

  const [maintenanceDrawerOpen, setMaintenanceDrawerOpen] = useState(false);
  const [maintenanceAsset, setMaintenanceAsset] = useState<IAsset | null>(null);

  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [qrPrintModalOpen, setQrPrintModalOpen] = useState(false);
  const [qrAssetsToPrint, setQrAssetsToPrint] = useState<IAsset[]>([]);
  const [qrLayoutMode, setQrLayoutMode] = useState<'THERMAL_50x30' | 'A4_GRID'>('THERMAL_50x30');
  const [qrScannerOpen, setQrScannerOpen] = useState(false);
  const qrPrintAreaRef = useRef<HTMLDivElement>(null);

  const handleOpenBatchPrintQR = (assetsToPrint?: IAsset[]) => {
    if (assetsToPrint && assetsToPrint.length > 0) {
      setQrAssetsToPrint(assetsToPrint);
      setQrPrintModalOpen(true);
      return;
    }
    if (selectedRowKeys.length > 0) {
      const selected = data.filter((item) => selectedRowKeys.includes(item.id));
      setQrAssetsToPrint(selected);
      setQrPrintModalOpen(true);
      return;
    }
    if (data.length > 0) {
      setQrAssetsToPrint(data);
      setQrPrintModalOpen(true);
      return;
    }
    message.warning('Chưa có thiết bị nào để in tem QR!');
  };

  const handleExecutePrintQR = () => {
    if (!qrPrintAreaRef.current) return;
    const printContents = qrPrintAreaRef.current.innerHTML;
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) {
      message.error('Trình duyệt đã chặn Pop-up. Vui lòng cho phép Pop-up để in tem.');
      return;
    }
    const pageCss =
      qrLayoutMode === 'THERMAL_50x30'
        ? `@page { size: 50mm 30mm; margin: 0; }
           body { margin: 0; padding: 0; font-family: Arial, sans-serif; }
           .qr-label-card { width: 50mm; height: 30mm; box-sizing: border-box; padding: 2mm; display: flex; align-items: center; gap: 2.5mm; page-break-after: always; }
           .qr-svg-wrap { width: 24mm; height: 24mm; flex-shrink: 0; }
           .qr-svg-wrap svg { width: 100%; height: 100%; }
           .qr-info { flex: 1; overflow: hidden; line-height: 1.25; }
           .qr-company { font-size: 7pt; font-weight: bold; color: #333; }
           .qr-hostname { font-size: 9pt; font-weight: 800; color: #000; font-family: monospace; }
           .qr-meta { font-size: 6.5pt; color: #333; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }`
        : `@page { size: A4; margin: 8mm; }
           body { margin: 0; padding: 0; font-family: Arial, sans-serif; }
           .qr-grid-wrap { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4mm; }
           .qr-label-card { border: 1px dashed #666; border-radius: 4px; padding: 3mm; display: flex; align-items: center; gap: 3mm; page-break-inside: avoid; }
           .qr-svg-wrap { width: 22mm; height: 22mm; flex-shrink: 0; }
           .qr-svg-wrap svg { width: 100%; height: 100%; }
           .qr-info { flex: 1; overflow: hidden; line-height: 1.3; }
           .qr-company { font-size: 7.5pt; font-weight: bold; color: #1d4ed8; }
           .qr-hostname { font-size: 9.5pt; font-weight: 800; color: #000; font-family: monospace; }
           .qr-meta { font-size: 7.5pt; color: #333; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }`;

    printWindow.document.write(`
      <html>
        <head><title>In Tem QR Ngoại Vi</title><style>${pageCss}</style></head>
        <body onload="window.print(); window.close();">
          <div class="${qrLayoutMode === 'A4_GRID' ? 'qr-grid-wrap' : ''}">${printContents}</div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

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

  const handleExportExcel = async () => {
      setExporting(true);
      try {
          const res = await assetService.getAll({
              page: 1,
              limit: 10000,
              search: searchText,
              typeId: selectedType,
              excludeComputers: true
          } as any);
          const allItems: IAsset[] = res.data?.data || [];
          if (!allItems.length) {
              message.warning('Không có dữ liệu thiết bị ngoại vi để xuất!');
              return;
          }
          const statusMap: Record<string, string> = {
              NEW: 'Mới',
              IN_USE: 'Đang dùng',
              BROKEN: 'Hỏng',
              REPAIR: 'Sửa chữa',
              DISPOSED: 'Thanh lý'
          };
          const rows = allItems.map((item, idx) => ({
              'STT': idx + 1,
              'Loại thiết bị': item.type?.name || 'Khác',
              'Tên thiết bị': item.name || '',
              'Hãng sản xuất': item.manufacturer || '',
              'Model': item.modelName || '',
              'Serial Number': item.serialNumber || '',
              'Gắn vào máy (Máy mẹ)': item.parent?.name || 'Chưa gắn (Kho)',
              'Nhà máy': item.factory?.name || '',
              'Phòng ban': item.department?.name || '',
              'Người sử dụng': item.users?.map((u: any) => u.fullName).join(', ') || '',
              'Trạng thái': statusMap[item.status] || item.status,
              'Cập nhật lần cuối': item.updatedAt ? dayjs(item.updatedAt).format('DD/MM/YYYY HH:mm') : ''
          }));
          const ws = XLSX.utils.json_to_sheet(rows);
          ws['!cols'] = [
              { wch: 6 },
              { wch: 18 },
              { wch: 24 },
              { wch: 16 },
              { wch: 20 },
              { wch: 20 },
              { wch: 22 },
              { wch: 16 },
              { wch: 18 },
              { wch: 24 },
              { wch: 14 },
              { wch: 18 }
          ];
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, 'Thiet_Bi_Ngoai_Vi');
          XLSX.writeFile(wb, `Bao_Cao_Thiet_Bi_Ngoai_Vi_${dayjs().format('DDMMYYYY_HHmm')}.xlsx`);
          message.success(`Đã xuất ${allItems.length} thiết bị ngoại vi ra file Excel!`);
      } catch (error) {
          console.error(error);
          message.error('Lỗi khi xuất file Excel!');
      } finally {
          setExporting(false);
      }
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
      fixed: isCompactScreen ? undefined : 'right',
      align: 'center',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="In tem QR">
              <Button
                size="small"
                type="text"
                className="text-purple-600"
                icon={<QrcodeOutlined />}
                onClick={() => handleOpenBatchPrintQR([record])}
              />
          </Tooltip>
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
    <div className="p-3 sm:p-4 bg-white shadow rounded-lg m-2 sm:m-4 h-full flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between mb-4 gap-3">
         <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <Input.Search 
                placeholder="Tìm tên, serial..." 
                onSearch={val => setSearchText(val)} 
                className="w-full sm:w-64"
                allowClear 
            />
            <Select 
                placeholder="Lọc theo loại"
                className="w-full sm:w-44"
                allowClear
                onChange={(val) => setSelectedType(val)}
            >
                {peripheralTypes.map(t => (
                    <Select.Option key={t.id} value={t.id}>{t.name}</Select.Option>
                ))}
            </Select>
            <Button icon={<ReloadOutlined />} onClick={() => fetchData(pagination.current)} />
         </div>

         <div className="flex flex-wrap items-center gap-2">
             <Button
                icon={<ScanOutlined />}
                onClick={() => setQrScannerOpen(true)}
                className="text-indigo-600 border-indigo-200 hover:bg-indigo-50"
             >
                Quét QR
             </Button>
             <Button
                icon={<PrinterOutlined />}
                onClick={() => handleOpenBatchPrintQR()}
                className="text-purple-600 border-purple-200 hover:bg-purple-50"
             >
                In tem QR {selectedRowKeys.length > 0 ? `(${selectedRowKeys.length})` : ''}
             </Button>
             <Button 
                icon={<FileExcelOutlined />} 
                loading={exporting}
                onClick={handleExportExcel}
                className="bg-green-600 text-white hover:!bg-green-700 hover:!text-white border-none"
             >
                Xuất Excel
             </Button>
             {hasPermission('ITAM_ASSET_CREATE') && (
                 <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingItem(null); setIsModalOpen(true); }}>
                    Thêm ngoại vi
                 </Button>
             )}
         </div>
      </div>

      <Table 
         rowSelection={{
           selectedRowKeys,
           onChange: (keys) => setSelectedRowKeys(keys),
         }}
         columns={columns} 
         dataSource={data} 
         rowKey="id" 
         loading={loading} 
         scroll={{ x: 'max-content' }}
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

      <QRScannerModal
        isOpen={qrScannerOpen}
        onClose={() => setQrScannerOpen(false)}
        onScanSuccess={(code) => {
          setQrScannerOpen(false);
          setSearchText(code.trim());
          message.success(`Đã quét mã: ${code.trim()}`);
        }}
      />

      <Modal
        title={`In tem QR Thiết bị Ngoại vi (${qrAssetsToPrint.length} thiết bị)`}
        open={qrPrintModalOpen}
        onCancel={() => setQrPrintModalOpen(false)}
        width={760}
        footer={[
          <Button key="close" onClick={() => setQrPrintModalOpen(false)}>Đóng</Button>,
          <Button key="print" type="primary" icon={<PrinterOutlined />} onClick={handleExecutePrintQR}>
            In {qrAssetsToPrint.length} Tem Ngay
          </Button>,
        ]}
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 bg-slate-50 p-2.5 rounded border">
          <span className="text-xs font-medium">Chọn khổ giấy in tem:</span>
          <Radio.Group value={qrLayoutMode} onChange={(e) => setQrLayoutMode(e.target.value)} buttonStyle="solid" size="small">
            <Radio.Button value="THERMAL_50x30">Tem nhãn 50x30mm</Radio.Button>
            <Radio.Button value="A4_GRID">Giấy A4 (Lưới 3 cột)</Radio.Button>
          </Radio.Group>
        </div>
        <div ref={qrPrintAreaRef} className="max-h-[400px] overflow-y-auto p-3 border rounded grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {qrAssetsToPrint.map((asset) => (
            <div key={asset.id} className="qr-label-card border border-dashed rounded p-2 flex items-center gap-2.5 bg-white">
              <div className="qr-svg-wrap flex-shrink-0">
                <QRCodeSVG value={asset.serialNumber || asset.name} size={72} level="M" />
              </div>
              <div className="qr-info flex-1 min-w-0">
                <div className="qr-company text-[10px] font-bold text-blue-700 uppercase">
                  {asset.type?.name || 'TOWA ITAM'}
                </div>
                <div className="qr-hostname text-xs font-bold font-mono truncate">{asset.name}</div>
                <div className="qr-meta text-[11px] text-gray-600 truncate">SN: {asset.serialNumber || 'N/A'}</div>
                <div className="qr-meta text-[11px] text-gray-500 truncate">
                  {asset.parent?.name ? `Máy: ${asset.parent.name}` : asset.department?.name || ''}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
};

export default PeripheralList;