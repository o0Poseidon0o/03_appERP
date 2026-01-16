import React, { useState } from 'react';
import { Card, DatePicker, Button, Typography, Table, Tag, App, Row, Col, Statistic } from 'antd'; // [SỬA 1] Bỏ import message, thêm App
import { FileExcelOutlined, SearchOutlined, BarChartOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';
import axiosClient from '../../api/axiosClient';

const { Title, Text } = Typography;

const MonthlyReport = () => {
  // [SỬA 1] Sử dụng hook của Antd App để hiện thông báo đúng chuẩn
  const { message } = App.useApp(); 
  
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<any[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<dayjs.Dayjs>(dayjs());

  // 1. Gọi API lấy dữ liệu
  const fetchReport = async () => {
    setLoading(true);
    try {
      const response = await axiosClient.get('/warehouses/reports/monthly-stock', {
        params: {
          month: selectedMonth.month() + 1,
          year: selectedMonth.year()
        }
      });
      setReportData(response.data.data || []);
      message.success(`Đã tải dữ liệu chốt tháng ${selectedMonth.format('MM/YYYY')}`);
    } catch (error) {
      message.error("Lỗi tải báo cáo. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  // 2. Xuất Excel chuẩn Format File Mẫu
  const handleExportExcel = () => {
    if (reportData.length === 0) {
        message.warning("Chưa có dữ liệu để xuất!");
        return;
    }

    // Map dữ liệu theo đúng tên cột trong file mẫu CSV
    const excelData = reportData.map((item, index) => ({
      "Stt": index + 1,
      "Mã vật tư": item.itemCode,
      "Tên vật tư": item.itemName,
      "Đvt": item.unit,
      [`TỒN CUỐI THÁNG ${selectedMonth.format('MM/YYYY')}`]: item.quantity, // Đảm bảo backend trả về đúng key (finalQuantity hoặc quantity)
      "Nhà máy": item.factoryName,
      "Kho": item.warehouseName,
      "Kệ": item.rack, 
      "Hộc": item.bin
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    
    // Chỉnh độ rộng cột cho đẹp
    worksheet['!cols'] = [
      { wch: 6 },  // Stt
      { wch: 15 }, // Mã
      { wch: 40 }, // Tên
      { wch: 10 }, // Đvt
      { wch: 15 }, // Số lượng
      { wch: 10 }, // Nhà máy
      { wch: 20 }, // Kho
      { wch: 10 }, // Kệ
      { wch: 10 }, // Hộc
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Ton_Kho_Thang");
    XLSX.writeFile(workbook, `BaoCao_TonKho_${selectedMonth.format('MM_YYYY')}.xlsx`);
  };

  // Cột hiển thị trên Web
  const columns = [
    { title: 'STT', render: (_:any, __:any, idx:number) => idx + 1, width: 60, align: 'center' as const },
    { title: 'Mã VT', dataIndex: 'itemCode', render: (t:string) => <b className="text-blue-600">{t}</b> },
    { title: 'Tên vật tư', dataIndex: 'itemName' },
    { title: 'ĐVT', dataIndex: 'unit', align: 'center' as const },
    { 
        title: `Tồn Cuối T${selectedMonth.format('MM')}`, 
        // Lưu ý: Backend controller nãy tôi code trả về 'quantity' (hoặc 'finalQuantity'). 
        // Hãy đảm bảo dataIndex khớp với backend trả về. Ở đây tôi dùng finalQuantity theo controller.
        dataIndex: 'finalQuantity', 
        align: 'right' as const,
        render: (val: number | undefined | null) => {
            // [SỬA 2] Fix lỗi crash 'toLocaleString' bằng cách kiểm tra giá trị null/undefined
            const safeVal = val ?? 0; 
            return <Tag color="green" className="text-base font-bold mr-0">{safeVal.toLocaleString()}</Tag>;
        }
    },
    { 
        title: 'Vị trí lưu kho', 
        children: [
            { title: 'Nhà máy', dataIndex: 'factoryName', width: 100 },
            { title: 'Kho', dataIndex: 'warehouseName', width: 150 },
            { title: 'Kệ - Hộc', render: (_:any, r:any) => <Tag>{r.rack || '_'} - {r.bin || '_'}</Tag> }
        ]
    }
  ];

  // Tính tổng an toàn
  const totalStock = reportData.reduce((acc, cur) => acc + (cur.finalQuantity || 0), 0);

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <Card bordered={false} className="shadow-md rounded-lg">
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
            <div>
                <Title level={4} className="m-0 text-indigo-700"><BarChartOutlined /> Báo Cáo Tồn Kho Theo Tháng</Title>
                <Text type="secondary">Dữ liệu được chốt vào 23:59 ngày cuối cùng của tháng.</Text>
            </div>
            
            <div className="flex gap-2 bg-gray-100 p-2 rounded-lg items-center">
                <span className="font-semibold text-gray-600 pl-2">Chọn tháng:</span>
                <DatePicker 
                    picker="month" 
                    value={selectedMonth} 
                    onChange={(val) => val && setSelectedMonth(val)} 
                    format="MM/YYYY"
                    allowClear={false}
                    className="w-40"
                />
                <Button type="primary" icon={<SearchOutlined />} onClick={fetchReport} loading={loading}>
                    Xem báo cáo
                </Button>
                <Button 
                    className="bg-green-600 text-white border-none hover:bg-green-500 hover:text-white" 
                    icon={<FileExcelOutlined />} 
                    onClick={handleExportExcel}
                    disabled={reportData.length === 0}
                >
                    Xuất Excel
                </Button>
            </div>
        </div>

        {reportData.length > 0 && (
            <Row gutter={16} className="mb-4">
                <Col span={6}>
                    <Statistic title="Tổng số dòng hàng" value={reportData.length} />
                </Col>
                <Col span={6}>
                    {/* [SỬA 3] Fix lỗi valueStyle deprecated */}
                    <Statistic 
                        title="Tổng số lượng tồn" 
                        value={totalStock} 
                        precision={0} 
                        styles={{ content: { color: '#3f8600' } }} 
                    />
                </Col>
            </Row>
        )}

        <Table 
            columns={columns} 
            dataSource={reportData} 
            // Tạo unique key an toàn hơn
            rowKey={(r) => `${r.itemCode}_${r.warehouseName}_${r.rack}_${r.bin}`} 
            loading={loading}
            pagination={{ pageSize: 50 }}
            bordered
            size="small"
            scroll={{ y: 500 }}
        />
      </Card>
    </div>
  );
};

export default MonthlyReport;