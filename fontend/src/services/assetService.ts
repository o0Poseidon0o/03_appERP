import axiosClient from "../api/axiosClient"; // Import file axios của bạn
import type { IAsset, IAssetParams } from "../types/itam.types";

const URL = '/assets'; // Prefix đã khai báo ở app.ts backend

export const assetService = {
  // 1. Lấy danh sách (Pagination & Filter)
  getAll: (params: IAssetParams) => {
    return axiosClient.get(URL, { params });
  },

  // 2. Lấy chi tiết
  getById: (id: string) => {
    return axiosClient.get(`${URL}/${id}`);
  },

  // 3. Tạo mới (Thủ công)
  create: (data: Partial<IAsset>) => {
    return axiosClient.post(URL, data);
  },

  // 4. Cập nhật
  update: (id: string, data: Partial<IAsset>) => {
    return axiosClient.patch(`${URL}/${id}`, data);
  },

  // 5. Xóa
  delete: (id: string) => {
    return axiosClient.delete(`${URL}/${id}`);
  },

  // 6. Lấy danh sách Loại tài sản (Mock tạm hoặc gọi API nếu có)
  getAssetTypes: async () => {
    // Nếu chưa có API backend cho AssetType, ta hardcode tạm để chạy UI
    return [
      { id: 'uuid-pc', name: 'Máy tính (PC)', code: 'PC' },
      { id: 'uuid-laptop', name: 'Laptop', code: 'LAPTOP' },
      { id: 'uuid-monitor', name: 'Màn hình', code: 'MONITOR' },
      { id: 'uuid-mouse', name: 'Chuột', code: 'MOUSE' },
      { id: 'uuid-keyboard', name: 'Bàn phím', code: 'KEYBOARD' },
      { id: 'uuid-printer', name: 'Máy in', code: 'PRINTER' },
    ];
    // Khi nào có API: return axiosClient.get('/asset-types');
  }
};