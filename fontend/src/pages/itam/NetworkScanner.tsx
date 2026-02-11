import { useState } from 'react';
import { Card, Input, Button, Table, Tag, Space, message, Badge, Tooltip, Alert, Modal, Progress, List, Spin } from 'antd';
import { 
  RadarChartOutlined, 
  SearchOutlined, 
  SaveOutlined, 
  CameraOutlined, 
  PrinterOutlined, 
  DesktopOutlined, 
  GlobalOutlined, 
  MobileOutlined,
  QuestionCircleOutlined,
  WifiOutlined,
  ExperimentOutlined, 
  ClockCircleOutlined,
  SafetyCertificateOutlined,
  BugOutlined,
  WarningOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import axiosClient from '../../api/axiosClient'; 

interface NetworkDevice {
  ip: string;
  mac: string;
  hostname: string;
  vendor: string;
  open_ports: number[];
  type: 'CAMERA' | 'PRINTER' | 'PC' | 'TIMEKEEPER' | 'NETWORK_DEVICE' | 'MOBILE' | 'INDUSTRIAL' | 'UNKNOWN';
  status: string;
}

const NetworkScanner = () => {
  // --- STATE QUÉT MẠNG ---
  const [subnets, setSubnets] = useState("192.168.1.0/24"); 
  const [loading, setLoading] = useState(false);
  const [devices, setDevices] = useState<NetworkDevice[]>([]);
  const [selectedRows, setSelectedRows] = useState<NetworkDevice[]>([]);

  // --- STATE BẢO MẬT (SECURITY AUDIT) ---
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [auditResult, setAuditResult] = useState<any>(null);
  const [auditLoading, setAuditLoading] = useState(false);

  // --- HÀM 1: QUÉT MẠNG ---
  const handleScan = async () => {
    if (!subnets) return message.warning("Vui lòng nhập dải mạng!");
    
    // Tách subnet phòng trường hợp nhập nhiều dòng
    const subnetArray = subnets.split(/[\n,;]+/).map(s => s.trim()).filter(s => s);

    setLoading(true);
    setDevices([]); 
    try {
      const res = await axiosClient.post('/itam/network/scan', { subnets: subnetArray });
      
      if (res.data.status === 'success') {
        setDevices(res.data.data);
        message.success(`Đã tìm thấy ${res.data.data.length} thiết bị!`);
      }
    } catch (error: any) {
      console.error(error);
      message.error("Lỗi khi quét mạng. Hãy kiểm tra lại Backend/Python.");
    } finally {
      setLoading(false);
    }
  };

  // --- HÀM 2: LƯU VÀO CSDL ---
  const handleImportAssets = async () => {
    if (selectedRows.length === 0) return message.warning("Chưa chọn thiết bị nào để lưu!");
    
    message.loading("Đang lưu vào kho tài sản...");
    try {
       await axiosClient.post('/itam/network/import', { devices: selectedRows });
       message.success(`Đã lưu thành công ${selectedRows.length} thiết bị!`);
    } catch(e) {
       message.error("Lỗi khi lưu thiết bị.");
    }
  };

  // --- HÀM 3: KIỂM TRA BẢO MẬT (AUDIT) ---
  const handleAudit = async (ip: string) => {
    setAuditResult(null);
    setAuditModalOpen(true);
    setAuditLoading(true);
    try {
        // Gọi API Audit riêng cho 1 IP
        const res = await axiosClient.post('/itam/network/audit', { ip });
        setAuditResult(res.data.data);
    } catch (e) {
        message.error("Không thể kết nối module bảo mật.");
        setAuditModalOpen(false);
    } finally {
        setAuditLoading(false);
    }
  };

  // --- HELPER: RENDER ICON LOẠI THIẾT BỊ ---
  const getDeviceIcon = (type: string) => {
    switch (type) {
        case 'CAMERA': return <CameraOutlined className="text-xl text-orange-500" />;
        case 'PRINTER': return <PrinterOutlined className="text-xl text-cyan-600" />;
        case 'PC': return <DesktopOutlined className="text-xl text-blue-600" />;
        case 'TIMEKEEPER': return <Badge dot status="processing"><ClockCircleOutlined className="text-xl text-purple-600" /></Badge>;
        case 'INDUSTRIAL': return <ExperimentOutlined className="text-xl text-red-600" />;
        case 'NETWORK_DEVICE': return <GlobalOutlined className="text-xl text-green-600" />;
        case 'MOBILE': return <MobileOutlined className="text-xl text-pink-500" />;
        default: return <QuestionCircleOutlined className="text-xl text-gray-400" />;
    }
  };

  // --- HELPER: RENDER TYPE TAG ---
  const getTypeTag = (type: string) => {
      const map: Record<string, string> = {
          'CAMERA': 'orange', 'PRINTER': 'cyan', 'PC': 'blue', 
          'TIMEKEEPER': 'purple', 'INDUSTRIAL': 'volcano', 
          'NETWORK_DEVICE': 'green', 'MOBILE': 'magenta', 'UNKNOWN': 'default'
      };
      return <Tag color={map[type] || 'default'}>{type}</Tag>;
  };

  // --- COLUMNS ---
  const columns: ColumnsType<NetworkDevice> = [
    {
        title: '',
        dataIndex: 'type',
        width: 50,
        align: 'center',
        render: (type) => <Tooltip title={type}>{getDeviceIcon(type)}</Tooltip>
    },
    {
      title: 'IP Address',
      dataIndex: 'ip',
      key: 'ip',
      width: 140,
      sorter: (a, b) => a.ip.localeCompare(b.ip, undefined, { numeric: true }),
      render: (ip) => <span className="font-bold text-gray-700">{ip}</span>
    },
    // [UPDATE] Cột Hãng sản xuất (Vendor) hiển thị đẹp hơn
    {
        title: 'Hãng sản xuất',
        dataIndex: 'vendor',
        key: 'vendor',
        width: 180,
        render: (v) => v ? <Tag color="cyan">{v}</Tag> : <span className="text-gray-300 text-xs italic">-</span>
    },
    {
        title: 'Phân loại AI',
        dataIndex: 'type',
        key: 'type',
        width: 120,
        render: (type) => getTypeTag(type)
    },
    {
        title: 'Cổng mở (Ports)',
        dataIndex: 'open_ports',
        key: 'ports',
        render: (ports: number[]) => (
            <div className="flex flex-wrap gap-1 max-w-[200px]">
                {ports.map(p => {
                    let color = 'default';
                    if ([80, 443].includes(p)) color = 'blue';       
                    if ([554, 8000].includes(p)) color = 'orange';   
                    if ([3389, 445, 62078].includes(p)) color = 'geekblue'; 
                    if ([22, 23].includes(p)) color = 'red';         
                    if ([4370].includes(p)) color = 'purple'; 
                    if ([502, 102, 1883, 4840, 9600].includes(p)) color = 'volcano'; 
                    return <Tag key={p} className="m-0 text-[10px]" color={color}>{p}</Tag>
                })}
            </div>
        )
    },
    // [NEW] Cột Hành động quét bảo mật
    {
        title: 'Bảo mật',
        key: 'action',
        align: 'center',
        width: 100,
        render: (_, record) => (
            <Button 
                size="small" 
                type="dashed" 
                danger
                icon={<SafetyCertificateOutlined />}
                onClick={() => handleAudit(record.ip)}
            >
                Kiểm tra
            </Button>
        )
    }
  ];

  return (
    <div className="p-4 bg-gray-50 h-full">
      <Card 
        bordered={false}
        title={<span><RadarChartOutlined className="text-blue-600 mr-2" />Quét Mạng (Network Discovery)</span>}
        className="shadow-sm rounded-lg"
      >
        {/* Input Area */}
        <div className="flex gap-4 mb-6 items-start">
          <div className="flex-1">
            <Input.TextArea 
              rows={1} 
              placeholder="Nhập dải mạng (CIDR). VD: 192.168.1.0/24" 
              value={subnets}
              onChange={e => setSubnets(e.target.value)}
              className="resize-none"
            />
            <div className="text-xs text-gray-400 mt-1 flex gap-4">
                <span><WifiOutlined /> Hỗ trợ quét nhiều VLAN.</span>
                <span>⏳ Thời gian: 10-30s. Sử dụng Service Scan để tìm Vendor qua VPN.</span>
            </div>
          </div>
          <Button 
            type="primary" 
            icon={<SearchOutlined />} 
            onClick={handleScan} 
            loading={loading}
            size="large"
          >
            {loading ? 'Đang quét...' : 'Bắt đầu quét'}
          </Button>
        </div>

        {/* Thông báo kết quả */}
        {devices.length > 0 && (
            <Alert 
                message={
                    <div className="flex justify-between items-center w-full">
                        <span>Đã tìm thấy <b>{devices.length}</b> thiết bị.</span>
                        <Space>
                            <Button type="primary" size="small" icon={<SaveOutlined />} onClick={handleImportAssets}>
                                Lưu {selectedRows.length} thiết bị đã chọn
                            </Button>
                        </Space>
                    </div>
                } 
                type="info" 
                showIcon 
                className="mb-4"
            />
        )}

        {/* Bảng dữ liệu chính */}
        <Table 
            rowSelection={{
                type: 'checkbox',
                onChange: (_, rows) => setSelectedRows(rows),
            }}
            columns={columns} 
            dataSource={devices} 
            rowKey="ip" 
            loading={loading}
            pagination={{ pageSize: 20 }}
            size="middle"
            bordered
        />
      </Card>

      {/* --- MODAL BÁO CÁO BẢO MẬT --- */}
      <Modal
        title={
            <div className="flex items-center gap-2">
                <BugOutlined className="text-red-500"/> 
                <span>Báo cáo Bảo mật: {auditResult?.ip}</span>
            </div>
        }
        open={auditModalOpen}
        onCancel={() => setAuditModalOpen(false)}
        footer={null}
        width={700}
        destroyOnClose
      >
        {auditLoading ? (
            <div className="flex flex-col items-center justify-center p-8 gap-4">
                <Spin size="large" />
                <span className="text-gray-500">Đang chạy script dò lỗ hổng (Nmap Vuln)...<br/>Quá trình này có thể mất 1-2 phút.</span>
            </div>
        ) : auditResult ? (
            <div className="space-y-6">
                {/* Điểm số */}
                <div className="flex justify-center items-center flex-col">
                    <Progress 
                        type="circle" 
                        percent={auditResult.score} 
                        format={(percent) => <span className="text-xl font-bold">{percent}/100</span>}
                        status={auditResult.score < 50 ? 'exception' : auditResult.score < 80 ? 'normal' : 'success'}
                        strokeWidth={10}
                        size={120}
                    />
                    <div className="mt-2 font-semibold text-gray-600">Điểm An Toàn</div>
                </div>

                {/* Danh sách lỗi */}
                <div>
                    <h4 className="font-bold mb-2 flex items-center gap-2">
                        {auditResult.vulnerabilities.length > 0 ? <WarningOutlined className="text-red-500"/> : <CheckCircleOutlined className="text-green-500"/>}
                        Chi tiết phát hiện:
                    </h4>
                    
                    {auditResult.vulnerabilities.length > 0 ? (
                        <List
                            itemLayout="horizontal"
                            dataSource={auditResult.vulnerabilities}
                            renderItem={(item: any) => (
                                <List.Item className="bg-red-50 p-3 rounded-md mb-2 border border-red-100">
                                    <List.Item.Meta
                                        title={
                                            <div className="flex gap-2 items-center">
                                                <Tag color="red">Port {item.port}</Tag>
                                                <span className="font-bold text-red-700">{item.issue}</span>
                                            </div>
                                        }
                                        description={
                                            <div className="text-xs font-mono text-gray-600 mt-1 bg-white p-2 rounded border">
                                                {item.detail}
                                            </div>
                                        }
                                    />
                                </List.Item>
                            )}
                        />
                    ) : (
                        <Alert 
                            message="Hệ thống sạch" 
                            description="Không tìm thấy lỗ hổng CVE nghiêm trọng nào phổ biến với script này." 
                            type="success" 
                            showIcon 
                        />
                    )}

                    {/* Cảnh báo nhẹ */}
                    {auditResult.warnings && auditResult.warnings.length > 0 && (
                         <div className="mt-4">
                            <span className="text-xs text-gray-400 font-bold uppercase">Cảnh báo khác:</span>
                            <div className="flex flex-wrap gap-2 mt-1">
                                {auditResult.warnings.map((w: any, idx: number) => (
                                    <Tag key={idx} color="orange">{w.service} ({w.issue})</Tag>
                                ))}
                            </div>
                         </div>
                    )}
                </div>
            </div>
        ) : null}
      </Modal>
    </div>
  );
};

export default NetworkScanner;