import axiosClient from "../api/axiosClient";

export interface SoftwarePolicyInfo {
  id: string | null;
  name: string;
  matchKeyword: string;
  category: "LICENSED" | "BLACKLIST" | "FREE";
  totalSeats: number;
  keyCount: number;
  assignedKeyCount: number;
  note?: string | null;
}

export interface SoftwareSummary {
  name: string;
  publisher: string;
  installCount: number;
  policy?: SoftwarePolicyInfo | null;
}

export interface SoftwareDetail {
  version: string;
  publisher?: string;
  installDate: string;
  asset: {
    id: string;
    name: string; // Hostname
    domainUser: string | null;
    modelName?: string | null;
    manufacturer?: string | null;
    ipAddress?: string | null;
    serialNumber?: string | null;
    department: {
      id?: string;
      name: string;
    } | null;
    factory?: {
      id?: string;
      name: string;
    } | null;
    users?: Array<{
      id: string;
      fullName: string;
      email: string;
    }>;
  };
}

export interface SoftwarePolicyItem {
  id: string;
  name: string;
  matchKeyword: string;
  category: "LICENSED" | "BLACKLIST" | "FREE";
  totalSeats: number;
  publisher?: string | null;
  note?: string | null;
  installedCount?: number;
  keyCount?: number;
  keyTotalSeats?: number;
  assignedSeats?: number;
  effectiveSeats?: number;
}

export interface SoftwareKeyAssignmentItem {
  id: string;
  keyId: string;
  assetId: string;
  assignedAt: string;
  note?: string | null;
  asset: {
    id: string;
    name: string;
    serialNumber?: string | null;
    ipAddress?: string | null;
    domainUser?: string | null;
    modelName?: string | null;
    department?: { id: string; name: string } | null;
    factory?: { id: string; name: string } | null;
  };
}

export interface SoftwareLicenseKeyItem {
  id: string;
  policyId: string;
  policy: SoftwarePolicyItem;
  licenseKey: string;
  keyType: "SUBSCRIPTION" | "VOLUME" | "MAK" | "RETAIL" | "OEM";
  maxSeats: number;
  expiredAt?: string | null;
  supplier?: string | null;
  invoiceCode?: string | null;
  status: "ACTIVE" | "EXPIRED" | "REVOKED";
  note?: string | null;
  assignments: SoftwareKeyAssignmentItem[];
  assignedCount: number;
  remainingSeats: number;
  daysUntilExpiry: number | null;
  computedStatus: "ACTIVE" | "EXPIRING_SOON" | "EXPIRED" | "REVOKED";
  createdAt: string;
}

export const softwareService = {
  // 1. Lấy danh sách tổng hợp (kèm đối chiếu License & Blacklist)
  getInventory: async () => {
    return axiosClient.get("/itam/software/inventory");
  },

  // 2. Lấy chi tiết cài đặt của 1 phần mềm
  getInstallations: async (softwareName: string) => {
    return axiosClient.get("/itam/software/detail", {
      params: { name: softwareName },
    });
  },

  // 3. Lấy toàn bộ dữ liệu để xuất Excel báo cáo
  exportAll: async () => {
    return axiosClient.get("/itam/software/export-all");
  },

  // 4. Chuẩn hóa & làm gọn dữ liệu phần mềm đã lưu trong DB
  cleanupInventory: async () => {
    return axiosClient.post("/itam/software/cleanup");
  },

  // 5. Quản lý Chính sách Phần mềm (Bản quyền / Blacklist / Free)
  getPolicies: async () => {
    return axiosClient.get("/itam/software/policies");
  },

  upsertPolicy: async (payload: {
    name: string;
    matchKeyword?: string;
    category: "LICENSED" | "BLACKLIST" | "FREE";
    totalSeats?: number;
    publisher?: string;
    note?: string;
  }) => {
    return axiosClient.post("/itam/software/policies", payload);
  },

  updatePolicy: async (
    id: string,
    payload: Partial<{
      name: string;
      matchKeyword: string;
      category: "LICENSED" | "BLACKLIST" | "FREE";
      totalSeats: number;
      publisher: string;
      note: string;
    }>
  ) => {
    return axiosClient.patch(`/itam/software/policies/${id}`, payload);
  },

  deletePolicy: async (id: string) => {
    return axiosClient.delete(`/itam/software/policies/${id}`);
  },

  // 6. Quản lý Key Bản quyền (Kaspersky, Office, AutoCAD, Windows...)
  getLicenseKeys: async () => {
    return axiosClient.get("/itam/software/keys");
  },

  createLicenseKey: async (payload: {
    policyId?: string;
    softwareName?: string;
    matchKeyword?: string;
    publisher?: string;
    licenseKey: string;
    keyType: string;
    maxSeats: number;
    expiredAt?: string | null;
    supplier?: string;
    invoiceCode?: string;
    status?: string;
    note?: string;
    assetIds?: string[];
  }) => {
    return axiosClient.post("/itam/software/keys", payload);
  },

  updateLicenseKey: async (
    id: string,
    payload: Partial<{
      policyId: string;
      licenseKey: string;
      keyType: string;
      maxSeats: number;
      expiredAt: string | null;
      supplier: string;
      invoiceCode: string;
      status: string;
      note: string;
      assetIds: string[];
    }>
  ) => {
    return axiosClient.patch(`/itam/software/keys/${id}`, payload);
  },

  deleteLicenseKey: async (id: string) => {
    return axiosClient.delete(`/itam/software/keys/${id}`);
  },

  assignLicenseKey: async (id: string, assetIds: string[], note?: string) => {
    return axiosClient.post(`/itam/software/keys/${id}/assign`, {
      assetIds,
      note,
    });
  },

  unassignLicenseKey: async (id: string, assetId: string) => {
    return axiosClient.delete(`/itam/software/keys/${id}/assign/${assetId}`);
  },
};
