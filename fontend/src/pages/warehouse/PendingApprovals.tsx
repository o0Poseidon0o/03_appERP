import React, { useState, useEffect, useRef } from 'react';
import { 
  Table, Tag, Button, Card, Modal, 
  Typography, Descriptions, Divider, Input, 
  App as AntdApp, Space, Progress, Badge as AntdBadge 
} from 'antd';
import { 
  CheckCircleOutlined, 
  EyeOutlined, ClockCircleOutlined,
  ArrowRightOutlined,
  InfoCircleOutlined, HistoryOutlined, FileDoneOutlined,
  UserSwitchOutlined, SolutionOutlined, PrinterOutlined, DownloadOutlined
} from '@ant-design/icons';
import { useReactToPrint } from 'react-to-print';
import html2pdf from 'html2pdf.js';
import axiosClient from '../../api/axiosClient';
import dayjs from 'dayjs';

const { Text } = Typography;

// --- COMPONENT MẪU IN PHIẾU (ĐÃ CHỈNH SỬA CHO GIỐNG FILE EXCEL & SỬA LỖI PDF) ---
const TicketPrintTemplate = React.forwardRef<HTMLDivElement, { ticket: any }>(({ ticket }, ref) => {
    if (!ticket) return null;

    // Tìm người duyệt
    const deptManager = ticket.approvals?.find((a: any) => 
        a.step?.name?.toLowerCase().includes('trưởng') || a.step?.name?.toLowerCase().includes('leader')
    );
    const warehouseKeeper = ticket.approvals?.find((a: any) => 
        a.step?.name?.toLowerCase().includes('thủ kho') || a.step?.name?.toLowerCase().includes('warehouse')
    );

    // Box chữ ký (Sử dụng style inline để tránh lỗi html2pdf)
    const SignatureBox = ({ title, subTitle, approvalData, isCreator = false }) => {
        const isSigned = isCreator || approvalData?.status === 'APPROVED';
        const signerName = isCreator ? ticket.creator?.fullName : approvalData?.approver?.fullName;
        
        // Lấy ID
        let rawId = '';
        if (isCreator) {
            rawId = ticket.creator?.id;
        } else {
            rawId = approvalData?.approver?.id;
        }
        const signerId = rawId ? rawId.slice(0, 8) : '---';

        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                <p style={{ fontWeight: 'bold', fontSize: '14px', textTransform: 'uppercase', marginBottom: '4px' }}>{title}</p>
                <p style={{ fontStyle: 'italic', fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>{subTitle}</p>
                
                <div style={{ height: '100px', width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                    {isSigned ? (
                        <>
                            <div style={{ marginBottom: '4px' }}>
                                <div style={{ 
                                    width: '40px', height: '40px', 
                                    borderRadius: '50%', border: '2px solid #16a34a', 
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    backgroundColor: 'white'
                                }}>
                                    <span style={{ color: '#16a34a', fontSize: '24px', fontWeight: 'bold' }}>✔</span>
                                </div>
                            </div>
                            <span style={{ fontSize: '14px', fontWeight: 'bold', textTransform: 'uppercase', textAlign: 'center' }}>
                                {signerName || '---'}
                            </span>
                            <span style={{ fontSize: '10px', color: '#6b7280', fontFamily: 'monospace', marginTop: '2px' }}>
                                (ID: {signerId})
                            </span>
                        </>
                    ) : (
                        <div style={{ height: '100%', display: 'flex', alignItems: 'flex-end', paddingBottom: '16px' }}>
                            <span style={{ color: '#d1d5db', fontStyle: 'italic', fontSize: '12px' }}>...(Chưa ký)...</span>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div ref={ref} style={{ padding: '40px', backgroundColor: 'white', color: 'black', fontFamily: '"Times New Roman", Times, serif', width: '210mm', minHeight: '297mm', boxSizing: 'border-box' }}>
            
            {/* HEADER */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', paddingBottom: '16px', borderBottom: '2px solid black' }}>
                <div style={{ width: '25%', display: 'flex', alignItems: 'center' }}>
                    {/* Logo với crossOrigin để tránh lỗi khi tạo PDF */}
                    <img 
                        src="/logo_towa.png" 
                        alt="Logo" 
                        style={{ height: '64px', objectFit: 'contain' }} 
                        crossOrigin="anonymous" 
                    />
                </div>

                <div style={{ width: '50%', textAlign: 'center', paddingTop: '8px' }}>
                    <h1 style={{ fontSize: '24px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '1px' }}>
                        PHIẾU {ticket.type === 'EXPORT' ? 'XUẤT KHO' : (ticket.type === 'IMPORT' ? 'NHẬP KHO' : 'ĐIỀU CHUYỂN')}
                    </h1>
                    <p style={{ fontStyle: 'italic', fontSize: '16px' }}>Ngày lập: {dayjs(ticket.createdAt).format('DD/MM/YYYY')}</p>
                </div>

                <div style={{ width: '25%', textAlign: 'right', fontSize: '14px', paddingTop: '8px' }}>
                    <p style={{ marginBottom: '4px' }}><b>Số CT:</b> <span style={{ fontFamily: 'monospace', fontSize: '16px' }}>{ticket.code}</span></p>
                    <p style={{ marginBottom: '4px' }}><b>Ngày in:</b> {dayjs().format('DD/MM/YYYY')}</p>
                    <p><b>Trang:</b> 1/1</p>
                </div>
            </div>

            {/* INFO */}
            <div style={{ marginBottom: '24px', fontSize: '16px' }}>
                <table style={{ width: '100%' }}>
                    <tbody>
                        <tr>
                            <td style={{ width: '100px', fontWeight: 'bold', padding: '4px 0' }}>Bộ phận:</td>
                            <td>{ticket.creator?.department?.name}</td>
                            <td style={{ width: '120px', fontWeight: 'bold', padding: '4px 0', textAlign: 'right', paddingRight: '8px' }}>Mã bộ phận:</td>
                            {/* Hiển thị ID department làm mã bộ phận */}
                            <td style={{ width: '100px', fontFamily: 'monospace', fontWeight: 'bold' }}>
                                {ticket.creator?.department?.id || '---'}
                            </td>
                        </tr>
                        <tr>
                            <td style={{ fontWeight: 'bold', padding: '4px 0' }}>Người đề nghị:</td>
                            <td colSpan={3}>{ticket.creator?.fullName}</td>
                        </tr>
                        <tr>
                            <td style={{ fontWeight: 'bold', padding: '4px 0', verticalAlign: 'top' }}>Lý do/Ghi chú:</td>
                            <td colSpan={3} style={{ fontStyle: 'italic' }}>{ticket.description || 'Xuất kho phục vụ sản xuất'}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* MAIN TABLE */}
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid black', marginBottom: '32px', fontSize: '14px' }}>
                <thead>
                    <tr style={{ backgroundColor: '#e5e7eb', textAlign: 'center', fontWeight: 'bold', textTransform: 'uppercase' }}>
                        <th style={{ border: '1px solid black', padding: '8px', width: '40px' }}>STT</th>
                        <th style={{ border: '1px solid black', padding: '8px', width: '120px' }}>Mã vật tư</th>
                        <th style={{ border: '1px solid black', padding: '8px' }}>Tên vật tư / Quy cách</th>
                        <th style={{ border: '1px solid black', padding: '8px', width: '80px' }}>Mã loại</th>
                        <th style={{ border: '1px solid black', padding: '8px', width: '60px' }}>ĐVT</th>
                        <th style={{ border: '1px solid black', padding: '8px', width: '80px' }}>SL Yêu cầu</th>
                        <th style={{ border: '1px solid black', padding: '8px', width: '80px' }}>SL Thực tế</th>
                        <th style={{ border: '1px solid black', padding: '8px', width: '100px' }}>Vị trí</th>
                    </tr>
                </thead>
                <tbody>
                    {ticket.details?.map((item: any, index: number) => (
                        <tr key={index}>
                            <td style={{ border: '1px solid black', padding: '8px', textAlign: 'center' }}>{index + 1}</td>
                            <td style={{ border: '1px solid black', padding: '8px', fontFamily: 'monospace', fontWeight: 'bold', textAlign: 'center' }}>{item.item?.itemCode}</td>
                            <td style={{ border: '1px solid black', padding: '8px' }}>{item.item?.itemName}</td>
                            <td style={{ border: '1px solid black', padding: '8px', textAlign: 'center' }}>{item.usageCategory?.code || '-'}</td>
                            <td style={{ border: '1px solid black', padding: '8px', textAlign: 'center' }}>{item.item?.baseUnit || item.item?.unit}</td>
                            <td style={{ border: '1px solid black', padding: '8px', textAlign: 'center', fontWeight: 'bold', fontSize: '16px' }}>{item.quantity}</td>
                            <td style={{ border: '1px solid black', padding: '8px', textAlign: 'center' }}></td>
                            <td style={{ border: '1px solid black', padding: '8px', textAlign: 'center', fontSize: '12px' }}>
                                {ticket.type === 'EXPORT' ? item.fromLocation?.locationCode : item.toLocation?.locationCode}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* FOOTER */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid black' }}>
                <SignatureBox title="NGƯỜI ĐỀ NGHỊ" subTitle="(Ký, họ tên)" isCreator={true} />
                <SignatureBox title="TRƯỞNG BỘ PHẬN" subTitle="(Ký duyệt)" approvalData={deptManager} />
                <SignatureBox title="THỦ KHO" subTitle="(Ký xuất hàng)" approvalData={warehouseKeeper} />
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                    <p style={{ fontWeight: 'bold', fontSize: '14px', textTransform: 'uppercase', marginBottom: '4px' }}>NGƯỜI NHẬN</p>
                    <p style={{ fontStyle: 'italic', fontSize: '12px', color: '#6b7280', marginBottom: '32px' }}>(Ký, họ tên)</p>
                    <div style={{ height: '128px', width: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: '16px' }}>
                        <span style={{ color: '#9ca3af', fontSize: '12px' }}>.........................................</span>
                    </div>
                </div>
            </div>
        </div>
    );
});

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

  // Print Handler
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: selectedTicket ? `Phieu_${selectedTicket.code}` : 'Phieu_Kho',
  });

  // Download PDF Handler (FIXED)
  const handleDownloadPDF = () => {
      const element = printRef.current;
      if(!element) return;
      
      const opt = {
          margin: 5,
          filename: `Phieu_${selectedTicket?.code}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { 
              scale: 2, 
              useCORS: true, // Cho phép load ảnh từ domain khác (nếu có) hoặc local server
              logging: true
          }, 
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };
      
      html2pdf().set(opt).from(element).save();
  };

  const fetchPending = async () => {
    setLoading(true);
    try {
      const res = await axiosClient.get('/stock-transactions/pending-my-turn');
      setPendingData(res.data.data);
    } catch (e) { } finally { setLoading(false); }
  };

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await axiosClient.get('/stock-transactions/history', { params: { limit: 20 } });
      setHistoryData(res.data.data);
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
      await axiosClient.patch('/stock-transactions/approve-action', {
        transactionId: selectedTicket.id, action, comment
      });
      message.success(selectedTicket.isRequesterStep ? 'Đã xác nhận hoàn tất' : 'Đã duyệt thành công');
      setIsModalOpen(false);
      setComment('');
      fetchPending(); 
    } catch (e: any) { 
      message.error(e.response?.data?.message || 'Thao tác thất bại'); 
    } finally {
      setSubmitting(false);
    }
  };

  const renderCreatorInfo = (record: any) => (
    <div>
        <Text strong>{record.creator?.fullName}</Text>
        <br/>
        <Tag color="cyan" style={{ fontSize: '10px', marginTop: '4px' }}>
            {record.creator?.department?.name || 'N/A'}
        </Tag>
    </div>
  );

  const columnsConfig = (isHistory = false) => [
    { title: 'Mã phiếu', dataIndex: 'code', render: (v: string, r: any) => (<Space direction="vertical" size={0}><Text strong className="text-blue-600">{v}</Text>{r.isEmergency && <Tag color="error" style={{ fontSize: '10px', lineHeight: '14px' }}>KHẨN</Tag>}</Space>) },
    { title: 'Loại', dataIndex: 'type', render: (v: string) => { const config: any = { IMPORT: { color: 'blue', text: 'Nhập kho' }, EXPORT: { color: 'orange', text: 'Xuất kho' }, TRANSFER: { color: 'purple', text: 'Chuyển kho' } }; return <Tag color={config[v]?.color}>{config[v]?.text}</Tag>; } },
    { title: 'Người tạo', render: (_: any, r: any) => renderCreatorInfo(r) },
    ...(isHistory ? [{ title: 'Người duyệt', key: 'approvers', width: 250, render: (_: any, r: any) => (<div className="flex flex-col gap-1">{r.approvals?.length > 0 ? r.approvals.map((app: any, idx: number) => (<div key={idx} className="flex items-center gap-2 text-xs"><UserSwitchOutlined className="text-gray-400" /><span className="font-semibold text-gray-600">{app.step?.name}:</span><span className="text-gray-800">{app.approver?.fullName}</span></div>)) : <Text type="secondary" italic style={{fontSize: '11px'}}>Chưa có dữ liệu</Text>}</div>) }] : [{ title: 'Trạng thái', key: 'progress', render: (_: any, r: any) => { if (r.status === 'WAITING_CONFIRM') return <Tag icon={<SolutionOutlined />} color="processing">Chờ xác nhận</Tag>; const approved = r.approvals.filter((a: any) => a.status === 'APPROVED').length; const total = r.approvals.length; return (<Space direction="vertical" size={0} style={{ width: 140 }}><div className="flex justify-between mb-1"><Text style={{ fontSize: '12px' }} type={r.isRequesterStep ? "danger" : "secondary"}>{r.currentStepName}</Text><Text style={{ fontSize: '12px' }}>{approved}/{total}</Text></div><Progress percent={Math.round((approved / total) * 100)} size="small" showInfo={false} status="active" /></Space>); } }]),
    { title: 'Ngày tạo', dataIndex: 'createdAt', render: (v: string) => <Text type="secondary">{dayjs(v).format('DD/MM HH:mm')}</Text> },
    { title: 'Hành động', align: 'right' as const, render: (_: any, r: any) => (<Button type={isHistory ? "text" : "primary"} size="small" className={!isHistory && r.isRequesterStep ? "bg-green-600 hover:bg-green-500" : ""} icon={!isHistory && r.isRequesterStep ? <CheckCircleOutlined /> : <EyeOutlined />} onClick={() => { setSelectedTicket(r); setIsModalOpen(true); }}>{isHistory ? "" : (r.isRequesterStep ? "Nhận hàng" : "Duyệt")}</Button>) }
  ];

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      <div style={{ display: 'none' }}><TicketPrintTemplate ref={printRef} ticket={selectedTicket} /></div>
      <Card className="shadow-sm border-none rounded-xl" tabList={[{ key: 'pending', label: (<span className="px-2"><FileDoneOutlined /> Cần xử lý <AntdBadge count={pendingData.length} offset={[10, -5]} size="small" /></span>) }, { key: 'history', label: (<span className="px-2"><HistoryOutlined /> Lịch sử</span>) }]} activeTabKey={activeTab} onTabChange={key => setActiveTab(key)} extra={<Button icon={<ClockCircleOutlined />} onClick={() => activeTab === 'pending' ? fetchPending() : fetchHistory()}>Tải lại</Button>}>
        <Table dataSource={activeTab === 'pending' ? pendingData : historyData} columns={columnsConfig(activeTab === 'history')} rowKey="id" loading={loading} pagination={{ pageSize: 10 }} locale={{ emptyText: 'Không có dữ liệu.' }} />
      </Card>
      
      <Modal title={<div className="flex justify-between items-center pr-10"><span>Phiếu: {selectedTicket?.code}</span><Space><Button icon={<DownloadOutlined />} onClick={handleDownloadPDF}>Tải PDF</Button><Button icon={<PrinterOutlined />} onClick={() => handlePrint()}>In Phiếu</Button><Tag color={selectedTicket?.status === 'APPROVED' ? "green" : "processing"}>{selectedTicket?.status}</Tag></Space></div>} open={isModalOpen} onCancel={() => setIsModalOpen(false)} width={900} confirmLoading={submitting} footer={[<Button key="close" onClick={() => setIsModalOpen(false)}>Đóng</Button>, (activeTab === 'pending' && ['PENDING', 'WAITING_CONFIRM'].includes(selectedTicket?.status)) && (<><Button key="reject" danger onClick={() => handleAction('REJECT')} loading={submitting}>Từ chối</Button><Button key="approve" type="primary" onClick={() => handleAction('APPROVE')} loading={submitting} className={selectedTicket?.isRequesterStep ? "bg-green-600" : "bg-indigo-600"}>{selectedTicket?.isRequesterStep ? "Đã nhận đủ hàng" : "Phê duyệt"}</Button></>)]}>
        {selectedTicket && <div className="py-2">
            <div className="p-4 mb-4 rounded-lg bg-slate-50 border border-gray-200">
                <Descriptions column={2} size="small" bordered>
                  <Descriptions.Item label="Người lập">{selectedTicket.creator?.fullName}</Descriptions.Item>
                  <Descriptions.Item label="Bộ phận">
                      <Space>
                          <Tag>{selectedTicket.creator?.department?.name || 'N/A'}</Tag>
                          <span className="text-gray-500 text-xs">({selectedTicket.creator?.department?.id || '---'})</span>
                      </Space>
                  </Descriptions.Item>
                  <Descriptions.Item label="Ghi chú" span={2}>{selectedTicket.description || 'Không có'}</Descriptions.Item>
                </Descriptions>
            </div>
            <Divider orientation={"left" as any}><Text strong>Chi tiết vật tư</Text></Divider>
            <Table dataSource={selectedTicket.details} pagination={false} size="small" bordered rowKey="id" columns={[{ title: 'Vật tư', render: (_: any, r: any) => <div><Text strong>{r.item?.itemName}</Text><br/><Text type="secondary" style={{ fontSize: '11px' }}>{r.item?.itemCode}</Text></div> }, { title: 'Loại hàng', render: (_: any, r: any) => r.usageCategory ? <Tag color="cyan"><b>{r.usageCategory.code}</b>: {r.usageCategory.name}</Tag> : <Text type="secondary" italic>--</Text> }, { title: 'SL', dataIndex: 'quantity', align: 'center', render: (v: any, r: any) => <b>{v} {r.item?.baseUnit}</b> }, { title: 'Vị trí', render: (_: any, row: any) => <Space><Tag color="orange">{row.fromLocation?.locationCode || 'Kho'}</Tag><ArrowRightOutlined /><Tag color="blue">{row.toLocation?.locationCode || 'Ngoài'}</Tag></Space> }]} />
            {activeTab === 'pending' && <Input.TextArea className="mt-4" rows={2} value={comment} onChange={e => setComment(e.target.value)} placeholder="Nhập ghi chú phê duyệt..." />}
        </div>}
      </Modal>
    </div>
  );
};

export default PendingApprovals;