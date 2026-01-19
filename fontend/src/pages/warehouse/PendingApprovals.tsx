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
  HistoryOutlined, FileDoneOutlined,
  UserSwitchOutlined, SolutionOutlined, PrinterOutlined, DownloadOutlined
} from '@ant-design/icons';
import { useReactToPrint } from 'react-to-print';
import html2pdf from 'html2pdf.js';
import axiosClient from '../../api/axiosClient';
import dayjs from 'dayjs';

const { Text } = Typography;

// --- COMPONENT MẪU IN PHIẾU (FIXED CSS & LOGO) ---
const TicketPrintTemplate = React.forwardRef<HTMLDivElement, { ticket: any }>(({ ticket }, ref) => {
    if (!ticket) return null;

    const deptManager = ticket.approvals?.find((a: any) => 
        a.step?.name?.toLowerCase().includes('trưởng') || a.step?.name?.toLowerCase().includes('leader')
    );
    const warehouseKeeper = ticket.approvals?.find((a: any) => 
        a.step?.name?.toLowerCase().includes('thủ kho') || a.step?.name?.toLowerCase().includes('warehouse')
    );

    const SignatureBox = ({ title, subTitle, approvalData, isCreator = false }) => {
        const isSigned = isCreator || approvalData?.status === 'APPROVED';
        const signerName = isCreator ? ticket.creator?.fullName : approvalData?.approver?.fullName;
        const rawId = isCreator ? ticket.creator?.id : approvalData?.approver?.id;
        const signerId = rawId ? rawId.slice(0, 8) : '---';

        return (
            <div className="flex flex-col items-center w-full">
                <p className="font-bold text-sm uppercase mb-1">{title}</p>
                <p className="italic text-xs mb-2 text-gray-500">{subTitle}</p>
                <div className="h-32 w-full flex flex-col justify-center items-center">
                    {isSigned ? (
                        <>
                            <div className="relative mb-1">
                                {/* Dùng style trực tiếp thay vì class Tailwind để tránh lỗi oklch */}
                                <div style={{ 
                                    width: '48px', height: '48px', 
                                    borderRadius: '50%', border: '2px solid #16a34a', 
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    backgroundColor: 'white'
                                }}>
                                    <span style={{ color: '#16a34a', fontSize: '24px', fontWeight: 'bold' }}>✔</span>
                                </div>
                            </div>
                            <span className="text-sm font-bold text-black uppercase text-center">{signerName || '---'}</span>
                            <span className="text-[10px] text-gray-500 font-mono mt-1">(ID: {signerId})</span>
                        </>
                    ) : (
                        <div className="h-full flex items-end pb-4">
                            <span className="text-gray-300 italic text-xs">...(Chưa ký)...</span>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div ref={ref} className="p-10 bg-white text-black leading-tight" style={{ width: '210mm', minHeight: '297mm', fontFamily: '"Times New Roman", Times, serif' }}>
            {/* HEADER */}
            <div className="flex justify-between items-start mb-6 pb-4 border-b-2 border-black">
                <div className="w-1/4 flex items-center">
                    {/* Thêm crossOrigin để html2canvas tải được ảnh */}
                    <img 
                        src="/logo_towa.png" 
                        alt="Logo" 
                        className="h-16 object-contain" 
                        crossOrigin="anonymous" 
                    />
                </div>
                <div className="w-2/4 text-center pt-2">
                    <h1 className="text-3xl font-bold uppercase tracking-wide mb-2">
                        PHIẾU {ticket.type === 'EXPORT' ? 'XUẤT KHO' : (ticket.type === 'IMPORT' ? 'NHẬP KHO' : 'ĐIỀU CHUYỂN')}
                    </h1>
                    <p className="italic text-base">Ngày lập: {dayjs(ticket.createdAt).format('DD/MM/YYYY')}</p>
                </div>
                <div className="w-1/4 text-right text-sm pt-2">
                    <p className="mb-1"><b>Số CT:</b> <span className="font-mono text-base">{ticket.code}</span></p>
                    <p className="mb-1"><b>Ngày in:</b> {dayjs().format('DD/MM/YYYY')}</p>
                    <p><b>Trang:</b> 1/1</p>
                </div>
            </div>

            {/* INFO */}
            <div className="mb-6 text-base">
                <table className="w-full">
                    <tbody>
                        <tr>
                            <td className="w-24 font-bold py-1">Bộ phận:</td>
                            <td>{ticket.creator?.department?.name || 'Chưa cập nhật'}</td>
                            <td className="w-32 font-bold py-1 text-right pr-2">Mã bộ phận:</td>
                            <td className="w-24 font-mono font-bold">
                                {ticket.creator?.department?.id || '---'}
                            </td>
                        </tr>
                        <tr>
                            <td className="font-bold py-1">Người đề nghị:</td>
                            <td colSpan={3}>{ticket.creator?.fullName}</td>
                        </tr>
                        <tr>
                            <td className="font-bold py-1 align-top">Lý do/Ghi chú:</td>
                            <td colSpan={3} className="italic">{ticket.description || 'Xuất kho phục vụ sản xuất'}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* MAIN TABLE */}
            <table className="w-full border-collapse border border-black mb-8 text-sm">
                <thead>
                    <tr style={{ backgroundColor: '#e5e7eb' }} className="text-center font-bold uppercase">
                        <th className="border border-black p-2 w-10">STT</th>
                        <th className="border border-black p-2 w-32">Mã vật tư</th>
                        <th className="border border-black p-2">Tên vật tư / Quy cách</th>
                        <th className="border border-black p-2 w-20">Mã loại</th>
                        <th className="border border-black p-2 w-16">ĐVT</th>
                        <th className="border border-black p-2 w-20">SL Yêu cầu</th>
                        <th className="border border-black p-2 w-20">SL Thực tế</th>
                        <th className="border border-black p-2 w-24">Vị trí</th>
                    </tr>
                </thead>
                <tbody>
                    {ticket.details?.map((item: any, index: number) => (
                        <tr key={index}>
                            <td className="border border-black p-2 text-center">{index + 1}</td>
                            <td className="border border-black p-2 font-mono font-bold text-center">{item.item?.itemCode}</td>
                            <td className="border border-black p-2">{item.item?.itemName}</td>
                            <td className="border border-black p-2 text-center">{item.usageCategory?.code || '-'}</td>
                            <td className="border border-black p-2 text-center">{item.item?.baseUnit || item.item?.unit}</td>
                            <td className="border border-black p-2 text-center font-bold text-base">{item.quantity}</td>
                            <td className="border border-black p-2 text-center"></td>
                            <td className="border border-black p-2 text-center text-xs">
                                {ticket.type === 'EXPORT' ? item.fromLocation?.locationCode : item.toLocation?.locationCode}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* FOOTER */}
            <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t border-black">
                <SignatureBox title="NGƯỜI ĐỀ NGHỊ" subTitle="(Ký, họ tên)" isCreator={true} />
                <SignatureBox title="TRƯỞNG BỘ PHẬN" subTitle="(Ký duyệt)" approvalData={deptManager} />
                <SignatureBox title="THỦ KHO" subTitle="(Ký xuất hàng)" approvalData={warehouseKeeper} />
                <div className="flex flex-col items-center w-full">
                    <p className="font-bold text-sm uppercase mb-1">NGƯỜI NHẬN</p>
                    <p className="italic text-xs mb-2 text-gray-500">(Ký, họ tên)</p>
                    <div className="h-32 w-full flex items-end justify-center pb-4">
                        <span className="text-gray-400 text-xs">.........................................</span>
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
      {/* Component ẩn dùng để in/tải PDF */}
      <div style={{ position: 'absolute', top: '-10000px', left: '-10000px' }}>
         <TicketPrintTemplate ref={printRef} ticket={selectedTicket} />
      </div>

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