import { useEffect, useRef, useState } from 'react';
import { Table, Button, Input, Tag, Space, Popconfirm, message, Tooltip, Badge, Popover, Modal, Radio } from 'antd'; 
import { 
  ReloadOutlined, PlusOutlined, EditOutlined, DeleteOutlined, 
  DesktopOutlined, WindowsOutlined, AuditOutlined, 
  LaptopOutlined, CloudServerOutlined, ToolOutlined, UserOutlined,
  FundProjectionScreenOutlined, GlobalOutlined, 
  ThunderboltOutlined, SearchOutlined, FileExcelOutlined,
  QrcodeOutlined, PrinterOutlined, ScanOutlined, DownloadOutlined, CopyOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import * as XLSX from 'xlsx';
import { QRCodeSVG } from 'qrcode.react';

import { useSocket } from '../../contexts/SocketContext'; 
import { assetService } from '../../services/assetService';
import axiosClient from '../../api/axiosClient';
import AssetForm from './AssetForm';
import AssetSoftwareDrawer from './AssetSoftwareDrawer'; 
import AssetMaintenanceDrawer from './AssetMaintenanceDrawer'; 
import QRScannerModal from '../warehouse/QRScannerModal';
import type { IAsset } from '../../types/itam.types';
import { useHasPermission } from '../../hooks/useHasPermission';
import useMediaQuery from '../../hooks/useMediaQuery';

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
  const isTabletOrMobile = useMediaQuery('(max-width: 1024px)');

  const { socket, isConnected } = useSocket(); 

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<IAsset | null>(null);
  
  const [softwareDrawerOpen, setSoftwareDrawerOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<IAsset | null>(null);
  const [maintenanceDrawerOpen, setMaintenanceDrawerOpen] = useState(false);
  const [maintenanceAsset, setMaintenanceAsset] = useState<IAsset | null>(null);

  // State cho In tem QR hàng loạt & Quét QR bằng điện thoại
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [qrPrintModalOpen, setQrPrintModalOpen] = useState(false);
  const [qrAssetsToPrint, setQrAssetsToPrint] = useState<IAsset[]>([]);
  const [qrLayoutMode, setQrLayoutMode] = useState<'THERMAL_50x30' | 'A4_GRID'>('THERMAL_50x30');
  const [qrScannerOpen, setQrScannerOpen] = useState(false);
  const [scannedAsset, setScannedAsset] = useState<IAsset | null>(null);
  const [agentInstallerModalOpen, setAgentInstallerModalOpen] = useState(false);
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
      message.error('Trình duyệt đã chặn cửa sổ bật lên (Pop-up). Vui lòng cho phép Pop-up để in tem.');
      return;
    }

    const pageCss =
      qrLayoutMode === 'THERMAL_50x30'
        ? `@page { size: 50mm 30mm; margin: 0; }
           body { margin: 0; padding: 0; font-family: Arial, sans-serif; }
           .qr-label-card { width: 50mm; height: 30mm; box-sizing: border-box; padding: 2mm; display: flex; align-items: center; gap: 2.5mm; page-break-after: always; border: none; }
           .qr-svg-wrap { width: 24mm; height: 24mm; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
           .qr-svg-wrap svg { width: 100%; height: 100%; }
           .qr-info { flex: 1; overflow: hidden; line-height: 1.25; }
           .qr-company { font-size: 7pt; font-weight: bold; color: #333; letter-spacing: 0.5px; }
           .qr-hostname { font-size: 9.5pt; font-weight: 800; color: #000; margin: 1px 0; font-family: monospace; word-break: break-all; }
           .qr-meta { font-size: 6.5pt; color: #333; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }`
        : `@page { size: A4; margin: 8mm; }
           body { margin: 0; padding: 0; font-family: Arial, sans-serif; }
           .qr-grid-wrap { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4mm; }
           .qr-label-card { border: 1px dashed #666; border-radius: 4px; padding: 3mm; display: flex; align-items: center; gap: 3mm; box-sizing: border-box; page-break-inside: avoid; }
           .qr-svg-wrap { width: 22mm; height: 22mm; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
           .qr-svg-wrap svg { width: 100%; height: 100%; }
           .qr-info { flex: 1; overflow: hidden; line-height: 1.3; }
           .qr-company { font-size: 7.5pt; font-weight: bold; color: #1d4ed8; }
           .qr-hostname { font-size: 10pt; font-weight: 800; color: #000; margin: 2px 0; font-family: monospace; }
           .qr-meta { font-size: 7.5pt; color: #333; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }`;

    printWindow.document.write(`
      <html>
        <head>
          <title>In Tem QR Tài Sản ITAM</title>
          <style>${pageCss}</style>
        </head>
        <body onload="window.print(); window.close();">
          <div class="${qrLayoutMode === 'A4_GRID' ? 'qr-grid-wrap' : ''}">
            ${printContents}
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleQRScanSuccess = async (decodedText: string) => {
    let cleanCode = decodedText.trim();
    if (cleanCode.includes('/qr/asset/')) {
      cleanCode = decodeURIComponent(cleanCode.split('/qr/asset/').pop() || '').split('?')[0].trim();
    }
    setQrScannerOpen(false);
    setSearchText(cleanCode);

    try {
      const qrRes = await axiosClient.get(`/assets/public-qr/${encodeURIComponent(cleanCode)}`);
      if (qrRes.data?.data) {
        setScannedAsset(qrRes.data.data);
        message.success(`Đã tải đầy đủ thông tin & phần mềm máy: ${qrRes.data.data.name}`);
        return;
      }
    } catch {
      // Fallback tìm kiếm thông thường nếu không khớp chính xác
    }

    const matched = data.find(
      (item) =>
        item.name.toLowerCase() === cleanCode.toLowerCase() ||
        item.serialNumber?.toLowerCase() === cleanCode.toLowerCase() ||
        item.id === cleanCode
    );

    if (matched) {
      setScannedAsset(matched);
      message.success(`Đã nhận diện thiết bị: ${matched.name}`);
    } else {
      try {
        const res = await assetService.getAll({ page: 1, limit: 50, search: cleanCode });
        const foundList: IAsset[] = res.data?.data || [];
        if (foundList.length > 0) {
          setData(foundList);
          setScannedAsset(foundList[0]);
          message.success(`Đã tìm thấy thiết bị: ${foundList[0].name}`);
        } else {
          message.warning(`Không tìm thấy thiết bị có mã: ${cleanCode}`);
        }
      } catch {
        message.error('Lỗi khi tra cứu mã QR');
      }
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
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
  }, [socket, isConnected]); 

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

  // --- HÀM XUẤT EXCEL (.XLSX CHUẨN) ---
  const exportToExcel = () => {
    if (!data || data.length === 0) {
        message.warning("Không có dữ liệu để xuất");
        return;
    }

    const statusMap: Record<string, string> = {
      NEW: 'Mới',
      IN_USE: 'Đang dùng',
      BROKEN: 'Hỏng',
      REPAIR: 'Sửa chữa',
      DISPOSED: 'Thanh lý',
    };

    const excelRows = data.map((item: any, idx: number) => {
        const specs = item.customSpecs || {};
        const users = item.users?.map((u: any) => u.fullName).join(" & ") || "Chưa cấp phát";
        const factory = item.factory?.name || "Chưa gán";
        const department = item.department?.name || "Chưa gán";
        const status = statusMap[item.status] || item.status;
        const lastSeen = item.lastSeen ? new Date(item.lastSeen).toLocaleString('vi-VN') : "Offline";

        const comps = item.components || [];
        const monitors = comps
            .filter((c: any) => c.type === 'MONITOR')
            .map((m: any) => `${m.name} ${m.specs?.size && m.specs.size !== 'N/A' ? `(${m.specs.size})` : ''} ${m.serialNumber ? `[SN: ${m.serialNumber}]` : ''}`.trim())
            .join(" + ");

        const peripherals = comps
            .filter((c: any) => ['MOUSE', 'KEYBOARD'].includes(c.type))
            .map((p: any) => `${p.type === 'MOUSE' ? 'Chuột' : 'Phím'}: ${p.name.replace('Device', '').trim()}`)
            .join(" + ");

        return {
            "STT": idx + 1,
            "Tên Thiết Bị": item.name || "",
            "Loại": item.type?.name || "N/A",
            "Hãng / Model": `${item.manufacturer || ''} ${item.modelName || ''}`.trim(),
            "Serial Number": item.serialNumber || "",
            "Hệ Điều Hành": item.osName || "N/A",
            "IP Address": item.ipAddress || "",
            "MAC Address": item.macAddress || "",
            "Domain User": item.domainUser || "",
            "CPU": specs.cpu || "",
            "RAM": specs.ram || "",
            "Ổ Cứng": specs.disk || "",
            "Màn Hình": monitors || "Không có",
            "Thiết Bị Ngoại Vi": peripherals || "Không có",
            "Số Phần Mềm": item._count?.softwares || 0,
            "Người Sử Dụng": users,
            "Nhà Máy": factory,
            "Phòng Ban": department,
            "Trạng Thái": status,
            "Lần Cuối Online": lastSeen,
        };
    });

    const worksheet = XLSX.utils.json_to_sheet(excelRows);
    worksheet['!cols'] = [
      { wch: 6 },
      { wch: 18 },
      { wch: 14 },
      { wch: 24 },
      { wch: 18 },
      { wch: 24 },
      { wch: 15 },
      { wch: 18 },
      { wch: 18 },
      { wch: 28 },
      { wch: 10 },
      { wch: 24 },
      { wch: 28 },
      { wch: 28 },
      { wch: 12 },
      { wch: 22 },
      { wch: 16 },
      { wch: 18 },
      { wch: 14 },
      { wch: 20 },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "DS_MayTinh_Server");

    const dateStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `DS_MayTinh_Server_${dateStr}.xlsx`);
    message.success("Xuất file Excel thành công!");
  };

  const columns: ColumnsType<IAsset> = [
    {
      title: 'Thiết bị',
      key: 'info',
      width: 240,
      fixed: isTabletOrMobile ? undefined : 'left',
      sorter: (a: any, b: any) => {
          const nameA = a.name || "";
          const nameB = b.name || "";
          return nameA.localeCompare(nameB, 'vi');
      },
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
                  <div className="flex flex-col gap-1 bg-slate-50 px-2 py-1 rounded">
                    <div className="flex items-center gap-1.5 text-slate-700 font-medium truncate" title={record.osName}>
                        {/ubuntu|linux|debian|centos|redhat/i.test(record.osName) ? (
                            <span className="text-orange-600 font-bold">🐧</span>
                        ) : (
                            <WindowsOutlined className="text-blue-500" />
                        )}
                        <span className="truncate">{record.osName}</span>
                    </div>
                    {(record.customSpecs as any)?.osLicense?.status === 'LICENSED' && (
                        <Tooltip title={`Kênh: ${(record.customSpecs as any)?.osLicense?.channel || 'OEM/Retail'} ${((record.customSpecs as any)?.osLicense?.partialKey) ? `- Key: *${(record.customSpecs as any).osLicense.partialKey}` : ''}`}>
                            <Tag color="green" bordered={false} className="m-0 text-[10px] w-max">✓ Bản quyền Windows</Tag>
                        </Tooltip>
                    )}
                    {Array.isArray((record as any).licenseAssignments) && (record as any).licenseAssignments.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                            {(record as any).licenseAssignments.map((la: any) => (
                                <Tag key={la.id} color="gold" className="m-0 text-[10px]">
                                    🔑 {la.licenseKey?.policy?.name || 'Key'}
                                </Tag>
                            ))}
                        </div>
                    )}
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
                      <div key={idx} className="mb-1 text-slate-600 flex justify-between gap-2">
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

          const hwHealth = (record.customSpecs as any)?.hardwareHealth || null;
          const healthPopoverContent = hwHealth ? (
              <div className="text-xs min-w-[250px] max-w-[320px] space-y-1.5">
                  <div className="font-bold border-b pb-1 text-blue-700">
                      🩺 Chẩn đoán Sức khỏe CPU / RAM / Ổ cứng
                  </div>
                  {hwHealth.cpu && (
                      <div>
                          • <b>CPU:</b> {hwHealth.cpu.status === 'GOOD' ? '✓ Tốt' : hwHealth.cpu.statusText} (Tải {hwHealth.cpu.loadPercent ?? 0}% • {hwHealth.cpu.cores} nhân/{hwHealth.cpu.threads} luồng)
                      </div>
                  )}
                  {hwHealth.ram && (
                      <div>
                          • <b>RAM:</b> Đang dùng {hwHealth.ram.usedGB}/{hwHealth.ram.totalGB} GB ({hwHealth.ram.usagePercent}% - Trống {hwHealth.ram.freeGB} GB)
                      </div>
                  )}
                  <div>
                      • <b>Ổ cứng (S.M.A.R.T):</b> {hwHealth.diskText || 'Tốt (S.M.A.R.T OK)'}
                  </div>
                  {Array.isArray(hwHealth.logicalVolumes) && hwHealth.logicalVolumes.length > 0 && (
                      <div className="pt-1 border-t space-y-0.5">
                          <div className="text-gray-400">Dung lượng các phân vùng:</div>
                          {hwHealth.logicalVolumes.map((v: any, idx: number) => (
                              <div key={idx} className="flex justify-between">
                                  <span className="font-mono font-semibold">Ổ {v.drive}</span>
                                  <span className={v.status === 'CRITICAL' ? 'text-red-600 font-bold' : v.status === 'WARNING' ? 'text-amber-600' : 'text-emerald-700'}>
                                      Trống {v.freeGB}/{v.totalGB} GB ({v.usedPercent}%)
                                  </span>
                              </div>
                          ))}
                      </div>
                  )}
                  {Array.isArray(hwHealth.alerts) && hwHealth.alerts.length > 0 && (
                      <div className="pt-1 border-t text-red-600 space-y-0.5">
                          {hwHealth.alerts.map((al: string, idx: number) => (
                              <div key={idx}>⚠️ {al}</div>
                          ))}
                      </div>
                  )}
              </div>
          ) : null;

          return (
             <div className="text-xs space-y-2">
                {cpu && <div className="truncate font-semibold text-slate-700 bg-slate-100 px-2 py-1 rounded" title={cpu}>CPU: {cpu}</div>}
                
                <div className="flex items-center gap-1.5 flex-wrap">
                    <Popover content={ramContent} title={null} placement="top">
                        <Tag color="blue" bordered={false} className="cursor-help m-0 hover:opacity-80 transition-opacity">RAM: {ram}</Tag>
                    </Popover>
                    {Array.isArray(gpus) && gpus.length > 0 && (
                        <Popover content={gpuContent} title={null} placement="top">
                            <Tag color="volcano" bordered={false} className="cursor-help m-0 hover:opacity-80 transition-opacity">GPU</Tag>
                        </Popover>
                    )}
                    {hwHealth && (
                        <Popover content={healthPopoverContent} title={null} placement="top">
                            <Tag
                                color={hwHealth.overallStatus === 'CRITICAL' ? 'error' : hwHealth.overallStatus === 'WARNING' ? 'warning' : 'success'}
                                className="cursor-help m-0 text-[10px]"
                            >
                                {hwHealth.overallStatus === 'CRITICAL'
                                    ? '🚨 Lỗi Phần cứng (S.M.A.R.T)'
                                    : hwHealth.overallStatus === 'WARNING'
                                    ? '⚠️ Cần chú ý (RAM/Ổ đĩa)'
                                    : '✓ CPU/RAM/Disk Tốt'}
                            </Tag>
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
      width: 240,
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
        sorter: (a: any, b: any) => {
            const factoryA = a.factory?.name || "";
            const factoryB = b.factory?.name || "";
            return factoryA.localeCompare(factoryB, 'vi');
        },
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
      fixed: isTabletOrMobile ? undefined : 'right',
      align: 'center',
      render: (_, record) => (
        <div className="flex flex-col gap-2 items-center">
          {hasPermission('ITAM_MAINTENANCE') && (
              <Tooltip title="Bảo trì / Sửa chữa">
                  <Button size="small" type="dashed" className="w-full text-orange-500 border-orange-200 hover:bg-orange-50 flex justify-center items-center" icon={<ToolOutlined />} onClick={() => handleOpenMaintenance(record)} />
              </Tooltip>
          )}
          <Space size="small">
              <Tooltip title="In tem QR thiết bị này">
                  <Button size="small" type="text" className="text-indigo-600 hover:bg-indigo-50" icon={<QrcodeOutlined />} onClick={() => handleOpenBatchPrintQR([record])} />
              </Tooltip>
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
    <div className="h-full flex flex-col">
      
      {/* HEADER SECTION */}
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
            <Input
                placeholder="Tìm tên máy, IP, người dùng..." 
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                onPressEnter={() => fetchData()} 
                prefix={<SearchOutlined className="text-gray-400" />}
                className="w-full sm:w-64"
                allowClear
            />
            
            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                <Tooltip title="Tải bộ cài Agent tự động gửi cấu hình cho máy không Join Domain (Win 7/10/11 & Ubuntu)">
                    <Button
                        icon={<DownloadOutlined />}
                        onClick={() => setAgentInstallerModalOpen(true)}
                        className="flex-shrink-0 text-amber-700 border-amber-300 bg-amber-50 hover:bg-amber-100"
                    >
                        Bộ cài Agent
                    </Button>
                </Tooltip>

                <Tooltip title="Quét mã QR trên thiết bị bằng Camera điện thoại / Máy quét">
                    <Button
                        icon={<ScanOutlined />}
                        onClick={() => setQrScannerOpen(true)}
                        className="flex-shrink-0 text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                    >
                        Quét QR
                    </Button>
                </Tooltip>

                <Tooltip title="In tem QR hàng loạt cho các máy đã chọn (hoặc toàn bộ danh sách)">
                    <Button
                        icon={<PrinterOutlined />}
                        onClick={() => handleOpenBatchPrintQR()}
                        className="flex-shrink-0 text-purple-600 border-purple-200 hover:bg-purple-50"
                    >
                        In tem QR {selectedRowKeys.length > 0 ? `(${selectedRowKeys.length})` : ''}
                    </Button>
                </Tooltip>

                <Tooltip title="Xuất dữ liệu Excel (.xlsx)">
                    <Button 
                        icon={<FileExcelOutlined />} 
                        onClick={exportToExcel}
                        className="flex-shrink-0 text-green-600 border-green-200 hover:bg-green-50"
                    >
                        Xuất Excel
                    </Button>
                </Tooltip>

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
            rowSelection={{
              selectedRowKeys,
              onChange: (keys) => setSelectedRowKeys(keys),
            }}
            columns={columns} 
            dataSource={data} 
            rowKey="id" 
            loading={loading} 
            scroll={{ x: 1200, y: isTabletOrMobile ? undefined : 'calc(100vh - 340px)' }} 
            pagination={{ 
                defaultPageSize: 20, 
                showSizeChanger: true, 
                showTotal: (total) => <span className="font-medium text-blue-600">Tổng số {total} thiết bị</span>,
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

      {/* MODAL QUÉT QR BẰNG ĐIỆN THOẠI / MÁY QUÉT USB */}
      <QRScannerModal
        isOpen={qrScannerOpen}
        onClose={() => setQrScannerOpen(false)}
        onScanSuccess={handleQRScanSuccess}
      />

      {/* MODAL THAO TÁC NHANH KHI QUÉT QR TRÊN ĐIỆN THOẠI (HIỂN THỊ ĐẦY ĐỦ CẤU HÌNH + PHẦN MỀM) */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-blue-700">
            <QrcodeOutlined />
            <span>Hồ sơ Thiết bị & Phần mềm (Quét QR)</span>
          </div>
        }
        open={!!scannedAsset}
        onCancel={() => setScannedAsset(null)}
        width={680}
        footer={null}
      >
        {scannedAsset && (
          <div className="space-y-3">
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs sm:text-sm">
              <div className="sm:col-span-2 flex items-center justify-between border-b pb-2 mb-1">
                <span className="text-base font-bold text-slate-800 font-mono">
                  {scannedAsset.name}{' '}
                  <Tag color="blue">{scannedAsset.type?.name || 'PC'}</Tag>
                </span>
                <Button
                  size="small"
                  type="link"
                  onClick={() => window.open(`/qr/asset/${encodeURIComponent(scannedAsset.name)}`, '_blank')}
                >
                  Mở trang Hồ sơ đầy đủ ↗
                </Button>
              </div>
              <div>
                <b>Hãng / Model:</b> {scannedAsset.manufacturer || '-'}{' '}
                {scannedAsset.modelName || ''}
              </div>
              <div>
                <b>Serial Number:</b>{' '}
                <span className="font-mono">{scannedAsset.serialNumber || 'N/A'}</span>
              </div>
              <div>
                <b>Hệ điều hành:</b> {scannedAsset.osName || 'N/A'}
              </div>
              <div>
                <b>IP / MAC:</b>{' '}
                <span className="font-mono">{scannedAsset.ipAddress || 'N/A'}</span>
              </div>
              <div>
                <b>Người dùng:</b>{' '}
                {scannedAsset.users?.map((u) => u.fullName).join(', ') ||
                  scannedAsset.domainUser ||
                  'Chưa cấp phát'}
              </div>
              <div>
                <b>Vị trí:</b> {scannedAsset.factory?.name || '-'}{' '}
                {scannedAsset.department ? `/ ${scannedAsset.department.name}` : ''}
              </div>
              <div>
                <b>CPU:</b> {(scannedAsset.customSpecs as any)?.cpu || 'N/A'}
              </div>
              <div>
                <b>RAM / Ổ cứng:</b> {(scannedAsset.customSpecs as any)?.ram || 'N/A'} •{' '}
                {(scannedAsset.customSpecs as any)?.disk || 'N/A'}
              </div>
            </div>

            {/* DANH SÁCH PHẦN MỀM ĐÃ CÀI TRÊN MÁY */}
            {Array.isArray((scannedAsset as any).softwares) && (
              <div className="border rounded-lg p-2.5 bg-white">
                <div className="font-bold text-xs sm:text-sm text-emerald-700 mb-2 flex items-center justify-between">
                  <span>💿 Phần mềm đang cài đặt trên máy ({(scannedAsset as any).softwares.length} phần mềm)</span>
                </div>
                <div className="max-h-52 overflow-y-auto divide-y text-xs">
                  {(scannedAsset as any).softwares.map((sw: any, idx: number) => (
                    <div key={sw.id || idx} className="py-1.5 flex items-center justify-between gap-2">
                      <span className="font-medium text-slate-800">{sw.name}</span>
                      <Tag color="geekblue" className="m-0 font-mono text-[10px]">
                        {sw.version || '-'}
                      </Tag>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
              <Button
                type="primary"
                icon={<ToolOutlined />}
                className="bg-orange-500 hover:!bg-orange-600 border-none"
                onClick={() => {
                  const target = scannedAsset;
                  setScannedAsset(null);
                  handleOpenMaintenance(target);
                }}
              >
                Lịch sử / Bảo trì
              </Button>
              <Button
                icon={<AuditOutlined />}
                onClick={() => {
                  const target = scannedAsset;
                  setScannedAsset(null);
                  handleViewSoftware(target);
                }}
              >
                Chi tiết Phần mềm
              </Button>
              <Button
                icon={<EditOutlined />}
                onClick={() => {
                  const target = scannedAsset;
                  setScannedAsset(null);
                  setEditingItem(target);
                  setIsModalOpen(true);
                }}
              >
                Chỉnh sửa máy
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL XEM TRƯỚC & IN TEM QR HÀNG LOẠT */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <QrcodeOutlined className="text-purple-600" />
            <span>In tem QR Tài sản ITAM ({qrAssetsToPrint.length} thiết bị)</span>
          </div>
        }
        open={qrPrintModalOpen}
        onCancel={() => setQrPrintModalOpen(false)}
        width={780}
        footer={[
          <Button key="cancel" onClick={() => setQrPrintModalOpen(false)}>
            Đóng
          </Button>,
          <Button
            key="print"
            type="primary"
            icon={<PrinterOutlined />}
            onClick={handleExecutePrintQR}
            className="bg-purple-600 hover:!bg-purple-500 border-none"
          >
            In {qrAssetsToPrint.length} Tem Ngay
          </Button>,
        ]}
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 bg-slate-50 p-3 rounded-lg border">
          <span className="text-xs sm:text-sm font-medium text-slate-700">
            Chọn khổ giấy in tem:
          </span>
          <Radio.Group
            value={qrLayoutMode}
            onChange={(e) => setQrLayoutMode(e.target.value)}
            buttonStyle="solid"
            size="small"
          >
            <Radio.Button value="THERMAL_50x30">
              Tem nhãn nhiệt 50x30mm (1 tem/nhãn)
            </Radio.Button>
            <Radio.Button value="A4_GRID">
              Giấy in A4 (Lưới 3 cột dán máy)
            </Radio.Button>
          </Radio.Group>
        </div>

        <div
          ref={qrPrintAreaRef}
          className="max-h-[420px] overflow-y-auto p-3 bg-white border rounded-lg grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3"
        >
          {qrAssetsToPrint.map((asset) => (
            <div
              key={asset.id}
              className="qr-label-card border border-dashed border-gray-300 rounded-lg p-2.5 flex items-center gap-3 bg-white"
            >
              <div className="qr-svg-wrap flex-shrink-0">
                <QRCodeSVG
                  value={`${window.location.origin}/qr/asset/${encodeURIComponent(asset.name)}`}
                  size={76}
                  level="M"
                />
              </div>
              <div className="qr-info flex-1 min-w-0">
                <div className="qr-company text-[10px] font-bold text-blue-700 uppercase">
                  TOWA IT ASSET
                </div>
                <div className="qr-hostname text-sm font-extrabold font-mono text-slate-900 truncate">
                  {asset.name}
                </div>
                <div className="qr-meta text-[11px] text-gray-600 truncate">
                  SN: {asset.serialNumber || 'N/A'}
                </div>
                <div className="qr-meta text-[11px] text-gray-500 truncate">
                  {asset.department?.name || asset.factory?.name || asset.modelName || 'ITAM'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Modal>

      {/* MODAL TẢI & CÀI ĐẶT TỰ ĐỘNG AGENT CHO MÁY KHÔNG JOIN DOMAIN (WIN 7/10/11 & UBUNTU) */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-amber-700 font-bold">
            <DownloadOutlined />
            <span>Bộ cài Tự động Đồng bộ cho máy KHÔNG Join Domain (Workgroup)</span>
          </div>
        }
        open={agentInstallerModalOpen}
        onCancel={() => setAgentInstallerModalOpen(false)}
        width={720}
        footer={[
          <Button key="close" type="primary" onClick={() => setAgentInstallerModalOpen(false)}>
            Đã hiểu & Đóng
          </Button>,
        ]}
      >
        <div className="space-y-4 text-xs sm:text-sm">
          <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-900">
            💡 <b>Giải pháp cho máy không Join Domain (Workgroup / Laptop cá nhân / Ubuntu):</b>{' '}
            Bạn chỉ cần chạy bộ cài dưới đây <b>1 lần duy nhất</b> trên máy người dùng. Bộ cài sẽ tự động đăng ký{' '}
            <b>Task Scheduler (Windows 7/10/11)</b> hoặc <b>Cronjob (Ubuntu)</b> chạy ngầm với quyền <code>SYSTEM/root</code>{' '}
            mỗi khi bật máy và lúc 08:45 sáng hàng ngày (đồng thời tự động tải bản script mới nhất từ Server).
          </div>

          {/* 1. WINDOWS 7 / 10 / 11 */}
          <div className="p-3.5 rounded-xl border bg-slate-50 space-y-2.5">
            <div className="font-bold text-slate-800 flex items-center justify-between">
              <span>🪟 Cách 1: Cho máy Windows 7, Windows 10, Windows 11 (Không Join Domain)</span>
              <Tag color="blue">Chạy 1 lần duy nhất</Tag>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="primary"
                icon={<DownloadOutlined />}
                href="/agent/cai_dat_tu_dong_windows.bat"
                download="cai_dat_tu_dong_windows.bat"
              >
                1. Tải cai_dat_tu_dong_windows.bat
              </Button>
              <Button
                icon={<DownloadOutlined />}
                href="/agent/powershell_phancung.ps1"
                download="powershell_phancung.ps1"
              >
                2. Tải powershell_phancung.ps1
              </Button>
            </div>

            <div className="text-gray-600 text-xs">
              👉 <b>Cách dùng:</b> Tải <code>cai_dat_tu_dong_windows.bat</code> về máy đó và nhấp đúp chuột chạy (bấm <b>Yes</b> khi hỏi quyền Admin). File sẽ tự động tải <code>powershell_phancung.ps1</code> từ Server về <code>C:\ProgramData\TowaITAM</code> và tạo lịch tự động chạy ngầm mỗi khi mở máy!
            </div>

            <div className="pt-1">
              <div className="text-xs font-semibold text-gray-500 mb-1">
                Hoặc mở <b>Command Prompt (Run as Administrator)</b> trên máy Windows và dán 1 dòng lệnh này:
              </div>
              <div className="flex items-center gap-2 bg-slate-900 text-emerald-400 p-2 rounded font-mono text-xs overflow-x-auto">
                <code className="flex-1 whitespace-nowrap">
                  {`powershell -NoProfile -ExecutionPolicy Bypass -Command "$wc=New-Object System.Net.WebClient;$wc.DownloadFile('${window.location.origin}/agent/cai_dat_tu_dong_windows.bat', '$env:TEMP\\install_itam.bat');Start-Process '$env:TEMP\\install_itam.bat' -Verb RunAs"`}
                </code>
                <Button
                  size="small"
                  icon={<CopyOutlined />}
                  onClick={() => {
                    navigator.clipboard.writeText(
                      `powershell -NoProfile -ExecutionPolicy Bypass -Command "$wc=New-Object System.Net.WebClient;$wc.DownloadFile('${window.location.origin}/agent/cai_dat_tu_dong_windows.bat', '$env:TEMP\\install_itam.bat');Start-Process '$env:TEMP\\install_itam.bat' -Verb RunAs"`
                    );
                    message.success('Đã sao chép lệnh cài đặt tự động cho Windows!');
                  }}
                >
                  Copy
                </Button>
              </div>
            </div>
          </div>

          {/* 2. UBUNTU / LINUX */}
          <div className="p-3.5 rounded-xl border bg-slate-50 space-y-2.5">
            <div className="font-bold text-slate-800 flex items-center justify-between">
              <span>🐧 Cách 2: Cho máy trạm / Server chạy Ubuntu / Debian Linux</span>
              <Tag color="orange">Tự động Cronjob @reboot & hàng ngày</Tag>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                icon={<DownloadOutlined />}
                href="/agent/cai_dat_tu_dong_ubuntu.sh"
                download="cai_dat_tu_dong_ubuntu.sh"
              >
                Tải cai_dat_tu_dong_ubuntu.sh
              </Button>
              <Button
                icon={<DownloadOutlined />}
                href="/agent/ubuntu_agent.sh"
                download="ubuntu_agent.sh"
              >
                Tải ubuntu_agent.sh
              </Button>
            </div>

            <div>
              <div className="text-xs font-semibold text-gray-500 mb-1">
                Hoặc mở <b>Terminal</b> trên máy Ubuntu và dán 1 dòng lệnh duy nhất dưới đây:
              </div>
              <div className="flex items-center gap-2 bg-slate-900 text-amber-300 p-2 rounded font-mono text-xs overflow-x-auto">
                <code className="flex-1 whitespace-nowrap">
                  {`curl -fsSL ${window.location.origin}/agent/cai_dat_tu_dong_ubuntu.sh | sudo bash`}
                </code>
                <Button
                  size="small"
                  icon={<CopyOutlined />}
                  onClick={() => {
                    navigator.clipboard.writeText(
                      `curl -fsSL ${window.location.origin}/agent/cai_dat_tu_dong_ubuntu.sh | sudo bash`
                    );
                    message.success('Đã sao chép lệnh cài đặt tự động cho Ubuntu!');
                  }}
                >
                  Copy
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AssetList;
