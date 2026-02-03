// src/types/itam.types.ts

// 1. Interface cho Tài sản
export interface IAsset {
  id: string;
  name: string;          // Hostname / Tên thiết bị
  serialNumber?: string;
  status: 'NEW' | 'IN_USE' | 'BROKEN' | 'REPAIR' | 'DISPOSED';
  
  // Phân loại
  typeId: string;
  type?: { id: string; name: string; code: string };

  // Thông tin kỹ thuật
  manufacturer?: string;
  modelName?: string;
  osName?: string;
  ipAddress?: string;
  macAddress?: string;
  lastSeen?: string;

  // Cấu hình tóm tắt (JSON từ Backend)
  customSpecs?: {
    cpu?: string;
    ram?: string;
    disk?: string;      // Chuỗi tổng hợp "250GB + 1TB"
    lastAgentSync?: string;
  };

  // Vị trí
  factoryId?: string;
  factory?: { id: string; name: string };
  departmentId?: string;
  department?: { id: string; name: string };
  
  // [UPDATED] Quan hệ N-N: Danh sách người dùng (Thay cho currentUserId cũ)
  users?: { 
      id: string; 
      fullName: string; 
      email: string; 
  }[];

  // Quan hệ Cha - Con (Hierarchy)
  parentId?: string;
  parent?: { id: string; name: string };  // Máy mẹ
  children?: IAsset[];                    // Các thiết bị con đi kèm
}

// 2. Interface cho Param Search/Filter
export interface IAssetParams {
  page?: number;
  limit?: number;
  search?: string;
  typeId?: string;
  factoryId?: string;
  departmentId?: string;
  parentId?: string | 'null'; // 'null' để lọc thiết bị rời
  status?: string;
}