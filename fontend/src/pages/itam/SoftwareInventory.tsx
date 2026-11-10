import { useEffect, useState } from 'react';
import {
  Table,
  Card,
  Input,
  Tag,
  Button,
  Drawer,
  Space,
  Tooltip,
  message,
  Popconfirm,
  Tabs,
  Modal,
  Form,
  Select,
  InputNumber,
  DatePicker,
  Progress,
  Badge,
  Alert,
} from 'antd';
import {
  AppstoreOutlined,
  SearchOutlined,
  EyeOutlined,
  DesktopOutlined,
  UserOutlined,
  ReloadOutlined,
  FileExcelOutlined,
  ClearOutlined,
  KeyOutlined,
  SafetyCertificateOutlined,
  StopOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CopyOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import axiosClient from '../../api/axiosClient';
import {
  softwareService,
  type SoftwareSummary,
  type SoftwareDetail,
  type SoftwarePolicyItem,
  type SoftwareLicenseKeyItem,
} from '../../services/softwareService';

const SoftwareInventory = () => {
  // --- STATE KIỂM KÊ ---
  const [activeTab, setActiveTab] = useState<string>('inventory');
  const [data, setData] = useState<SoftwareSummary[]>([]);
  const [policies, setPolicies] = useState<SoftwarePolicyItem[]>([]);
  const [licenseKeys, setLicenseKeys] = useState<SoftwareLicenseKeyItem[]>([]);
  const [allAssets, setAllAssets] = useState<any[]>([]);

  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [keySearchText, setKeySearchText] = useState('');

  // State cho Drawer chi tiết máy cài
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedSoftware, setSelectedSoftware] = useState<string>('');
  const [detailData, setDetailData] = useState<SoftwareDetail[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // State cho Modal Chính sách Phần mềm (License / Blacklist)
  const [policyModalOpen, setPolicyModalOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<SoftwarePolicyItem | null>(null);
  const [policySubmitting, setPolicySubmitting] = useState(false);
  const [policyForm] = Form.useForm();

  // State cho Modal Quản lý Key Bản quyền (Kaspersky, Office, CAD...)
  const [keyModalOpen, setKeyModalOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<SoftwareLicenseKeyItem | null>(null);
  const [keySubmitting, setKeySubmitting] = useState(false);
  const [keyForm] = Form.useForm();

  // State cho Modal Gán Key vào Máy tính
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assigningKey, setAssigningKey] = useState<SoftwareLicenseKeyItem | null>(null);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [assignSubmitting, setAssignSubmitting] = useState(false);

  // State cho Tab Bản quyền theo Máy người dùng & Windows
  const [machineSearchText, setMachineSearchText] = useState('');
  const [machineLicenseFilter, setMachineLicenseFilter] = useState<string>('ALL');
  const [quickAssignAsset, setQuickAssignAsset] = useState<any | null>(null);
  const [selectedKeyIdForAsset, setSelectedKeyIdForAsset] = useState<string | undefined>(undefined);
  const [quickAssignLoading, setQuickAssignLoading] = useState(false);

  // --- FETCH ALL DATA ---
  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [invRes, polRes, keyRes, assetsRes] = await Promise.all([
        softwareService.getInventory(),
        softwareService.getPolicies().catch(() => ({ data: { data: [] } })),
        softwareService.getLicenseKeys().catch(() => ({ data: { data: [] } })),
        axiosClient.get('/assets?limit=1000').catch(() => ({ data: { data: [] } })),
      ]);
      setData(invRes.data?.data || []);
      setPolicies(polRes.data?.data || []);
      setLicenseKeys(keyRes.data?.data || []);
      setAllAssets(assetsRes.data?.data || []);
    } catch (error) {
      message.error('Không thể tải dữ liệu phần mềm');
    } finally {
      setLoading(false);
    }
  };

  const fetchAssetsForAssign = async () => {
    if (allAssets.length > 0) return;
    try {
      const res = await axiosClient.get('/assets?limit=1000');
      setAllAssets(res.data?.data || []);
    } catch {
      // ignore
    }
  };

  const handleQuickAssignKeyToMachine = async () => {
    if (!quickAssignAsset || !selectedKeyIdForAsset) {
      message.warning('Vui lòng chọn Key bản quyền cần gán cho máy này!');
      return;
    }
    setQuickAssignLoading(true);
    try {
      await softwareService.assignLicenseKey(selectedKeyIdForAsset, [quickAssignAsset.id]);
      message.success(`Đã gán Key bản quyền cho máy ${quickAssignAsset.name}!`);
      setQuickAssignAsset(null);
      setSelectedKeyIdForAsset(undefined);
      fetchAllData();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Lỗi khi gán Key cho máy');
    } finally {
      setQuickAssignLoading(false);
    }
  };

  const handleUnassignKeyFromMachine = async (keyId: string, assetId: string) => {
    try {
      await softwareService.unassignLicenseKey(keyId, assetId);
      message.success('Đã thu hồi Key khỏi máy tính!');
      fetchAllData();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Lỗi khi thu hồi Key');
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // --- HANDLE CLEANUP / NORMALIZE DB ---
  const handleCleanup = async () => {
    setCleaning(true);
    try {
      const res = await softwareService.cleanupInventory();
      message.success(res.data?.message || 'Đã chuẩn hóa danh sách phần mềm!');
      fetchAllData();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Lỗi khi chuẩn hóa dữ liệu');
    } finally {
      setCleaning(false);
    }
  };

  // --- HANDLE POLICY MODAL ---
  const handleOpenPolicyModal = (
    initial?: Partial<SoftwarePolicyItem>,
    existingPolicy?: SoftwarePolicyItem | null
  ) => {
    if (existingPolicy) {
      setEditingPolicy(existingPolicy);
      policyForm.setFieldsValue({
        name: existingPolicy.name,
        matchKeyword: existingPolicy.matchKeyword,
        category: existingPolicy.category,
        totalSeats: existingPolicy.totalSeats,
        publisher: existingPolicy.publisher || '',
        note: existingPolicy.note || '',
      });
    } else {
      setEditingPolicy(null);
      policyForm.setFieldsValue({
        name: initial?.name || '',
        matchKeyword: initial?.matchKeyword || initial?.name || '',
        category: initial?.category || 'LICENSED',
        totalSeats: initial?.totalSeats ?? 10,
        publisher: initial?.publisher || '',
        note: initial?.note || '',
      });
    }
    setPolicyModalOpen(true);
  };

  const handleSavePolicy = async (values: any) => {
    setPolicySubmitting(true);
    try {
      if (editingPolicy?.id) {
        await softwareService.updatePolicy(editingPolicy.id, values);
        message.success('Đã cập nhật chính sách phần mềm!');
      } else {
        await softwareService.upsertPolicy(values);
        message.success('Đã lưu chính sách phần mềm!');
      }
      setPolicyModalOpen(false);
      fetchAllData();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Lỗi khi lưu chính sách');
    } finally {
      setPolicySubmitting(false);
    }
  };

  const handleDeletePolicy = async (id: string) => {
    try {
      await softwareService.deletePolicy(id);
      message.success('Đã xóa chính sách phần mềm!');
      fetchAllData();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Lỗi khi xóa chính sách');
    }
  };

  // --- HANDLE LICENSE KEY MODAL ---
  const handleOpenKeyModal = (
    keyRecord?: SoftwareLicenseKeyItem | null,
    prefillPolicyId?: string,
    prefillSoftwareName?: string
  ) => {
    fetchAssetsForAssign();
    if (keyRecord) {
      setEditingKey(keyRecord);
      keyForm.setFieldsValue({
        policyId: keyRecord.policyId,
        licenseKey: keyRecord.licenseKey,
        keyType: keyRecord.keyType,
        maxSeats: keyRecord.maxSeats,
        expiredAt: keyRecord.expiredAt ? dayjs(keyRecord.expiredAt) : null,
        supplier: keyRecord.supplier || '',
        invoiceCode: keyRecord.invoiceCode || '',
        status: keyRecord.status,
        note: keyRecord.note || '',
        assetIds: keyRecord.assignments?.map((a) => a.assetId) || [],
      });
    } else {
      setEditingKey(null);
      keyForm.resetFields();
      keyForm.setFieldsValue({
        policyId: prefillPolicyId || undefined,
        softwareName: prefillSoftwareName || '',
        keyType: 'SUBSCRIPTION',
        maxSeats: 10,
        status: 'ACTIVE',
        assetIds: [],
      });
    }
    setKeyModalOpen(true);
  };

  const handleSaveKey = async (values: any) => {
    setKeySubmitting(true);
    try {
      const payload = {
        ...values,
        expiredAt: values.expiredAt ? values.expiredAt.toISOString() : null,
      };
      if (editingKey) {
        await softwareService.updateLicenseKey(editingKey.id, payload);
        message.success('Đã cập nhật Key bản quyền!');
      } else {
        await softwareService.createLicenseKey(payload);
        message.success('Đã thêm Key bản quyền mới!');
      }
      setKeyModalOpen(false);
      fetchAllData();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Lỗi khi lưu Key bản quyền');
    } finally {
      setKeySubmitting(false);
    }
  };

  const handleDeleteKey = async (id: string) => {
    try {
      await softwareService.deleteLicenseKey(id);
      message.success('Đã xóa Key bản quyền!');
      fetchAllData();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Lỗi khi xóa Key');
    }
  };

  // --- HANDLE ASSIGN KEY TO ASSETS MODAL ---
  const handleOpenAssignModal = (keyRecord: SoftwareLicenseKeyItem) => {
    fetchAssetsForAssign();
    setAssigningKey(keyRecord);
    setSelectedAssetIds(keyRecord.assignments?.map((a) => a.assetId) || []);
    setAssignModalOpen(true);
  };

  const handleSaveAssignAssets = async () => {
    if (!assigningKey) return;
    if (selectedAssetIds.length > assigningKey.maxSeats) {
      message.error(
        `Key này chỉ cho phép kích hoạt tối đa ${assigningKey.maxSeats} máy (Đang chọn ${selectedAssetIds.length} máy)!`
      );
      return;
    }
    setAssignSubmitting(true);
    try {
      await softwareService.updateLicenseKey(assigningKey.id, {
        assetIds: selectedAssetIds,
      });
      message.success('Đã cập nhật danh sách máy gán Key bản quyền!');
      setAssignModalOpen(false);
      fetchAllData();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Lỗi khi gán máy');
    } finally {
      setAssignSubmitting(false);
    }
  };

  // --- HANDLE EXPORT FULL EXCEL REPORT (3 SHEETS) ---
  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const wb = XLSX.utils.book_new();

      // Sheet 1: Tổng hợp phần mềm & Đối chiếu Bản quyền / Blacklist
      const summaryRows = filteredData.map((item, idx) => {
        const pol = item.policy;
        let categoryLabel = 'Thông thường / Miễn phí';
        let complianceStatus = 'Hợp lệ';
        if (pol?.category === 'BLACKLIST') {
          categoryLabel = 'PHẦN MỀM CẤM (BLACKLIST)';
          complianceStatus = item.installCount > 0 ? 'VI PHẠM CHÍNH SÁCH' : 'An toàn';
        } else if (pol?.category === 'LICENSED') {
          categoryLabel = 'Có Bản quyền (Licensed)';
          complianceStatus =
            pol.totalSeats > 0 && item.installCount > pol.totalSeats
              ? `Vượt quá ${item.installCount - pol.totalSeats} bản quyền`
              : 'Đủ bản quyền';
        }

        return {
          STT: idx + 1,
          'Tên Phần Mềm': item.name,
          'Nhà Phát Hành': item.publisher !== 'Unknown' ? item.publisher : 'Không rõ',
          'Phân Loại': categoryLabel,
          'Số License Đã Mua': pol?.category === 'LICENSED' ? pol.totalSeats : '-',
          'Số Máy Thực Tế Đang Cài': item.installCount,
          'Trạng Thái Tuân Thủ': complianceStatus,
          'Ghi Chú Chính Sách': pol?.note || '',
        };
      });

      const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
      wsSummary['!cols'] = [
        { wch: 6 },
        { wch: 38 },
        { wch: 26 },
        { wch: 26 },
        { wch: 18 },
        { wch: 22 },
        { wch: 26 },
        { wch: 32 },
      ];
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Tong_Hop_Ban_Quyen');

      // Sheet 2: Danh sách Key Bản quyền (Kaspersky, Office, AutoCAD...)
      if (licenseKeys.length > 0) {
        const keyRows = licenseKeys.map((k, idx) => ({
          STT: idx + 1,
          'Phần Mềm': k.policy?.name || '',
          'Mã Key Bản Quyền': k.licenseKey,
          'Loại Key': k.keyType,
          'Số Máy Tối Đa (Seats)': k.maxSeats,
          'Đã Cấp Phát': k.assignedCount,
          'Còn Trống': k.remainingSeats,
          'Ngày Hết Hạn': k.expiredAt ? dayjs(k.expiredAt).format('DD/MM/YYYY') : 'Vĩnh viễn',
          'Trạng Thái':
            k.computedStatus === 'EXPIRED'
              ? 'Đã hết hạn'
              : k.computedStatus === 'EXPIRING_SOON'
              ? `Sắp hết hạn (còn ${k.daysUntilExpiry} ngày)`
              : 'Đang hoạt động',
          'Nhà Cung Cấp': k.supplier || '',
          'Số Hợp Đồng / Hóa Đơn': k.invoiceCode || '',
          'Danh Sách Máy Đã Gán': k.assignments?.map((a) => a.asset?.name).join(', ') || '',
          'Ghi Chú': k.note || '',
        }));
        const wsKeys = XLSX.utils.json_to_sheet(keyRows);
        wsKeys['!cols'] = [
          { wch: 6 },
          { wch: 30 },
          { wch: 32 },
          { wch: 15 },
          { wch: 18 },
          { wch: 14 },
          { wch: 14 },
          { wch: 16 },
          { wch: 24 },
          { wch: 22 },
          { wch: 20 },
          { wch: 35 },
          { wch: 25 },
        ];
        XLSX.utils.book_append_sheet(wb, wsKeys, 'Danh_Sach_Key_Ban_Quyen');
      }

      // Sheet 3: Chi tiết cài đặt theo từng máy
      const resAll = await softwareService.exportAll();
      const allInstallations = resAll.data?.data || [];
      const lowerSearch = searchText.trim().toLowerCase();

      const filteredInstallations = lowerSearch
        ? allInstallations.filter(
            (inst: any) =>
              inst.name?.toLowerCase().includes(lowerSearch) ||
              inst.publisher?.toLowerCase().includes(lowerSearch)
          )
        : allInstallations;

      if (filteredInstallations.length > 0) {
        const detailRows = filteredInstallations.map((inst: any, idx: number) => {
          const asset = inst.asset || {};
          const assignedUsers =
            asset.users?.map((u: any) => u.fullName).join(' & ') || 'Chưa cấp phát';
          return {
            STT: idx + 1,
            'Tên Phần Mềm': inst.name || '',
            'Phiên Bản (Version)': inst.version || '',
            'Nhà Phát Hành': inst.publisher || '',
            'Tên Máy (Hostname)': asset.name || '',
            'Loại Thiết Bị': asset.type?.name || '',
            'Hãng / Model': `${asset.manufacturer || ''} ${asset.modelName || ''}`.trim(),
            'Serial Number': asset.serialNumber || '',
            'IP Address': asset.ipAddress || '',
            'User Domain': asset.domainUser || '',
            'Người Sử Dụng': assignedUsers,
            'Phòng Ban': asset.department?.name || 'Chưa gán',
            'Nhà Máy': asset.factory?.name || 'Chưa gán',
          };
        });

        const wsDetail = XLSX.utils.json_to_sheet(detailRows);
        wsDetail['!cols'] = [
          { wch: 6 },
          { wch: 36 },
          { wch: 18 },
          { wch: 25 },
          { wch: 20 },
          { wch: 16 },
          { wch: 24 },
          { wch: 18 },
          { wch: 15 },
          { wch: 20 },
          { wch: 24 },
          { wch: 20 },
          { wch: 16 },
        ];
        XLSX.utils.book_append_sheet(wb, wsDetail, 'Chi_Tiet_Theo_May');
      }

      const dateStr = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `BaoCao_PhanMem_BanQuyen_${dateStr}.xlsx`);
      message.success('Đã xuất báo cáo Excel (3 Sheet) thành công!');
    } catch (error) {
      console.error(error);
      message.error('Lỗi khi xuất báo cáo Excel');
    } finally {
      setExporting(false);
    }
  };

  // --- HANDLE EXPORT SINGLE SOFTWARE DETAIL IN DRAWER ---
  const handleExportDetailExcel = () => {
    if (!detailData || detailData.length === 0) {
      message.warning('Không có dữ liệu để xuất');
      return;
    }

    const rows = detailData.map((item, idx) => {
      const asset = item.asset;
      const assignedUsers =
        asset?.users?.map((u) => u.fullName).join(' & ') || 'Chưa cấp phát';
      return {
        STT: idx + 1,
        'Tên Phần Mềm': selectedSoftware,
        'Phiên Bản': item.version || '-',
        'Tên Máy (Hostname)': asset?.name || '-',
        'Hãng / Model':
          `${asset?.manufacturer || ''} ${asset?.modelName || ''}`.trim() || '-',
        'IP Address': asset?.ipAddress || '-',
        'User Domain': asset?.domainUser || '-',
        'Người Sử Dụng': assignedUsers,
        'Phòng Ban': asset?.department?.name || '-',
        'Nhà Máy': asset?.factory?.name || '-',
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [
      { wch: 6 },
      { wch: 32 },
      { wch: 18 },
      { wch: 20 },
      { wch: 24 },
      { wch: 15 },
      { wch: 20 },
      { wch: 24 },
      { wch: 20 },
      { wch: 16 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Danh_Sach_May');
    const safeName = selectedSoftware.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);
    XLSX.writeFile(wb, `DS_May_Cai_${safeName}.xlsx`);
    message.success('Đã xuất file Excel!');
  };

  // --- HANDLE VIEW DETAILS ---
  const handleViewDetail = async (name: string) => {
    setSelectedSoftware(name);
    setDrawerOpen(true);
    setDetailLoading(true);
    try {
      const res = await softwareService.getInstallations(name);
      setDetailData(res.data.data || []);
    } catch (error) {
      message.error('Lỗi khi tải chi tiết');
    } finally {
      setDetailLoading(false);
    }
  };

  // --- STATS & FILTERING ---
  const blacklistInstalledItems = data.filter(
    (item) => item.policy?.category === 'BLACKLIST' && item.installCount > 0
  );
  const overLicensedItems = data.filter(
    (item) =>
      item.policy?.category === 'LICENSED' &&
      item.policy.totalSeats > 0 &&
      item.installCount > item.policy.totalSeats
  );
  const expiringOrExpiredKeys = licenseKeys.filter(
    (k) => k.computedStatus === 'EXPIRED' || k.computedStatus === 'EXPIRING_SOON'
  );

  const filteredData = data.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchText.toLowerCase()) ||
      item.publisher.toLowerCase().includes(searchText.toLowerCase());

    if (!matchesSearch) return false;

    if (categoryFilter === 'LICENSED') {
      return item.policy?.category === 'LICENSED';
    }
    if (categoryFilter === 'OVER_LICENSED') {
      return (
        item.policy?.category === 'LICENSED' &&
        (item.policy?.totalSeats || 0) > 0 &&
        item.installCount > (item.policy?.totalSeats || 0)
      );
    }
    if (categoryFilter === 'BLACKLIST') {
      return item.policy?.category === 'BLACKLIST';
    }
    return true;
  });

  const filteredKeys = licenseKeys.filter((k) => {
    if (!keySearchText.trim()) return true;
    const q = keySearchText.toLowerCase();
    return (
      k.policy?.name?.toLowerCase().includes(q) ||
      k.licenseKey?.toLowerCase().includes(q) ||
      k.supplier?.toLowerCase().includes(q) ||
      k.invoiceCode?.toLowerCase().includes(q) ||
      k.assignments?.some((a) => a.asset?.name?.toLowerCase().includes(q))
    );
  });

  // --- COLUMNS TAB 1: KIỂM KÊ & ĐỐI CHIẾU BẢN QUYỀN ---
  const inventoryColumns: ColumnsType<SoftwareSummary> = [
    {
      title: 'Tên Phần mềm',
      dataIndex: 'name',
      key: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name),
      render: (text, record) => (
        <div className="flex flex-col">
          <span
            className={`font-semibold cursor-pointer hover:underline ${
              record.policy?.category === 'BLACKLIST'
                ? 'text-red-600'
                : 'text-blue-700'
            }`}
            onClick={() => handleViewDetail(record.name)}
          >
            {text}
          </span>
          <span className="text-xs text-gray-400 md:hidden">
            {record.publisher !== 'Unknown' ? record.publisher : 'Không rõ NSX'}
          </span>
        </div>
      ),
    },
    {
      title: 'Nhà phát hành',
      dataIndex: 'publisher',
      key: 'publisher',
      responsive: ['md'],
      render: (t) =>
        t !== 'Unknown' ? t : <span className="text-gray-400 italic">Không rõ</span>,
    },
    {
      title: 'Phân loại & Bản quyền',
      key: 'policy',
      width: 260,
      render: (_, record) => {
        const pol = record.policy;
        if (!pol) {
          return <Tag className="m-0 text-gray-500">Thông thường / Miễn phí</Tag>;
        }

        if (pol.category === 'BLACKLIST') {
          return (
            <Space direction="vertical" size={2}>
              <Tag color="red" icon={<StopOutlined />} className="m-0 font-semibold">
                PHẦN MỀM CẤM (BLACKLIST)
              </Tag>
              {pol.note && <span className="text-[11px] text-red-500">{pol.note}</span>}
            </Space>
          );
        }

        if (pol.category === 'LICENSED') {
          const seats = pol.totalSeats || 0;
          if (seats === 0) {
            return (
              <div className="flex flex-wrap items-center justify-between gap-1 pr-2">
                <Tag color="geekblue" icon={<SafetyCertificateOutlined />} className="m-0">
                  Cần Bản quyền (Chưa nhập Key)
                </Tag>
                <Button
                  size="small"
                  type="link"
                  className="p-0 h-auto text-xs font-medium"
                  onClick={() => handleOpenKeyModal(null, pol.id || undefined, record.name)}
                >
                  + Nhập Key
                </Button>
              </div>
            );
          }

          const isOver = record.installCount > seats;
          const percent = Math.min(100, Math.round((record.installCount / seats) * 100));

          return (
            <div className="w-full pr-2">
              <div className="flex items-center justify-between text-xs mb-1">
                <Tag
                  color={isOver ? 'error' : 'success'}
                  icon={isOver ? <WarningOutlined /> : <SafetyCertificateOutlined />}
                  className="m-0"
                >
                  {isOver ? `Vượt ${record.installCount - seats} máy` : 'Đủ Bản quyền'}
                </Tag>
                <span className="font-mono font-semibold text-slate-700">
                  {record.installCount} / {seats} License
                </span>
              </div>
              <Progress
                percent={percent}
                size="small"
                status={isOver ? 'exception' : 'normal'}
                showInfo={false}
              />
            </div>
          );
        }

        return <Tag color="green">Miễn phí (Free)</Tag>;
      },
    },
    {
      title: 'Số máy cài',
      dataIndex: 'installCount',
      key: 'installCount',
      width: 120,
      align: 'center',
      sorter: (a, b) => a.installCount - b.installCount,
      render: (count, record) => (
        <Tag
          color={
            record.policy?.category === 'BLACKLIST'
              ? 'red'
              : count > 5
              ? 'volcano'
              : 'blue'
          }
          className="text-sm px-3 py-0.5 rounded-full m-0 cursor-pointer"
          onClick={() => handleViewDetail(record.name)}
        >
          {count} máy
        </Tag>
      ),
    },
    {
      title: 'Thao tác',
      key: 'action',
      width: 150,
      align: 'center',
      render: (_, record) => {
        const existingPol = policies.find(
          (p) => p.id === record.policy?.id || p.name === record.name
        );
        return (
          <Space size={4}>
            <Tooltip title="Xem danh sách máy đang cài">
              <Button
                type="text"
                size="small"
                icon={<EyeOutlined className="text-blue-600" />}
                onClick={() => handleViewDetail(record.name)}
              />
            </Tooltip>
            <Tooltip title="Thiết lập Bản quyền / Đánh dấu Phần mềm cấm">
              <Button
                type="text"
                size="small"
                icon={<SettingOutlined className="text-indigo-600" />}
                onClick={() =>
                  handleOpenPolicyModal(
                    {
                      name: record.name,
                      matchKeyword: record.name,
                      publisher:
                        record.publisher !== 'Unknown' ? record.publisher : '',
                      category: 'LICENSED',
                      totalSeats: record.installCount,
                    },
                    existingPol || null
                  )
                }
              />
            </Tooltip>
            <Tooltip title="Thêm Key bản quyền cho phần mềm này">
              <Button
                type="text"
                size="small"
                icon={<KeyOutlined className="text-amber-600" />}
                onClick={() =>
                  handleOpenKeyModal(null, existingPol?.id, record.name)
                }
              />
            </Tooltip>
          </Space>
        );
      },
    },
  ];

  // --- COLUMNS TAB 2: QUẢN LÝ KEY BẢN QUYỀN (KASPERSKY, OFFICE, AUTOCAD...) ---
  const keyColumns: ColumnsType<SoftwareLicenseKeyItem> = [
    {
      title: 'Phần mềm & Loại Key',
      key: 'software',
      render: (_, record) => (
        <div className="flex flex-col">
          <span className="font-bold text-slate-800">{record.policy?.name}</span>
          <div className="flex items-center gap-1 mt-1">
            <Tag color="geekblue" className="m-0 text-[11px]">
              {record.keyType}
            </Tag>
            {record.supplier && (
              <span className="text-xs text-gray-500">NCC: {record.supplier}</span>
            )}
          </div>
        </div>
      ),
    },
    {
      title: 'Mã Key Bản quyền',
      dataIndex: 'licenseKey',
      key: 'licenseKey',
      render: (keyStr, record) => (
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <code className="bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-xs font-mono text-indigo-700 select-all">
              {keyStr}
            </code>
            <Tooltip title="Sao chép Key">
              <Button
                type="text"
                size="small"
                icon={<CopyOutlined />}
                onClick={() => {
                  navigator.clipboard.writeText(keyStr);
                  message.success('Đã sao chép mã Key!');
                }}
              />
            </Tooltip>
          </div>
          {record.invoiceCode && (
            <span className="text-[11px] text-gray-400 mt-0.5">
              HĐ/Invoice: {record.invoiceCode}
            </span>
          )}
        </div>
      ),
    },
    {
      title: 'Số lượng Máy cấp phát (Seats)',
      key: 'seats',
      width: 240,
      render: (_, record) => {
        const percent =
          record.maxSeats > 0
            ? Math.min(100, Math.round((record.assignedCount / record.maxSeats) * 100))
            : 0;
        return (
          <div className="pr-2">
            <div className="flex justify-between text-xs mb-1">
              <span className="font-medium text-slate-700">
                Đã gán: <b>{record.assignedCount}</b> / {record.maxSeats} máy
              </span>
              <span className="text-emerald-600 font-medium">
                Trống: {record.remainingSeats}
              </span>
            </div>
            <Progress
              percent={percent}
              size="small"
              status={record.assignedCount >= record.maxSeats ? 'active' : 'normal'}
              showInfo={false}
            />
            {record.assignments?.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {record.assignments.slice(0, 3).map((a) => (
                  <Tag key={a.id} color="blue" className="m-0 text-[10px]">
                    {a.asset?.name}
                  </Tag>
                ))}
                {record.assignments.length > 3 && (
                  <Tag className="m-0 text-[10px]">
                    +{record.assignments.length - 3} máy
                  </Tag>
                )}
              </div>
            )}
          </div>
        );
      },
    },
    {
      title: 'Thời hạn Bản quyền',
      key: 'expiredAt',
      width: 170,
      render: (_, record) => {
        if (!record.expiredAt) {
          return <Tag color="green">Vĩnh viễn (Perpetual)</Tag>;
        }
        const dateFormatted = dayjs(record.expiredAt).format('DD/MM/YYYY');
        if (record.computedStatus === 'EXPIRED') {
          return (
            <div className="flex flex-col">
              <Tag color="error" className="m-0 w-fit">
                Đã hết hạn
              </Tag>
              <span className="text-xs text-red-500 mt-0.5">{dateFormatted}</span>
            </div>
          );
        }
        if (record.computedStatus === 'EXPIRING_SOON') {
          return (
            <div className="flex flex-col">
              <Tag color="warning" className="m-0 w-fit">
                Còn {record.daysUntilExpiry} ngày
              </Tag>
              <span className="text-xs text-amber-600 mt-0.5">{dateFormatted}</span>
            </div>
          );
        }
        return (
          <div className="flex flex-col">
            <Tag color="success" className="m-0 w-fit">
              Còn {record.daysUntilExpiry} ngày
            </Tag>
            <span className="text-xs text-gray-500 mt-0.5">{dateFormatted}</span>
          </div>
        );
      },
    },
    {
      title: 'Thao tác',
      key: 'action',
      width: 140,
      align: 'center',
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title="Gán / Thu hồi Key trên máy tính">
            <Button
              type="primary"
              ghost
              size="small"
              icon={<DesktopOutlined />}
              onClick={() => handleOpenAssignModal(record)}
            />
          </Tooltip>
          <Tooltip title="Chỉnh sửa Key">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined className="text-blue-600" />}
              onClick={() => handleOpenKeyModal(record)}
            />
          </Tooltip>
          <Popconfirm
            title="Xóa Key bản quyền này?"
            onConfirm={() => handleDeleteKey(record.id)}
            okText="Xóa"
            cancelText="Hủy"
          >
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // --- COLUMNS TAB 3: DANH MỤC CHÍNH SÁCH (SOFTWARE POLICIES) ---
  const policyColumns: ColumnsType<SoftwarePolicyItem> = [
    {
      title: 'Tên Chính sách / Phần mềm',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <div className="flex flex-col">
          <span className="font-bold text-slate-800">{text}</span>
          <span className="text-xs text-gray-400 font-mono">
            Từ khóa khớp: {record.matchKeyword}
          </span>
        </div>
      ),
    },
    {
      title: 'Phân loại',
      dataIndex: 'category',
      key: 'category',
      width: 170,
      render: (cat) => {
        if (cat === 'BLACKLIST') {
          return (
            <Tag color="red" icon={<StopOutlined />}>
              Phần mềm cấm (Blacklist)
            </Tag>
          );
        }
        if (cat === 'LICENSED') {
          return (
            <Tag color="blue" icon={<SafetyCertificateOutlined />}>
              Bản quyền (Licensed)
            </Tag>
          );
        }
        return <Tag color="green">Miễn phí (Free)</Tag>;
      },
    },
    {
      title: 'Đối chiếu License & Máy thực tế',
      key: 'compliance',
      render: (_, record) => {
        const isWindowsOsPolicy = /Windows/i.test(record.matchKeyword || record.name);
        const windowsMachinesCount = allAssets.filter((a) =>
          /Windows/i.test(a.osName || '')
        ).length;
        const installed = isWindowsOsPolicy
          ? windowsMachinesCount || record.installedCount || 0
          : record.installedCount || 0;
        const seats = record.effectiveSeats || record.totalSeats || 0;
        if (record.category === 'BLACKLIST') {
          return installed > 0 ? (
            <Tag color="error" icon={<WarningOutlined />}>
              Phát hiện {installed} máy đang cài!
            </Tag>
          ) : (
            <Tag color="success" icon={<CheckCircleOutlined />}>
              0 máy vi phạm
            </Tag>
          );
        }
        if (record.category === 'LICENSED') {
          if (seats === 0) {
            return (
              <Space wrap>
                <Tag color="default">Đang cài: {installed} máy</Tag>
                <Tag color="geekblue">Chưa nhập Key bản quyền</Tag>
              </Space>
            );
          }
          const isOver = installed > seats;
          return (
            <Space wrap>
              <Tag color={isOver ? 'error' : 'processing'}>
                Đang cài: {installed} / {seats} License đã mua
              </Tag>
              {record.keyCount ? (
                <Tag color="gold">
                  {record.keyCount} Key (Đã gán: {record.assignedSeats || 0} máy)
                </Tag>
              ) : null}
            </Space>
          );
        }
        return <span>Đang cài trên {installed} máy</span>;
      },
    },
    {
      title: 'Ghi chú',
      dataIndex: 'note',
      key: 'note',
      responsive: ['md'],
    },
    {
      title: 'Thao tác',
      key: 'action',
      width: 140,
      align: 'center',
      render: (_, record) => (
        <Space size={4}>
          {record.category === 'LICENSED' && (
            <Tooltip title="Thêm Key cho phần mềm này">
              <Button
                type="text"
                size="small"
                icon={<KeyOutlined className="text-amber-600" />}
                onClick={() => handleOpenKeyModal(null, record.id, record.name)}
              />
            </Tooltip>
          )}
          <Button
            type="text"
            size="small"
            icon={<EditOutlined className="text-blue-600" />}
            onClick={() => handleOpenPolicyModal(undefined, record)}
          />
          <Popconfirm
            title="Xóa chính sách này?"
            onConfirm={() => handleDeletePolicy(record.id)}
            okText="Xóa"
            cancelText="Hủy"
          >
            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // --- COLUMNS DRAWER CHI TIẾT ---
  const detailColumns: ColumnsType<SoftwareDetail> = [
    {
      title: 'Tên Máy',
      key: 'asset',
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <span className="font-bold text-slate-800">
            <DesktopOutlined className="text-blue-600 mr-1" />
            {record.asset?.name}
          </span>
          {(record.asset?.manufacturer || record.asset?.modelName) && (
            <span className="text-xs text-gray-500">
              {record.asset?.manufacturer} {record.asset?.modelName}
            </span>
          )}
          {record.asset?.ipAddress && (
            <span className="text-[11px] text-gray-400 font-mono">
              IP: {record.asset.ipAddress}
            </span>
          )}
        </Space>
      ),
    },
    {
      title: 'Người dùng & Vị trí',
      key: 'user',
      render: (_, record) => {
        const assignedUsers = record.asset?.users
          ?.map((u) => u.fullName)
          .join(', ');
        return (
          <Space direction="vertical" size={2}>
            <span className="text-blue-600 text-xs font-medium">
              <UserOutlined className="mr-1" />
              {assignedUsers || record.asset?.domainUser || '-'}
            </span>
            <div className="flex flex-wrap gap-1">
              {record.asset?.factory && (
                <Tag color="cyan" className="m-0 text-[10px]">
                  {record.asset.factory.name}
                </Tag>
              )}
              {record.asset?.department && (
                <Tag className="m-0 text-[10px]">
                  {record.asset.department.name}
                </Tag>
              )}
            </div>
          </Space>
        );
      },
    },
    {
      title: 'Phiên bản',
      dataIndex: 'version',
      key: 'version',
      width: 130,
      render: (t) =>
        t ? (
          <Tag color="geekblue" className="m-0 font-mono text-xs">
            {t}
          </Tag>
        ) : (
          <span className="text-gray-400">-</span>
        ),
    },
  ];

  // --- DANH SÁCH & COLUMNS TAB BẢN QUYỀN THEO MÁY NGƯỜI DÙNG & WINDOWS ---
  const filteredMachineAssets = allAssets.filter((asset) => {
    const q = machineSearchText.trim().toLowerCase();
    const matchesSearch =
      !q ||
      asset.name?.toLowerCase().includes(q) ||
      asset.ipAddress?.toLowerCase().includes(q) ||
      asset.osName?.toLowerCase().includes(q) ||
      asset.domainUser?.toLowerCase().includes(q) ||
      asset.department?.name?.toLowerCase().includes(q) ||
      asset.users?.some((u: any) => u.fullName?.toLowerCase().includes(q));

    if (!matchesSearch) return false;

    const osLic = asset.customSpecs?.osLicense;
    const assignedKeys: any[] = asset.licenseAssignments || [];
    const hasWinKeyAssigned = assignedKeys.some((la) =>
      /Windows/i.test(la.licenseKey?.policy?.name || la.licenseKey?.policy?.matchKeyword || '')
    );

    if (machineLicenseFilter === 'WINDOWS_LICENSED') {
      return osLic?.status === 'LICENSED' || hasWinKeyAssigned;
    }
    if (machineLicenseFilter === 'WINDOWS_UNLICENSED') {
      return (
        /Windows/i.test(asset.osName || '') &&
        osLic?.status !== 'LICENSED' &&
        !hasWinKeyAssigned
      );
    }
    if (machineLicenseFilter === 'HAS_ERP_KEY') {
      return assignedKeys.length > 0;
    }
    if (machineLicenseFilter === 'NO_ERP_KEY') {
      return assignedKeys.length === 0;
    }
    return true;
  });

  const machineLicenseColumns: ColumnsType<any> = [
    {
      title: 'Máy tính & Người dùng',
      key: 'machine',
      width: 240,
      render: (_, record) => {
        const assignedUsers = record.users?.map((u: any) => u.fullName).join(', ');
        return (
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <DesktopOutlined className="text-blue-600" />
              <span className="font-bold text-slate-800 font-mono">{record.name}</span>
              {record.type?.name && (
                <Tag className="m-0 text-[10px]">{record.type.name}</Tag>
              )}
            </div>
            <span className="text-xs text-blue-600 font-medium mt-0.5">
              <UserOutlined className="mr-1" />
              {assignedUsers || record.domainUser || 'Chưa gán người dùng'}
            </span>
            <div className="flex flex-wrap gap-1 mt-1 text-[11px] text-gray-500">
              {record.department?.name && (
                <Tag color="cyan" className="m-0 text-[10px]">
                  {record.department.name}
                </Tag>
              )}
              {record.ipAddress && <span className="font-mono">IP: {record.ipAddress}</span>}
              {record.customSpecs?.hardwareHealth && (
                <Tag
                  color={
                    record.customSpecs.hardwareHealth.overallStatus === 'CRITICAL'
                      ? 'error'
                      : record.customSpecs.hardwareHealth.overallStatus === 'WARNING'
                      ? 'warning'
                      : 'green'
                  }
                  className="m-0 text-[10px]"
                >
                  {record.customSpecs.hardwareHealth.overallStatus === 'CRITICAL'
                    ? '🚨 Lỗi phần cứng'
                    : record.customSpecs.hardwareHealth.overallStatus === 'WARNING'
                    ? '⚠️ Cần chú ý (RAM/Ổ đĩa)'
                    : '✓ CPU/RAM/Disk Tốt'}
                </Tag>
              )}
            </div>
          </div>
        );
      },
    },
    {
      title: 'Bản quyền Hệ điều hành (Windows / Linux)',
      key: 'osLicense',
      width: 290,
      render: (_, record) => {
        const osName = record.osName || 'Chưa ghi nhận OS';
        const osLic = record.customSpecs?.osLicense;
        const assignedKeys: any[] = record.licenseAssignments || [];
        const winKeyAssigned = assignedKeys.find((la) =>
          /Windows/i.test(la.licenseKey?.policy?.name || la.licenseKey?.policy?.matchKeyword || '')
        );

        if (/Ubuntu|Linux|Debian|CentOS/i.test(osName)) {
          return (
            <div className="flex flex-col gap-1">
              <span className="font-medium text-slate-700 text-xs">{osName}</span>
              <Tag color="success" className="m-0 w-fit text-[11px]">
                ✓ Mã nguồn mở (Miễn phí)
              </Tag>
            </div>
          );
        }

        return (
          <div className="flex flex-col gap-1">
            <span className="font-semibold text-slate-800 text-xs">{osName}</span>
            {osLic ? (
              <div className="flex flex-wrap items-center gap-1">
                <Tag
                  color={osLic.status === 'LICENSED' ? 'success' : 'warning'}
                  className="m-0 text-[11px]"
                >
                  {osLic.status === 'LICENSED'
                    ? `✓ Đã kích hoạt (${osLic.channel || 'Active'})`
                    : `⚠️ ${osLic.statusText || 'Chưa kích hoạt'}`}
                </Tag>
                {osLic.partialKey && (
                  <Tag className="m-0 font-mono text-[10px]">
                    Key máy: *{osLic.partialKey}
                  </Tag>
                )}
              </div>
            ) : winKeyAssigned ? (
              <Tag color="success" className="m-0 w-fit text-[11px]">
                ✓ Đã cấp Key Windows từ ERP
              </Tag>
            ) : (
              <span className="text-[11px] text-gray-400 italic">
                Chạy Agent V3.21 để tự động quét bản quyền Windows hoặc gán Key bên phải
              </span>
            )}
            {osLic?.oemKey && (
              <span className="text-[11px] text-emerald-700 font-mono">
                Key OEM BIOS: {osLic.oemKey}
              </span>
            )}
          </div>
        );
      },
    },
    {
      title: 'Bản quyền Office & Phần mềm trên máy',
      key: 'softwareLicenses',
      render: (_, record) => {
        const offLic = record.customSpecs?.officeLicense;
        const scannedLicenses: any[] = Array.isArray(record.customSpecs?.softwareLicenses)
          ? record.customSpecs.softwareLicenses.filter(
              (s: any) => !/Windows/i.test(s.softwareName || '')
            )
          : [];
        const assignedKeys: any[] = record.licenseAssignments || [];

        return (
          <div className="flex flex-col gap-1.5">
            {scannedLicenses.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1">
                {scannedLicenses.map((slic: any, idx: number) => (
                  <Tag
                    key={idx}
                    color={slic.status === 'LICENSED' ? 'blue' : 'orange'}
                    className="m-0 text-[11px]"
                  >
                    ✓ <b>{slic.softwareName}</b>: {slic.statusText || slic.status}
                    {slic.partialKey ? ` (${slic.partialKey})` : ''}
                  </Tag>
                ))}
              </div>
            ) : (
              offLic && (
                <div className="flex flex-wrap items-center gap-1">
                  <Tag
                    color={offLic.status === 'LICENSED' ? 'blue' : 'orange'}
                    className="m-0 text-[11px]"
                  >
                    Office trên máy: {offLic.statusText}
                    {offLic.partialKey ? ` (*${offLic.partialKey})` : ''}
                  </Tag>
                </div>
              )
            )}

            {assignedKeys.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {assignedKeys.map((la: any) => (
                  <Tag
                    key={la.id}
                    color="gold"
                    closable
                    onClose={(e) => {
                      e.preventDefault();
                      handleUnassignKeyFromMachine(la.keyId, record.id);
                    }}
                    className="m-0 text-xs py-0.5 px-2"
                  >
                    🔑 <b>{la.licenseKey?.policy?.name}</b>:{' '}
                    <span className="font-mono">{la.licenseKey?.licenseKey}</span>
                  </Tag>
                ))}
              </div>
            ) : (
              !offLic &&
              scannedLicenses.length === 0 && (
                <span className="text-xs text-gray-400 italic">
                  Chưa gán Key ERP nào (Kaspersky, Office, Windows, AutoCAD...)
                </span>
              )
            )}
          </div>
        );
      },
    },
    {
      title: 'Cấp phát Key',
      key: 'action',
      width: 150,
      align: 'center',
      render: (_, record) => (
        <Space size={4}>
          <Button
            type="primary"
            ghost
            size="small"
            icon={<KeyOutlined />}
            onClick={() => {
              setQuickAssignAsset(record);
              setSelectedKeyIdForAsset(undefined);
            }}
          >
            Gán Key
          </Button>
          <Tooltip title="Xem trang hồ sơ QR & Phần mềm của máy này">
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() =>
                window.open(`/qr/asset/${encodeURIComponent(record.name)}`, '_blank')
              }
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div className="p-2 sm:p-4 bg-gray-50 min-h-full space-y-4">
      {/* 4 KPI SUMMARY CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card
          size="small"
          className="shadow-sm rounded-xl border-l-4 border-l-blue-500 cursor-pointer hover:shadow-md transition-all"
          onClick={() => {
            setActiveTab('inventory');
            setCategoryFilter('ALL');
          }}
        >
          <div className="text-xs text-gray-500">Tổng phần mềm ghi nhận</div>
          <div className="text-2xl font-bold text-slate-800 mt-1">
            {data.length} <span className="text-xs font-normal text-gray-400">Apps</span>
          </div>
        </Card>

        <Card
          size="small"
          className="shadow-sm rounded-xl border-l-4 border-l-indigo-500 cursor-pointer hover:shadow-md transition-all"
          onClick={() => {
            setActiveTab('inventory');
            setCategoryFilter(overLicensedItems.length > 0 ? 'OVER_LICENSED' : 'LICENSED');
          }}
        >
          <div className="text-xs text-gray-500">Bản quyền Phần mềm</div>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-bold text-indigo-700">
              {policies.filter((p) => p.category === 'LICENSED').length}
            </span>
            {overLicensedItems.length > 0 ? (
              <Tag color="error" className="m-0 text-[11px]">
                {overLicensedItems.length} vượt số lượng!
              </Tag>
            ) : (
              <Tag color="success" className="m-0 text-[11px]">
                Đủ License
              </Tag>
            )}
          </div>
        </Card>

        <Card
          size="small"
          className="shadow-sm rounded-xl border-l-4 border-l-amber-500 cursor-pointer hover:shadow-md transition-all"
          onClick={() => setActiveTab('keys')}
        >
          <div className="text-xs text-gray-500">Kho Key (Kaspersky, Office...)</div>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-bold text-amber-600">
              {licenseKeys.length} <span className="text-xs font-normal">Keys</span>
            </span>
            {expiringOrExpiredKeys.length > 0 ? (
              <Tag color="warning" className="m-0 text-[11px]">
                {expiringOrExpiredKeys.length} sắp/đã hết hạn
              </Tag>
            ) : (
              <Tag color="blue" className="m-0 text-[11px]">
                Đang hoạt động
              </Tag>
            )}
          </div>
        </Card>

        <Card
          size="small"
          className="shadow-sm rounded-xl border-l-4 border-l-red-500 cursor-pointer hover:shadow-md transition-all"
          onClick={() => {
            setActiveTab('inventory');
            setCategoryFilter('BLACKLIST');
          }}
        >
          <div className="text-xs text-gray-500">Phần mềm cấm (Blacklist)</div>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-bold text-red-600">
              {blacklistInstalledItems.length}
            </span>
            {blacklistInstalledItems.length > 0 ? (
              <Tag color="error" className="m-0 text-[11px]">
                Cần xử lý ngay!
              </Tag>
            ) : (
              <Tag color="success" className="m-0 text-[11px]">
                An toàn
              </Tag>
            )}
          </div>
        </Card>
      </div>

      {/* CẢNH BÁO NẾU CÓ PHẦN MỀM CẤM HOẶC VƯỢT LICENSE */}
      {blacklistInstalledItems.length > 0 && (
        <Alert
          type="error"
          showIcon
          message={`Cảnh báo bảo mật: Phát hiện ${blacklistInstalledItems.length} phần mềm nằm trong danh sách cấm (Blacklist) đang được cài đặt trên máy trạm (${blacklistInstalledItems
            .map((i) => `${i.name}: ${i.installCount} máy`)
            .join(', ')})`}
          action={
            <Button
              size="small"
              danger
              onClick={() => {
                setActiveTab('inventory');
                setCategoryFilter('BLACKLIST');
              }}
            >
              Kiểm tra ngay
            </Button>
          }
        />
      )}

      {/* MAIN CARD WITH TABS */}
      <Card
        bordered={false}
        className="shadow-sm rounded-xl"
        title={
          <div className="flex flex-wrap items-center gap-2">
            <AppstoreOutlined className="text-blue-600 text-xl" />
            <span className="text-base sm:text-lg font-bold">
              Quản lý Phần mềm, Bản quyền & Key (Kaspersky / Office / CAD)
            </span>
          </div>
        }
        extra={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="primary"
              icon={<KeyOutlined />}
              onClick={() => handleOpenKeyModal(null)}
              className="bg-amber-600 hover:!bg-amber-500 border-none"
            >
              <span className="hidden sm:inline">Thêm Key Bản quyền</span>
              <span className="sm:hidden">+Key</span>
            </Button>

            <Popconfirm
              title="Làm gọn & Chuẩn hóa dữ liệu phần mềm?"
              description="Tự động gộp các gói cài đặt phụ (Office MUI, Click-to-Run, Kaspersky Agent phụ, Python phụ...) trên toàn bộ máy tính."
              onConfirm={handleCleanup}
              okText="Chuẩn hóa ngay"
              cancelText="Hủy"
            >
              <Button icon={<ClearOutlined />} loading={cleaning}>
                <span className="hidden md:inline">Làm gọn dữ liệu</span>
              </Button>
            </Popconfirm>

            <Button
              type="primary"
              icon={<FileExcelOutlined />}
              onClick={handleExportExcel}
              loading={exporting}
              className="bg-green-600 hover:!bg-green-500 border-none"
            >
              <span className="hidden sm:inline">Xuất Excel</span>
            </Button>

            <Button icon={<ReloadOutlined />} onClick={fetchAllData} />
          </div>
        }
      >
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'inventory',
              label: (
                <span>
                  <AppstoreOutlined /> Kiểm kê & Đối chiếu Bản quyền ({data.length})
                </span>
              ),
              children: (
                <div>
                  <div className="mb-4 flex flex-col sm:flex-row justify-between gap-2">
                    <Input
                      placeholder="Tìm kiếm tên phần mềm hoặc nhà phát hành..."
                      prefix={<SearchOutlined className="text-gray-400" />}
                      allowClear
                      value={searchText}
                      onChange={(e) => setSearchText(e.target.value)}
                      className="w-full sm:max-w-md"
                    />
                    <div className="flex flex-wrap gap-2">
                      <Select
                        value={categoryFilter}
                        onChange={setCategoryFilter}
                        className="w-full sm:w-56"
                        options={[
                          { value: 'ALL', label: 'Tất cả phần mềm' },
                          { value: 'LICENSED', label: '🛡️ Phần mềm có Bản quyền' },
                          {
                            value: 'OVER_LICENSED',
                            label: '⚠️ Vượt quá số lượng License',
                          },
                          {
                            value: 'BLACKLIST',
                            label: '🚫 Phần mềm cấm (Blacklist)',
                          },
                        ]}
                      />
                      <Button
                        icon={<PlusOutlined />}
                        onClick={() => handleOpenPolicyModal()}
                      >
                        Thêm Chính sách / Blacklist
                      </Button>
                    </div>
                  </div>

                  <Table
                    columns={inventoryColumns}
                    dataSource={filteredData}
                    rowKey="name"
                    loading={loading}
                    pagination={{ pageSize: 12, showSizeChanger: true }}
                    size="middle"
                    scroll={{ x: 680 }}
                  />
                </div>
              ),
            },
            {
              key: 'machine_licenses',
              label: (
                <span>
                  <DesktopOutlined /> Bản quyền trên Máy người dùng & Windows (
                  {allAssets.length})
                </span>
              ),
              children: (
                <div>
                  <Alert
                    type="info"
                    showIcon
                    className="mb-3 text-xs"
                    message={
                      <span>
                        <b>Quản lý Bản quyền theo từng Máy người dùng (Windows & Phần mềm):</b>{' '}
                        Khi chạy <code>powershell_phancung.ps1</code> (V3.21), hệ thống tự động đọc trạng thái kích hoạt{' '}
                        <b>Windows (OEM / Retail / Volume MAK / KMS + 5 ký tự cuối Product Key + OEM Key BIOS)</b> và{' '}
                        <b>Microsoft Office</b> trên máy người dùng. Bạn cũng có thể bấm nút{' '}
                        <b>"Gán Key"</b> ở từng máy để cấp phát trực tiếp Key Windows, Office, Kaspersky, AutoCAD từ Kho Key ERP.
                      </span>
                    }
                  />

                  <div className="mb-4 flex flex-col sm:flex-row justify-between gap-2">
                    <Input
                      placeholder="Tìm theo tên máy (Hostname), người dùng, phòng ban, IP hoặc hệ điều hành..."
                      prefix={<SearchOutlined className="text-gray-400" />}
                      allowClear
                      value={machineSearchText}
                      onChange={(e) => setMachineSearchText(e.target.value)}
                      className="w-full sm:max-w-md"
                    />
                    <div className="flex flex-wrap gap-2">
                      <Select
                        value={machineLicenseFilter}
                        onChange={setMachineLicenseFilter}
                        className="w-full sm:w-64"
                        options={[
                          { value: 'ALL', label: 'Tất cả máy tính người dùng' },
                          {
                            value: 'WINDOWS_LICENSED',
                            label: '✓ Máy đã có Bản quyền Windows',
                          },
                          {
                            value: 'WINDOWS_UNLICENSED',
                            label: '⚠️ Máy Windows chưa kích hoạt / chưa gán Key',
                          },
                          {
                            value: 'HAS_ERP_KEY',
                            label: '🔑 Máy đã được gán Key từ ERP',
                          },
                          {
                            value: 'NO_ERP_KEY',
                            label: 'Chưa gán Key ERP nào',
                          },
                        ]}
                      />
                      <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => handleOpenKeyModal(null)}
                      >
                        Nhập Key mới (Windows / Office / Kaspersky)
                      </Button>
                    </div>
                  </div>

                  <Table
                    columns={machineLicenseColumns}
                    dataSource={filteredMachineAssets}
                    rowKey="id"
                    loading={loading}
                    pagination={{ pageSize: 12, showSizeChanger: true }}
                    size="middle"
                    scroll={{ x: 860 }}
                  />
                </div>
              ),
            },
            {
              key: 'keys',
              label: (
                <Badge
                  count={expiringOrExpiredKeys.length}
                  offset={[10, 0]}
                  size="small"
                >
                  <span>
                    <KeyOutlined /> Quản lý Key Bản quyền (Kaspersky, Office...){' '}
                    ({licenseKeys.length})
                  </span>
                </Badge>
              ),
              children: (
                <div>
                  <div className="mb-4 flex flex-col sm:flex-row justify-between gap-2">
                    <Input
                      placeholder="Tìm theo tên phần mềm (Kaspersky, Office...), mã Key, nhà cung cấp hoặc tên máy..."
                      prefix={<SearchOutlined className="text-gray-400" />}
                      allowClear
                      value={keySearchText}
                      onChange={(e) => setKeySearchText(e.target.value)}
                      className="w-full sm:max-w-lg"
                    />
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={() => handleOpenKeyModal(null)}
                    >
                      Thêm Key Bản quyền mới
                    </Button>
                  </div>

                  <Table
                    columns={keyColumns}
                    dataSource={filteredKeys}
                    rowKey="id"
                    loading={loading}
                    pagination={{ pageSize: 10, showSizeChanger: true }}
                    size="middle"
                    scroll={{ x: 850 }}
                  />
                </div>
              ),
            },
            {
              key: 'policies',
              label: (
                <span>
                  <SafetyCertificateOutlined /> Chính sách License & Blacklist (
                  {policies.length})
                </span>
              ),
              children: (
                <div>
                  <div className="mb-4 flex justify-between items-center">
                    <span className="text-xs sm:text-sm text-gray-500">
                      Cấu hình số lượng bản quyền đã mua (VD: 50 license Office, 50 license
                      Kaspersky) hoặc đánh dấu phần mềm cấm (Torrent, Crack, VPN...) để tự
                      động cảnh báo qua Chuông thông báo khi Agent đồng bộ.
                    </span>
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={() => handleOpenPolicyModal()}
                    >
                      Thêm Chính sách
                    </Button>
                  </div>

                  <Table
                    columns={policyColumns}
                    dataSource={policies}
                    rowKey="id"
                    loading={loading}
                    pagination={{ pageSize: 10 }}
                    size="middle"
                    scroll={{ x: 680 }}
                  />
                </div>
              ),
            },
          ]}
        />
      </Card>

      {/* DRAWER CHI TIẾT MÁY ĐANG CÀI PHẦN MỀM */}
      <Drawer
        title={
          <div className="flex flex-wrap items-center justify-between gap-2 pr-4">
            <div className="flex items-center gap-2">
              <DesktopOutlined className="text-blue-600" />
              <span className="truncate max-w-[200px] sm:max-w-xs">
                {selectedSoftware}
              </span>
              <Tag color="green" className="m-0">
                {detailData.length} máy
              </Tag>
            </div>
            <Button
              size="small"
              type="primary"
              icon={<FileExcelOutlined />}
              onClick={handleExportDetailExcel}
              className="bg-green-600 hover:!bg-green-500 border-none"
            >
              Xuất Excel
            </Button>
          </div>
        }
        placement="right"
        width="min(680px, 100vw)"
        onClose={() => setDrawerOpen(false)}
        open={drawerOpen}
      >
        <Table
          columns={detailColumns}
          dataSource={detailData}
          rowKey={(r) => r.asset?.id || Math.random().toString()}
          loading={detailLoading}
          pagination={{ pageSize: 10 }}
          size="small"
          scroll={{ x: 480 }}
          locale={{ emptyText: 'Không tìm thấy máy tính nào cài phần mềm này' }}
        />
      </Drawer>

      {/* MODAL THÊM / SỬA CHÍNH SÁCH PHẦN MỀM (LICENSE / BLACKLIST) */}
      <Modal
        title={
          editingPolicy
            ? 'Cập nhật Chính sách Phần mềm'
            : 'Thiết lập Chính sách Bản quyền / Phần mềm cấm'
        }
        open={policyModalOpen}
        onCancel={() => setPolicyModalOpen(false)}
        onOk={() => policyForm.submit()}
        confirmLoading={policySubmitting}
        okText="Lưu chính sách"
        cancelText="Hủy"
      >
        <Form form={policyForm} layout="vertical" onFinish={handleSavePolicy}>
          <Form.Item
            name="name"
            label="Tên phần mềm / Nhóm phần mềm"
            rules={[{ required: true, message: 'Vui lòng nhập tên phần mềm!' }]}
          >
            <Input placeholder="VD: Kaspersky Endpoint Security, Microsoft Office, uTorrent..." />
          </Form.Item>

          <Form.Item
            name="matchKeyword"
            label="Từ khóa nhận diện tự động (hỗ trợ Regex dùng dấu |)"
            tooltip="Hệ thống sẽ tự động khớp tên phần mềm trên máy trạm chứa từ khóa này."
            rules={[{ required: true, message: 'Vui lòng nhập từ khóa nhận diện!' }]}
          >
            <Input placeholder="VD: Kaspersky hoặc Microsoft Office|Microsoft 365 hoặc uTorrent|BitTorrent" />
          </Form.Item>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Form.Item
              name="category"
              label="Phân loại chính sách"
              rules={[{ required: true }]}
            >
              <Select
                options={[
                  {
                    value: 'LICENSED',
                    label: '🛡️ Phần mềm Bản quyền (Licensed)',
                  },
                  {
                    value: 'BLACKLIST',
                    label: '🚫 Phần mềm Cấm (Blacklist)',
                  },
                  { value: 'FREE', label: '✅ Phần mềm Miễn phí (Free)' },
                ]}
              />
            </Form.Item>

            <Form.Item
              noStyle
              shouldUpdate={(prev, curr) => prev.category !== curr.category}
            >
              {({ getFieldValue }) =>
                getFieldValue('category') === 'LICENSED' ? (
                  <Form.Item
                    name="totalSeats"
                    label="Tổng số License đã mua"
                    rules={[{ required: true, message: 'Nhập số lượng license!' }]}
                  >
                    <InputNumber min={0} className="w-full" placeholder="VD: 50" />
                  </Form.Item>
                ) : null
              }
            </Form.Item>
          </div>

          <Form.Item name="publisher" label="Nhà phát hành">
            <Input placeholder="VD: Kaspersky, Microsoft Corporation, Autodesk..." />
          </Form.Item>

          <Form.Item name="note" label="Ghi chú">
            <Input.TextArea
              rows={2}
              placeholder="Ghi chú hợp đồng hoặc lý do đưa vào danh sách cấm..."
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* MODAL THÊM / SỬA KEY BẢN QUYỀN (KASPERSKY, OFFICE, AUTOCAD...) */}
      <Modal
        title={
          editingKey
            ? 'Cập nhật Key Bản quyền'
            : 'Thêm Key Bản quyền mới (Kaspersky, Office, AutoCAD...)'
        }
        open={keyModalOpen}
        onCancel={() => setKeyModalOpen(false)}
        onOk={() => keyForm.submit()}
        confirmLoading={keySubmitting}
        width={640}
        okText="Lưu Key Bản quyền"
        cancelText="Hủy"
      >
        <Form form={keyForm} layout="vertical" onFinish={handleSaveKey}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Form.Item name="policyId" label="Chọn Phần mềm (Đã có trong danh mục)">
              <Select
                allowClear
                placeholder="Chọn Kaspersky, Office, AutoCAD..."
                options={policies
                  .filter((p) => p.category !== 'BLACKLIST')
                  .map((p) => ({
                    value: p.id,
                    label: `${p.name} (Tổng: ${p.effectiveSeats || p.totalSeats} seats)`,
                  }))}
              />
            </Form.Item>

            <Form.Item
              noStyle
              shouldUpdate={(prev, curr) => prev.policyId !== curr.policyId}
            >
              {({ getFieldValue }) =>
                !getFieldValue('policyId') ? (
                  <Form.Item
                    name="softwareName"
                    label="Hoặc nhập tên Phần mềm mới"
                    rules={[
                      {
                        required: true,
                        message: 'Vui lòng chọn hoặc nhập tên phần mềm!',
                      },
                    ]}
                  >
                    <Input placeholder="VD: Kaspersky Endpoint Security" />
                  </Form.Item>
                ) : null
              }
            </Form.Item>
          </div>

          <Form.Item
            name="licenseKey"
            label="Mã Key Bản quyền / Activation Code"
            rules={[{ required: true, message: 'Vui lòng nhập mã Key bản quyền!' }]}
          >
            <Input.Password
              visibilityToggle
              placeholder="VD: XXXXX-XXXXX-XXXXX-XXXXX hoặc Mã kích hoạt Kaspersky"
            />
          </Form.Item>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Form.Item name="keyType" label="Loại bản quyền">
              <Select
                options={[
                  { value: 'SUBSCRIPTION', label: 'Thuê bao năm (Subscription)' },
                  { value: 'VOLUME', label: 'Volume License (Nhiều máy)' },
                  { value: 'MAK', label: 'MAK Key' },
                  { value: 'RETAIL', label: 'Retail (1 máy / Box)' },
                  { value: 'OEM', label: 'OEM theo máy' },
                ]}
              />
            </Form.Item>

            <Form.Item
              name="maxSeats"
              label="Số máy tối đa (Seats)"
              rules={[{ required: true, message: 'Nhập số lượng máy!' }]}
            >
              <InputNumber min={1} className="w-full" placeholder="VD: 50" />
            </Form.Item>

            <Form.Item name="expiredAt" label="Ngày hết hạn (Nếu có)">
              <DatePicker
                format="DD/MM/YYYY"
                className="w-full"
                placeholder="Chọn ngày hết hạn"
              />
            </Form.Item>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Form.Item name="supplier" label="Nhà cung cấp">
              <Input placeholder="VD: Nam Trường Sơn, FPT, Pacisoft..." />
            </Form.Item>
            <Form.Item name="invoiceCode" label="Số Hợp đồng / Hóa đơn">
              <Input placeholder="VD: HD-2026-001" />
            </Form.Item>
          </div>

          <Form.Item
            name="assetIds"
            label="Gán Key này cho các máy tính (Tùy chọn)"
          >
            <Select
              mode="multiple"
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Tìm & chọn máy tính được cấp phát Key này..."
              options={allAssets.map((a) => ({
                value: a.id,
                label: `${a.name} ${a.ipAddress ? `(${a.ipAddress})` : ''} ${
                  a.domainUser ? `- ${a.domainUser}` : ''
                }`,
              }))}
            />
          </Form.Item>

          <Form.Item name="note" label="Ghi chú">
            <Input.TextArea
              rows={2}
              placeholder="Ghi chú tài khoản quản trị Kaspersky Security Center, email đăng ký..."
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* MODAL GÁN MÁY TÍNH CHO KEY BẢN QUYỀN */}
      <Modal
        title={
          assigningKey
            ? `Cấp phát Key: ${assigningKey.policy?.name} (Tối đa ${assigningKey.maxSeats} máy)`
            : 'Gán Key bản quyền vào máy tính'
        }
        open={assignModalOpen}
        onCancel={() => setAssignModalOpen(false)}
        onOk={handleSaveAssignAssets}
        confirmLoading={assignSubmitting}
        okText="Lưu cấp phát"
        cancelText="Hủy"
      >
        {assigningKey && (
          <div className="space-y-3">
            <div className="bg-slate-50 p-3 rounded-lg border text-xs space-y-1">
              <div>
                <b>Mã Key:</b>{' '}
                <code className="text-indigo-600 font-mono">
                  {assigningKey.licenseKey}
                </code>
              </div>
              <div>
                <b>Số lượng đã chọn:</b>{' '}
                <Tag
                  color={
                    selectedAssetIds.length > assigningKey.maxSeats
                      ? 'error'
                      : 'blue'
                  }
                >
                  {selectedAssetIds.length} / {assigningKey.maxSeats} máy
                </Tag>
              </div>
            </div>

            <div>
              <div className="text-xs font-medium text-gray-600 mb-1">
                Chọn danh sách máy tính sử dụng Key này:
              </div>
              <Select
                mode="multiple"
                allowClear
                showSearch
                optionFilterProp="label"
                className="w-full"
                placeholder="Gõ tên máy (Hostname), IP hoặc User để chọn..."
                value={selectedAssetIds}
                onChange={setSelectedAssetIds}
                options={allAssets.map((a) => ({
                  value: a.id,
                  label: `${a.name} ${a.ipAddress ? `(${a.ipAddress})` : ''} ${
                    a.domainUser ? `- ${a.domainUser}` : ''
                  }`,
                }))}
              />
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL GÁN NHANH KEY CHO 1 MÁY NGƯỜI DÙNG */}
      <Modal
        title={
          quickAssignAsset
            ? `Cấp phát Key Bản quyền cho máy: ${quickAssignAsset.name}`
            : 'Cấp phát Key Bản quyền cho máy'
        }
        open={!!quickAssignAsset}
        onCancel={() => {
          setQuickAssignAsset(null);
          setSelectedKeyIdForAsset(undefined);
        }}
        onOk={handleQuickAssignKeyToMachine}
        confirmLoading={quickAssignLoading}
        okText="Gán Key cho máy này"
        cancelText="Đóng"
      >
        {quickAssignAsset && (
          <div className="space-y-3">
            <div className="bg-slate-50 p-3 rounded-lg border text-xs space-y-1">
              <div>
                <b>Tên máy:</b>{' '}
                <span className="font-mono font-bold text-blue-700">
                  {quickAssignAsset.name}
                </span>{' '}
                {quickAssignAsset.ipAddress ? `(${quickAssignAsset.ipAddress})` : ''}
              </div>
              <div>
                <b>Hệ điều hành:</b> {quickAssignAsset.osName || 'Chưa rõ'}
              </div>
              <div>
                <b>Người dùng:</b>{' '}
                {quickAssignAsset.users?.map((u: any) => u.fullName).join(', ') ||
                  quickAssignAsset.domainUser ||
                  'Chưa gán'}
              </div>
            </div>

            <div>
              <div className="text-xs font-medium text-gray-700 mb-1">
                Chọn Key bản quyền trong Kho Key (Windows, Office, Kaspersky, AutoCAD...):
              </div>
              <Select
                showSearch
                optionFilterProp="label"
                className="w-full"
                placeholder="Chọn Key bản quyền cần gán cho máy..."
                value={selectedKeyIdForAsset}
                onChange={setSelectedKeyIdForAsset}
                options={licenseKeys
                  .filter((k) => k.remainingSeats > 0)
                  .map((k) => ({
                    value: k.id,
                    label: `${k.policy?.name} — Key: ${k.licenseKey} (Còn trống ${k.remainingSeats}/${k.maxSeats} máy)`,
                  }))}
              />
              {licenseKeys.length === 0 && (
                <div className="mt-2 text-xs text-amber-600">
                  Kho Key hiện chưa có Key nào.{' '}
                  <Button
                    type="link"
                    size="small"
                    className="p-0 h-auto"
                    onClick={() => {
                      const assetId = quickAssignAsset.id;
                      setQuickAssignAsset(null);
                      handleOpenKeyModal(null);
                      setTimeout(() => {
                        keyForm.setFieldValue('assetIds', [assetId]);
                      }, 100);
                    }}
                  >
                    + Bấm vào đây để thêm Key mới và gán luôn cho máy này
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default SoftwareInventory;
