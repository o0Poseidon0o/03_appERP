import React, { useState, useEffect, useRef } from 'react';
import { 
  Table, Tag, Button, Card, Modal, 
  Typography, Descriptions, Input, 
  App as AntdApp, Space, Progress, Badge as AntdBadge, Tooltip 
} from 'antd';
import { 
  CheckCircleOutlined, 
  EyeOutlined, ClockCircleOutlined,
  ArrowRightOutlined,
  HistoryOutlined, FileDoneOutlined,
  PrinterOutlined,
  CloseCircleOutlined,
  EnvironmentOutlined,
  UserOutlined,
  ApartmentOutlined,
  BarcodeOutlined
} from '@ant-design/icons';
import { useReactToPrint } from 'react-to-print';
import axiosClient from '../../api/axiosClient';
import dayjs from 'dayjs';

const { Text } = Typography;

// ============================================================================
// COMPONENT MẪU IN 
// ============================================================================
const TicketPrintTemplate = React.forwardRef<HTMLDivElement, { ticket: any }>(({ ticket }, ref) => {
    if (!ticket) return null;

    const steps = ticket.steps || [];
    
    // Logic tìm người ký (Mở rộng từ khóa)
    let deptManagerStep = steps.find((s: any) => 
        s.status === 'APPROVED' && 
        ['trưởng', 'leader', 'manager', 'quản lý', 'giám đốc', 'bộ phận', 'tổ trưởng', 'xác nhận'].some((k: string) => s.step?.name?.toLowerCase().includes(k))
    );
    if (!deptManagerStep && steps.length > 1 && steps[1].status === 'APPROVED') {
        deptManagerStep = steps[1];
    }

    let warehouseKeeperStep = steps.find((s: any) => 
        s.status === 'APPROVED' && 
        ['thủ kho', 'kho', 'warehouse', 'xuất', 'nhập', 'hoàn tất'].some((k: string) => s.step?.name?.toLowerCase().includes(k))
    );
    if (!warehouseKeeperStep && steps.length > 0) {
        const lastStep = steps[steps.length - 1];
        if (lastStep.status === 'APPROVED' && lastStep.id !== deptManagerStep?.id) {
            warehouseKeeperStep = lastStep;
        }
    }

    const SignatureBox = ({ title, jpTitle, signerName, signerId, date, isSigned }: any) => {
        return (
            <div style={{ flex: 1, border: '1px solid #000', borderLeft: 'none', display: 'flex', flexDirection: 'column', height: '150px' }}>
                <div style={{ borderBottom: '1px solid #000', padding: '5px', textAlign: 'center', backgroundColor: '#f0f0f0', height: '45px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '11px', textTransform: 'uppercase' }}>{title}</div>
                    <div style={{ fontSize: '10px' }}>{jpTitle}</div>
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', paddingBottom: '5px', position: 'relative' }}>
                    {isSigned ? (
                        <>
                            <div style={{ position: 'absolute', top: '10px', width: '40px', height: '40px', border: '3px solid #28a745', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.2 }}>
                                <span style={{ fontSize: '24px', color: '#28a745', fontWeight: 'bold' }}>✔</span>
                            </div>
                            <div style={{ position: 'absolute', top: '10px', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <span style={{ fontSize: '24px', color: '#28a745', fontWeight: 'bold' }}>✔</span>
                            </div>
                            <div style={{ fontFamily: 'Arial', fontWeight: 'bold', fontSize: '13px', marginBottom: '2px', textTransform: 'uppercase', textAlign: 'center' }}>
                                {signerName || '---'}
                            </div>
                            <div style={{ fontSize: '10px', color: '#333' }}>ID: {signerId || '---'}</div>
                            <div style={{ fontSize: '10px', fontStyle: 'italic', marginTop: '2px' }}>
                                {date ? dayjs(date).format('DD/MM/YYYY') : ''}
                            </div>
                        </>
                    ) : <div style={{ height: '40px' }}></div>}
                </div>
            </div>
        );
    };

    return (
        <div ref={ref} style={{ padding: '20px 40px', backgroundColor: 'white', color: 'black', fontFamily: '"Times New Roman", Times, serif', fontSize: '12px' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', borderBottom: '2px solid #000', paddingBottom: '10px' }}>
                <div style={{ width: '30%', display: 'flex', alignItems: 'center' }}>
                    <img src="/logo_towa.png" alt="Towa Logo" style={{ maxHeight: '50px', maxWidth: '100%', objectFit: 'contain' }} 
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                </div>
                <div style={{ width: '40%', textAlign: 'center' }}>
                    <div style={{ fontSize: '20px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                        PHIẾU {ticket.type === 'EXPORT' ? 'XUẤT KHO' : (ticket.type === 'IMPORT' ? 'NHẬP KHO' : 'ĐIỀU CHUYỂN')}
                    </div>
                    <div style={{ fontStyle: 'italic', fontSize: '14px' }}>Ngày: {dayjs(ticket.createdAt).format('DD/MM/YYYY')}</div>
                </div>
                <div style={{ width: '30%', textAlign: 'right', fontSize: '12px' }}>
                    <div>Số phiếu (No): <b>{ticket.code}</b></div>
                    <div>Nhà máy: <b>{ticket.factoryName || '---'}</b></div>
                </div>
            </div>

            {/* Info */}
            <div style={{ display: 'flex', border: '1px solid #000', borderBottom: 'none' }}>
                <div style={{ flex: 1, padding: '8px', borderRight: '1px solid #000' }}>
                    Bộ phận (Dept): <b>{ticket.creator?.department?.name}</b>
                </div>
                <div style={{ flex: 1, padding: '8px', borderRight: '1px solid #000' }}>
                    Mã Bộ phận (Dept Code): <b>{ticket.creator?.department?.id || '---'}</b>
                </div>
                <div style={{ flex: 2, padding: '8px' }}>
                    Diễn giải: {ticket.description}
                </div>
            </div>

            {/* Table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid black', fontSize: '11px' }}>
                <thead>
                    <tr style={{ backgroundColor: '#e0e0e0', textAlign: 'center', height: '40px' }}>
                        <th style={{ border: '1px solid black', width: '30px' }}>STT<br/>No.</th>
                        <th style={{ border: '1px solid black' }}>Mã Vật Tư<br/>Item Code</th>
                        <th style={{ border: '1px solid black' }}>Tên Vật Tư<br/>Item Name</th>
                        <th style={{ border: '1px solid black', width: '60px' }}>Mã BP<br/>Dept Code</th>
                        <th style={{ border: '1px solid black', width: '70px' }}>Chủng Loại<br/>Category</th>
                        <th style={{ border: '1px solid black', width: '50px' }}>ĐVT<br/>Unit</th>
                        <th style={{ border: '1px solid black', width: '60px' }}>SL Đề Nghị<br/>Qty</th>
                        <th style={{ border: '1px solid black', width: '60px' }}>Thực Nhận<br/>Actual</th>
                        <th style={{ border: '1px solid black' }}>Vị Trí Kho<br/>Location</th>
                    </tr>
                </thead>
                <tbody>
                    {ticket.details?.map((item: any, index: number) => (
                        <tr key={index} style={{ height: '30px' }}>
                            <td style={{ border: '1px solid black', textAlign: 'center' }}>{index + 1}</td>
                            <td style={{ border: '1px solid black', padding: '0 5px' }}>{item.item?.itemCode}</td>
                            <td style={{ border: '1px solid black', padding: '0 5px' }}>{item.item?.itemName}</td>
                            <td style={{ border: '1px solid black', textAlign: 'center' }}>{ticket.creator?.department?.id}</td>
                            <td style={{ border: '1px solid black', textAlign: 'center' }}>{item.usageCategory?.code || '-'}</td>
                            <td style={{ border: '1px solid black', textAlign: 'center' }}>{item.item?.baseUnit}</td>
                            <td style={{ border: '1px solid black', textAlign: 'center', fontWeight: 'bold' }}>{item.quantity}</td>
                            <td style={{ border: '1px solid black', textAlign: 'center' }}>{ticket.status === 'APPROVED' ? item.quantity : ''}</td>
                            <td style={{ border: '1px solid black', padding: '0 5px' }}>{ticket.type === 'EXPORT' ? item.fromLocation?.locationCode : item.toLocation?.locationCode}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* Signatures */}
            <div style={{ display: 'flex', marginTop: '30px', borderLeft: '1px solid #000' }}>
                <SignatureBox title="Người đề nghị" jpTitle="依頼者" isSigned={true} signerName={ticket.creator?.fullName} signerId={ticket.creator?.id} date={ticket.createdAt} />
                <SignatureBox title="Trưởng bộ phận" jpTitle="部門長" isSigned={!!deptManagerStep} signerName={deptManagerStep?.actor?.fullName} signerId={deptManagerStep?.actor?.id} date={deptManagerStep?.actedAt} />
                <SignatureBox title="Bộ phận Kho" jpTitle="倉庫部門" isSigned={!!warehouseKeeperStep} signerName={warehouseKeeperStep?.actor?.fullName} date={warehouseKeeperStep?.actedAt} />
                <SignatureBox title="Thủ kho" jpTitle="払出者" isSigned={!!warehouseKeeperStep} signerName={warehouseKeeperStep?.actor?.fullName} signerId={warehouseKeeperStep?.actor?.id} date={warehouseKeeperStep?.actedAt} />
                <SignatureBox title="Người nhận" jpTitle="受領者" isSigned={false} signerName="" />
            </div>
            <div style={{ marginTop: '5px', fontSize: '10px', fontStyle: 'italic', textAlign: 'right' }}>
                In lúc: {dayjs().format('DD/MM/YYYY HH:mm')} | Hệ thống ERP Towa Vietnam
            </div>
        </div>
    );
});

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================
const PendingApprovals: React.FC = () => {
  const { message } = AntdApp.useApp();
  const printRef = useRef<HTMLDivElement>(null);
  
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('pending');
  const [pendingData, setPendingData] = useState([]);
  const [historyData, setHistoryData] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: selectedTicket ? `${selectedTicket.code}` : 'Phieu_Kho',
  });

  const normalizeTicket = (t: any) => {
      const isTicketStructure = !!t.stockTransaction;
      return {
          id: t.id,
          code: t.code,
          type: isTicketStructure ? t.stockTransaction?.type : t.type,
          description: isTicketStructure ? t.stockTransaction?.description : t.description,
          isEmergency: isTicketStructure ? t.stockTransaction?.isEmergency : t.isEmergency,
          details: isTicketStructure ? t.stockTransaction?.details : t.details,
          factoryName: isTicketStructure ? t.stockTransaction?.factory?.name : t.factoryName,
          
          creator: t.creator,
          status: t.status,
          createdAt: t.createdAt,
          currentStep: t.currentStep,
          // Đảm bảo lấy được steps từ cả 2 nguồn
          steps: t.steps || t.approvalHistory || [],
          isRequesterStep: t.status === 'WAITING_CONFIRM', 
      };
  };

  const fetchPending = async () => {
    setLoading(true);
    try {
      const res = await axiosClient.get('/tickets/pending');
      setPendingData(res.data.data.map(normalizeTicket));
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await axiosClient.get('/stock-transactions/history', { params: { limit: 20 } });
      // [FIX] Ưu tiên lấy item.steps vì Backend trả về đúng key này
      const normalized = res.data.data.map((item: any) => ({
          ...item,
          steps: item.steps || item.approvalHistory || []
      }));
      setHistoryData(normalized);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => {
    if (activeTab === 'pending') fetchPending();
    else fetchHistory();
  }, [activeTab]);

  const handleAction = async (action: 'APPROVE' | 'REJECT') => {
    if (!selectedTicket) return;
    setSubmitting(true);
    try {
      const endpoint = action === 'APPROVE' ? `/tickets/${selectedTicket.id}/approve` : `/tickets/${selectedTicket.id}/reject`;
      await axiosClient.post(endpoint, { comment });
      message.success(action === 'APPROVE' ? 'Đã duyệt thành công' : 'Đã từ chối phiếu');
      setIsModalOpen(false);
      setComment('');
      fetchPending(); 
    } catch (e: any) { 
      message.error(e.response?.data?.message || 'Thao tác thất bại'); 
    } finally {
      setSubmitting(false);
    }
  };

  const columnsConfig = (isHistory = false) => [
    { 
        title: 'Mã phiếu', dataIndex: 'code', 
        render: (v: string, r: any) => (
            <Space direction="vertical" size={0}>
                <a onClick={() => { setSelectedTicket(r); setIsModalOpen(true); }} className="font-bold text-blue-600 cursor-pointer hover:underline">{v}</a>
                {r.isEmergency && <Tag color="error" style={{ fontSize: '10px' }}>KHẨN</Tag>}
                {r.factoryName && <Tag icon={<EnvironmentOutlined />} color="cyan">{r.factoryName}</Tag>}
            </Space>
        ) 
    },
    { 
        title: 'Loại', dataIndex: 'type', width: 100,
        render: (v: string) => { 
            const config: any = { IMPORT: { color: 'blue', text: 'Nhập kho' }, EXPORT: { color: 'orange', text: 'Xuất kho' }, TRANSFER: { color: 'purple', text: 'Chuyển kho' } }; 
            return <Tag color={config[v]?.color}>{config[v]?.text}</Tag>; 
        } 
    },
    { 
        title: 'Người lập & Bộ phận', 
        render: (_: any, r: any) => (
            <div>
                <div className="font-semibold"><UserOutlined className="mr-1"/>{r.creator?.fullName}</div>
                <div className="text-xs text-gray-500 mb-1 pl-4">ID: {r.creator?.id || '---'}</div>
                <div className="text-xs text-blue-700 font-medium"><ApartmentOutlined className="mr-1"/>{r.creator?.department?.name}</div>
                <div className="text-xs text-gray-400 pl-4">Code: {r.creator?.department?.id || '---'}</div>
            </div>
        ) 
    },
    {
        title: 'Nội dung', key: 'summary', width: '25%',
        render: (_: any, r: any) => {
            const firstTwo = r.details?.slice(0, 2) || [];
            const remaining = (r.details?.length || 0) - 2;
            return (
                <div className="text-xs text-gray-600">
                    {firstTwo.map((d: any, idx: number) => (
                         <div key={idx}>• <b>{d.item?.itemName}</b> ({d.quantity} {d.item?.baseUnit})</div>
                    ))}
                    {remaining > 0 && <div>+ {remaining} mặt hàng khác...</div>}
                </div>
            )
        }
    },
    { 
        title: 'Tiến độ', 
        key: 'progress', 
        render: (_: any, r: any) => { 
            if (r.status === 'REJECTED') return <Tag color="red" icon={<CloseCircleOutlined />}>Đã từ chối</Tag>;
            if (r.status === 'APPROVED') return <Tag color="green" icon={<CheckCircleOutlined />}>Hoàn tất</Tag>;
            if (r.status === 'WAITING_CONFIRM') return <Tag color="gold">Chờ xác nhận</Tag>;
            
            const steps = r.steps || [];
            const totalSteps = steps.length || 1;
            const approvedCount = steps.filter((s: any) => s.status === 'APPROVED').length;
            const currentStepData = steps.find((s: any) => s.step?.order === r.currentStep);
            const currentStepName = currentStepData?.step?.name || 'Đang chờ';

            return (
                <Space direction="vertical" size={0} style={{ width: 140 }}>
                    <div className="flex justify-between mb-1">
                        <Tooltip title={currentStepName}>
                             <Text style={{ fontSize: '11px', maxWidth: '100px' }} ellipsis type="secondary">{currentStepName}</Text>
                        </Tooltip>
                        <Text style={{ fontSize: '11px' }}>{approvedCount}/{totalSteps}</Text>
                    </div>
                    <Progress percent={Math.round((approvedCount / totalSteps) * 100)} size="small" showInfo={false} status="active" />
                </Space>
            ); 
        } 
    },
    { title: 'Ngày tạo', dataIndex: 'createdAt', render: (v: string) => <Text type="secondary" style={{fontSize: '11px'}}>{dayjs(v).format('DD/MM HH:mm')}</Text> },
    { 
        title: '', align: 'right' as const, 
        render: (_: any, r: any) => (
            <Button 
                type={isHistory ? "text" : "primary"} 
                size="small" 
                className={!isHistory && r.isRequesterStep ? "bg-green-600" : ""} 
                icon={!isHistory && r.isRequesterStep ? <CheckCircleOutlined /> : <EyeOutlined />} 
                onClick={() => { setSelectedTicket(r); setIsModalOpen(true); }}
            >
                {isHistory ? "Chi tiết" : (r.isRequesterStep ? "Nhận hàng" : "Duyệt")}
            </Button>
        ) 
    }
  ];

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      <div style={{ position: 'fixed', top: -10000, left: -10000 }}>
         <TicketPrintTemplate ref={printRef} ticket={selectedTicket} />
      </div>

      <Card 
        className="shadow-sm rounded-xl" 
        tabList={[
            { key: 'pending', label: (<span className="px-2"><FileDoneOutlined /> Cần xử lý <AntdBadge count={pendingData.length} offset={[10, -5]} size="small" /></span>) }, 
            { key: 'history', label: (<span className="px-2"><HistoryOutlined /> Lịch sử</span>) }
        ]} 
        activeTabKey={activeTab} 
        onTabChange={key => setActiveTab(key)} 
        extra={<Button icon={<ClockCircleOutlined />} onClick={() => activeTab === 'pending' ? fetchPending() : fetchHistory()}>Tải lại</Button>}
      >
        <Table 
            dataSource={activeTab === 'pending' ? pendingData : historyData} 
            columns={columnsConfig(activeTab === 'history')} 
            rowKey="id" 
            loading={loading} 
            pagination={{ pageSize: 10 }} 
            locale={{ emptyText: 'Không có dữ liệu.' }} 
        />
      </Card>
      
      <Modal 
        title={<Space><span>Phiếu: {selectedTicket?.code}</span><Button size="small" icon={<PrinterOutlined />} onClick={handlePrint}>In phiếu</Button></Space>} 
        open={isModalOpen} 
        onCancel={() => setIsModalOpen(false)} 
        width={900} 
        footer={null}
      >
        {selectedTicket && (
            <div className="pt-2">
                <Descriptions column={2} size="small" bordered className="mb-4">
                    <Descriptions.Item label="Người lập">
                        {selectedTicket.creator?.fullName} <br/> 
                        <span className="text-gray-400 text-xs">(ID: {selectedTicket.creator?.id})</span>
                    </Descriptions.Item>
                    <Descriptions.Item label="Bộ phận">
                        {selectedTicket.creator?.department?.name} <br/>
                        <span className="text-gray-400 text-xs">(Code: {selectedTicket.creator?.department?.id})</span>
                    </Descriptions.Item>
                    <Descriptions.Item label="Nhà máy">{selectedTicket.factoryName || '---'}</Descriptions.Item>
                    <Descriptions.Item label="Ngày tạo">{dayjs(selectedTicket.createdAt).format('DD/MM/YYYY HH:mm')}</Descriptions.Item>
                    <Descriptions.Item label="Ghi chú" span={2}>{selectedTicket.description || 'Không có'}</Descriptions.Item>
                </Descriptions>
                
                <Table 
                    dataSource={selectedTicket.details} 
                    pagination={false} size="small" bordered rowKey="id" 
                    columns={[
                        { title: 'Vật tư', render: (_: any, r: any) => <div><b>{r.item?.itemName}</b><br/><span className="text-gray-500 text-xs">{r.item?.itemCode}</span></div> }, 
                        { title: 'Loại', align: 'center', render: (_: any, r: any) => <Tag icon={<BarcodeOutlined />}>{r.usageCategory?.code || '-'}</Tag> },
                        { title: 'SL', dataIndex: 'quantity', align: 'center', render: (v: any, r: any) => <b>{v} {r.item?.baseUnit}</b> }, 
                        { title: 'Vị trí', render: (_: any, row: any) => <Space><Tag color="orange">{row.fromLocation?.locationCode || 'Kho'}</Tag><ArrowRightOutlined /><Tag color="blue">{row.toLocation?.locationCode || 'Ngoài'}</Tag></Space> }
                    ]} 
                />
                
                {activeTab === 'pending' && ['PENDING', 'WAITING_CONFIRM'].includes(selectedTicket?.status) && (
                    <div className="mt-4 p-4 bg-slate-50 rounded border">
                        <Input.TextArea rows={2} value={comment} onChange={e => setComment(e.target.value)} placeholder="Nhập ghi chú phê duyệt (nếu có)..." className="mb-3" />
                        <div className="flex justify-end gap-2">
                            <Button danger onClick={() => handleAction('REJECT')} loading={submitting}>Từ chối</Button>
                            <Button type="primary" onClick={() => handleAction('APPROVE')} loading={submitting}>
                                {selectedTicket?.isRequesterStep ? "Xác nhận đã nhận hàng" : "Phê duyệt"}
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        )}
      </Modal>
    </div>
  );
};

export default PendingApprovals;