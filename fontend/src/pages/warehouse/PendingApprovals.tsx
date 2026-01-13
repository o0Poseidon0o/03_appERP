import React, { useState, useEffect } from 'react';
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
  UserSwitchOutlined, SolutionOutlined
} from '@ant-design/icons';
import axiosClient from '../../api/axiosClient';
import dayjs from 'dayjs';

const { Text } = Typography;

const PendingApprovals: React.FC = () => {
  const { message } = AntdApp.useApp();
  
  // --- STATE ---
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('pending');

  // Data
  const [pendingData, setPendingData] = useState([]);
  const [historyData, setHistoryData] = useState([]);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // --- API CALLS ---
  const fetchPending = async () => {
    setLoading(true);
    try {
      const res = await axiosClient.get('/stock-transactions/pending-my-turn');
      setPendingData(res.data.data);
    } catch (e) { 
      message.error('Lỗi tải danh sách chờ duyệt'); 
    } finally { 
      setLoading(false); 
    }
  };

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await axiosClient.get('/stock-transactions/history', {
        params: { limit: 20 } 
      });
      setHistoryData(res.data.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'pending') fetchPending();
    else fetchHistory();
  }, [activeTab]);

  // --- ACTIONS ---
  const handleAction = async (action: 'APPROVE' | 'REJECT') => {
    if (!selectedTicket) return;
    setSubmitting(true);
    try {
      await axiosClient.patch('/stock-transactions/approve-action', {
        transactionId: selectedTicket.id, 
        action, 
        comment
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

  // --- HELPER RENDERS ---
  const renderCreatorInfo = (record: any) => (
    <div>
        <Text strong>{record.creator?.fullName}</Text>
        <br/>
        <Tag color="cyan" style={{ fontSize: '10px', marginTop: '4px' }}>
            {record.creator?.department?.name || 'Chưa cập nhật BP'}
        </Tag>
    </div>
  );

  // --- COLUMNS CONFIG ---

  // 1. Cột cho bảng Chờ Duyệt
  const pendingColumns = [
    { 
      title: 'Mã phiếu', dataIndex: 'code', 
      render: (v: string, r: any) => (
        <Space direction="vertical" size={0}>
           <Text strong className="text-blue-600">{v}</Text>
           {r.isEmergency && <Tag color="error" style={{ fontSize: '10px', lineHeight: '14px' }}>KHẨN</Tag>}
        </Space>
      ) 
    },
    { 
      title: 'Loại', dataIndex: 'type', 
      render: (v: string) => {
        const config: any = { IMPORT: { color: 'blue', text: 'Nhập kho' }, EXPORT: { color: 'orange', text: 'Xuất kho' }, TRANSFER: { color: 'purple', text: 'Chuyển kho' } };
        return <Tag color={config[v]?.color}>{config[v]?.text}</Tag>;
      } 
    },
    { 
        title: 'Trạng thái / Tiến độ', key: 'progress',
        render: (_: any, r: any) => {
          if (r.status === 'WAITING_CONFIRM') {
             return <Tag icon={<SolutionOutlined />} color="processing">Chờ xác nhận</Tag>;
          }

          const approved = r.approvals.filter((a: any) => a.status === 'APPROVED').length;
          const total = r.approvals.length;
          return (
            <Space direction="vertical" size={0} style={{ width: 140 }}>
               <div className="flex justify-between mb-1">
                  <Text style={{ fontSize: '12px' }} type={r.isRequesterStep ? "danger" : "secondary"}>{r.currentStepName}</Text>
                  <Text style={{ fontSize: '12px' }}>{approved}/{total}</Text>
               </div>
               <Progress percent={Math.round((approved / total) * 100)} size="small" showInfo={false} status="active" />
            </Space>
          );
        }
    },
    { 
        title: 'Người tạo', 
        render: (_: any, r: any) => renderCreatorInfo(r) 
    },
    { title: 'Ngày tạo', dataIndex: 'createdAt', render: (v: string) => <Text type="secondary">{dayjs(v).format('DD/MM HH:mm')}</Text> },
    {
      title: 'Hành động', align: 'right' as const,
      render: (_: any, r: any) => (
        <Button 
          type="primary" 
          size="small" 
          className={r.isRequesterStep ? "bg-green-600 hover:bg-green-500" : ""}
          icon={r.isRequesterStep ? <CheckCircleOutlined /> : <EyeOutlined />} 
          onClick={() => { setSelectedTicket(r); setIsModalOpen(true); }}
        >
          {r.isRequesterStep ? "Nhận hàng" : "Duyệt"}
        </Button>
      )
    }
  ];

  // 2. Cột cho bảng Lịch Sử
  const historyColumns = [
    { title: 'Mã phiếu', dataIndex: 'code', render: (v: string) => <Text strong>{v}</Text> },
    { 
        title: 'Loại', dataIndex: 'type', 
        render: (v: string) => {
          const config: any = { IMPORT: 'Nhập', EXPORT: 'Xuất', TRANSFER: 'Chuyển' };
          return <Tag>{config[v]}</Tag>;
        } 
    },
    { 
        title: 'Người tạo', 
        render: (_: any, r: any) => renderCreatorInfo(r)
    },
    {
        title: 'Người duyệt (Trưởng BP/Kho)',
        key: 'approvers',
        width: 250,
        render: (_: any, r: any) => (
            <div className="flex flex-col gap-1">
                {r.approvals && r.approvals.length > 0 ? (
                    r.approvals.map((app: any, idx: number) => (
                        <div key={idx} className="flex items-center gap-2 text-xs">
                            <UserSwitchOutlined className="text-gray-400" />
                            <span className="font-semibold text-gray-600">{app.step?.name}:</span>
                            <span className="text-gray-800">{app.approver?.fullName}</span>
                        </div>
                    ))
                ) : (
                    <Text type="secondary" italic style={{fontSize: '11px'}}>Chưa có dữ liệu duyệt</Text>
                )}
            </div>
        )
    },
    { 
        title: 'Kết quả', dataIndex: 'status', align: 'center' as const,
        render: (v: string) => {
            if (v === 'APPROVED') return <Tag color="success">Hoàn tất</Tag>;
            if (v === 'REJECTED') return <Tag color="error">Đã hủy</Tag>;
            if (v === 'WAITING_CONFIRM') return <Tag color="processing">Chờ xác nhận</Tag>;
            return <Tag>Đang xử lý</Tag>;
        }
    },
    {
        title: '', align: 'right' as const,
        render: (_: any, r: any) => <Button type="text" icon={<EyeOutlined />} onClick={() => { setSelectedTicket(r); setIsModalOpen(true); }} />
    }
  ];

  // --- RENDER ---
  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      <Card 
        className="shadow-sm border-none rounded-xl"
        tabList={[
            { 
                key: 'pending', 
                label: (
                    <span className="px-2">
                        <FileDoneOutlined /> Cần xử lý <AntdBadge count={pendingData.length} offset={[10, -5]} size="small" />
                    </span>
                )
            },
            { 
                key: 'history', 
                label: (
                    <span className="px-2">
                        <HistoryOutlined /> Lịch sử & Người duyệt
                    </span>
                ) 
            }
        ]}
        activeTabKey={activeTab}
        onTabChange={key => setActiveTab(key)}
        extra={<Button icon={<ClockCircleOutlined />} onClick={() => activeTab === 'pending' ? fetchPending() : fetchHistory()}>Tải lại</Button>}
      >
        
        {/* TAB 1: PENDING */}
        {activeTab === 'pending' && (
            <>
                <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-lg flex items-start gap-2">
                    <InfoCircleOutlined className="text-blue-500 mt-1" />
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                    Danh sách các phiếu cần bạn phê duyệt theo đúng thứ tự, hoặc xác nhận đã nhận hàng.
                    </Text>
                </div>
                <Table 
                    dataSource={pendingData} 
                    columns={pendingColumns} 
                    rowKey="id" 
                    loading={loading}
                    pagination={{ pageSize: 5 }}
                    locale={{ emptyText: 'Tuyệt vời! Bạn không có phiếu nào cần xử lý.' }}
                />
            </>
        )}

        {/* TAB 2: HISTORY */}
        {activeTab === 'history' && (
            <Table 
                dataSource={historyData} 
                columns={historyColumns} 
                rowKey="id" 
                loading={loading}
                pagination={{ pageSize: 10 }}
                locale={{ emptyText: 'Chưa có lịch sử giao dịch.' }}
            />
        )}

      </Card>

      {/* MODAL CHI TIẾT */}
      <Modal
        title={
          <div className="flex justify-between items-center pr-10">
            <span>Phiếu: {selectedTicket?.code}</span>
            <Tag color={selectedTicket?.status === 'APPROVED' ? "green" : (selectedTicket?.status === 'WAITING_CONFIRM' ? "processing" : "default")}>
              {selectedTicket?.status === 'APPROVED' ? "ĐÃ HOÀN TẤT" : (selectedTicket?.status === 'WAITING_CONFIRM' ? "CHỜ XÁC NHẬN" : "ĐANG XỬ LÝ")}
            </Tag>
          </div>
        }
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        width={850}
        confirmLoading={submitting}
        footer={[
          <Button key="close" onClick={() => setIsModalOpen(false)}>Đóng</Button>,
          
          (activeTab === 'pending' && ['PENDING', 'WAITING_CONFIRM'].includes(selectedTicket?.status)) && (
              <>
                 {!selectedTicket?.isRequesterStep && (
                    <Button key="reject" danger onClick={() => handleAction('REJECT')} loading={submitting}>
                        Từ chối
                    </Button>
                 )}
                 <Button 
                    key="approve" type="primary" onClick={() => handleAction('APPROVE')} loading={submitting}
                    className={selectedTicket?.isRequesterStep ? "bg-green-600" : "bg-indigo-600"}
                 >
                    {selectedTicket?.isRequesterStep ? "Đã nhận đủ hàng (Hoàn tất)" : "Phê duyệt"}
                 </Button>
              </>
          )
        ]}
      >
        {selectedTicket && (
          <div className="py-2">
            <div className={`p-4 mb-4 rounded-lg ${selectedTicket.isRequesterStep ? 'bg-green-50 border border-green-100' : 'bg-slate-50'}`}>
                <Descriptions column={2} size="small" bordered>
                  <Descriptions.Item label="Người lập">{selectedTicket.creator?.fullName}</Descriptions.Item>
                  <Descriptions.Item label="Bộ phận">
                      <Tag>{selectedTicket.creator?.department?.name || 'N/A'}</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="Ghi chú" span={2}>{selectedTicket.description || 'Không có'}</Descriptions.Item>
                </Descriptions>
                {selectedTicket.isRequesterStep && (
                    <div className="mt-2 text-green-700 text-xs italic">
                        * Phiếu đã được duyệt hết. Vui lòng kiểm tra thực tế và bấm "Đã nhận đủ hàng" để đóng phiếu.
                    </div>
                )}
            </div>

            {/* FIX: Ép kiểu as any để tránh lỗi TS */}
            <Divider orientation={"left" as any}><Text strong>Chi tiết vật tư</Text></Divider>
            
            <Table 
              dataSource={selectedTicket.details} 
              pagination={false} size="small" bordered rowKey="id"
              columns={[
                // FIX: Dùng (_: any, r: any) để r được hiểu là record
                { title: 'Vật tư', render: (_: any, r: any) => <div><Text strong>{r.item?.itemName}</Text><br/><Text type="secondary" style={{ fontSize: '11px' }}>{r.item?.itemCode}</Text></div>},
                { title: 'Số lượng', dataIndex: 'quantity', align: 'center', render: (v: any, r: any) => <b>{v} {r.item?.unit}</b> },
                { 
                    title: 'Lộ trình kho', 
                    render: (_: any, row: any) => {
                        const fromLoc = row.fromLocation?.locationCode; 
                        const toLoc = row.toLocation?.locationCode;
                        if (selectedTicket.type === 'IMPORT') return <Space><Tag>NCC</Tag><ArrowRightOutlined /><Tag color="blue">{toLoc}</Tag></Space>
                        if (selectedTicket.type === 'EXPORT') return <Space><Tag color="orange">{fromLoc}</Tag><ArrowRightOutlined /><span>Ra ngoài</span></Space>
                        return <Space><Tag color="orange">{fromLoc}</Tag><ArrowRightOutlined /><Tag color="blue">{toLoc}</Tag></Space>
                    } 
                }
              ]} 
            />

            {activeTab === 'pending' && (
                <div className="mt-6">
                    <Text strong>{selectedTicket.isRequesterStep ? "Ghi chú xác nhận (nếu có):" : "Ý kiến phê duyệt:"}</Text>
                    <Input.TextArea className="mt-2" rows={2} value={comment} onChange={e => setComment(e.target.value)} placeholder="Nhập ghi chú..." />
                </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default PendingApprovals;