import { useEffect, useState } from 'react';
import { 
    Drawer, Table, Button, Tag, Space, Form, Input, 
    Select, DatePicker, InputNumber, Radio, message, Popconfirm, Empty, Divider 
} from 'antd';
import { 
    ToolOutlined, PlusOutlined, CheckCircleOutlined, 
    UserOutlined, ShopOutlined, ArrowLeftOutlined, HistoryOutlined 
} from '@ant-design/icons';
import dayjs from 'dayjs';
import axiosClient from '../../api/axiosClient';
import type { IAsset } from '../../types/itam.types';

interface Props {
    open: boolean;
    asset: IAsset | null;
    onClose: () => void;
}

const AssetMaintenanceDrawer = ({ open, asset, onClose }: Props) => {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(false);
    
    // State điều khiển chế độ xem: List (false) hay Form (true)
    const [isAdding, setIsAdding] = useState(false);
    
    const [form] = Form.useForm();
    // Theo dõi loại hình thực hiện để đổi label (Nội bộ / Thuê ngoài)
    const providerType = Form.useWatch('providerType', form);

    // 1. Hàm lấy dữ liệu lịch sử
    const fetchHistory = async () => {
        if (!asset) return;
        setLoading(true);
        try {
            const res = await axiosClient.get(`/maintenance/${asset.id}`);
            setHistory(res.data.data);
        } catch (error) {
            message.error("Lỗi tải lịch sử sửa chữa");
        } finally {
            setLoading(false);
        }
    };

    // Reset khi mở Drawer
    useEffect(() => {
        if (open && asset) {
            fetchHistory();
            setIsAdding(false);
        }
    }, [open, asset]);

    // 2. Xử lý tạo phiếu mới
    const handleCreate = async (values: any) => {
        try {
            await axiosClient.post('/maintenance', {
                ...values,
                assetId: asset?.id,
                // Chuyển date object sang ISO string
                startDate: values.startDate ? values.startDate.toISOString() : new Date().toISOString()
            });
            message.success("Đã tạo phiếu sửa chữa & Cập nhật trạng thái máy");
            
            // Reset form và quay về list
            setIsAdding(false);
            form.resetFields();
            fetchHistory(); 
        } catch (error) {
            message.error("Không thể tạo phiếu sửa chữa");
        }
    };

    // 3. Xử lý hoàn tất sửa chữa
    const handleComplete = async (id: string) => {
        try {
            // Ở đây tạm thời set cost = 0 hoặc giữ nguyên. 
            // Nếu muốn kỹ hơn, bạn có thể hiện Modal nhỏ bắt nhập chi phí thực tế.
            await axiosClient.patch(`/maintenance/${id}/complete`, { 
                note: "Hoàn tất bởi Admin" 
            });
            message.success("Đã hoàn thành sửa chữa. Máy đã sẵn sàng sử dụng!");
            fetchHistory();
        } catch (error) {
            message.error("Lỗi cập nhật trạng thái");
        }
    };

    // Cấu hình cột cho bảng lịch sử
    const columns = [
        {
            title: 'Ngày',
            dataIndex: 'startDate',
            width: 100,
            render: (d: string) => <span className="text-gray-500">{dayjs(d).format('DD/MM/YYYY')}</span>
        },
        {
            title: 'Nội dung / Lỗi',
            dataIndex: 'description',
            render: (text: string, record: any) => (
                <div>
                    <div className="font-medium text-slate-700 mb-1">{text}</div>
                    <Tag color={record.type === 'REPAIR' ? 'red' : 'blue'}>
                        {record.type === 'REPAIR' ? 'Sửa chữa' : record.type === 'UPGRADE' ? 'Nâng cấp' : 'Bảo trì'}
                    </Tag>
                </div>
            )
        },
        {
            title: 'Thực hiện',
            key: 'provider',
            width: 150,
            render: (_, record: any) => (
                <Space direction="vertical" size={0}>
                    <div className="flex items-center gap-1 text-xs font-semibold text-gray-600">
                        {record.providerType === 'INTERNAL' 
                            ? <><UserOutlined/> Nội bộ (IT)</> 
                            : <><ShopOutlined/> Bên ngoài</>
                        }
                    </div>
                    <div className="text-xs text-gray-500">{record.providerName}</div>
                </Space>
            )
        },
        {
            title: 'Chi phí',
            dataIndex: 'cost',
            width: 100,
            align: 'right' as const,
            render: (c: number) => c ? <span className="font-mono">{new Intl.NumberFormat('vi-VN').format(c)} ₫</span> : '-'
        },
        {
            title: 'Trạng thái',
            dataIndex: 'status',
            width: 100,
            align: 'center' as const,
            render: (s: string) => s === 'DONE' 
                ? <Tag color="success">Hoàn thành</Tag> 
                : <Tag color="processing" icon={<HistoryOutlined spin />}>Đang sửa</Tag>
        },
        {
            title: '',
            key: 'action',
            width: 80,
            render: (_, record: any) => record.status === 'IN_PROGRESS' && (
                <Popconfirm title="Xác nhận đã sửa xong?" description="Máy sẽ chuyển về trạng thái Sẵn sàng." onConfirm={() => handleComplete(record.id)}>
                    <Button size="small" type="primary" icon={<CheckCircleOutlined />}>Xong</Button>
                </Popconfirm>
            )
        }
    ];

    return (
        <Drawer
            title={
                <div className="flex items-center gap-2 text-slate-700">
                    <ToolOutlined className="text-orange-600"/> 
                    <span>Bảo trì & Sửa chữa: <span className="text-blue-600 font-bold">{asset?.name}</span></span>
                </div>
            }
            width={750}
            open={open}
            onClose={onClose}
            styles={{ body: { paddingBottom: 80 } }}
        >
            {/* VIEW 1: FORM TẠO MỚI */}
            {isAdding ? (
                <div className="animate-fade-in">
                    <div className="flex items-center mb-4">
                        <Button icon={<ArrowLeftOutlined />} onClick={() => setIsAdding(false)} className="mr-3"/>
                        <h3 className="m-0 font-bold text-lg">Tạo phiếu yêu cầu mới</h3>
                    </div>

                    <Form 
                        form={form} 
                        layout="vertical" 
                        onFinish={handleCreate} 
                        initialValues={{ 
                            type: 'REPAIR', 
                            providerType: 'INTERNAL', 
                            startDate: dayjs() 
                        }}
                    >
                        <div className="bg-orange-50 p-5 rounded-lg border border-orange-100 mb-5">
                            <div className="grid grid-cols-2 gap-4">
                                <Form.Item name="type" label="Loại yêu cầu" rules={[{ required: true }]}>
                                    <Select>
                                        <Select.Option value="REPAIR">🔴 Sửa chữa (Hỏng hóc)</Select.Option>
                                        <Select.Option value="MAINTENANCE">🟠 Bảo trì định kỳ</Select.Option>
                                        <Select.Option value="UPGRADE">🔵 Nâng cấp phần cứng</Select.Option>
                                    </Select>
                                </Form.Item>

                                <Form.Item name="startDate" label="Ngày bắt đầu" rules={[{ required: true }]}>
                                    <DatePicker className="w-full" format="DD/MM/YYYY" showTime />
                                </Form.Item>
                            </div>

                            <Form.Item name="description" label="Mô tả sự cố / Yêu cầu chi tiết" rules={[{ required: true, message: 'Vui lòng nhập mô tả lỗi' }]}>
                                <Input.TextArea rows={3} placeholder="Ví dụ: Máy không lên nguồn, màn hình xanh, cần thay ổ cứng..." />
                            </Form.Item>

                            <Divider dashed className="border-orange-200" />

                            <div className="grid grid-cols-2 gap-4">
                                <Form.Item name="providerType" label="Hình thức thực hiện">
                                    <Radio.Group buttonStyle="solid">
                                        <Radio.Button value="INTERNAL">Nội bộ (IT Team)</Radio.Button>
                                        <Radio.Button value="EXTERNAL">Thuê ngoài</Radio.Button>
                                    </Radio.Group>
                                </Form.Item>

                                <Form.Item 
                                    name="providerName" 
                                    label={providerType === 'INTERNAL' ? "Nhân viên thực hiện" : "Tên đơn vị / Cửa hàng"}
                                    rules={[{ required: true, message: 'Vui lòng nhập thông tin này' }]}
                                >
                                    <Input placeholder={providerType === 'INTERNAL' ? "VD: Nguyễn Văn A" : "VD: Phong Vũ, FPT..."} />
                                </Form.Item>
                            </div>

                            <Form.Item name="cost" label="Chi phí dự kiến (VNĐ)">
                                <InputNumber 
                                    className="w-full" 
                                    formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                    parser={value => value!.replace(/\$\s?|(,*)/g, '')}
                                    min={0}
                                    step={10000}
                                />
                            </Form.Item>

                            <div className="flex justify-end gap-3 mt-4">
                                <Button onClick={() => setIsAdding(false)}>Hủy bỏ</Button>
                                <Button type="primary" htmlType="submit" size="large" icon={<PlusOutlined />}>
                                    Tạo phiếu & Cập nhật trạng thái
                                </Button>
                            </div>
                        </div>
                    </Form>
                </div>
            ) : (
                // VIEW 2: DANH SÁCH LỊCH SỬ
                <div className="animate-fade-in">
                    <div className="flex justify-between items-center mb-4">
                        <div className="text-gray-500">
                            Tổng số lần sửa chữa: <b>{history.length}</b>
                        </div>
                        <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsAdding(true)}>
                            Tạo phiếu mới
                        </Button>
                    </div>

                    <Table 
                        columns={columns} 
                        dataSource={history} 
                        rowKey="id" 
                        loading={loading}
                        pagination={false}
                        locale={{ emptyText: <Empty description="Thiết bị này chưa từng sửa chữa" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
                        className="border rounded-lg overflow-hidden"
                    />
                </div>
            )}
        </Drawer>
    );
};

export default AssetMaintenanceDrawer;