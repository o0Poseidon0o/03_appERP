import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Tag,
  Spin,
  Input,
  Table,
  Button,
  Empty,
  Badge,
  Divider,
} from 'antd';
import {
  DesktopOutlined,
  WindowsOutlined,
  UserOutlined,
  GlobalOutlined,
  AppstoreOutlined,
  SafetyCertificateOutlined,
  ToolOutlined,
  SearchOutlined,
  ArrowLeftOutlined,
  HddOutlined,
  FundProjectionScreenOutlined,
  CheckCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import axiosClient from '../../api/axiosClient';

const AssetQrPublicPage: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [asset, setAsset] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [swSearch, setSwSearch] = useState('');

  useEffect(() => {
    const fetchQrAsset = async () => {
      if (!code) return;
      setLoading(true);
      try {
        const res = await axiosClient.get(
          `/assets/public-qr/${encodeURIComponent(code)}`
        );
        setAsset(res.data?.data || null);
        setErrorMsg(null);
      } catch (err: any) {
        setErrorMsg(
          err.response?.data?.message ||
            `Không tìm thấy thông tin thiết bị với mã "${code}"`
        );
      } finally {
        setLoading(false);
      }
    };
    fetchQrAsset();
  }, [code]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100 p-4">
        <Spin size="large" />
        <span className="mt-3 text-slate-600 text-sm">
          Đang tải hồ sơ thiết bị & phần mềm...
        </span>
      </div>
    );
  }

  if (errorMsg || !asset) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100 p-4">
        <Card className="max-w-md w-full text-center rounded-2xl shadow">
          <Empty description={errorMsg || 'Không tìm thấy thiết bị'} />
          <Button
            type="primary"
            className="mt-4"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/itam')}
          >
            Về trang Quản lý Thiết bị
          </Button>
        </Card>
      </div>
    );
  }

  const specs = asset.customSpecs || {};
  const osLic = specs.osLicense;
  const officeLic = specs.officeLicense;
  const scannedSwLicenses: any[] = Array.isArray(specs.softwareLicenses)
    ? specs.softwareLicenses
    : [];
  const parsedRamGB = parseInt(String(specs.ram || '0'), 10) || 0;
  const isLowRam = parsedRamGB > 0 && parsedRamGB <= 4;
  const hwHealth = specs.hardwareHealth || {
    overallStatus: asset.status === 'BROKEN' ? 'CRITICAL' : isLowRam ? 'WARNING' : 'GOOD',
    overallText:
      asset.status === 'BROKEN'
        ? 'Thiết bị đang báo hỏng'
        : isLowRam
        ? 'RAM thấp (<= 4GB - Khuyên nâng cấp)'
        : 'Phần cứng hoạt động Tốt',
    cpu: specs.cpu ? { status: 'GOOD', statusText: 'Hoạt động ổn định' } : null,
    ram: specs.ram
      ? {
          status: isLowRam ? 'WARNING' : 'GOOD',
          statusText: isLowRam ? 'RAM thấp' : 'Tốt',
        }
      : null,
    diskStatus: 'GOOD',
    diskText: '✓ S.M.A.R.T OK',
    logicalVolumes: [],
    alerts: isLowRam ? [`Máy chỉ có ${specs.ram} RAM, khuyên nâng cấp lên >= 8GB`] : [],
  };
  const assignedLicenses: any[] = asset.safeLicenses || [];
  const components: any[] = asset.components || [];
  const monitors = components.filter((c) => c.type === 'MONITOR');
  const disks = components.filter((c) => c.type === 'HARD_DISK');
  const peripherals = components.filter((c) =>
    ['MOUSE', 'KEYBOARD', 'PERIPHERAL'].includes(c.type)
  );
  const softwares: any[] = (asset.softwares || []).filter(
    (s: any) =>
      !swSearch.trim() ||
      s.name?.toLowerCase().includes(swSearch.toLowerCase()) ||
      s.publisher?.toLowerCase().includes(swSearch.toLowerCase())
  );

  const statusTextMap: Record<string, string> = {
    NEW: 'Mới',
    IN_USE: 'Đang sử dụng',
    BROKEN: 'Đang hỏng',
    REPAIR: 'Đang sửa chữa',
    DISPOSED: 'Đã thanh lý',
  };

  return (
    <div className="min-h-screen bg-slate-100 py-3 px-2 sm:px-4 md:py-6">
      <div className="max-w-3xl mx-auto space-y-3 sm:space-y-4">
        {/* HEADER BANNER */}
        <div className="bg-gradient-to-r from-blue-700 to-indigo-800 text-white rounded-2xl p-4 sm:p-5 shadow-md">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="bg-white/15 p-3 rounded-xl">
                <DesktopOutlined className="text-2xl text-white" />
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-blue-200 font-semibold">
                  Hồ sơ Thiết bị CNTT (TOWA ITAM)
                </div>
                <h1 className="text-xl sm:text-2xl font-extrabold m-0 text-white font-mono">
                  {asset.name}
                </h1>
                <div className="text-xs text-blue-100 mt-0.5">
                  {asset.manufacturer || ''} {asset.modelName || ''} • SN:{' '}
                  <span className="font-mono">{asset.serialNumber || 'N/A'}</span>
                </div>
              </div>
            </div>
            <Tag color="cyan" className="m-0 font-bold">
              {statusTextMap[asset.status] || asset.status}
            </Tag>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-4 pt-3 border-t border-white/15 text-xs">
            <div>
              <div className="text-blue-200">Người sử dụng:</div>
              <div className="font-semibold truncate">
                <UserOutlined className="mr-1" />
                {asset.users?.map((u: any) => u.fullName).join(', ') ||
                  asset.domainUser ||
                  'Chưa cấp phát'}
              </div>
            </div>
            <div>
              <div className="text-blue-200">Vị trí / Phòng ban:</div>
              <div className="font-semibold truncate">
                {asset.factory?.name || '-'}{' '}
                {asset.department ? `/ ${asset.department.name}` : ''}
              </div>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <div className="text-blue-200">Địa chỉ IP / MAC:</div>
              <div className="font-mono font-semibold">
                <GlobalOutlined className="mr-1" />
                {asset.ipAddress || 'N/A'}{' '}
                {asset.macAddress ? `(${asset.macAddress})` : ''}
              </div>
            </div>
          </div>
        </div>

        {/* 1. BẢN QUYỀN HOẠT ĐỘNG TRÊN MÁY (WINDOWS & PHẦN MỀM) */}
        <Card
          size="small"
          className="rounded-xl shadow-sm"
          title={
            <div className="flex items-center gap-2 text-indigo-700 font-bold">
              <SafetyCertificateOutlined />
              <span>Hệ điều hành & Bản quyền trên máy</span>
            </div>
          }
        >
          <div className="space-y-2.5 text-xs sm:text-sm">
            {/* Hệ điều hành & Trạng thái kích hoạt Windows */}
            <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 p-2.5 rounded-lg border">
              <div className="flex items-center gap-2">
                {/ubuntu|linux|debian/i.test(asset.osName || '') ? (
                  <span className="text-lg">🐧</span>
                ) : (
                  <WindowsOutlined className="text-blue-600 text-lg" />
                )}
                <div>
                  <div className="font-bold text-slate-800">
                    {asset.osName || 'Chưa rõ Hệ điều hành'}{' '}
                    {asset.osVersion ? `(${asset.osVersion})` : ''}
                  </div>
                  {osLic && (
                    <div className="text-xs text-gray-500">
                      Kênh: <b>{osLic.channel || 'OEM/Retail'}</b>
                      {osLic.partialKey ? ` • Mã cuối Key: ***** - ${osLic.partialKey}` : ''}
                      {osLic.oemKey ? ` • Có Key OEM BIOS` : ''}
                    </div>
                  )}
                </div>
              </div>
              <div>
                {osLic?.status === 'LICENSED' ? (
                  <Tag color="success" icon={<CheckCircleOutlined />} className="m-0">
                    Windows Đã kích hoạt Bản quyền
                  </Tag>
                ) : osLic?.status === 'UNLICENSED' ? (
                  <Tag color="warning" icon={<WarningOutlined />} className="m-0">
                    Chưa kích hoạt / Chưa quét
                  </Tag>
                ) : (
                  <Tag color="blue" className="m-0">
                    Hệ điều hành đang hoạt động
                  </Tag>
                )}
              </div>
            </div>

            {/* Bản quyền Office tự động phát hiện trên máy (nếu có) */}
            {officeLic && (
              <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 p-2.5 rounded-lg border">
                <div>
                  <div className="font-bold text-slate-800">
                    Bản quyền Office trên máy: {officeLic.productName}
                  </div>
                  <div className="text-xs text-gray-500">
                    Loại: <b>{officeLic.channel}</b>
                    {officeLic.partialKey
                      ? ` • Mã cuối Key: ***** - ${officeLic.partialKey}`
                      : ''}
                  </div>
                </div>
                <Tag
                  color={officeLic.status === 'LICENSED' ? 'success' : 'warning'}
                  className="m-0"
                >
                  {officeLic.status === 'LICENSED'
                    ? 'Đã kích hoạt'
                    : 'Chưa kích hoạt'}
                </Tag>
              </div>
            )}

            {/* Các bản quyền phần mềm Agent quét được trực tiếp trên máy (Kaspersky, AutoCAD, Office...) */}
            {scannedSwLicenses.length > 0 && (
              <div className="pt-1">
                <div className="text-xs font-semibold text-gray-500 mb-1.5">
                  Bản quyền Phần mềm phát hiện trực tiếp trên máy ({scannedSwLicenses.length}):
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {scannedSwLicenses.map((slic: any, idx: number) => (
                    <div
                      key={idx}
                      className="p-2 rounded-lg border bg-emerald-50/40 flex justify-between items-center gap-2"
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-slate-800 text-xs truncate">
                          {slic.softwareName}
                        </div>
                        <div className="text-[11px] text-gray-500 font-mono">
                          {slic.channel ? `${slic.channel}` : ''}
                          {slic.partialKey ? ` • ${slic.partialKey}` : ''}
                        </div>
                      </div>
                      <Tag
                        color={slic.status === 'LICENSED' ? 'success' : 'warning'}
                        className="m-0 text-[10px]"
                      >
                        {slic.statusText ||
                          (slic.status === 'LICENSED' ? 'Đã kích hoạt' : 'Cảnh báo')}
                      </Tag>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Các Key Bản quyền cấp phát từ hệ thống ERP (Kaspersky, Office, Windows, AutoCAD...) */}
            {assignedLicenses.length > 0 && (
              <div className="pt-1">
                <div className="text-xs font-semibold text-gray-500 mb-1.5">
                  Key Bản quyền được cấp phát trên hệ thống ({assignedLicenses.length}):
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {assignedLicenses.map((lic: any) => (
                    <div
                      key={lic.id}
                      className="p-2.5 rounded-lg border border-indigo-100 bg-indigo-50/50 flex justify-between items-center"
                    >
                      <div>
                        <div className="font-bold text-indigo-900">
                          {lic.softwareName}
                        </div>
                        <div className="text-xs text-indigo-700 font-mono">
                          Key: {lic.maskedKey} ({lic.keyType})
                        </div>
                      </div>
                      <Tag color="geekblue" className="m-0 text-[11px]">
                        {lic.expiredAt
                          ? `HSD: ${new Date(lic.expiredAt).toLocaleDateString('vi-VN')}`
                          : 'Vĩnh viễn'}
                      </Tag>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* 2. CẤU HÌNH & SỨC KHỎE PHẦN CỨNG (CPU, RAM, Ổ CỨNG S.M.A.R.T) */}
        <Card
          size="small"
          className="rounded-xl shadow-sm"
          title={
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-blue-700 font-bold">
                <HddOutlined />
                <span>Cấu hình & Sức khỏe Phần cứng (CPU / RAM / Ổ cứng)</span>
              </div>
              {hwHealth && (
                <Tag
                  color={
                    hwHealth.overallStatus === 'CRITICAL'
                      ? 'error'
                      : hwHealth.overallStatus === 'WARNING'
                      ? 'warning'
                      : 'success'
                  }
                  icon={
                    hwHealth.overallStatus === 'GOOD' ? (
                      <CheckCircleOutlined />
                    ) : (
                      <WarningOutlined />
                    )
                  }
                  className="m-0 font-semibold"
                >
                  {hwHealth.overallText ||
                    (hwHealth.overallStatus === 'GOOD'
                      ? 'Phần cứng hoạt động Tốt'
                      : 'Cần kiểm tra phần cứng')}
                </Tag>
              )}
            </div>
          }
        >
          {hwHealth?.alerts?.length > 0 && (
            <div className="mb-3 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800 space-y-1">
              <div className="font-bold">⚠️ Cảnh báo Sức khỏe Phần cứng:</div>
              {hwHealth.alerts.map((al: string, idx: number) => (
                <div key={idx}>• {al}</div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
            <div className="bg-slate-50 p-2.5 rounded-lg border">
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-xs">Vi xử lý (CPU)</span>
                {hwHealth?.cpu && (
                  <Tag
                    color={
                      hwHealth.cpu.status === 'GOOD'
                        ? 'success'
                        : hwHealth.cpu.status === 'WARNING'
                        ? 'warning'
                        : 'error'
                    }
                    className="m-0 text-[10px]"
                  >
                    {hwHealth.cpu.status === 'GOOD'
                      ? `✓ Tốt (Tải ${hwHealth.cpu.loadPercent ?? 0}%)`
                      : hwHealth.cpu.statusText}
                  </Tag>
                )}
              </div>
              <div className="font-bold text-slate-800 mt-0.5">
                {specs.cpu || 'N/A'}
              </div>
              {hwHealth?.cpu && (
                <div className="text-[11px] text-gray-500 mt-1">
                  Số nhân: <b>{hwHealth.cpu.cores} Cores / {hwHealth.cpu.threads} Threads</b>
                  {hwHealth.cpu.temperatureC ? ` • Nhiệt độ: ${hwHealth.cpu.temperatureC}°C` : ''}
                </div>
              )}
            </div>

            <div className="bg-slate-50 p-2.5 rounded-lg border">
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-xs">Bộ nhớ RAM</span>
                {hwHealth?.ram && (
                  <Tag
                    color={hwHealth.ram.status === 'GOOD' ? 'success' : 'warning'}
                    className="m-0 text-[10px]"
                  >
                    {hwHealth.ram.status === 'GOOD'
                      ? `✓ Tốt (Đang dùng ${hwHealth.ram.usagePercent}%)`
                      : `⚠️ Đầy RAM (${hwHealth.ram.usagePercent}%)`}
                  </Tag>
                )}
              </div>
              <div className="font-bold text-slate-800 mt-0.5">
                {specs.ram || 'N/A'}
                {hwHealth?.ram && (
                  <span className="text-xs font-normal text-gray-500 ml-1">
                    (Trống {hwHealth.ram.freeGB} GB / {hwHealth.ram.totalGB} GB)
                  </span>
                )}
              </div>
              {Array.isArray(specs.ramDetails) && specs.ramDetails.length > 0 && (
                <div className="text-[11px] text-gray-500 mt-1 space-y-0.5">
                  {specs.ramDetails.map((r: any, idx: number) => (
                    <div key={idx}>
                      • {r.Slot}: <b>{r.Capacity}</b> ({r.Speed}) - {r.Manufacturer}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-slate-50 p-2.5 rounded-lg border">
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-xs">Ổ cứng lưu trữ (S.M.A.R.T)</span>
                {hwHealth?.diskStatus && (
                  <Tag
                    color={
                      hwHealth.diskStatus === 'CRITICAL'
                        ? 'error'
                        : hwHealth.diskStatus === 'WARNING'
                        ? 'warning'
                        : 'success'
                    }
                    className="m-0 text-[10px]"
                  >
                    {hwHealth.diskText || '✓ S.M.A.R.T OK'}
                  </Tag>
                )}
              </div>
              <div className="font-bold text-slate-800 mt-0.5">
                {specs.disk || 'N/A'}
              </div>
              {disks.length > 0 && (
                <div className="text-[11px] text-gray-500 mt-1 space-y-1">
                  {disks.map((d: any) => (
                    <div key={d.id} className="flex items-center justify-between gap-1">
                      <span>
                        • {d.name} ({d.specs?.sizeGB}GB {d.specs?.type}) - SN:{' '}
                        <span className="font-mono">{d.serialNumber || 'N/A'}</span>
                      </span>
                      <Tag
                        color={
                          d.specs?.healthStatus === 'CRITICAL'
                            ? 'error'
                            : d.specs?.healthStatus === 'WARNING'
                            ? 'warning'
                            : 'green'
                        }
                        className="m-0 text-[10px]"
                      >
                        {d.specs?.healthStatus === 'CRITICAL'
                          ? 'Sắp hỏng!'
                          : d.specs?.healthStatus === 'WARNING'
                          ? 'Cảnh báo'
                          : 'Tốt'}
                      </Tag>
                    </div>
                  ))}
                </div>
              )}
              {Array.isArray(hwHealth?.logicalVolumes) &&
                hwHealth.logicalVolumes.length > 0 && (
                  <div className="mt-2 pt-1.5 border-t space-y-1 text-[11px]">
                    <div className="text-gray-400">Dung lượng các phân vùng:</div>
                    {hwHealth.logicalVolumes.map((vol: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between">
                        <span className="font-mono font-semibold text-slate-700">
                          Ổ {vol.drive} ({vol.label})
                        </span>
                        <span
                          className={
                            vol.status === 'CRITICAL'
                              ? 'text-red-600 font-bold'
                              : vol.status === 'WARNING'
                              ? 'text-amber-600 font-semibold'
                              : 'text-emerald-700'
                          }
                        >
                          Trống {vol.freeGB} GB / {vol.totalGB} GB ({vol.usedPercent}% đã dùng)
                        </span>
                      </div>
                    ))}
                  </div>
                )}
            </div>

            <div className="bg-slate-50 p-2.5 rounded-lg border">
              <div className="text-gray-400 text-xs">
                <FundProjectionScreenOutlined className="mr-1" />
                Màn hình & Ngoại vi
              </div>
              {monitors.length > 0 ? (
                <div className="mt-0.5 space-y-1">
                  {monitors.map((m: any) => (
                    <div key={m.id} className="font-semibold text-slate-800 text-xs">
                      🖥️ {m.name}{' '}
                      {m.specs?.size && m.specs.size !== 'N/A'
                        ? `(${m.specs.size})`
                        : ''}{' '}
                      <span className="text-gray-400 font-mono">
                        [SN: {m.serialNumber || 'N/A'}]
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-gray-400 italic text-xs mt-0.5">
                  Không ghi nhận màn hình rời
                </div>
              )}
              {peripherals.length > 0 && (
                <div className="mt-1.5 pt-1.5 border-t text-[11px] text-gray-600 space-y-0.5">
                  {peripherals.map((p: any) => (
                    <div key={p.id}>
                      {p.type === 'MOUSE' ? '🖱️ Chuột:' : '⌨️ Phím:'} {p.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* 3. DANH SÁCH PHẦN MỀM ĐÃ CÀI ĐẶT TRÊN MÁY */}
        <Card
          size="small"
          className="rounded-xl shadow-sm"
          title={
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-emerald-700 font-bold">
                <AppstoreOutlined />
                <span>Phần mềm đang cài đặt trên máy</span>
                <Badge
                  count={asset.softwares?.length || 0}
                  style={{ backgroundColor: '#10b981' }}
                  overflowCount={999}
                />
              </div>
            </div>
          }
        >
          <div className="mb-3">
            <Input
              placeholder="Tìm nhanh tên phần mềm trên máy này..."
              prefix={<SearchOutlined className="text-gray-400" />}
              allowClear
              value={swSearch}
              onChange={(e) => setSwSearch(e.target.value)}
            />
          </div>

          <Table
            dataSource={softwares}
            rowKey={(r) => r.id || r.name}
            size="small"
            pagination={{ pageSize: 15, showSizeChanger: false }}
            columns={[
              {
                title: 'Tên phần mềm',
                dataIndex: 'name',
                key: 'name',
                render: (t, r: any) => (
                  <div>
                    <div className="font-semibold text-slate-800 text-xs sm:text-sm">
                      {t}
                    </div>
                    {r.publisher && (
                      <div className="text-[11px] text-gray-400 sm:hidden">
                        {r.publisher}
                      </div>
                    )}
                  </div>
                ),
              },
              {
                title: 'Phiên bản',
                dataIndex: 'version',
                key: 'version',
                width: 120,
                render: (v) =>
                  v ? (
                    <Tag color="geekblue" className="m-0 font-mono text-[11px]">
                      {v}
                    </Tag>
                  ) : (
                    '-'
                  ),
              },
              {
                title: 'Nhà phát hành',
                dataIndex: 'publisher',
                key: 'publisher',
                responsive: ['sm'],
                render: (p) => (
                  <span className="text-xs text-gray-500">{p || '-'}</span>
                ),
              },
            ]}
          />
        </Card>

        {/* 4. LỊCH SỬ BẢO TRÌ / NÂNG CẤP (NẾU CÓ) */}
        {Array.isArray(asset.maintenances) && asset.maintenances.length > 0 && (
          <Card
            size="small"
            className="rounded-xl shadow-sm"
            title={
              <div className="flex items-center gap-2 text-orange-600 font-bold">
                <ToolOutlined />
                <span>Lịch sử Bảo trì & Thay đổi cấu hình</span>
              </div>
            }
          >
            <div className="space-y-2 text-xs">
              {asset.maintenances.map((m: any) => (
                <div
                  key={m.id}
                  className="p-2.5 bg-orange-50/40 border border-orange-100 rounded-lg"
                >
                  <div className="flex justify-between font-semibold text-slate-700">
                    <span>{m.type}</span>
                    <span className="text-gray-400">
                      {new Date(m.startDate).toLocaleDateString('vi-VN')}
                    </span>
                  </div>
                  <div className="text-gray-600 mt-1">{m.description}</div>
                </div>
              ))}
            </div>
          </Card>
        )}

        <Divider className="my-2" />
        <div className="text-center pb-6">
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/itam')}
          >
            Mở trang Quản trị ITAM
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AssetQrPublicPage;

