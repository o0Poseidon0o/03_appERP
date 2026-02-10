import axiosClient from '../api/axiosClient'; // Import axiosClient của bạn

export interface SoftwareSummary {
  name: string;
  publisher: string;
  installCount: number;
}

export interface SoftwareDetail {
  version: string;
  installDate: string;
  asset: {
    id: string;
    name: string; // Hostname
    domainUser: string | null;
    model: string | null;
    department: {
      name: string;
    } | null;
  };
}

export const softwareService = {
  // 1. Lấy danh sách tổng hợp
  getInventory: async () => {
    // Gọi vào: /api/itam/software/inventory
    return axiosClient.get('/itam/software/inventory');
  },

  // 2. Lấy chi tiết cài đặt của 1 phần mềm
  getInstallations: async (softwareName: string) => {
    // Gọi vào: /api/itam/software/detail?name=...
    return axiosClient.get('/itam/software/detail', {
      params: { name: softwareName }
    });
  }
};