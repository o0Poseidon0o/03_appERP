import React, { useState, useEffect } from 'react';
import axiosClient from '../../api/axiosClient'; // Đã cập nhật import đúng chuẩn của bạn
import { FiSearch, FiDownload, FiAlertTriangle, FiRefreshCw, FiFilter } from 'react-icons/fi';

// 1. Định nghĩa kiểu dữ liệu khớp với Backend trả về
interface StockItem {
  id: string;
  itemCode: string;
  itemName: string;
  unit: string;
  category: string;
  locationCode: string;
  warehouseName: string;
  quantity: number;
  minStock: number;
  supplierName: string;
  isLow: boolean;
}

interface Warehouse {
  id: string;
  name: string;
}

const StockActual = () => {
  const [stocks, setStocks] = useState<StockItem[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(false);
  
  // State bộ lọc
  const [filters, setFilters] = useState({
    search: '',
    warehouseId: '',
    isLowStock: false,
    page: 1,
    limit: 20
  });

  const [pagination, setPagination] = useState({
    total: 0,
    totalPages: 1
  });

  // 2. Load danh sách kho
  useEffect(() => {
    const fetchWarehouses = async () => {
      try {
        // Gọi API lấy danh sách kho
        const response = await axiosClient.get('/warehouses'); 
        // Lưu ý: Cấu trúc response.data.data dựa trên controller của bạn
        setWarehouses(response.data?.data || []); 
      } catch (error) {
        console.error("Không tải được danh sách kho", error);
      }
    };
    fetchWarehouses();
  }, []);

  // 3. Gọi API lấy dữ liệu Tồn kho thực tế
  const fetchStocks = async () => {
    setLoading(true);
    try {
      // Sử dụng axiosClient gọi đúng endpoint đã gộp
      const response = await axiosClient.get('/stock-transactions/actual', { 
        params: {
          page: filters.page,
          limit: filters.limit,
          search: filters.search,
          warehouseId: filters.warehouseId || undefined,
          isLowStock: filters.isLowStock ? 'true' : undefined 
        } 
      });
      
      setStocks(response.data?.data || []);
      setPagination(response.data?.pagination || { total: 0, totalPages: 1 });
    } catch (error) {
      console.error("Lỗi tải tồn kho:", error);
    } finally {
      setLoading(false);
    }
  };

  // Debounce search và auto-fetch khi filter thay đổi
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchStocks();
    }, 500);
    return () => clearTimeout(timer);
  }, [filters]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters({ ...filters, search: e.target.value, page: 1 });
  };

  const handlePageChange = (newPage: number) => {
    setFilters(prev => ({ ...prev, page: newPage }));
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen font-sans">
      {/* Header & Stats */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            Tồn Kho Thực Tế
            {loading && <FiRefreshCw className="animate-spin text-gray-400 text-lg" />}
          </h1>
          <p className="text-gray-500 mt-1 text-sm">Xem số lượng và vị trí vật tư realtime</p>
        </div>
        <div className="flex gap-2">
           <button 
            onClick={() => fetchStocks()}
            className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition shadow-sm"
          >
            <FiRefreshCw /> Làm mới
          </button>
          <button className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition shadow-md">
            <FiDownload /> Xuất Excel
          </button>
        </div>
      </div>

      {/* Thanh công cụ lọc */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6 flex flex-col md:flex-row gap-4 items-center">
        {/* Tìm kiếm */}
        <div className="relative flex-1 w-full md:w-auto">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Tìm mã VT, tên VT..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition"
            value={filters.search}
            onChange={handleSearchChange}
          />
        </div>
        
        {/* Dropdown chọn kho (Dynamic Data) */}
        <div className="relative w-full md:w-auto">
            <FiFilter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <select 
              className="w-full md:w-auto pl-10 pr-8 py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-gray-700 bg-white appearance-none"
              value={filters.warehouseId}
              onChange={(e) => setFilters({...filters, warehouseId: e.target.value, page: 1})}
            >
              <option value="">-- Tất cả các kho --</option>
              {warehouses.length > 0 ? (
                  warehouses.map(wh => (
                      <option key={wh.id} value={wh.id}>{wh.name}</option>
                  ))
              ) : (
                  <option disabled>Đang tải danh sách kho...</option>
              )}
            </select>
        </div>

        {/* Checkbox lọc hàng sắp hết */}
        <label className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border cursor-pointer transition select-none ${filters.isLowStock ? 'bg-red-50 border-red-200 text-red-700' : 'bg-white border-gray-300 text-gray-600'}`}>
          <input 
            type="checkbox" 
            checked={filters.isLowStock}
            onChange={(e) => setFilters({...filters, isLowStock: e.target.checked, page: 1})}
            className="w-4 h-4 text-red-600 rounded focus:ring-red-500"
          />
          <span className="font-medium text-sm">Cảnh báo tồn thấp</span>
        </label>
      </div>

      {/* Bảng dữ liệu */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-600 text-xs font-bold uppercase tracking-wider border-b border-gray-200">
                <th className="px-6 py-4">Mã VT</th>
                <th className="px-6 py-4">Tên Vật Tư</th>
                <th className="px-6 py-4">Vị Trí (Bin)</th>
                <th className="px-6 py-4 text-center">Số Lượng</th>
                <th className="px-6 py-4 text-center">ĐVT</th>
                <th className="px-6 py-4">Kho</th>
                <th className="px-6 py-4">Nhà Cung Cấp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {loading && stocks.length === 0 ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={7} className="px-6 py-4 bg-gray-50 border-b border-white">
                      <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto"></div>
                    </td>
                  </tr>
                ))
              ) : stocks.length === 0 ? (
                <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500 flex flex-col items-center justify-center">
                        <div className="bg-gray-100 p-4 rounded-full mb-3">
                            <FiSearch className="text-2xl text-gray-400" />
                        </div>
                        <p className="font-medium">Không tìm thấy dữ liệu tồn kho phù hợp.</p>
                    </td>
                </tr>
              ) : (
                stocks.map((item) => (
                  <tr key={item.id} className="hover:bg-blue-50 transition duration-150 group">
                    <td className="px-6 py-4 font-semibold text-blue-600 whitespace-nowrap">
                      {item.itemCode}
                    </td>
                    <td className="px-6 py-4 text-gray-800">
                      <div className="font-medium text-base">{item.itemName}</div>
                      <div className="text-xs text-gray-500 mt-1 inline-block bg-gray-100 px-2 py-0.5 rounded">{item.category}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="bg-indigo-50 text-indigo-700 px-2 py-1 rounded border border-indigo-100 font-mono font-medium">
                        {item.locationCode}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border ${
                        item.isLow 
                            ? 'bg-red-50 text-red-700 border-red-200 font-bold' 
                            : 'bg-white text-gray-800 border-transparent font-semibold'
                      }`}>
                        {item.quantity.toLocaleString()}
                        {item.isLow && <FiAlertTriangle className="text-red-500" title={`Tồn kho thấp hơn mức quy định (${item.minStock})`} />}
                      </div>
                      {item.isLow && (
                        <div className="text-[10px] text-red-500 mt-1">Min: {item.minStock}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center text-gray-600">{item.unit}</td>
                    <td className="px-6 py-4 text-gray-600 whitespace-nowrap">{item.warehouseName}</td>
                    <td className="px-6 py-4 text-gray-500 italic max-w-[200px] truncate" title={item.supplierName}>
                      {item.supplierName !== 'N/A' ? item.supplierName : <span className="text-gray-300">-</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-6 py-4 border-t border-gray-200 flex flex-col md:flex-row justify-between items-center gap-4 bg-gray-50">
          <span className="text-sm text-gray-600">
            Hiển thị <b>{stocks.length}</b> trên tổng <b>{pagination.total}</b> dòng
          </span>
          <div className="flex gap-2">
            <button 
              disabled={filters.page === 1}
              onClick={() => handlePageChange(filters.page - 1)}
              className="px-4 py-2 text-sm border border-gray-300 bg-white rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              Trước
            </button>
            <span className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg font-medium shadow-sm">
              Trang {filters.page} / {pagination.totalPages}
            </span>
            <button 
              disabled={filters.page >= pagination.totalPages}
              onClick={() => handlePageChange(filters.page + 1)}
              className="px-4 py-2 text-sm border border-gray-300 bg-white rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              Sau
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StockActual;