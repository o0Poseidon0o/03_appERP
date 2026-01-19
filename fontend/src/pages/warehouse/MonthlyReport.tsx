import { useState } from 'react';
import { Card, DatePicker, Button, Typography, Table, Tag, App, Row, Col, Statistic, Space, Divider } from 'antd';
import { FileExcelOutlined, SearchOutlined, BarChartOutlined, CalendarOutlined, DatabaseOutlined, AuditOutlined, FilterOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';
import axiosClient from '../../api/axiosClient';

const { Title, Text } = Typography;

const MonthlyReport = () => {
  const { message } = App.useApp(); 
  
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<any[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<dayjs.Dayjs>(dayjs());

  // --- LOGIC GIỮ NGUYÊN ---
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

  const handleExportExcel = () => {
    if (reportData.length === 0) {
        message.warning("Chưa có dữ liệu để xuất!");
        return;
    }
    const excelData = reportData.map((item, index) => ({
      "Stt": index + 1,
      "Mã vật tư": item.itemCode,
      "Tên vật tư": item.itemName,
      "Đvt": item.unit,
      [`TỒN CUỐI THÁNG ${selectedMonth.format('MM/YYYY')}`]: item.finalQuantity, 
      "Nhà máy": item.factoryName,
      "Kho": item.warehouseName,
      "Kệ": item.rack, 
      "Hộc": item.bin
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    worksheet['!cols'] = [{ wch: 6 }, { wch: 15 }, { wch: 40 }, { wch: 10 }, { wch: 15 }, { wch: 10 }, { wch: 20 }, { wch: 10 }, { wch: 10 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Ton_Kho_Thang");
    XLSX.writeFile(workbook, `BaoCao_TonKho_${selectedMonth.format('MM_YYYY')}.xlsx`);
  };

  const columns = [
    { title: 'STT', render: (_:any, __:any, idx:number) => idx + 1, width: 50, align: 'center' as const },
    { title: 'Mã VT', dataIndex: 'itemCode', width: 110, render: (t:string) => <span className="font-semibold text-slate-700">{t}</span> },
    { title: 'Tên vật tư', dataIndex: 'itemName', ellipsis: true }, // Thêm ellipsis để tự cắt nếu tên quá dài
    { title: 'ĐVT', dataIndex: 'unit', align: 'center' as const, width: 70 },
    { 
        title: `Tồn Cuối`, 
        dataIndex: 'finalQuantity', 
        align: 'right' as const,
        width: 100,
        render: (val: number | undefined | null) => {
            const safeVal = val ?? 0; 
            return <span className="font-bold text-blue-700">{safeVal.toLocaleString()}</span>;
        }
    },
    { 
        title: 'Vị trí', 
        children: [
            { title: 'Kho', dataIndex: 'warehouseName', width: 130, ellipsis: true },
            { title: 'Kệ/Hộc', width: 90, align: 'center' as const, render: (_:any, r:any) => <Tag bordered={false} className="m-0 bg-gray-100">{r.rack || '-'}/{r.bin || '-'}</Tag> }
        ]
    }
  ];

  const totalStock = reportData.reduce((acc, cur) => acc + (cur.finalQuantity || 0), 0);

  return (
    <div className="p-6 bg-gray-100 min-h-screen flex justify-center">
      
      {/* Container giới hạn chiều rộng (max-w-6xl ~ 1150px) để không bị kéo giãn */}
      <div className="w-full max-w-6xl flex flex-col gap-4">
        
        {/* --- HEADER CARD --- */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                {/* Title & Info */}
                <div>
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-50 text-blue-600 p-2 rounded-lg">
                            <BarChartOutlined style={{ fontSize: 24 }} />
                        </div>
                        <div>
                            <Title level={4} style={{ margin: 0, color: '#111827' }}>Báo cáo tồn kho</Title>
                            <Text type="secondary" className="text-xs">Kỳ dữ liệu: Tháng {selectedMonth.format('MM/YYYY')}</Text>
                        </div>
                    </div>
                </div>

                {/* Filter & Actions */}
                <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-lg border border-gray-100">
                    <DatePicker 
                        picker="month" 
                        value={selectedMonth} 
                        onChange={(val) => val && setSelectedMonth(val)} 
                        format="MM/YYYY"
                        allowClear={false}
                        bordered={false}
                        className="bg-white shadow-sm w-32 font-medium"
                        suffixIcon={<CalendarOutlined className="text-gray-400"/>}
                    />
                    <div className="h-6 w-px bg-gray-300 mx-1"></div>
                    <Button type="text" icon={<SearchOutlined />} onClick={fetchReport} loading={loading} className="text-gray-600 hover:text-blue-600 hover:bg-blue-50">
                        Xem
                    </Button>
                    <Button 
                        type="primary"
                        className="bg-green-600 hover:bg-green-500 shadow-sm" 
                        icon={<FileExcelOutlined />} 
                        onClick={handleExportExcel}
                        disabled={reportData.length === 0}
                    >
                        Excel
                    </Button>
                </div>
            </div>

            {/* Compact Statistics (Nằm gọn trong Header) */}
            {reportData.length > 0 && (
                <>
                    <Divider className="my-4" />
                    <Row gutter={24}>
                        <Col>
                            <Statistic 
                                title={<span className="text-xs text-gray-500 font-medium uppercase">Tổng mặt hàng</span>}
                                value={reportData.length} 
                                prefix={<AuditOutlined className="text-gray-400 mr-1"/>}
                                valueStyle={{ fontSize: 20, fontWeight: 600, color: '#374151' }}
                            />
                        </Col>
                        <Col>
                            <div className="h-full w-px bg-gray-100 mx-2"></div>
                        </Col>
                        <Col>
                            <Statistic 
                                title={<span className="text-xs text-gray-500 font-medium uppercase">Tổng tồn kho</span>}
                                value={totalStock} 
                                prefix={<DatabaseOutlined className="text-blue-500 mr-1"/>}
                                valueStyle={{ fontSize: 20, fontWeight: 600, color: '#2563eb' }}
                            />
                        </Col>
                    </Row>
                </>
            )}
        </div>

        {/* --- TABLE CARD --- */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex-1">
            <Table 
                columns={columns} 
                dataSource={reportData} 
                rowKey={(r) => `${r.itemCode}_${r.warehouseName}_${r.rack}_${r.bin}`} 
                loading={loading}
                pagination={{ pageSize: 15, showSizeChanger: true, size: 'small' }}
                size="small" // Bảng nhỏ gọn hơn
                scroll={{ y: 'calc(100vh - 400px)' }}
                bordered={false} // Bỏ viền dọc nhìn thoáng hơn
                rowClassName="hover:bg-gray-50 transition-colors cursor-default"
                locale={{ emptyText: <div className="py-10 text-gray-400 flex flex-col items-center"><FilterOutlined className="text-3xl mb-2 opacity-50"/><span>Chọn tháng và bấm xem dữ liệu</span></div> }}
            />
        </div>

      </div>
    </div>
  );
};

export default MonthlyReport;