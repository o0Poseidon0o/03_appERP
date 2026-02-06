import axiosClient from "../api/axiosClient"; 
import type { IAsset, IAssetParams } from "../types/itam.types";

const URL = '/assets'; 

export const assetService = {
  // 1. Lấy danh sách tài sản (Pagination & Filter)
  getAll: (params: IAssetParams) => {
    return axiosClient.get(URL, { params });
  },

  // 2. Lấy chi tiết tài sản
  getById: (id: string) => {
    return axiosClient.get(`${URL}/${id}`);
  },

  // 3. Tạo mới tài sản
  create: (data: Partial<IAsset>) => {
    return axiosClient.post(URL, data);
  },

  // 4. Cập nhật tài sản
  update: (id: string, data: Partial<IAsset>) => {
    return axiosClient.patch(`${URL}/${id}`, data);
  },

  // 5. Xóa tài sản
  delete: (id: string) => {
    return axiosClient.delete(`${URL}/${id}`);
  },

  // 6. [UPDATE] Lấy danh sách Loại tài sản từ API Backend
  getAssetTypes: () => {
    // Gọi về route: GET /api/asset-types
    return axiosClient.get('/asset-types');
  }
};