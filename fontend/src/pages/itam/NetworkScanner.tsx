import { useState, useEffect } from 'react';
import { Card, Input, Button, Table, Tag, Space, message, Badge, Tooltip, Alert, Modal, Progress, List, Spin } from 'antd';
import { 
  RadarChartOutlined, SearchOutlined, SaveOutlined, CameraOutlined, PrinterOutlined, 
  DesktopOutlined, GlobalOutlined, MobileOutlined, QuestionCircleOutlined, WifiOutlined, 
  ExperimentOutlined, ClockCircleOutlined, SafetyCertificateOutlined, BugOutlined, 
  WarningOutlined, CheckCircleOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import axiosClient from '../../api/axiosClient'; 
// [1] Import Socket Context
import { useSocket } from '../../context/SocketContext';

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
  // --- SOCKET ---
  const { socket } = useSocket();

  // --- STATE ---
  const [subnets, setSubnets] = useState("192.168.1.0/24"); 
  const [loading, setLoading] = useState(false); // Loading cho quét mạng
  const [devices, setDevices] = useState<NetworkDevice[]>([]);
  const [selectedRows, setSelectedRows] = useState<NetworkDevice[]>([]);

  // --- STATE BẢO MẬT ---
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [auditResult, setAuditResult] = useState<any>(null);
  const [auditLoading, setAuditLoading] = useState(false); // Loading cho Audit

  // --- [QUAN TRỌNG] LẮNG NGHE SOCKET ---
  useEffect(() => {
    if (!socket) return;

    // 1. Nhận kết quả QUÉT MẠNG
    const onScanComplete = (data: NetworkDevice[]) => {
        console.log("📡 Nhận kết quả quét từ Server:", data);
        setDevices(data);
        setLoading(false);
        message.success(`Quét hoàn tất! Tìm thấy ${data.length} thiết bị.`);
    };

    const onScanError = (err: any) => {
        setLoading(false);
        message.error(err.message || "Lỗi trong quá trình quét mạng");
    };

    // 2. Nhận kết quả AUDIT BẢO MẬT
    const onAuditComplete = (data: any) => {
        console.log("🛡️ Nhận kết quả Audit:", data);
        setAuditResult(data);
        setAuditLoading(false);
        message.success(`Đã kiểm tra xong IP: ${data.ip}`);
    };

    const onAuditError = (err: any) => {
        setAuditLoading(false);
        message.error(err.message || "Lỗi khi kiểm tra bảo mật");
    };

    // Đăng ký sự kiện
    socket.on("scan_complete", onScanComplete);
    socket.on("scan_error", onScanError);
    socket.on("audit_complete", onAuditComplete);
    socket.on("audit_error", onAuditError);

    // Hủy đăng ký khi thoát
    return () => {
        socket.off("scan_complete", onScanComplete);
        socket.off("scan_error", onScanError);
        socket.off("audit_complete", onAuditComplete);
        socket.off("audit_error", onAuditError);
    };
  }, [socket]);

  // --- HÀM 1: QUÉT MẠNG (Gửi lệnh async) ---
  const handleScan = async () => {
    if (!subnets) return message.warning("Vui lòng nhập dải mạng!");
    
    const subnetArray = subnets.split(/[\n,;]+/).map(s => s.trim()).filter(s => s);

    setLoading(true);
    setDevices([]); 
    try {
      // Gọi API: Server sẽ trả về ngay lập tức "Đang xử lý..."
      const res = await axiosClient.post('/itam/network/scan', { subnets: subnetArray });
      
      if (res.data.status === 'success') {
        message.loading({ content: "Hệ thống đang quét ngầm, vui lòng đợi...", key: 'scanning_msg', duration: 2 });
        // Lưu ý: Không setLoading(false) ở đây. Chờ Socket báo về mới tắt.
      }
    } catch (error: any) {
      console.error(error);
      message.error("Lỗi khi gửi lệnh quét.");
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

  // --- HÀM 3: KIỂM TRA BẢO MẬT (Gửi lệnh async) ---
  const handleAudit = async (ip: string) => {
    setAuditResult(null);
    setAuditModalOpen(true);
    setAuditLoading(true);
    try {
        // Gửi lệnh kiểm tra ngầm
        await axiosClient.post('/itam/network/audit', { ip });
        // Không chờ kết quả ở đây, chờ Socket
    } catch (e) {
        message.error("Không thể kết nối module bảo mật.");
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
                loading={auditLoading && auditModalOpen === false} // Hiệu ứng loading nhỏ nếu cần
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
                <span>⏳ Thời gian: 30s - 2 phút. Hệ thống xử lý ngầm và báo kết quả khi xong.</span>
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
                <span>Báo cáo Bảo mật: {auditResult?.ip || 'Đang kiểm tra...'}</span>
            </div>
        }
        open={auditModalOpen}
        onCancel={() => { if(!auditLoading) setAuditModalOpen(false); }}
        footer={!auditLoading ? null : <div className="text-center text-gray-400 text-xs">Vui lòng đợi...</div>}
        width={700}
        destroyOnClose
        maskClosable={!auditLoading} // Không cho đóng khi đang quét
      >
        {auditLoading ? (
            <div className="flex flex-col items-center justify-center p-8 gap-4">
                <Spin size="large" />
                <span className="text-gray-500 text-center">
                    Đang chạy script dò lỗ hổng (Nmap Vuln)...<br/>
                    Quá trình này có thể mất 1-2 phút. Kết quả sẽ tự động hiện ra.
                </span>
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