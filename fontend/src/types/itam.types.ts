// src/types/itam.types.ts

// 1. Interface cho Phần mềm đã cài (Dùng trong chi tiết tài sản)
export interface IInstalledSoftware {
  id: string;
  name: string;
  version?: string;
  publisher?: string;
  installDate?: string;
}

// 2. Interface cho Linh kiện (Ổ cứng, RAM rời...)
export interface IAssetComponent {
  id: string;
  type: string; // 'HARD_DISK', 'RAM', etc.
  name: string;
  specs?: any;  // JSON chứa sizeGB, type...
}

// 3. Interface Chính cho Tài sản
export interface IAsset {
  id: string;
  name: string;          // Hostname / Tên thiết bị
  serialNumber?: string;
  status: 'NEW' | 'IN_USE' | 'BROKEN' | 'REPAIR' | 'DISPOSED';
  
  // Phân loại
  typeId: string;
  type?: { id: string; name: string; code: string };

  // Thông tin kỹ thuật (Agent gửi về)
  manufacturer?: string;
  modelName?: string;
  osName?: string;
  osVersion?: string;    // [NEW] Phiên bản OS (vd: 22H2)
  ipAddress?: string;
  macAddress?: string;
  lastSeen?: string;

  // [NEW] User Domain thực tế đang ngồi máy (VD: "TOWA\NguyenVanA")
  domainUser?: string;

  // Cấu hình tóm tắt (JSON)
  customSpecs?: {
    cpu?: string;
    ram?: string;
    disk?: string;      // Chuỗi tổng hợp "250GB (SSD) + 1TB (HDD)"
    lastAgentSync?: string;
  };

  // Vị trí & Tổ chức
  factoryId?: string;
  factory?: { id: string; name: string };
  departmentId?: string;
  department?: { id: string; name: string };
  
  // Quan hệ N-N: Danh sách người dùng được biên chế (Admin gán)
  users?: { 
      id: string; 
      fullName: string; 
      email: string; 
  }[];

  // Quan hệ Cha - Con (Hierarchy)
  parentId?: string;
  parent?: { id: string; name: string };  // Máy mẹ
  children?: IAsset[];                    // Các thiết bị con đi kèm

  // [NEW] Chi tiết (Dùng khi getById)
  softwares?: IInstalledSoftware[];
  components?: IAssetComponent[];

  // [NEW] Số lượng (Dùng để hiển thị Badge trên bảng)
  _count?: {
    softwares?: number;
    children?: number;
  };
}

// 4. Interface cho Param Search/Filter
export interface IAssetParams {
  page?: number;
  limit?: number;
  search?: string;     // Tìm theo tên, IP, Serial, User Domain...
  typeId?: string;
  factoryId?: string;
  departmentId?: string;
  parentId?: string | 'null'; // 'null' để lọc thiết bị rời
  status?: string;
}