import { useEffect, useState } from 'react';
import { 
    Drawer, Table, Button, Tag, Form, Input, 
    Select, DatePicker, InputNumber, Radio, message, Popconfirm} from 'antd';
import { 
    ToolOutlined, PlusOutlined, CheckCircleOutlined, 
    UserOutlined, ShopOutlined, ArrowLeftOutlined, HistoryOutlined,
    SettingOutlined, SyncOutlined, DollarOutlined
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
    
    const [isAdding, setIsAdding] = useState(false);
    const [form] = Form.useForm();
    const providerType = Form.useWatch('providerType', form);

    const fetchHistory = async () => {
        if (!asset || !asset.id) return;
        setLoading(true);
        try {
            const res = await axiosClient.get(`/maintenance/${asset.id}`);
            setHistory(res.data.data || []);
        } catch (error) {
            message.error("Lỗi tải lịch sử sửa chữa");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (open && asset) {
            fetchHistory();
            setIsAdding(false);
            form.resetFields();
        }
    }, [open, asset]);

    const handleCreate = async (values: any) => {
        if (!asset) return;
        try {
            await axiosClient.post('/maintenance', {
                ...values,
                assetId: asset.id,
                startDate: values.startDate ? values.startDate.toISOString() : new Date().toISOString()
            });
            message.success("Đã tạo phiếu sửa chữa & Cập nhật trạng thái máy");
            setIsAdding(false);
            form.resetFields();
            fetchHistory(); 
        } catch (error) {
            message.error("Không thể tạo phiếu sửa chữa");
        }
    };

    const handleComplete = async (id: string) => {
        try {
            await axiosClient.patch(`/maintenance/${id}/complete`, { 
                note: "Hoàn tất bởi Admin" 
            });
            message.success("Đã hoàn thành sửa chữa. Máy đã sẵn sàng sử dụng!");
            fetchHistory();
        } catch (error) {
            message.error("Lỗi cập nhật trạng thái");
        }
    };

    const renderTypeTag = (type: string) => {
        if (type === 'REPAIR') return <Tag color="volcano" icon={<ToolOutlined />} className="border-none m-0 mt-1">Sửa chữa</Tag>;
        if (type === 'UPGRADE') return <Tag color="geekblue" icon={<SyncOutlined />} className="border-none m-0 mt-1">Nâng cấp</Tag>;
        return <Tag color="green" icon={<SettingOutlined />} className="border-none m-0 mt-1">Bảo trì định kỳ</Tag>;
    };

    const columns = [
        {
            title: 'Ngày',
            dataIndex: 'startDate',
            width: 100,
            render: (d: string) => (
                <div className="flex flex-col">
                    <span className="font-semibold text-slate-700">{d ? dayjs(d).format('DD/MM/YYYY') : ''}</span>
                    <span className="text-[10px] text-gray-400">{d ? dayjs(d).format('HH:mm') : ''}</span>
                </div>
            )
        },
        {
            title: 'Nội dung / Lỗi',
            dataIndex: 'description',
            render: (text: string, record: any) => (
                <div className="flex flex-col items-start">
                    <span className="font-medium text-slate-700 leading-tight">{text}</span>
                    {renderTypeTag(record.type)}
                </div>
            )
        },
        {
            title: 'Thực hiện',
            key: 'provider',
            width: 160,
            render: (_: any, record: any) => (
                <div className="flex flex-col p-2 bg-slate-50 rounded border border-slate-100">
                    <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        {record.providerType === 'INTERNAL' 
                            ? <><UserOutlined/> Nội bộ (IT)</> 
                            : <><ShopOutlined/> Bên ngoài</>
                        }
                    </div>
                    <div className="text-xs font-semibold text-blue-700 truncate" title={record.providerName}>{record.providerName || "N/A"}</div>
                </div>
            )
        },
        {
            title: 'Chi phí',
            dataIndex: 'cost',
            width: 110,
            align: 'right' as const,
            render: (c: number) => c ? (
                <span className="font-mono font-medium text-orange-600 bg-orange-50 px-2 py-0.5 rounded">
                    {new Intl.NumberFormat('vi-VN').format(c)} ₫
                </span>
            ) : <span className="text-gray-300">-</span>
        },
        {
            title: 'Trạng thái',
            dataIndex: 'status',
            width: 110,
            align: 'center' as const,
            render: (s: string) => s === 'DONE' 
                ? <Tag color="success" className="m-0 w-full text-center py-0.5">Hoàn thành</Tag> 
                : <Tag color="processing" icon={<HistoryOutlined spin />} className="m-0 w-full text-center py-0.5">Đang sửa</Tag>
        },
        {
            title: '',
            key: 'action',
            width: 80,
            align: 'center' as const,
            render: (_: any, record: any) => record.status === 'IN_PROGRESS' && (
                <Popconfirm 
                    title="Xác nhận đã sửa xong?" 
                    description="Máy sẽ chuyển về trạng thái Sẵn sàng." 
                    onConfirm={() => handleComplete(record.id)}
                    okText="Xong"
                    cancelText="Hủy"
                >
                    <Button size="small" type="primary" className="bg-green-500 hover:bg-green-600 border-none" icon={<CheckCircleOutlined />}>Xong</Button>
                </Popconfirm>
            )
        }
    ];

    return (
        <Drawer
            title={
                <div className="flex items-center gap-3 text-slate-700">
                    <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 text-lg">
                        <ToolOutlined />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-lg font-bold text-slate-800 leading-tight">Bảo trì & Sửa chữa</span>
                        <span className="text-xs text-gray-500 font-mono mt-0.5">Tài sản: <span className="text-blue-600 font-bold">{asset ? asset.name : 'Đang tải...'}</span></span>
                    </div>
                </div>
            }
            width={850}
            open={open}
            onClose={onClose}
            styles={{ body: { padding: '20px', background: '#f8fafc' }, header: { padding: '16px 20px' } }}
        >
            {isAdding ? (
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm animate-fade-in">
                    <div className="flex items-center mb-6 pb-4 border-b border-gray-100">
                        <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => setIsAdding(false)} className="mr-2 hover:bg-gray-100"/>
                        <h3 className="m-0 font-bold text-lg text-slate-700">Tạo phiếu yêu cầu mới</h3>
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
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
                            <Form.Item name="type" label={<span className="font-medium text-gray-700">Loại yêu cầu</span>} rules={[{ required: true }]}>
                                <Select size="large" className="w-full">
                                    <Select.Option value="REPAIR"><span className="text-volcano font-medium">🔴 Sửa chữa (Hỏng hóc)</span></Select.Option>
                                    <Select.Option value="MAINTENANCE"><span className="text-green-600 font-medium">🟢 Bảo trì định kỳ</span></Select.Option>
                                    <Select.Option value="UPGRADE"><span className="text-blue-600 font-medium">🔵 Nâng cấp phần cứng</span></Select.Option>
                                </Select>
                            </Form.Item>

                            <Form.Item name="startDate" label={<span className="font-medium text-gray-700">Ngày bắt đầu</span>} rules={[{ required: true }]}>
                                <DatePicker className="w-full" size="large" format="DD/MM/YYYY HH:mm" showTime />
                            </Form.Item>
                        </div>

                        <Form.Item name="description" label={<span className="font-medium text-gray-700">Mô tả sự cố / Yêu cầu chi tiết</span>} rules={[{ required: true, message: 'Vui lòng nhập mô tả lỗi' }]}>
                            <Input.TextArea 
                                rows={3} 
                                size="large"
                                placeholder="Ví dụ: Máy không lên nguồn, màn hình xanh, cần thay ổ cứng..." 
                                className="rounded-lg"
                            />
                        </Form.Item>

                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mt-2 mb-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
                                <Form.Item name="providerType" label={<span className="font-medium text-gray-700">Hình thức thực hiện</span>}>
                                    <Radio.Group buttonStyle="solid" className="flex w-full">
                                        <Radio.Button value="INTERNAL" className="flex-1 text-center">Nội bộ (IT Team)</Radio.Button>
                                        <Radio.Button value="EXTERNAL" className="flex-1 text-center">Thuê ngoài</Radio.Button>
                                    </Radio.Group>
                                </Form.Item>

                                <Form.Item 
                                    name="providerName" 
                                    label={<span className="font-medium text-gray-700">{providerType === 'INTERNAL' ? "Nhân viên thực hiện" : "Tên đơn vị / Cửa hàng"}</span>} 
                                    rules={[{ required: true, message: 'Vui lòng nhập thông tin này' }]}
                                >
                                    <Input size="large" placeholder={providerType === 'INTERNAL' ? "VD: Nguyễn Văn A" : "VD: Phong Vũ, FPT..."} className="rounded-md" />
                                </Form.Item>
                            </div>

                            <Form.Item name="cost" label={<span className="font-medium text-gray-700">Chi phí dự kiến (VNĐ)</span>}>
                                <InputNumber<string>
                                    size="large"
                                    className="w-full font-mono text-lg text-orange-600 rounded-md" 
                                    formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                    parser={(value) => value?.replace(/\$\s?|(,*)/g, '') || ''}
                                    min="0"
                                    step="50000"
                                    placeholder="0"
                                    prefix={<DollarOutlined className="text-gray-400" />}
                                />
                            </Form.Item>
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                            <Button size="large" onClick={() => setIsAdding(false)} className="rounded-lg px-6">Hủy bỏ</Button>
                            <Button type="primary" size="large" htmlType="submit" icon={<PlusOutlined />} className="rounded-lg px-6 bg-orange-500 hover:bg-orange-600 border-none shadow-sm">
                                Tạo phiếu & Cập nhật trạng thái máy
                            </Button>
                        </div>
                    </Form>
                </div>
            ) : (
                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm animate-fade-in h-full flex flex-col">
                    <div className="flex justify-between items-center mb-5">
                        <div className="flex items-center gap-2">
                            <div className="text-slate-500 font-medium">Tổng số lần sửa chữa:</div>
                            <Tag color="orange" className="font-bold text-sm m-0 border-none px-3 py-0.5 rounded-full">{history.length}</Tag>
                        </div>
                        <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsAdding(true)} className="bg-orange-500 hover:bg-orange-600 border-none shadow-sm rounded-lg">
                            Tạo phiếu mới
                        </Button>
                    </div>

                    <Table 
                        columns={columns} 
                        dataSource={history} 
                        rowKey="id" 
                        loading={loading}
                        pagination={false}
                        scroll={{ y: 'calc(100vh - 280px)' }}
                        locale={{ 
                            emptyText: (
                                <div className="py-10 flex flex-col items-center">
                                    <div className="text-6xl mb-4 opacity-20">🛡️</div>
                                    <div className="text-gray-500 font-medium text-lg">Thiết bị này chưa từng sửa chữa</div>
                                    <div className="text-gray-400 text-sm mt-1">Bấm "Tạo phiếu mới" nếu máy đang gặp sự cố.</div>
                                </div>
                            ) 
                        }}
                        className="border border-gray-100 rounded-lg overflow-hidden custom-table-header"
                        size="middle"
                        rowClassName={(record: any) => record.status === 'IN_PROGRESS' ? 'bg-orange-50/40' : 'hover:bg-slate-50'}
                    />
                </div>
            )}
        </Drawer>
    );
};

export default AssetMaintenanceDrawer;